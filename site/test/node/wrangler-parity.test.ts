import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

// The workers suite runs against test/wrangler.test.jsonc, which duplicates the
// asset options of the deployed wrangler.jsonc. Duplication is the price of
// letting those tests build from fixtures instead of from real posts; drift is
// what that price becomes if nobody watches. Two of these options ARE the
// behaviour under test — html_handling turns a trailing slash into a redirect,
// not_found_handling serves the 404 page — so a divergence would leave the
// suite green while production quietly behaved differently.

/** Strips // comments from JSONC without touching them inside string values. */
function stripComments(source: string): string {
  let out = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (inString) {
      out += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      out += char;
      continue;
    }

    // A "//" outside a string starts a comment. Inside one it is just a URL.
    if (char === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      out += "\n";
      continue;
    }

    out += char;
  }

  return out;
}

interface WranglerConfig {
  main: string;
  compatibility_date: string;
  assets: Record<string, string>;
}

function load(path: string): WranglerConfig {
  return JSON.parse(stripComments(readFileSync(path, "utf8")));
}

describe("the test wrangler config matches the deployed one", () => {
  const deployed = load("wrangler.jsonc");
  const forTests = load("test/wrangler.test.jsonc");

  it.each(["html_handling", "not_found_handling", "binding"])("agrees on assets.%s", (key) => {
    expect(forTests.assets[key]).toBe(deployed.assets[key]);
  });

  it("runs the same Worker entrypoint", () => {
    expect(forTests.main.replace(/^\.\.\//, "./")).toBe(deployed.main);
  });

  it("runs on the same compatibility date", () => {
    expect(forTests.compatibility_date).toBe(deployed.compatibility_date);
  });

  // Pointing the test config at dist/ would put a site made of fixtures where
  // the deployable one belongs. Keeping them apart is the whole point.
  it("serves a different directory from the deployed config", () => {
    expect(forTests.assets.directory).not.toBe(deployed.assets.directory);
  });
});
