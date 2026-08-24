import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { translatePost, assertPlausibleLength } from "../translate";

const META = "pubDate: 2026-08-21T09:00:00+07:00\ntags: [spring-boot]\nsource: en\n";

const EN = `---
title: "Hello"
description: "A post."
---

Intro.

\`\`\`java
record X() {}
\`\`\`

![A parked thread](./assets/park.png)

See [the feed](/rss.xml).
`;

function postDir(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "tr-"));
  mkdirSync(join(root, "blog", "a"), { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(root, "blog", "a", name), body, "utf8");
  }
  return root;
}

// Stand-in for the model. It translates the few phrases it knows and leaves
// everything else — placeholders included — exactly as it found it.
const DICTIONARY: Record<string, string> = {
  "Intro.": "Mở đầu.",
  "A parked thread": "Một thread đang park",
  "the feed": "feed",
  Hello: "Xin chào",
  "A post.": "Một bài.",
};

const fakeTranslate = vi.fn(async (text: string) => {
  let out = text;
  for (const [en, vi] of Object.entries(DICTIONARY)) out = out.replaceAll(en, vi);
  return out;
});

const read = (root: string, name: string) => readFileSync(join(root, "blog", "a", name), "utf8");

describe("translatePost", () => {
  it("writes the target file with the prose translated", async () => {
    const root = postDir({ "post.yaml": META, "en.md": EN });
    await translatePost({ contentRoot: root, slug: "a", translate: fakeTranslate });
    expect(read(root, "vi.md")).toContain("Mở đầu.");
    rmSync(root, { recursive: true });
  });

  it("translates the title and description in the front matter", async () => {
    const root = postDir({ "post.yaml": META, "en.md": EN });
    await translatePost({ contentRoot: root, slug: "a", translate: fakeTranslate });
    const out = read(root, "vi.md");
    expect(out).toContain('title: "Xin chào"');
    expect(out).toContain('description: "Một bài."');
    rmSync(root, { recursive: true });
  });

  it("never shows the model a front matter delimiter", async () => {
    const root = postDir({ "post.yaml": META, "en.md": EN });
    const seen: string[] = [];
    await translatePost({
      contentRoot: root,
      slug: "a",
      translate: async (text) => {
        seen.push(text);
        return fakeTranslate(text);
      },
    });
    // The `---` fence is structure. It is rebuilt here, never sent out and
    // hoped for.
    for (const text of seen) expect(text).not.toContain("---");
    rmSync(root, { recursive: true });
  });

  it("keeps the code block byte-identical", async () => {
    const root = postDir({ "post.yaml": META, "en.md": EN });
    await translatePost({ contentRoot: root, slug: "a", translate: fakeTranslate });
    expect(read(root, "vi.md")).toContain("record X() {}");
    rmSync(root, { recursive: true });
  });

  it("keeps the image path while translating its alt text", async () => {
    const root = postDir({ "post.yaml": META, "en.md": EN });
    await translatePost({ contentRoot: root, slug: "a", translate: fakeTranslate });
    expect(read(root, "vi.md")).toContain("![Một thread đang park](./assets/park.png)");
    rmSync(root, { recursive: true });
  });

  it("keeps the link url while translating its link text", async () => {
    const root = postDir({ "post.yaml": META, "en.md": EN });
    await translatePost({ contentRoot: root, slug: "a", translate: fakeTranslate });
    expect(read(root, "vi.md")).toContain("[feed](/rss.xml)");
    rmSync(root, { recursive: true });
  });

  it("refuses to overwrite an existing target without force", async () => {
    const root = postDir({ "post.yaml": META, "en.md": EN, "vi.md": "hand edited" });
    await expect(
      translatePost({ contentRoot: root, slug: "a", translate: fakeTranslate }),
    ).rejects.toThrow(/--force/);
    expect(read(root, "vi.md")).toBe("hand edited");
    rmSync(root, { recursive: true });
  });

  it("overwrites when force is set", async () => {
    const root = postDir({ "post.yaml": META, "en.md": EN, "vi.md": "hand edited" });
    await translatePost({ contentRoot: root, slug: "a", translate: fakeTranslate, force: true });
    expect(read(root, "vi.md")).toContain("Mở đầu.");
    rmSync(root, { recursive: true });
  });

  it("writes nothing when the model mangles a code block", async () => {
    const root = postDir({ "post.yaml": META, "en.md": EN });
    const bad = async (text: string) => text.replace("⟦CODE_0⟧", "```java\nrecord Y() {}\n```");
    await expect(
      translatePost({ contentRoot: root, slug: "a", translate: bad }),
    ).rejects.toThrow(/protected span|placeholder/i);
    expect(existsSync(join(root, "blog", "a", "vi.md"))).toBe(false);
    rmSync(root, { recursive: true });
  });

  it("writes nothing when the model drops a placeholder", async () => {
    const root = postDir({ "post.yaml": META, "en.md": EN });
    const bad = async (text: string) => text.replace(/⟦URL_\d+⟧/, "/duong-dan-da-dich");
    await expect(
      translatePost({ contentRoot: root, slug: "a", translate: bad }),
    ).rejects.toThrow(/placeholder/i);
    expect(existsSync(join(root, "blog", "a", "vi.md"))).toBe(false);
    rmSync(root, { recursive: true });
  });

  // Every placeholder came back, so restoreProtected is happy. What changed is
  // that the model wrote a code block of its own. Only assertProtectedIntact
  // sees that, which is what makes it more than a formality.
  it("writes nothing when the model invents a code block of its own", async () => {
    const root = postDir({ "post.yaml": META, "en.md": EN });
    const bad = async (text: string) => text + "\n\n```java\nrecord Z() {}\n```\n";
    await expect(
      translatePost({ contentRoot: root, slug: "a", translate: bad }),
    ).rejects.toThrow(/protected span/i);
    expect(existsSync(join(root, "blog", "a", "vi.md"))).toBe(false);
    rmSync(root, { recursive: true });
  });

  // The body translates fine; the title is what fails. The file must still not
  // exist, which is only true while the write stays last.
  it("writes nothing when a front matter value fails to translate", async () => {
    const root = postDir({ "post.yaml": META, "en.md": EN });
    let call = 0;
    const bad = async (text: string) => {
      call += 1;
      if (call === 1) return fakeTranslate(text);
      throw new Error("the model gave up on the title");
    };
    await expect(
      translatePost({ contentRoot: root, slug: "a", translate: bad }),
    ).rejects.toThrow(/gave up/);
    expect(existsSync(join(root, "blog", "a", "vi.md"))).toBe(false);
    rmSync(root, { recursive: true });
  });

  it("writes nothing when the model duplicates a placeholder", async () => {
    const root = postDir({ "post.yaml": META, "en.md": EN });
    // URL_2 is the link destination; the image path ahead of it is URL_1.
    const bad = async (text: string) => text.replace("⟦URL_2⟧", "⟦URL_2⟧ ⟦URL_2⟧");
    await expect(
      translatePost({ contentRoot: root, slug: "a", translate: bad }),
    ).rejects.toThrow(/duplicated it/i);
    expect(existsSync(join(root, "blog", "a", "vi.md"))).toBe(false);
    rmSync(root, { recursive: true });
  });

  // Measured on the first real run: handed the 41-character title "What a
  // virtual thread does when it blocks", the model returned 4267 characters —
  // an entire blog post. Every span check passed, because a title carries no
  // spans to check.
  it("writes nothing when the model answers a title with an essay", async () => {
    const root = postDir({ "post.yaml": META, "en.md": EN });
    const bad = async (text: string) =>
      text === "Hello" ? "Một bài viết rất dài. ".repeat(200) : fakeTranslate(text);
    await expect(
      translatePost({ contentRoot: root, slug: "a", translate: bad }),
    ).rejects.toThrow(/title/i);
    expect(existsSync(join(root, "blog", "a", "vi.md"))).toBe(false);
    rmSync(root, { recursive: true });
  });

  it("translates in the vi -> en direction when the source is vi", async () => {
    const root = postDir({ "post.yaml": META.replace("source: en", "source: vi"), "vi.md": EN });
    await translatePost({ contentRoot: root, slug: "a", translate: fakeTranslate });
    expect(existsSync(join(root, "blog", "a", "en.md"))).toBe(true);
    rmSync(root, { recursive: true });
  });

  it("names both languages when it asks the model to translate", async () => {
    const root = postDir({ "post.yaml": META, "en.md": EN });
    const pairs: string[] = [];
    await translatePost({
      contentRoot: root,
      slug: "a",
      translate: async (text, from, to) => {
        pairs.push(`${from}->${to}`);
        return fakeTranslate(text);
      },
    });
    expect(new Set(pairs)).toEqual(new Set(["English->Vietnamese"]));
    rmSync(root, { recursive: true });
  });

  it("throws when the post has no post.yaml", async () => {
    const root = postDir({ "en.md": EN });
    await expect(
      translatePost({ contentRoot: root, slug: "a", translate: fakeTranslate }),
    ).rejects.toThrow(/post\.yaml/);
    rmSync(root, { recursive: true });
  });

  it("throws when post.yaml names a source file that is not there", async () => {
    const root = postDir({ "post.yaml": META, "vi.md": EN });
    await expect(
      translatePost({ contentRoot: root, slug: "a", translate: fakeTranslate }),
    ).rejects.toThrow(/en\.md/);
    rmSync(root, { recursive: true });
  });
});

describe("assertPlausibleLength", () => {
  it("accepts a translation of about the same size", () => {
    expect(() => assertPlausibleLength("Hello there", "Xin chào các bạn", "title")).not.toThrow();
  });

  it("accepts a very short string growing several times over", () => {
    // "Why?" to "Tại sao lại như vậy?" is a fivefold growth and perfectly fine.
    // A ratio alone would reject it, so the ceiling has a flat allowance too.
    expect(() => assertPlausibleLength("Why?", "Tại sao lại như vậy?", "title")).not.toThrow();
  });

  it("rejects an answer that dwarfs what was asked", () => {
    expect(() => assertPlausibleLength("A short title", "x".repeat(4000), "title")).toThrow(
      /title/i,
    );
  });

  it("rejects an answer that lost most of the text", () => {
    // The other direction is a real failure too: a model that summarises
    // instead of translating drops most of the post.
    expect(() => assertPlausibleLength("x".repeat(4000), "Tóm lại: rất hay.", "body")).toThrow(
      /body/i,
    );
  });

  it("names the sizes so the author can see how far off it was", () => {
    expect(() => assertPlausibleLength("A short title", "x".repeat(4000), "title")).toThrow(
      /13.*4000|4000.*13/,
    );
  });
});
