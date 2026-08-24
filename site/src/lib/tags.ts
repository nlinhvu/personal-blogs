interface HasTags {
  data: { tags: string[] };
}

// Only tags that a post actually carries get a page. A tag declared in
// tags.yaml but unused produces no route, so no empty page enters the sitemap.
export function usedTags(entries: HasTags[]): string[] {
  const seen = new Set<string>();
  for (const entry of entries) {
    for (const tag of entry.data.tags) {
      seen.add(tag);
    }
  }
  return [...seen].sort();
}
