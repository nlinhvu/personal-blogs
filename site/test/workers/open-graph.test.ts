import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const meta = (html: string, property: string): string | null =>
  html.match(new RegExp(`<meta[^>]+property="${property}"[^>]+content="([^"]*)"`))?.[1] ?? null;

describe("open graph tags on a post", () => {
  it("advertises an absolute image URL, never a relative path", async () => {
    const html = await (await SELF.fetch("https://vulinh.dev/blog/first-post")).text();
    expect(meta(html, "og:image")).toMatch(/^https:\/\//);
  });

  it("points the Vietnamese post at the VIETNAMESE image", async () => {
    // The single most likely defect in this feature, and one that never shows
    // itself: the card still renders, just in the wrong language.
    const en = await (await SELF.fetch("https://vulinh.dev/blog/first-post")).text();
    const vi = await (await SELF.fetch("https://vulinh.dev/vi/blog/first-post")).text();
    expect(meta(vi, "og:image")).toContain("/og/vi/blog/first-post.png");
    expect(meta(vi, "og:image")).not.toBe(meta(en, "og:image"));
  });

  it("declares the size every platform crops from", async () => {
    const html = await (await SELF.fetch("https://vulinh.dev/blog/first-post")).text();
    expect(meta(html, "og:image:width")).toBe("1200");
    expect(meta(html, "og:image:height")).toBe("630");
  });

  it("names both locales so a crawler knows a translation exists", async () => {
    const html = await (await SELF.fetch("https://vulinh.dev/vi/blog/first-post")).text();
    expect(meta(html, "og:locale")).toBe("vi_VN");
    expect(meta(html, "og:locale:alternate")).toBe("en_US");
  });

  it("asks for the large card format", async () => {
    const html = await (await SELF.fetch("https://vulinh.dev/blog/first-post")).text();
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
  });

  it("omits og:image on a page that is not a post", async () => {
    const html = await (await SELF.fetch("https://vulinh.dev/")).text();
    expect(meta(html, "og:type")).toBe("website");
    expect(meta(html, "og:image")).toBeNull();
  });
});
