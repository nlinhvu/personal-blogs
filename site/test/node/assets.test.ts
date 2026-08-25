import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// The test build writes here. See astro.config.mjs OUT_DIR.
const DIST = "./dist-test";

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

describe("what the build is allowed to ship", () => {
  // Fonts are licensed for embedding, but the rule is that none of them reach a
  // browser: they are build inputs that rasterise into PNG. site/og/ sits
  // outside src/ and public/ precisely so nothing can copy one in here. This
  // test is the tripwire for the day somebody moves it "somewhere tidier".
  it("ships no font file at all", () => {
    const fonts = walk(DIST).filter((path) => /\.(ttf|otf|woff2?)$/i.test(path));
    expect(fonts).toEqual([]);
  });

  it("ships one open graph image per post per language", () => {
    const images = walk(join(DIST, "og")).filter((path) => path.endsWith(".png"));
    expect(images.length).toBeGreaterThan(0);
    expect(images.some((path) => path.includes(join("vi", "blog")))).toBe(true);
  });

  it("gives every open graph image real bytes, not an empty file", () => {
    for (const path of walk(join(DIST, "og"))) {
      expect(statSync(path).size).toBeGreaterThan(1000);
    }
  });
});
