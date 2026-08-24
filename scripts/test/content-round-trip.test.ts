import { describe, it, expect } from "vitest";
import { globSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { extractProtected, restoreProtected, assertProtectedIntact } from "../lib/protect";

// Every rule test uses a hand-written sample, which only ever proves the guard
// handles what was imagined while writing it. This one runs the guard over the
// posts that actually exist, so the day a post uses a construct the guard
// mishandles, the suite says so before the translation script ever runs.
const REPO = fileURLToPath(new URL("../..", import.meta.url));
const posts = globSync(join(REPO, "content/blog/*/*.md")).sort();

describe("the guard round-trips every post in the repo", () => {
  it("found posts to check", () => {
    // Without this the suite below would pass on an empty list and read as
    // coverage it does not have.
    expect(posts.length).toBeGreaterThan(0);
  });

  it.each(posts)("%s survives untouched", (path) => {
    const source = readFileSync(path, "utf8");
    const { text, tokens } = extractProtected(source);
    const restored = restoreProtected(text, tokens);

    expect(restored, `${relative(REPO, path)} did not round-trip`).toBe(source);
    expect(() => assertProtectedIntact(source, restored)).not.toThrow();
  });
});
