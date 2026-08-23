import { defineCollection } from "astro:content";
import { bilingualPostLoader } from "./loaders/bilingual-post";

const blog = defineCollection({
  loader: bilingualPostLoader({ base: "../content" }),
});

export const collections = { blog };
