// @ts-check
import { defineConfig } from "astro/config";
import { emitHeaders } from "./src/integrations/emit-headers";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

const SITE_URL = process.env.SITE_URL ?? "https://vulinh.dev";

// The test build writes somewhere else on purpose. CI builds the real site,
// then runs the suite, then deploys what it built — so a test run that wrote
// into dist/ would replace the deployable site with one made of fixtures.
const OUT_DIR = process.env.OUT_DIR ?? "./dist";

export default defineConfig({
  site: SITE_URL,
  outDir: OUT_DIR,
  output: "static",
  trailingSlash: "never",
  build: { format: "file" },
  i18n: {
    defaultLocale: "en",
    locales: ["en", "vi"],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    emitHeaders(),
    // hreflang pairs in the sitemap, so a crawler is told the two language
    // versions are the same document rather than duplicate content.
    sitemap({
      i18n: {
        defaultLocale: "en",
        locales: { en: "en", vi: "vi" },
      },
    }),
  ],
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
        // Where the beacon reports. Measured on production 2026-08-24: it
        // POSTs same-origin to /cdn-cgi/rum and gets 204, because Cloudflare
        // proxies that endpoint through the zone itself. So 'self' is the part
        // that carries it, and default-src would have covered it anyway.
        // Stated explicitly regardless: this is a destination worth being able
        // to read off the policy rather than inferring from a fallback. The
        // vendor host stays as a hedge for a beacon build that posts direct.
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
