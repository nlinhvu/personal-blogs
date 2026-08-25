import { describe, it, expect } from "vitest";
import { blogPostingSchema, AUTHOR_PROFILES } from "../../src/lib/schema";

const input = {
  title: "Reading a DS record",
  description: "What a DS record is and how to read one.",
  canonical: "https://vulinh.dev/blog/reading-a-ds-record",
  imageUrl: "https://vulinh.dev/og/blog/reading-a-ds-record.png",
  pubDate: new Date("2026-08-24T18:00:00+07:00"),
  lang: "en" as const,
  tagLabels: ["DNS"],
};

describe("blogPostingSchema", () => {
  it("declares the page as a BlogPosting", () => {
    const schema = blogPostingSchema(input);
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("BlogPosting");
  });

  it("keeps the explicit offset on datePublished", () => {
    // A bare date shifts the published day for readers in other timezones,
    // which is exactly what master 8.5 forbids.
    expect(blogPostingSchema(input).datePublished).toBe("2026-08-24T11:00:00.000Z");
  });

  it("links the author to every profile so search engines join them up", () => {
    const author = blogPostingSchema(input).author;
    expect(author["@type"]).toBe("Person");
    expect(author.sameAs).toEqual(AUTHOR_PROFILES);
    expect(AUTHOR_PROFILES).toContain("https://github.com/nlinhvu");
    expect(AUTHOR_PROFILES).toContain("https://www.linkedin.com/in/nlinhvu");
    expect(AUTHOR_PROFILES).toContain("https://www.youtube.com/@linhvudev");
  });

  it("uses absolute URLs for the canonical page and the image", () => {
    const schema = blogPostingSchema(input);
    expect(schema.mainEntityOfPage).toBe(input.canonical);
    expect(schema.image).toBe(input.imageUrl);
  });

  it("reports the language of the version being read", () => {
    expect(blogPostingSchema({ ...input, lang: "vi" }).inLanguage).toBe("vi");
  });
});
