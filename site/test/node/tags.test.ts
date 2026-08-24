import { describe, it, expect } from "vitest";
import { usedTags } from "../../src/lib/tags";

const entry = (tags: string[]) => ({ data: { tags } });

describe("usedTags", () => {
  it("returns only tags that at least one post carries", () => {
    expect(usedTags([entry(["spring-boot"]), entry(["spring-boot", "jvm-internals"])])).toEqual([
      "jvm-internals",
      "spring-boot",
    ]);
  });

  it("returns an empty list when no post carries any tag", () => {
    expect(usedTags([])).toEqual([]);
  });

  it("deduplicates", () => {
    expect(usedTags([entry(["a"]), entry(["a"]), entry(["a"])])).toEqual(["a"]);
  });
});
