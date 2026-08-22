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
