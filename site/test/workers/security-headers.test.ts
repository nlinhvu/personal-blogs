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
    "https://vulinh.dev/blog/hello-bilingual",
    "https://vulinh.dev/vi/blog/hello-bilingual",
  ];

  it.each(pages)("carries no inline style attribute: %s", async (url) => {
    const html = await (await SELF.fetch(url)).text();
    expect(html.match(/\sstyle="/g)).toBeNull();
  });

  it.each(pages)("carries no script tag: %s", async (url) => {
    const html = await (await SELF.fetch(url)).text();
    expect(html).not.toContain("<script");
  });

  it("colours code through Prism classes, not inline styles", async () => {
    const html = await (await SELF.fetch("https://vulinh.dev/blog/hello-bilingual")).text();
    expect(html).toContain('<pre class="language-java"');
    expect(html).toContain('<span class="token keyword">');
  });
});
