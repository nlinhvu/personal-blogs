import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

// The deployment host is configuration, not behaviour: SITE_URL differs between
// production, staging and preview, so these tests assert the URL contract —
// absolute links, correct paths, reciprocal hreflang — and leave the exact host
// to the per-environment smoke tests in .github/workflows.
function canonicalOf(html: string): URL {
  const match = html.match(/<link rel="canonical" href="([^"]+)"/);
  if (!match) throw new Error("no canonical link in the document");
  return new URL(match[1]);
}

function alternateOf(html: string, hreflang: string): URL {
  const match = html.match(new RegExp(`<link rel="alternate" hreflang="${hreflang}" href="([^"]+)"`));
  if (!match) throw new Error(`no hreflang="${hreflang}" alternate in the document`);
  return new URL(match[1]);
}

describe("static asset serving", () => {
  it("serves the home page", async () => {
    const response = await SELF.fetch("https://vulinh.dev/");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
  });

  it("returns 404 for an unknown path", async () => {
    const response = await SELF.fetch("https://vulinh.dev/does-not-exist");
    expect(response.status).toBe(404);
  });

  // Browsers and crawlers ask for these three by convention whether or not the
  // document links them, so a missing file is a 404 on every page view. The
  // .ico is the one that gets requested without being declared anywhere.
  it.each([
    ["/favicon.ico", "image/vnd.microsoft.icon"],
    ["/favicon.svg", "image/svg+xml"],
    ["/apple-touch-icon.png", "image/png"],
  ])("serves %s", async (path, contentType) => {
    const response = await SELF.fetch(`https://vulinh.dev${path}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(contentType);
  });
});

// A feed's whole job is to be fetchable by a machine that was told about it in
// a <link rel="alternate">. These assert the contract that link makes: the URL
// answers, it answers as XML, and the guid a subscriber keys off is the
// absolute canonical post URL — the one value in a feed that must never change.
describe("feeds and sitemap", () => {
  it.each([
    ["/rss.xml", "https://vulinh.dev/blog/hello-bilingual"],
    ["/vi/rss.xml", "https://vulinh.dev/vi/blog/hello-bilingual"],
  ])("serves %s with absolute permalink guids", async (path, guid) => {
    const response = await SELF.fetch(`https://vulinh.dev${path}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("xml");

    const xml = await response.text();
    expect(xml).toContain(`<guid isPermaLink="true">${guid}</guid>`);
  });

  it("links exactly one feed per page, in the page's own language", async () => {
    for (const [path, feed] of [
      ["/", "/rss.xml"],
      ["/blog/hello-bilingual", "/rss.xml"],
      ["/tags/spring-boot", "/rss.xml"],
      ["/vi", "/vi/rss.xml"],
      ["/vi/tags/spring-boot", "/vi/rss.xml"],
    ]) {
      const html = await (await SELF.fetch(`https://vulinh.dev${path}`)).text();
      const links = html.match(/type="application\/rss\+xml"/g) ?? [];
      expect(links, `${path} should link exactly one feed`).toHaveLength(1);
      expect(html).toContain(`href="${feed}"`);
    }
  });

  it("publishes a sitemap that lists real pages and nothing else", async () => {
    const index = await SELF.fetch("https://vulinh.dev/sitemap-index.xml");
    expect(index.status).toBe(200);

    const xml = await (await SELF.fetch("https://vulinh.dev/sitemap-0.xml")).text();
    expect(xml).toContain("<loc>https://vulinh.dev/blog/hello-bilingual</loc>");
    // Reciprocal hreflang is the point of the i18n sitemap: it tells a crawler
    // the two language versions are one document, not duplicate content.
    expect(xml).toContain('hreflang="vi" href="https://vulinh.dev/vi/blog/hello-bilingual"');
    // An error page or a feed in the sitemap invites a crawler to index it.
    expect(xml).not.toContain("/404");
    expect(xml).not.toContain("rss.xml");
  });
});

describe("bilingual routing", () => {
  it("serves the English post", async () => {
    const response = await SELF.fetch("https://vulinh.dev/blog/hello-bilingual");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('<html lang="en"');

    const canonical = canonicalOf(html);
    const vietnamese = alternateOf(html, "vi");
    const fallback = alternateOf(html, "x-default");

    expect(canonical.pathname).toBe("/blog/hello-bilingual");
    expect(vietnamese.pathname).toBe("/vi/blog/hello-bilingual");
    // x-default points at English, the source language.
    expect(fallback.href).toBe(canonical.href);
    // One SITE_URL built all three, so they must agree on the origin.
    expect(vietnamese.origin).toBe(canonical.origin);
  });

  it("serves the Vietnamese post", async () => {
    const response = await SELF.fetch("https://vulinh.dev/vi/blog/hello-bilingual");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('<html lang="vi"');

    const canonical = canonicalOf(html);
    const english = alternateOf(html, "en");

    expect(canonical.pathname).toBe("/vi/blog/hello-bilingual");
    expect(english.pathname).toBe("/blog/hello-bilingual");
    expect(english.origin).toBe(canonical.origin);
  });

  // Workers Static Assets always answers html_handling redirects with 307, in
  // every mode; the status code is not configurable. The canonical link on the
  // destination page is what tells a crawler which URL is the real one.
  it("redirects a trailing slash away", async () => {
    const response = await SELF.fetch("https://vulinh.dev/blog/hello-bilingual/", {
      redirect: "manual",
    });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/blog/hello-bilingual");
  });
});

describe("404 page", () => {
  it("answers an unknown English path with a real error page", async () => {
    const response = await SELF.fetch("https://vulinh.dev/blog/does-not-exist");
    expect(response.status).toBe(404);
    const html = await response.text();
    expect(html).toContain("Not found");
    expect(html).toContain('href="/"');
  });

  it("answers an unknown Vietnamese path with the same error page", async () => {
    const response = await SELF.fetch("https://vulinh.dev/vi/blog/does-not-exist");
    expect(response.status).toBe(404);
    const html = await response.text();
    expect(html).toContain("Not found");
  });
});
