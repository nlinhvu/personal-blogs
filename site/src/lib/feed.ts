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
