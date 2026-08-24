// Some spans of a post must survive translation byte-for-byte: code, and every
// path or URL. The model is not asked to leave them alone — it is never given
// the chance to touch them. Each span is lifted out, replaced with a
// placeholder, and put back verbatim afterwards.
//
// Where a construct mixes both kinds, only the machine-readable half is lifted.
// An image carries a path AND alt text; the path is locked and the alt text
// travels on to the model, because a Vietnamese reader on a screen reader needs
// Vietnamese alt text. Same for a link's text, an image title, and the fallback
// prose inside a <video> element.

export type ProtectedKind = "CODE" | "SPAN" | "URL";

export interface ProtectedToken {
  kind: ProtectedKind;
  value: string;
}

export interface Extraction {
  text: string;
  tokens: ProtectedToken[];
}

const placeholderFor = (kind: ProtectedKind, index: number) => `⟦${kind}_${index}⟧`;

interface Rule {
  kind: ProtectedKind;
  pattern: RegExp;
  // Rebuilds the matched text with the locked half swapped for a placeholder.
  // Whatever is returned around `lock(...)` stays translatable.
  rebuild: (match: RegExpMatchArray, lock: (value: string) => string) => string;
}

// A fence opener, used to catch one that was never closed.  CommonMark allows
// up to three spaces of indent, which is what a fence inside a list item gets.
const FENCE_OPENER = /^ {0,3}(?:`{3,}|~{3,})/m;

// Order is not cosmetic. A code block can contain something that looks like an
// image or a URL, so fences are lifted first and the later rules only ever see
// prose. Inline spans come next for the same reason: `curl https://…` is code.
// Bare URLs go last, once every URL that belongs to a link, an attribute or a
// reference definition has already been claimed.
const RULES: Rule[] = [
  {
    // Fenced block. The closing run must match the opening run exactly, so a
    // longer run of backticks inside the block cannot close it early.
    kind: "CODE",
    pattern: /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[ \t]*$/gm,
    rebuild: (match, lock) => lock(match[0]),
  },
  {
    // Inline span. A run of N backticks is closed by a run of exactly N.
    kind: "SPAN",
    pattern: /(`+)(?:[\s\S]*?[^`])?\1(?!`)/g,
    rebuild: (match, lock) => lock(match[0]),
  },
  {
    kind: "URL",
    pattern: /<(?:https?|mailto|ftp):[^\s<>]*>/gi,
    rebuild: (match, lock) => lock(match[0]),
  },
  {
    // Every markdown destination, keyed on `](` alone. Links and images share
    // one rule that way, and an image nested inside a link — [![alt](a)](b) —
    // falls out for free instead of tripping a bracket-counting regex.
    // The destination may carry balanced parentheses, as Wikipedia URLs do.
    kind: "URL",
    pattern: /\]\((\s*)(<[^>\n]*>|(?:[^\s()]|\([^\s()]*\))+)/g,
    rebuild: (match, lock) => `](${match[1]}${lock(match[2])}`,
  },
  {
    // Raw HTML passes straight through an Astro markdown file, and a video has
    // to be written as a tag because markdown has no syntax for one. Only the
    // attribute VALUE is locked, so alt= and the element's own text still go to
    // the model.
    kind: "URL",
    pattern: /\b(src|srcset|href|poster|data-src)(\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)/gi,
    rebuild: (match, lock) => `${match[1]}${match[2]}${lock(match[3])}`,
  },
  {
    // A reference link definition: the line that actually holds the URL.
    kind: "URL",
    pattern: /^( {0,3}\[[^\]\n]+\]:[ \t]*)(<[^>\n]*>|\S+)/gm,
    rebuild: (match, lock) => `${match[1]}${lock(match[2])}`,
  },
  {
    // A bare URL in prose. The regex swallows the sentence's full stop, so it
    // is handed back to the prose rather than locked inside the token.
    kind: "URL",
    pattern: /\bhttps?:\/\/[^\s<>()[\]"'`]+/gi,
    rebuild: (match, lock) => {
      const url = match[0].replace(/[.,;:!?]+$/, "");
      return lock(url) + match[0].slice(url.length);
    },
  },
];

export function extractProtected(markdown: string): Extraction {
  const tokens: ProtectedToken[] = [];
  let text = markdown;

  for (const rule of RULES) {
    text = text.replace(rule.pattern, (...args: unknown[]) => {
      // String.replace hands the callback the same shape as a match array,
      // trailed by the offset and the whole string.
      const match = args.slice(0, -2) as unknown as RegExpMatchArray;
      return rule.rebuild(match, (value) => {
        tokens.push({ kind: rule.kind, value });
        return placeholderFor(rule.kind, tokens.length - 1);
      });
    });

    if (rule.kind === "CODE" && FENCE_OPENER.test(text)) {
      throw new Error(
        "Unclosed code fence: an opening fence has no matching closing fence, " +
          "so the code inside it would be sent to the translation model",
      );
    }
  }

  return { text, tokens };
}

export function restoreProtected(text: string, tokens: ProtectedToken[]): string {
  let restored = text;

  for (let index = 0; index < tokens.length; index += 1) {
    const { kind, value } = tokens[index];
    const placeholder = placeholderFor(kind, index);

    if (!restored.includes(placeholder)) {
      throw new Error(
        `Placeholder ${placeholder} is missing from the translated text — the model dropped or rewrote it`,
      );
    }

    // The replacement is a function on purpose: a code block holding $&, $1 or
    // $$ is ordinary in a shell or regex example, and the string form of
    // replace would read those as backreferences and corrupt the block.
    restored = restored.replace(placeholder, () => value);
  }

  return restored;
}

const keyOf = (token: ProtectedToken) => `${token.kind} ${token.value}`;

const preview = (token: ProtectedToken) => {
  const flat = token.value.replace(/\n/g, "\\n");
  const body = flat.length > 120 ? `${flat.slice(0, 120)}…` : flat;
  return `  ${token.kind}: ${body}`;
};

function countByKey(tokens: ProtectedToken[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(keyOf(token), (counts.get(keyOf(token)) ?? 0) + 1);
  }
  return counts;
}

/**
 * The guarantee is about content, not position: every protected span in the
 * output is byte-identical to one in the input, none lost and none invented.
 * Order is deliberately not checked — a translator that swaps two links to fit
 * Vietnamese word order broke nothing, and failing on that would train the
 * author to bypass the guard.
 */
export function assertProtectedIntact(original: string, restored: string): void {
  const before = extractProtected(original).tokens;
  const after = extractProtected(restored).tokens;

  const beforeCounts = countByKey(before);
  const afterCounts = countByKey(after);

  const missing = before.filter((token) => {
    const remaining = afterCounts.get(keyOf(token)) ?? 0;
    if (remaining === 0) return true;
    afterCounts.set(keyOf(token), remaining - 1);
    return false;
  });

  const invented = after.filter((token) => {
    const remaining = beforeCounts.get(keyOf(token)) ?? 0;
    if (remaining === 0) return true;
    beforeCounts.set(keyOf(token), remaining - 1);
    return false;
  });

  if (missing.length === 0 && invented.length === 0) return;

  const report = ["Protected spans changed between source and output."];
  if (missing.length > 0) {
    report.push(`missing from output (${missing.length}):`, ...missing.map(preview));
  }
  if (invented.length > 0) {
    report.push(`invented in output (${invented.length}):`, ...invented.map(preview));
  }
  throw new Error(report.join("\n"));
}
