import { describe, it, expect } from "vitest";
import { buildStamp } from "../../src/pages/version.txt";

// The deploy gate compares this value against the SHA it just pushed, so every
// way of NOT having a SHA has to end up somewhere that cannot match one. The
// empty string is the dangerous case and the one that actually happens: a
// composite action input that is never passed arrives as "", not as undefined.
describe("buildStamp", () => {
  it("passes a real commit through untouched", () => {
    expect(buildStamp("ce0207a1b2c3d4e5f6")).toBe("ce0207a1b2c3d4e5f6");
  });

  it("falls back to a sentinel for every shape of missing", () => {
    expect(buildStamp(undefined)).toBe("dev");
    expect(buildStamp("")).toBe("dev");
    expect(buildStamp("   ")).toBe("dev");
  });

  it("never returns something an unset variable could match", () => {
    for (const missing of [undefined, "", "   "]) {
      expect(buildStamp(missing)).not.toBe("");
      expect(buildStamp(missing)).not.toBe(process.env.NOT_SET_ANYWHERE ?? "");
    }
  });
});
