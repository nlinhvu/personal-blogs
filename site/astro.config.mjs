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
        // The analytics beacon POSTs its sample here. connect-src has no
        // explicit value otherwise, so it falls back to default-src 'self'
        // and the POST is refused — the script loads and still reports
        // nothing. Allowing the script without this buys a broken beacon.
        "connect-src 'self' https://cloudflareinsights.com",
      ],
      // Cloudflare Web Analytics injects its beacon into HTML responses at the
      // edge, for browser-shaped requests only, so curl and the test suite
      // never see it. It is an external script with a known host, which is
      // what makes it allowable at all: unlike an injected inline script, a
      // host source is enough and no per-request nonce is needed.
      //
      // Listing resources REPLACES Astro's defaults, so 'self' has to be
      // repeated here. Astro still appends its own per-page hashes.
      // A third-party analytics vendor is added by extending this list.
      scriptDirective: {
        resources: ["'self'", "https://static.cloudflareinsights.com"],
      },
    },
  },
});
