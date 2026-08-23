// @ts-check
import { defineConfig } from "astro/config";
import { emitHeaders } from "./src/integrations/emit-headers";

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
  integrations: [emitHeaders()],
  security: {
    csp: {
      algorithm: "SHA-256",
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
      ],
    },
  },
});
