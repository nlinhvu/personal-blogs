import type { AstroIntegration } from "astro";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { buildHeadersFile } from "../config/security-headers";

export function emitHeaders(): AstroIntegration {
  return {
    name: "emit-headers",
    hooks: {
      "astro:build:done": ({ dir, logger }) => {
        const isDev = process.env.IS_DEV === "true";
        const target = join(fileURLToPath(dir), "_headers");
        writeFileSync(target, buildHeadersFile(isDev), "utf8");
        logger.info(`Wrote _headers (dev=${isDev})`);
      },
    },
  };
}
