import { describe, it, expect } from "vitest";
import { splitFrontmatter, joinFrontmatter, translatableEntries } from "../lib/frontmatter";

const DOC = `---
title: "Hello, bilingual world"
description: "The first post."
---

Intro.

\`\`\`java
record X() {}
\`\`\`
`;

describe("splitFrontmatter", () => {
  it("separates the front matter from the body", () => {
    const { data, body } = splitFrontmatter(DOC);
    expect(data.title).toBe("Hello, bilingual world");
    expect(data.description).toBe("The first post.");
    expect(body).toContain("Intro.");
    expect(body).not.toContain("---");
  });

  it("throws when a post has no front matter", () => {
    // Every post carries a title and a description. A file without them is not
    // a post that needs translating, it is a mistake worth stopping on.
    expect(() => splitFrontmatter("Just prose.\n")).toThrow(/front matter/i);
  });

  it("keeps fields it does not know about", () => {
    const { data } = splitFrontmatter(
      '---\ntitle: "T"\ndescription: "D"\nhero: ./assets/x.png\n---\n\nBody.\n',
    );
    expect(data.hero).toBe("./assets/x.png");
  });
});

describe("joinFrontmatter", () => {
  it("round-trips a document when nothing was translated", () => {
    const { raw, body } = splitFrontmatter(DOC);
    expect(joinFrontmatter(raw, {}, body)).toBe(DOC);
  });

  it("replaces only the values it was given", () => {
    const { raw, body } = splitFrontmatter(DOC);
    const out = joinFrontmatter(raw, { title: "Xin chào thế giới song ngữ" }, body);
    expect(out).toContain('title: "Xin chào thế giới song ngữ"');
    expect(out).toContain('description: "The first post."');
  });

  // The point of editing the parsed block instead of rebuilding it: a field
  // this script knows nothing about comes out exactly as the author wrote it,
  // quote style and all. A path that gets quoted "helpfully" is a diff nobody
  // asked for; a path that gets translated is a broken image.
  it("carries an unknown field through in the author's own style", () => {
    const source = '---\ntitle: "T"\ndescription: "D"\nhero: ./assets/x.png\n---\n\nBody.\n';
    const { raw, body } = splitFrontmatter(source);
    const out = joinFrontmatter(raw, { title: "Tê" }, body);
    expect(out).toContain("hero: ./assets/x.png");
    expect(out).not.toContain('hero: "./assets/x.png"');
  });

  it("keeps a comment written in the front matter", () => {
    const source = '---\n# why this title\ntitle: "T"\ndescription: "D"\n---\n\nBody.\n';
    const { raw, body } = splitFrontmatter(source);
    expect(joinFrontmatter(raw, { title: "Tê" }, body)).toContain("# why this title");
  });

  it("keeps a long description on one line", () => {
    // YAML folds long strings by default. A description wrapped across lines
    // still parses, but it makes every later diff of that file unreadable.
    const { raw, body } = splitFrontmatter(DOC);
    const long = "Một câu rất dài ".repeat(20) + "hết.";
    const out = joinFrontmatter(raw, { description: long }, body);
    const line = out.split("\n").find((l) => l.startsWith("description:"))!;
    expect(line).toContain("hết.");
  });

  it("keeps the double quotes when a translated value contains a colon", () => {
    // "Virtual threads: how they park" is a plain YAML syntax error unquoted.
    const { raw, body } = splitFrontmatter(DOC);
    const out = joinFrontmatter(raw, { title: "Virtual thread: cách nó park" }, body);
    expect(splitFrontmatter(out).data.title).toBe("Virtual thread: cách nó park");
  });
});

describe("translatableEntries", () => {
  it("offers up title and description and nothing else", () => {
    const { data } = splitFrontmatter(
      '---\ntitle: "T"\ndescription: "D"\nhero: ./assets/x.png\n---\n\nBody.\n',
    );
    expect(translatableEntries(data)).toEqual([
      ["title", "T"],
      ["description", "D"],
    ]);
  });
});
