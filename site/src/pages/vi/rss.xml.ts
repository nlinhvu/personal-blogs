import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIContext } from "astro";
import { feedItem, withChannelLink } from "../../lib/feed";
import { canonicalUrl } from "../../lib/urls";

export async function GET(context: APIContext) {
  const site = context.site!.toString();
  const entries = (await getCollection("blog", ({ data }) => data.lang === "vi")).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );

  // The channel link is what a reader shows as "visit website". It has to be
  // the Vietnamese home page: sending a Vietnamese subscriber to the English
  // one is the wrong destination in the one place a reader offers.
  const response = await rss({
    title: "vulinh.dev",
    description: "Bài viết kỹ thuật song ngữ về Java, Spring và JVM.",
    site,
    items: entries.map((entry) => feedItem(entry, site)),
  });

  const xml = withChannelLink(await response.text(), canonicalUrl("/vi", site));
  return new Response(xml, { headers: response.headers });
}
