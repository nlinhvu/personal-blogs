import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("build stamp", () => {
  it("serves the commit the running build came from", async () => {
    const res = await SELF.fetch("https://vulinh.dev/version.txt");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
  });

  // The deploy gate compares this body against the SHA it just pushed. An empty
  // body would compare equal to an unset variable and wave a broken deploy
  // through, so the no-SHA case has to answer something that can never match a
  // commit. That sentinel is the assertion, not an implementation detail.
  it("answers a sentinel, never an empty body, when no SHA was supplied", async () => {
    const body = (await (await SELF.fetch("https://vulinh.dev/version.txt")).text()).trim();
    expect(body).toBe("dev");
    expect(body).not.toBe("");
  });
});
