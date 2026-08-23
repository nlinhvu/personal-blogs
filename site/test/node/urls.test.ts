import { describe, it, expect } from "vitest";
import { postPath, tagPath, canonicalUrl } from "../../src/lib/urls";

describe("url contract", () => {
  it("puts English at the root and Vietnamese behind /vi", () => {
    expect(postPath("a-post", "en")).toBe("/blog/a-post");
    expect(postPath("a-post", "vi")).toBe("/vi/blog/a-post");
  });

  it("never emits a trailing slash", () => {
    expect(postPath("a-post", "en").endsWith("/")).toBe(false);
    expect(tagPath("spring-boot", "vi").endsWith("/")).toBe(false);
  });

  it("uses the same ASCII tag slug in both locales", () => {
    expect(tagPath("spring-boot", "en")).toBe("/tags/spring-boot");
    expect(tagPath("spring-boot", "vi")).toBe("/vi/tags/spring-boot");
  });

  it("builds an absolute canonical url", () => {
    expect(canonicalUrl("/blog/a-post", "https://vulinh.dev")).toBe(
      "https://vulinh.dev/blog/a-post",
    );
  });
});
