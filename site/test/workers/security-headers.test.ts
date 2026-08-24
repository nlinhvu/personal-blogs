import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { securityHeaders, buildHeadersFile } from "../../src/config/security-headers";

describe("security header policy", () => {
  it("denies framing through a real header, not a meta tag", () => {
    const csp = securityHeaders(false).find(([name]) => name === "Content-Security-Policy");
    expect(csp?.[1]).toContain("frame-ancestors 'none'");
  });

  it("includes the non-negotiable baseline", () => {
    const names = securityHeaders(false).map(([name]) => name);
    expect(names).toContain("X-Content-Type-Options");
    expect(names).toContain("Referrer-Policy");
    expect(names).toContain("Permissions-Policy");
  });

  it("adds noindex on dev and never on prod", () => {
    const prod = securityHeaders(false).map(([name]) => name);
    const dev = securityHeaders(true).map(([name]) => name);
    expect(prod).not.toContain("X-Robots-Tag");
    expect(dev).toContain("X-Robots-Tag");
  });

  it("renders a _headers file that applies to every path", () => {
    const file = buildHeadersFile(false);
    expect(file.split("\n")[0]).toBe("/*");
    for (const [name, value] of securityHeaders(false)) {
      expect(file).toContain(`  ${name}: ${value}`);
    }
  });
});

describe("headers on a real response through the Workers runtime", () => {
  it("carries every header from the policy", async () => {
    const response = await SELF.fetch("https://vulinh.dev/");
    for (const [name, value] of securityHeaders(false)) {
      expect(response.headers.get(name)).toBe(value);
    }
  });

  it("emits a per-page CSP meta tag with hashes", async () => {
    const html = await (await SELF.fetch("https://vulinh.dev/")).text();
    expect(html).toContain('http-equiv="content-security-policy"');
  });
});

// A CSP hash cannot whitelist a style ATTRIBUTE, only `unsafe-inline` or
// `unsafe-hashes` would, and the site ships neither. So an inline `style=`
// anywhere in the markup is dead on arrival: the browser drops it and logs a
// violation on every page view. Shiki, the default Astro highlighter, paints
// every token that way, which is why the site renders code with Prism instead.
// This test is the tripwire — it fails the moment something reintroduces one.
describe("markup stays inside the policy", () => {
  const pages = [
    "https://vulinh.dev/",
    "https://vulinh.dev/vi",
    "https://vulinh.dev/blog/first-post",
    "https://vulinh.dev/vi/blog/first-post",
    "https://vulinh.dev/tags/alpha",
    "https://vulinh.dev/vi/tags/alpha",
  ];

  it.each(pages)("carries no inline style attribute: %s", async (url) => {
    const html = await (await SELF.fetch(url)).text();
    expect(html.match(/\sstyle="/g)).toBeNull();
  });

  // The requirement is that the page READS with JavaScript disabled, not that
  // scripts are banned: analytics and anything else Phase 3 wants goes in via
  // script-src. What must stay true is that no script is load-bearing, and the
  // cheapest proof of that is that the site's own markup ships none. Cloudflare
  // injects its analytics beacon at the edge for browser-shaped requests, so it
  // is absent here and this assertion is about our output, not the served page.
  it.each(pages)("ships no javascript of its own: %s", async (url) => {
    const html = await (await SELF.fetch(url)).text();
    expect(html).not.toContain("<script");
  });

  it("allows the analytics beacon to load and to report", async () => {
    const html = await (await SELF.fetch("https://vulinh.dev/")).text();
    const csp = html.match(/content-security-policy" content="([^"]+)"/)?.[1] ?? "";
    // script-src is the load-bearing one: without the vendor host the script
    // is refused outright. connect-src is asserted because the reporting
    // destination should be readable off the policy, not inherited silently
    // from default-src.
    expect(csp).toContain("script-src 'self' https://static.cloudflareinsights.com");
    expect(csp).toContain("connect-src 'self' https://cloudflareinsights.com");
  });

  it("colours code through Prism classes, not inline styles", async () => {
    const html = await (await SELF.fetch("https://vulinh.dev/blog/first-post")).text();
    expect(html).toContain('<pre class="language-java"');
    expect(html).toContain('<span class="token keyword">');
  });
});

// Everything under /_astro/ carries a content hash in its filename, so the
// bytes behind one of those URLs can never change. Saying so turns a
// revalidation round trip on every repeat visit into a cache read — worth
// having on the one render-blocking request the page makes.
describe("cache policy for hashed assets", () => {
  const IMMUTABLE = "public, max-age=31536000, immutable";

  it("declares an immutable rule for /_astro/*", () => {
    const file = buildHeadersFile(false);
    expect(file).toContain("/_astro/*");
    expect(file).toContain(`  Cache-Control: ${IMMUTABLE}`);
  });

  it("serves the hashed stylesheet immutable and the document revalidated", async () => {
    const html = await (await SELF.fetch("https://vulinh.dev/")).text();
    const href = html.match(/<link rel="stylesheet" href="([^"]+)"/)?.[1];
    expect(href, "the page must link a bundled stylesheet").toBeDefined();
    expect(href).toMatch(/^\/_astro\/.+\.css$/);

    const asset = await SELF.fetch(`https://vulinh.dev${href}`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get("cache-control")).toBe(IMMUTABLE);

    // The document must stay revalidated: its URL carries no hash, so an
    // immutable rule there would pin a reader to a page that has moved on.
    const doc = await SELF.fetch("https://vulinh.dev/");
    expect(doc.headers.get("cache-control") ?? "").not.toContain("immutable");
  });
});
