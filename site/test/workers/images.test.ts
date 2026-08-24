import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

// A post's images are written as a path relative to the post directory, which
// is outside the site root. Nothing about that resolves on its own: the loader
// has to hand Astro both the file the markdown came from and the list of images
// it found, or the build emits an <img> with no src at all and still goes green.
// So this asserts the end state a reader gets — a real URL that answers 200 —
// rather than any step on the way there.
const PAGES = ["/blog/first-post", "/vi/blog/first-post"];

async function imagesOn(path: string): Promise<string[]> {
  const response = await SELF.fetch(`https://vulinh.dev${path}`);
  expect(response.status, `${path} must be served`).toBe(200);
  const html = await response.text();

  // The unprocessed marker Astro leaves behind when it could not resolve an
  // image. It carries the path in an attribute the browser ignores, so the page
  // looks fine to a test that only counts <img> tags.
  expect(html, `${path} has an unresolved image`).not.toContain("__ASTRO_IMAGE_");

  return [...html.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)].map((match) => match[1]);
}

describe("images in a post", () => {
  it.each(PAGES)("%s renders its image with a real src", async (path) => {
    const sources = await imagesOn(path);
    expect(sources.length, `${path} should show the fixture image`).toBeGreaterThan(0);
  });

  it.each(PAGES)("%s serves every image it points at", async (path) => {
    for (const src of await imagesOn(path)) {
      const asset = await SELF.fetch(new URL(src, "https://vulinh.dev").href);
      expect(asset.status, `${src} is linked from ${path} but does not exist`).toBe(200);
      expect(asset.headers.get("content-type")).toContain("image/");
    }
  });

  it("points both languages at the same image file", async () => {
    // One asset, two languages. A per-language copy is the thing this rules out.
    const [en, vi] = await Promise.all(PAGES.map(imagesOn));
    expect(vi).toEqual(en);
  });
});
