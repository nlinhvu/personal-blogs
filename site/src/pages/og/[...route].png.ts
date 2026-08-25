import { readFileSync } from "node:fs";
import { getCollection } from "astro:content";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { APIRoute } from "astro";
import { buildOgCard, OG_WIDTH, OG_HEIGHT } from "../../lib/og-card";
import { readTagRegistry } from "../../loaders/bilingual-post";
import { CONTENT_BASE } from "../../lib/content-base";
import { ogImagePath } from "../../lib/urls";

// Read once at module scope. This is BUILD-time code -- there is no request
// isolate here -- so the module-scope rule for Workers does not apply.
// The path resolves to site/og/, which is outside src/ and outside public/:
// nothing under those two can copy it into dist/.
const FONT = readFileSync(new URL("../../../og/Inter-Bold.ttf", import.meta.url));

export async function getStaticPaths() {
  const entries = await getCollection("blog");
  const tags = readTagRegistry(CONTENT_BASE);

  return entries.map((entry) => ({
    // ogImagePath() is the single source of truth for this mapping. Deriving the
    // param from it -- rather than rebuilding the string here -- is what stops
    // the page's og:image and the generated file from ever disagreeing.
    params: { route: ogImagePath(entry.data.slug, entry.data.lang).replace(/^\/og\/|\.png$/g, "") },
    props: {
      title: entry.data.title,
      tagLabels: entry.data.tags.map((tag) => tags[tag][entry.data.lang]),
      date: entry.data.pubDate.toISOString().slice(0, 10),
    },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const svg = await satori(
    buildOgCard({
      siteName: "vulinh.dev",
      title: props.title as string,
      tagLabels: props.tagLabels as string[],
      date: props.date as string,
    }) as never,
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: [{ name: "Inter", data: FONT, weight: 700, style: "normal" }],
    },
  );

  const png = new Resvg(svg, { fitTo: { mode: "width", value: OG_WIDTH } }).render().asPng();

  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png" },
  });
};
