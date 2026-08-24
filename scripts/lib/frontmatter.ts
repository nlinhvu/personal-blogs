// The translation model never sees front matter. It is split off here, its two
// prose values are translated as separate strings, and the block is put back by
// editing the parsed YAML in place.
//
// The alternative — leaving the `---` fence in the text and telling the model
// to keep it intact and translate only two of the keys — is the same mistake
// the protection guard exists to avoid: asking the model to be careful with
// something structural. A model that drops a delimiter or renames a key
// produces a file that fails to parse, and a model that translates a path in
// some future field produces one that parses and is quietly wrong.
//
// Editing in place rather than re-serialising matters for the same reason:
// every field this script knows nothing about comes back exactly as the author
// wrote it, comments and quote style included.
import { parseDocument, Scalar } from "yaml";

export interface Frontmatter {
  [key: string]: unknown;
}

export interface Document {
  data: Frontmatter;
  /** The YAML text between the two fences, untouched. */
  raw: string;
  body: string;
}

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

export function splitFrontmatter(markdown: string): Document {
  const match = markdown.match(FENCE);
  if (!match) {
    throw new Error(
      "No front matter found: a post must open with a --- block carrying its title and description",
    );
  }

  const doc = parseDocument(match[1]);
  return {
    data: (doc.toJS() ?? {}) as Frontmatter,
    raw: match[1],
    body: markdown.slice(match[0].length),
  };
}

export function joinFrontmatter(
  raw: string,
  updates: Record<string, string>,
  body: string,
): string {
  const doc = parseDocument(raw);

  for (const [key, value] of Object.entries(updates)) {
    const node = doc.get(key, true);
    if (node instanceof Scalar) {
      // Assigning to the existing node keeps its declared style, so a value the
      // author double-quoted stays double-quoted. That is not cosmetic: a
      // translated title carrying a colon is a YAML syntax error unquoted.
      node.value = value;
    } else {
      doc.set(key, doc.createNode(value, { flow: false }));
      const created = doc.get(key, true);
      if (created instanceof Scalar) created.type = Scalar.QUOTE_DOUBLE;
    }
  }

  // lineWidth 0 turns off folding: a long description broken across lines still
  // parses, but it makes every later diff of that file unreadable.
  const yaml = doc.toString({ lineWidth: 0 }).trimEnd();

  return `---\n${yaml}\n---\n${body.startsWith("\n") ? "" : "\n"}${body}`;
}

/**
 * The front matter keys that hold prose. Everything else — dates, paths, flags
 * — is carried through untouched, which is why a future `heroImage` field
 * cannot be translated into a broken path.
 */
export const TRANSLATABLE_KEYS = ["title", "description"] as const;

export function translatableEntries(data: Frontmatter): [string, string][] {
  return TRANSLATABLE_KEYS.filter((key) => typeof data[key] === "string").map((key) => [
    key,
    data[key] as string,
  ]);
}
