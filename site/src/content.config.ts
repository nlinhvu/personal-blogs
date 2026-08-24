import { defineCollection } from "astro:content";
import { bilingualPostLoader } from "./loaders/bilingual-post";
import { CONTENT_BASE } from "./lib/content-base";

const blog = defineCollection({
  loader: bilingualPostLoader({ base: CONTENT_BASE }),
});

export const collections = { blog };
