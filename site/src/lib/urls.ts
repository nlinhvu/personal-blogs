import type { Language } from "../loaders/bilingual-post";

const PREFIX: Record<Language, string> = { en: "", vi: "/vi" };

export function postPath(slug: string, lang: Language): string {
  return `${PREFIX[lang]}/blog/${slug}`;
}

export function tagPath(tagSlug: string, lang: Language): string {
  return `${PREFIX[lang]}/tags/${tagSlug}`;
}

export function feedPath(lang: Language): string {
  return `${PREFIX[lang]}/rss.xml`;
}

export function canonicalUrl(path: string, siteUrl: string): string {
  return new URL(path, siteUrl).toString().replace(/\/$/, path === "/" ? "/" : "");
}

export function otherLanguage(lang: Language): Language {
  return lang === "en" ? "vi" : "en";
}

// The image path mirrors the page path it belongs to. Anything else needs a
// lookup table, and a lookup table is a place for the two to drift apart --
// which is exactly how a Vietnamese post ends up advertising an English card.
export function ogImagePath(slug: string, lang: Language): string {
  return `/og${PREFIX[lang]}/blog/${slug}.png`;
}

export function tagIndexPath(lang: Language): string {
  return `${PREFIX[lang]}/tags`;
}

export function searchPath(lang: Language): string {
  return `${PREFIX[lang]}/search`;
}
