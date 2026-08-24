import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { extractProtected, restoreProtected, assertProtectedIntact } from "./lib/protect";
import { splitFrontmatter, joinFrontmatter, translatableEntries } from "./lib/frontmatter";
import { createTranslator, type Translate } from "./lib/gemini";

const LANGUAGE_NAME = { en: "English", vi: "Vietnamese" } as const;
type Language = keyof typeof LANGUAGE_NAME;

export interface TranslateOptions {
  contentRoot: string;
  slug: string;
  force?: boolean;
  translate: Translate;
}

/**
 * Translate one span of text with every code block, inline span and path lifted
 * out first and put back afterwards. Used for the body and for each front
 * matter value alike — a title carrying `Thread.ofVirtual()` deserves the same
 * guard the body gets.
 */
async function translateGuarded(
  source: string,
  from: Language,
  to: Language,
  translate: Translate,
): Promise<string> {
  const { text, tokens } = extractProtected(source);
  const translated = await translate(text, LANGUAGE_NAME[from], LANGUAGE_NAME[to]);
  const restored = restoreProtected(translated, tokens);
  assertProtectedIntact(source, restored);
  return restored;
}

export async function translatePost(options: TranslateOptions): Promise<string> {
  const dir = join(options.contentRoot, "blog", options.slug);

  const metaPath = join(dir, "post.yaml");
  if (!existsSync(metaPath)) {
    throw new Error(`Post "${options.slug}" has no post.yaml at ${metaPath}`);
  }
  const meta = parseYaml(readFileSync(metaPath, "utf8")) as { source: Language };

  const from: Language = meta.source;
  const to: Language = from === "en" ? "vi" : "en";

  const sourcePath = join(dir, `${from}.md`);
  const targetPath = join(dir, `${to}.md`);

  if (!existsSync(sourcePath)) {
    throw new Error(`Source file missing: ${sourcePath} (post.yaml says source: ${from})`);
  }
  if (existsSync(targetPath) && !options.force) {
    throw new Error(
      `${targetPath} already exists. Re-run with --force to overwrite, but note that hand edits in that file will be lost.`,
    );
  }

  // Front matter is structure, so it is split off rather than sent out with an
  // instruction to be careful with it. Only its prose values travel.
  const { data, raw, body } = splitFrontmatter(readFileSync(sourcePath, "utf8"));

  const translatedBody = await translateGuarded(body, from, to, options.translate);

  const updates: Record<string, string> = {};
  for (const [key, value] of translatableEntries(data)) {
    updates[key] = await translateGuarded(value, from, to, options.translate);
  }

  // Nothing has been written yet. Every guard above throws before this line, so
  // a failed translation leaves no half-finished file behind.
  writeFileSync(targetPath, joinFrontmatter(raw, updates, translatedBody), "utf8");
  return targetPath;
}

// node --env-file-if-exists announces a missing file on stderr, once per
// process, and tsx spawns a child — so the CLI greeted every run with the same
// line twice. Loading it here is silent, and a missing .env is not news: the
// key can just as well come from the shell.
function loadEnvFile(): void {
  try {
    process.loadEnvFile(resolve(process.cwd(), ".env"));
  } catch {
    // No .env. GEMINI_API_KEY may still be exported; if it is not, the
    // translator says so by name.
  }
}

async function main(): Promise<void> {
  loadEnvFile();
  const args = process.argv.slice(2);
  const slug = args.find((arg) => !arg.startsWith("--"));
  const force = args.includes("--force");

  if (!slug) {
    console.error("Usage: npm run translate <slug> [-- --force]");
    process.exit(1);
  }

  const contentRoot = resolve(process.cwd(), "content");
  const translate = createTranslator(join(contentRoot, "glossary.yaml"));

  const written = await translatePost({ contentRoot, slug, force, translate });

  console.log(`Wrote ${written}`);
  console.log("Read `git diff` before committing. Every translation is reviewed by a human.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
