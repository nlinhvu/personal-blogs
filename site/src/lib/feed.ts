import type { Language } from "../loaders/bilingual-post";
import { postPath, canonicalUrl } from "./urls";

interface FeedEntry {
  data: {
    slug: string;
    lang: Language;
    title: string;
    description: string;
    pubDate: Date;
  };
}

// The guid is the absolute canonical post URL and NOTHING ELSE.
// It is frozen for the life of the post. Deriving it from the title or the
// body would make every edit look like a brand new post to every subscriber,
// and that cannot be undone once the feed has gone out.
// `link` is the same absolute URL as the guid, and passing it absolute is the
// point: handed a relative path, @astrojs/rss joins it to the site URL and
// appends a trailing slash, which this site answers with a 307. That would put
// a redirect in front of every subscriber who clicks through, and would show
// them a URL that differs from the canonical one they would share.
export function feedItem(entry: FeedEntry, siteUrl: string) {
  const guid = canonicalUrl(postPath(entry.data.slug, entry.data.lang), siteUrl);

  return {
    title: entry.data.title,
    description: entry.data.description,
    pubDate: entry.data.pubDate,
    link: guid,
    guid,
    customData: `<guid isPermaLink="true">${guid}</guid>`,
  };
}

// @astrojs/rss builds the channel <link> from `site` and always leaves a
// trailing slash on it. This site answers a trailing slash with a 307, so the
// one link a reader surfaces as "visit website" would be a redirect. Rewriting
// it here keeps the whole feed on the URL contract the rest of the site keeps.
//
// Only the channel link is touched: it is the first <link> in the document,
// and every item link is already absolute and slash-free.
export function withChannelLink(xml: string, channelUrl: string): string {
  return xml.replace(/<link>[^<]*<\/link>/, `<link>${channelUrl}</link>`);
}
