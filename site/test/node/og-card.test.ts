import { describe, it, expect } from "vitest";
import { buildOgCard } from "../../src/lib/og-card";

const base = {
  siteName: "vulinh.dev",
  title: "Reading a DS record",
  tagLabels: ["DNS"],
  date: "2026-08-24",
};

// A helper that walks the satori node tree and collects every string child, so
// assertions read against content rather than against nesting depth.
function textOf(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(textOf);
  if (node && typeof node === "object" && "props" in node) {
    return textOf((node as { props: { children?: unknown } }).props.children);
  }
  return [];
}

describe("buildOgCard", () => {
  it("puts the site name, the title and the date on the card", () => {
    const text = textOf(buildOgCard(base));
    expect(text).toContain("vulinh.dev");
    expect(text).toContain("Reading a DS record");
    // The date shares the footer line with the tags, so it is a substring of a
    // node rather than a node of its own. What matters is that it is on the
    // card, not which element carries it.
    expect(text.join(" ")).toContain("2026-08-24");
  });

  it("renders Vietnamese diacritics as text, not as replacement characters", () => {
    const text = textOf(buildOgCard({ ...base, title: "Đọc một record DS — chữ ế ữ ợ" }));
    expect(text.join(" ")).toContain("Đọc một record DS — chữ ế ữ ợ");
  });

  it("omits the tag line entirely when a post carries no tags", () => {
    const text = textOf(buildOgCard({ ...base, tagLabels: [] }));
    expect(text.join(" ")).not.toContain("undefined");
    expect(text).not.toContain("");
  });

  it("shrinks the title for a long one instead of letting it overflow", () => {
    const short = buildOgCard(base);
    const long = buildOgCard({ ...base, title: "A".repeat(120) });
    expect(titleFontSize(long)).toBeLessThan(titleFontSize(short));
  });
});

// The title sits second in the card, under the site name. Reaching for it
// through a named helper keeps the type assertion in one place instead of
// spelling the whole cast out inside an expect().
function titleFontSize(card: ReturnType<typeof buildOgCard>): number {
  const children = card.props.children as { props: { style: { fontSize: number } } }[];
  return children[1].props.style.fontSize;
}
