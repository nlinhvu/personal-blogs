import type { Language } from "../loaders/bilingual-post";

// sameAs is what lets a search engine decide the blog, the GitHub account and
// the LinkedIn profile are one person. Without it each is an unconnected
// island, and the blog earns none of the authority the others carry.
export const AUTHOR_PROFILES = [
  "https://github.com/nlinhvu",
  "https://www.linkedin.com/in/nlinhvu",
  "https://www.youtube.com/@linhvudev",
] as const;

export const AUTHOR_NAME = "Linh Vu";
export const SITE_NAME = "vulinh.dev";

export interface BlogPostingInput {
  title: string;
  description: string;
  canonical: string;
  imageUrl: string;
  pubDate: Date;
  lang: Language;
  tagLabels: string[];
}

export function blogPostingSchema(input: BlogPostingInput) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.title,
    description: input.description,
    // toISOString() keeps the instant and normalises to UTC. The offset in
    // post.yaml is preserved as a point in time, not dropped.
    datePublished: input.pubDate.toISOString(),
    inLanguage: input.lang,
    mainEntityOfPage: input.canonical,
    image: input.imageUrl,
    keywords: input.tagLabels,
    author: {
      "@type": "Person",
      name: AUTHOR_NAME,
      url: `https://${SITE_NAME}/`,
      sameAs: AUTHOR_PROFILES,
    },
    publisher: {
      "@type": "Person",
      name: AUTHOR_NAME,
      url: `https://${SITE_NAME}/`,
    },
  };
}
