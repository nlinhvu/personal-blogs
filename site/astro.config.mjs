// @ts-check
import { defineConfig } from "astro/config";
import { emitHeaders } from "./src/integrations/emit-headers";
import tailwindcss from "@tailwindcss/vite";

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
  vite: { plugins: [tailwindcss()] },
  // Prism, not the default Shiki. Shiki paints every token with an inline
  // `style` attribute, and CSP blocks those: a hash cannot whitelist a style
  // ATTRIBUTE without `unsafe-hashes`, so the colours never arrive and the
  // browser logs one violation per token. Prism emits class names instead,
  // which `src/styles/code.css` colours from a real stylesheet.
  markdown: { syntaxHighlight: "prism" },
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
