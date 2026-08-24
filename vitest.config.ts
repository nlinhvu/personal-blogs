import { defineConfig } from "vitest/config";

// Authoring tooling lives in scripts/ and runs on plain Node — it reads the
// repo from disk and never touches a Worker binding. The site has its own
// two-project config in site/vitest.config.ts; keeping the include list narrow
// here stops this run from sweeping up the workers suite, which only starts
// under the vitest-pool-workers plugin.
export default defineConfig({
  test: {
    name: "scripts",
    environment: "node",
    include: ["scripts/test/**/*.test.ts"],
  },
});
