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
export function feedItem(entry: FeedEntry, siteUrl: string) {
  const link = postPath(entry.data.slug, entry.data.lang);
  const guid = canonicalUrl(link, siteUrl);

  return {
    title: entry.data.title,
    description: entry.data.description,
    pubDate: entry.data.pubDate,
    link,
    guid,
    customData: `<guid isPermaLink="true">${guid}</guid>`,
  };
}
