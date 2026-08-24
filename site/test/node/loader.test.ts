import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { collectPosts, incompleteDrafts } from "../../src/loaders/bilingual-post";

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

  // A draft is a finished-enough post that is not ready to be public. It is
  // dropped here, in the loader, rather than in each page: the home page, both
  // tag page routes, both feeds and the sitemap all read from this one list, so
  // filtering once is the difference between one rule and six places to forget.
  it("drops a draft from a production build", () => {
    const root = fixture({
      "tags.yaml": TAGS,
      "blog/published/post.yaml": META,
      "blog/published/en.md": EN,
      "blog/published/vi.md": VI,
      "blog/wip/post.yaml": META + "draft: true\n",
      "blog/wip/en.md": EN,
      "blog/wip/vi.md": VI,
    });
    expect(collectPosts(root).map((p) => p.slug)).toEqual(["published", "published"]);
    rmSync(root, { recursive: true });
  });

  it("keeps a draft when drafts are asked for", () => {
    const root = fixture({
      "tags.yaml": TAGS,
      "blog/wip/post.yaml": META + "draft: true\n",
      "blog/wip/en.md": EN,
      "blog/wip/vi.md": VI,
    });
    expect(collectPosts(root, { includeDrafts: true }).map((p) => p.id).sort()).toEqual([
      "wip/en",
      "wip/vi",
    ]);
    rmSync(root, { recursive: true });
  });

  it("treats a post with no draft field as published", () => {
    const root = fixture({
      "tags.yaml": TAGS,
      "blog/a/post.yaml": META,
      "blog/a/en.md": EN,
      "blog/a/vi.md": VI,
    });
    expect(collectPosts(root)).toHaveLength(2);
    rmSync(root, { recursive: true });
  });

  // The writing loop is: write en.md, run the translation script, get vi.md.
  // In between, the post exists in one language. Holding the bilingual
  // invariant over a draft would make `npm run dev` red for that whole window,
  // which is exactly when the author most wants to look at the page.
  it("lets a draft exist in only its source language", () => {
    const root = fixture({
      "tags.yaml": TAGS,
      "blog/wip/post.yaml": META + "draft: true\n",
      "blog/wip/en.md": EN,
    });
    expect(collectPosts(root, { includeDrafts: true }).map((p) => p.id)).toEqual(["wip/en"]);
    rmSync(root, { recursive: true });
  });

  // Relaxed for the half-written, never for the published. Dropping `draft:
  // true` on a post with one language must go red on the spot.
  it("still demands both languages once a post is published", () => {
    const root = fixture({
      "tags.yaml": TAGS,
      "blog/wip/post.yaml": META,
      "blog/wip/en.md": EN,
    });
    expect(() => collectPosts(root, { includeDrafts: true })).toThrow(/wip.*vi\.md/);
    rmSync(root, { recursive: true });
  });

  // A draft with no source file at all is broken, not in progress: post.yaml
  // names a language that is not there.
  it("still demands the source language file from a draft", () => {
    const root = fixture({
      "tags.yaml": TAGS,
      "blog/wip/post.yaml": META + "draft: true\n",
      "blog/wip/vi.md": VI,
    });
    expect(() => collectPosts(root, { includeDrafts: true })).toThrow(/wip.*en\.md/);
    rmSync(root, { recursive: true });
  });

  it("leaves an incomplete draft out of a production build without complaining", () => {
    const root = fixture({
      "tags.yaml": TAGS,
      "blog/wip/post.yaml": META + "draft: true\n",
      "blog/wip/en.md": EN,
      "blog/done/post.yaml": META,
      "blog/done/en.md": EN,
      "blog/done/vi.md": VI,
    });
    expect(collectPosts(root).map((p) => p.slug)).toEqual(["done", "done"]);
    rmSync(root, { recursive: true });
  });
});

// A draft that is missing its translation is fine to build and easy to forget.
// The build says so out loud rather than staying quiet until publication day.
describe("incompleteDrafts", () => {
  it("names the drafts that are still missing a translation", () => {
    const root = fixture({
      "tags.yaml": TAGS,
      "blog/wip/post.yaml": META + "draft: true\n",
      "blog/wip/en.md": EN,
      "blog/done/post.yaml": META,
      "blog/done/en.md": EN,
      "blog/done/vi.md": VI,
    });
    const posts = collectPosts(root, { includeDrafts: true });
    expect(incompleteDrafts(posts)).toEqual([{ slug: "wip", has: "en", missing: "vi" }]);
    rmSync(root, { recursive: true });
  });

  it("names nothing when every draft has both languages", () => {
    const root = fixture({
      "tags.yaml": TAGS,
      "blog/wip/post.yaml": META + "draft: true\n",
      "blog/wip/en.md": EN,
      "blog/wip/vi.md": VI,
    });
    expect(incompleteDrafts(collectPosts(root, { includeDrafts: true }))).toEqual([]);
    rmSync(root, { recursive: true });
  });
});
