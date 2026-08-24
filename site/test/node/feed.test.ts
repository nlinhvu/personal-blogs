import { describe, it, expect } from "vitest";
import { feedItem } from "../../src/lib/feed";

const SITE = "https://vulinh.dev";

const entry = (overrides: Record<string, unknown> = {}) => ({
  data: {
    slug: "a-post",
    lang: "en" as const,
    title: "A post",
    description: "About things.",
    pubDate: new Date("2026-08-21T09:00:00+07:00"),
    tags: ["spring-boot"],
    source: "en" as const,
    ...overrides,
  },
});

describe("feed items", () => {
  it("uses the absolute canonical post url as the guid", () => {
    expect(feedItem(entry(), SITE).guid).toBe("https://vulinh.dev/blog/a-post");
  });

  it("marks the guid as a permalink", () => {
    expect(feedItem(entry(), SITE).customData).toContain('isPermaLink="true"');
  });

  it("KEEPS THE GUID FROZEN when the title changes", () => {
    const before = feedItem(entry(), SITE).guid;
    const after = feedItem(entry({ title: "A completely different title" }), SITE).guid;
    expect(after).toBe(before);
  });

  it("KEEPS THE GUID FROZEN when the description changes", () => {
    const before = feedItem(entry(), SITE).guid;
    const after = feedItem(entry({ description: "Rewritten." }), SITE).guid;
    expect(after).toBe(before);
  });

  it("gives the Vietnamese version its own guid under /vi", () => {
    expect(feedItem(entry({ lang: "vi" }), SITE).guid).toBe("https://vulinh.dev/vi/blog/a-post");
  });
});
