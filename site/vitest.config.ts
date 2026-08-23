import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Two runtimes, so two projects. The split is not cosmetic: workerd has no real
// filesystem, so build-time code that reads content/ from disk cannot run there,
// and code that talks to a Worker binding cannot run on Node.
//
// vitest-pool-workers 0.22 ships the pool as a Vite plugin, so it is scoped by
// attaching it to one project rather than by filtering test files.
export default defineConfig({
  test: {
    projects: [
      {
        // Runs inside workerd against the real Worker and its static assets.
        // Everything importing "cloudflare:test" belongs here.
        plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
        test: {
          name: "workers",
          include: ["test/workers/**/*.test.ts"],
        },
      },
      {
        // Plain Node. Build-time code only: content loaders, URL helpers, feed
        // builders. These read node:fs and never touch a binding.
        test: {
          name: "node",
          environment: "node",
          include: ["test/node/**/*.test.ts"],
        },
      },
    ],
  },
});
