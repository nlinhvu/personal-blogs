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
