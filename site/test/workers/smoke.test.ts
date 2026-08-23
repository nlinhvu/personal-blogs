import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

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
});

describe("bilingual routing", () => {
  it("serves the English post", async () => {
    const response = await SELF.fetch("https://vulinh.dev/blog/hello-bilingual");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('<html lang="en"');
    expect(html).toContain('rel="canonical" href="https://vulinh.dev/blog/hello-bilingual"');
    expect(html).toContain('hreflang="vi" href="https://vulinh.dev/vi/blog/hello-bilingual"');
    expect(html).toContain('hreflang="x-default"');
  });

  it("serves the Vietnamese post", async () => {
    const response = await SELF.fetch("https://vulinh.dev/vi/blog/hello-bilingual");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('<html lang="vi"');
    expect(html).toContain('rel="canonical" href="https://vulinh.dev/vi/blog/hello-bilingual"');
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
