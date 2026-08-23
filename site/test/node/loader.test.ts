import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { collectPosts } from "../../src/loaders/bilingual-post";

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "posts-"));
  for (const [path, body] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body, "utf8");
  }
  return root;
}

const META = "pubDate: 2026-08-21T09:00:00+07:00\ntags: [spring-boot]\nsource: en\n";
const EN = '---\ntitle: "T"\ndescription: "D"\n---\n\nBody.\n';
const VI = '---\ntitle: "T vi"\ndescription: "D vi"\n---\n\nThân bài.\n';
const TAGS = 'spring-boot:\n  en: "Spring Boot"\n  vi: "Spring Boot"\n';

describe("collectPosts", () => {
  it("emits one entry per language for a complete pair", () => {
    const root = fixture({
      "tags.yaml": TAGS,
      "blog/a/post.yaml": META,
      "blog/a/en.md": EN,
      "blog/a/vi.md": VI,
    });
    const posts = collectPosts(root);
    expect(posts.map((p) => p.id).sort()).toEqual(["a/en", "a/vi"]);
    rmSync(root, { recursive: true });
  });

  it("throws naming the slug when the Vietnamese version is missing", () => {
    const root = fixture({
      "tags.yaml": TAGS,
      "blog/a/post.yaml": META,
      "blog/a/en.md": EN,
    });
    expect(() => collectPosts(root)).toThrow(/a.*vi\.md/);
    rmSync(root, { recursive: true });
  });

  it("throws naming the slug when the English version is missing", () => {
    const root = fixture({
      "tags.yaml": TAGS,
      "blog/a/post.yaml": META,
      "blog/a/vi.md": VI,
    });
    expect(() => collectPosts(root)).toThrow(/a.*en\.md/);
    rmSync(root, { recursive: true });
  });

  it("gives both language entries the same pubDate, tags and source", () => {
    const root = fixture({
      "tags.yaml": TAGS,
      "blog/a/post.yaml": META,
      "blog/a/en.md": EN,
      "blog/a/vi.md": VI,
    });
    const [en, vi] = collectPosts(root).sort((x, y) => x.id.localeCompare(y.id));
    expect(en.data.pubDate).toEqual(vi.data.pubDate);
    expect(en.data.tags).toEqual(vi.data.tags);
    expect(en.data.source).toBe(vi.data.source);
    rmSync(root, { recursive: true });
  });
});
