// @ts-check
import { defineConfig } from "astro/config";

const SITE_URL = process.env.SITE_URL ?? "https://vulinh.dev";

export default defineConfig({
  site: SITE_URL,
  output: "static",
  trailingSlash: "never",
  build: { format: "file" },
  i18n: {
    defaultLocale: "en",
    locales: ["en", "vi"],
    routing: { prefixDefaultLocale: false },
  },
});
