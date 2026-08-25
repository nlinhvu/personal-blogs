import { describe, it, expect } from "vitest";
import {
  postPath,
  tagPath,
  canonicalUrl,
  ogImagePath,
  tagIndexPath,
  searchPath,
} from "../../src/lib/urls";

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

describe("ogImagePath", () => {
  it("mirrors the post path so no lookup table is needed", () => {
    expect(ogImagePath("reading-a-ds-record", "en")).toBe("/og/blog/reading-a-ds-record.png");
  });

  it("gives the Vietnamese post its OWN image, not the English one", () => {
    expect(ogImagePath("reading-a-ds-record", "vi")).toBe("/og/vi/blog/reading-a-ds-record.png");
    expect(ogImagePath("reading-a-ds-record", "vi")).not.toBe(
      ogImagePath("reading-a-ds-record", "en"),
    );
  });
});

describe("tagIndexPath and searchPath", () => {
  it("prefixes Vietnamese and leaves English at the root", () => {
    expect(tagIndexPath("en")).toBe("/tags");
    expect(tagIndexPath("vi")).toBe("/vi/tags");
    expect(searchPath("en")).toBe("/search");
    expect(searchPath("vi")).toBe("/vi/search");
  });
});
