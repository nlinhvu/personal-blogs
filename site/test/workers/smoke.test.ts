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
