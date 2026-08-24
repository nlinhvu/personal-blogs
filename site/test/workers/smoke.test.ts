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

// Same rule as the page tests above: SITE_URL differs per environment, so
// these assert the CONTRACT — absolute URLs, correct paths, one origin for the
// whole document — and never the literal host. Hardcoding vulinh.dev here made
// the staging job red on the first push, which is the failure mode the comment
// at the top of this file was already warning about.
describe("feeds and sitemap", () => {
  function guidsOf(xml: string): URL[] {
    const found = [...xml.matchAll(/<guid isPermaLink="true">([^<]+)<\/guid>/g)];
    if (found.length === 0) throw new Error("no permalink guid in the feed");
    // new URL() on a relative string throws, so this also proves absoluteness.
    return found.map((match) => new URL(match[1]));
  }

  // Naming a specific post here would tie the test to whichever one happens to
  // be newest. Assert the shape instead: every guid absolute, under this
  // language's prefix, and repeated verbatim as the item link.
  it.each([
    ["/rss.xml", "/blog/"],
    ["/vi/rss.xml", "/vi/blog/"],
  ])("serves %s with absolute permalink guids under %s", async (path, prefix) => {
    const response = await SELF.fetch(`https://vulinh.dev${path}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("xml");

    const xml = await response.text();
    const guids = guidsOf(xml);
    expect(guids.length).toBeGreaterThan(0);

    for (const guid of guids) {
      expect(guid.pathname.startsWith(prefix), `${guid.pathname} under ${prefix}`).toBe(true);
      // The item link must be that same URL, character for character. A
      // trailing slash here is a 307 in front of every subscriber who clicks.
      expect(xml).toContain(`<link>${guid.href}</link>`);
    }
  });

  // Newest first is the whole reason a feed and an index are ordered at all: a
  // reader shows the top item as the latest. Needs two posts to mean anything,
  // which is why it could not be written until the second one existed.
  function descending(values: number[], label: string) {
    expect(values.length, `${label} needs at least two entries to order`).toBeGreaterThan(1);
    for (let i = 1; i < values.length; i++) {
      expect(values[i - 1], `${label} is out of order at position ${i}`).toBeGreaterThanOrEqual(
        values[i],
      );
    }
  }

  it.each(["/rss.xml", "/vi/rss.xml"])("orders %s newest first", async (path) => {
    const xml = await (await SELF.fetch(`https://vulinh.dev${path}`)).text();
    const dates = [...xml.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)].map((m) => Date.parse(m[1]));
    descending(dates, path);
  });

  it.each(["/", "/vi", "/tags/spring-boot", "/vi/tags/spring-boot"])(
    "orders the entries on %s newest first",
    async (path) => {
      const html = await (await SELF.fetch(`https://vulinh.dev${path}`)).text();
      const dates = [...html.matchAll(/<time[^>]*datetime="([^"]+)"/g)].map((m) => Date.parse(m[1]));
      descending(dates, path);
    },
  );

  it("points each feed's channel link at that language's home page", async () => {
    const link = async (path: string) => {
      const xml = await (await SELF.fetch(`https://vulinh.dev${path}`)).text();
      // The channel link is the first <link>, before any <item>.
      return new URL(xml.slice(0, xml.indexOf("<item>")).match(/<link>([^<]+)<\/link>/)![1]);
    };
    expect((await link("/rss.xml")).pathname).toBe("/");
    // A Vietnamese subscriber clicking "visit website" in their reader must
    // not land on the English home page.
    expect((await link("/vi/rss.xml")).pathname).toBe("/vi");
  });

  it("keeps the two feeds on one origin and one slug", async () => {
    const en = guidsOf(await (await SELF.fetch("https://vulinh.dev/rss.xml")).text());
    const vi = guidsOf(await (await SELF.fetch("https://vulinh.dev/vi/rss.xml")).text());

    expect(vi[0].origin).toBe(en[0].origin);
    // The slug is shared; only the locale prefix differs.
    expect(vi[0].pathname).toBe(`/vi${en[0].pathname}`);
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

  it("publishes a sitemap that pairs the two languages and lists nothing else", async () => {
    const index = await SELF.fetch("https://vulinh.dev/sitemap-index.xml");
    expect(index.status).toBe(200);

    const xml = await (await SELF.fetch("https://vulinh.dev/sitemap-0.xml")).text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]));
    const paths = locs.map((url) => url.pathname);

    expect(paths).toContain("/blog/hello-bilingual");
    expect(paths).toContain("/vi/blog/hello-bilingual");
    expect(paths).toContain("/tags/spring-boot");
    expect(new Set(locs.map((url) => url.origin)).size).toBe(1);

    // Reciprocal hreflang is the point of the i18n sitemap: it tells a crawler
    // the two language versions are one document, not duplicate content.
    const alternates = [...xml.matchAll(/hreflang="(\w+)" href="([^"]+)"/g)];
    const viAlternate = alternates.find(
      (m) => m[1] === "vi" && new URL(m[2]).pathname === "/vi/blog/hello-bilingual",
    );
    expect(viAlternate, "the English post must point at its Vietnamese pair").toBeDefined();

    // An error page or a feed in the sitemap invites a crawler to index it.
    expect(paths).not.toContain("/404");
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
