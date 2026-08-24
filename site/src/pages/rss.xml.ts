import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIContext } from "astro";
import { feedItem } from "../lib/feed";

export async function GET(context: APIContext) {
  const site = context.site!.toString();
  const entries = (await getCollection("blog", ({ data }) => data.lang === "en")).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );

  return rss({
    title: "vulinh.dev",
    description: "Bilingual technical writing on Java, Spring and the JVM.",
    site,
    items: entries.map((entry) => feedItem(entry, site)),
  });
}
