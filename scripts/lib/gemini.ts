import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";

// Model names move. This is the default, and .env overrides it; a run that
// fails because the name is wrong prints the models the key can actually reach
// instead of a bare 404.
const DEFAULT_MODEL = "gemini-3.5-flash";

interface GlossaryEntry {
  en: string;
  vi: string;
  note?: string;
}

export type Translate = (text: string, from: string, to: string) => Promise<string>;

export function buildSystemInstruction(glossaryPath: string, from: string, to: string): string {
  const glossary = (parseYaml(readFileSync(glossaryPath, "utf8")) ?? []) as GlossaryEntry[];
  const terms = glossary
    .map((term) => `- "${term.en}" -> "${term.vi}"${term.note ? ` (${term.note})` : ""}`)
    .join("\n");

  return [
    `You translate technical blog posts from ${from} to ${to}.`,
    "",
    "Rules:",
    "1. Translate prose only. Preserve Markdown structure exactly: headings,",
    "   lists, emphasis, table pipes, and blank lines.",
    "2. Tokens shaped like ⟦CODE_0⟧, ⟦SPAN_3⟧ or ⟦URL_7⟧ are placeholders. Each",
    "   one stands for a span that must not change: a code block, an inline code",
    "   span, or a path. Reproduce every placeholder EXACTLY, keeping its",
    "   brackets and its number. Never translate, reformat, renumber, drop or",
    "   duplicate one, and never invent a new one.",
    "3. A placeholder may sit inside a sentence. Move it if the target language",
    "   needs a different word order, but do not change its text.",
    "4. Keep English technical terms in English unless the glossary says",
    "   otherwise.",
    "5. Write natural, modern Vietnamese as used by working software engineers.",
    "   Do not use archaic Sino-Vietnamese vocabulary.",
    "6. Return the translated text and nothing else. No preamble, no fences",
    "   around the whole answer, no commentary.",
    "",
    "Glossary:",
    terms,
  ].join("\n");
}

/**
 * One client and one glossary read for the whole run, not one per call. The
 * returned function is what translatePost is given, which is also what the
 * tests replace with a stand-in.
 */
export function createTranslator(glossaryPath: string): Translate {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Copy .env.example to .env and fill it in.");
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const ai = new GoogleGenAI({ apiKey });

  return async function translate(text: string, from: string, to: string): Promise<string> {
    let stream;
    try {
      stream = await ai.models.generateContentStream({
        model,
        contents: text,
        config: { systemInstruction: buildSystemInstruction(glossaryPath, from, to) },
      });
    } catch (error) {
      throw await explainModelFailure(ai, model, error);
    }

    let out = "";
    for await (const chunk of stream) {
      out += chunk.text ?? "";
    }
    return out.trim();
  };
}

// "models/gemini-x is not found" is a name problem, and the useful answer is
// the list of names that do work. Asking for it costs one metadata call and
// turns a dead end into a one-line fix in .env.
async function explainModelFailure(
  ai: GoogleGenAI,
  model: string,
  error: unknown,
): Promise<Error> {
  const detail = error instanceof Error ? error.message : String(error);
  if (!/not found|not supported|NOT_FOUND|INVALID_ARGUMENT/i.test(detail)) {
    return error instanceof Error ? error : new Error(detail);
  }

  try {
    const names: string[] = [];
    for await (const entry of await ai.models.list()) {
      if (entry.name) names.push(entry.name.replace(/^models\//, ""));
    }
    return new Error(
      `The model "${model}" did not work.\n${detail}\n\n` +
        `Models this key can reach:\n${names.map((n) => `  ${n}`).join("\n")}\n\n` +
        "Put one of those in GEMINI_MODEL in your .env.",
    );
  } catch {
    return new Error(
      `The model "${model}" did not work, and listing the available models failed too.\n${detail}`,
    );
  }
}
