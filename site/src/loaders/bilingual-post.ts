import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import matter from "gray-matter";
import { z } from "astro/zod";
import type { Loader } from "astro/loaders";

export const LANGUAGES = ["en", "vi"] as const;
export type Language = (typeof LANGUAGES)[number];

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const postMetaSchema = z.object({
  pubDate: z.string().datetime({ offset: true }),
  tags: z.array(z.string().regex(SLUG_PATTERN)).min(1),
  source: z.enum(LANGUAGES),
  // Absent means published. Opting IN to being hidden is the safe default:
  // forgetting the field publishes a finished post, while the other way round
  // would silently withhold one and give no signal that it happened.
  draft: z.boolean().optional().default(false),
});

const frontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});

const tagRegistrySchema = z.record(
  z.string().regex(SLUG_PATTERN),
  z.object({ en: z.string().min(1), vi: z.string().min(1) }),
);

export interface CollectedPost {
  id: string;
  slug: string;
  lang: Language;
  filePath: string;
  body: string;
  data: {
    slug: string;
    lang: Language;
    title: string;
    description: string;
    pubDate: Date;
    tags: string[];
    source: Language;
    draft: boolean;
  };
}

export function readTagRegistry(contentRoot: string): Record<string, { en: string; vi: string }> {
  const path = join(contentRoot, "tags.yaml");
  if (!existsSync(path)) {
    throw new Error(`Tag registry not found at ${path}`);
  }
  return tagRegistrySchema.parse(parseYaml(readFileSync(path, "utf8")));
}

// A draft is a post that is finished enough to sit in the repository and not
// finished enough to be public. Dropping it HERE, in the loader, is the whole
// design: the home page, both tag routes, both feeds and the sitemap all read
// from this one list, so one filter covers six places that would otherwise each
// need to remember.
export function collectPosts(
  contentRoot: string,
  options: { includeDrafts?: boolean } = {},
): CollectedPost[] {
  const tags = readTagRegistry(contentRoot);
  const blogRoot = join(contentRoot, "blog");
  const slugs = readdirSync(blogRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const posts: CollectedPost[] = [];

  for (const slug of slugs) {
    if (!SLUG_PATTERN.test(slug)) {
      throw new Error(`Post directory "${slug}" is not ASCII kebab-case`);
    }

    const dir = join(blogRoot, slug);
    const metaPath = join(dir, "post.yaml");
    if (!existsSync(metaPath)) {
      throw new Error(`Post "${slug}" is missing post.yaml`);
    }
    const meta = postMetaSchema.parse(parseYaml(readFileSync(metaPath, "utf8")));

    for (const tag of meta.tags) {
      if (!(tag in tags)) {
        throw new Error(`Post "${slug}" uses undeclared tag "${tag}" — add it to content/tags.yaml`);
      }
    }

    for (const lang of LANGUAGES) {
      const filePath = join(dir, `${lang}.md`);
      if (!existsSync(filePath)) {
        throw new Error(
          `Post "${slug}" is missing ${lang}.md — every post must exist in both languages`,
        );
      }
    }

    // Checked after the structural rules above, on purpose: a draft that is
    // missing a translation or naming an undeclared tag must still fail the
    // build now, not on the day it is published.
    if (meta.draft && !options.includeDrafts) {
      continue;
    }

    for (const lang of LANGUAGES) {
      const filePath = join(dir, `${lang}.md`);
      const parsed = matter(readFileSync(filePath, "utf8"));
      const frontmatter = frontmatterSchema.parse(parsed.data);

      posts.push({
        id: `${slug}/${lang}`,
        slug,
        lang,
        filePath,
        body: parsed.content,
        data: {
          slug,
          lang,
          ...frontmatter,
          pubDate: new Date(meta.pubDate),
          tags: meta.tags,
          source: meta.source,
          draft: meta.draft,
        },
      });
    }
  }

  return posts;
}

export function bilingualPostLoader(options: { base: string }): Loader {
  return {
    name: "bilingual-post-loader",
    load: async ({ store, renderMarkdown, generateDigest, logger }) => {
      // Drafts are visible exactly where the site is already told not to be
      // indexed. IS_DEV drives the X-Robots-Tag on staging and preview, so
      // reusing it means a draft can be reviewed on a real deployment without
      // any chance of it reaching a search engine.
      const includeDrafts = process.env.IS_DEV === "true";
      const posts = collectPosts(options.base, { includeDrafts });
      store.clear();

      for (const post of posts) {
        store.set({
          id: post.id,
          data: post.data,
          body: post.body,
          filePath: post.filePath,
          digest: generateDigest(post.body),
          rendered: await renderMarkdown(post.body),
        });
      }

      logger.info(
        `Loaded ${posts.length} entries from ${posts.length / 2} bilingual posts` +
          (includeDrafts ? " (drafts included)" : ""),
      );
    },
  };
}
