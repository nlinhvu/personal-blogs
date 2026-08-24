import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";

// Model names move, and .env overrides this. A run that fails because the name
// is wrong prints the models the key can actually reach.
const DEFAULT_MODEL = "gemini-3.5-flash";

interface GlossaryEntry {
  en: string;
  vi: string;
  note?: string;
}

/**
 * What is being translated. A body is a Markdown document; a field is one value
 * out of the front matter — a title or a description. They need different
 * instructions, which is not a nicety: handed a bare title under the body
 * prompt, a model wrote the whole blog post the title described.
 */
export type TranslationKind = "body" | "field";

export type Translate = (
  text: string,
  from: string,
  to: string,
  kind: TranslationKind,
) => Promise<string>;

export function buildSystemInstruction(
  glossaryPath: string,
  from: string,
  to: string,
  kind: TranslationKind,
): string {
  const glossary = (parseYaml(readFileSync(glossaryPath, "utf8")) ?? []) as GlossaryEntry[];
  const terms = glossary
    .map((term) => `- "${term.en}" -> "${term.vi}"${term.note ? ` (${term.note})` : ""}`)
    .join("\n");

  const opening =
    kind === "field"
      ? [
          `You translate one field value from a blog post's front matter, from ${from} to ${to}.`,
          "",
          "What you receive is a single value — a title or a description. It is",
          "NOT a request to write anything. However short it is, translate it and",
          "stop.",
          "",
          "Rules:",
          "1. Return exactly one line: the translated value, nothing else. No",
          "   heading, no Markdown, no code block, no surrounding quotes, no",
          "   commentary, and never an article on the subject it names.",
        ]
      : [
          `You translate technical blog posts from ${from} to ${to}.`,
          "",
          "Rules:",
          "1. Translate prose only. Preserve Markdown structure exactly: headings,",
          "   lists, emphasis, table pipes, and blank lines.",
        ];

  return [
    ...opening,
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

export interface ApiFailure {
  code?: number;
  status?: string;
  message: string;
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;

/**
 * Turn whatever the SDK threw into one readable line.
 *
 * A real 503 arrives as an object whose `error.message` is itself a JSON
 * document describing the same failure again. Printed as-is it reaches the
 * author as a line of escaped braces, which says nothing about what to do next.
 */
export function describeApiError(error: unknown): ApiFailure {
  const outer = asRecord(error);
  const wrapped = asRecord(outer?.error) ?? outer;

  let message =
    typeof wrapped?.message === "string"
      ? wrapped.message
      : error instanceof Error
        ? error.message
        : String(error);

  let code = typeof wrapped?.code === "number" ? wrapped.code : undefined;
  let status = typeof wrapped?.status === "string" && wrapped.status ? wrapped.status : undefined;

  // The second layer: a message that is itself a JSON error document.
  const trimmed = message.trim();
  if (trimmed.startsWith("{")) {
    try {
      const inner = asRecord(asRecord(JSON.parse(trimmed))?.error);
      if (inner) {
        if (typeof inner.message === "string") message = inner.message;
        if (typeof inner.code === "number") code = inner.code;
        if (typeof inner.status === "string" && inner.status) status = inner.status;
      }
    } catch {
      // Not JSON after all. The outer message is the best there is.
    }
  }

  return { code, status, message: message.trim() };
}

// Worth another go: the request was fine and the service was not. A failure
// with no code at all is a dropped socket or a timeout, which is the same kind
// of thing. Everything else is a problem with the request, and retrying it just
// burns quota.
const TRANSIENT = new Set([408, 425, 429, 500, 502, 503, 504]);

export function isTransient(code: number | undefined): boolean {
  return code === undefined || TRANSIENT.has(code);
}

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (note: string) => void;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function failureAsError(failure: ApiFailure): Error {
  const error = new Error(failure.message) as Error & { code?: number };
  error.code = failure.code;
  return error;
}

export async function withRetry<T>(work: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 2000;
  const sleep = options.sleep ?? wait;

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      const failure = describeApiError(error);

      if (!isTransient(failure.code)) throw failureAsError(failure);

      if (attempt >= attempts) {
        throw failureAsError({
          ...failure,
          message: `Gave up after ${attempts} attempts. Last failure${
            failure.code ? ` (${failure.code})` : ""
          }: ${failure.message}`,
        });
      }

      const delay = baseDelayMs * 2 ** (attempt - 1);
      options.onRetry?.(
        `${failure.message} — retrying in ${delay / 1000}s (attempt ${attempt + 1} of ${attempts})`,
      );
      await sleep(delay);
    }
  }
}

/**
 * One client and one glossary read for the whole run, not one per call. The
 * returned function is what translatePost is given, which is also what the
 * tests replace with a stand-in.
 */
export function createTranslator(glossaryPath: string, retry: RetryOptions = {}): Translate {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Copy .env.example to .env and fill it in.");
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const ai = new GoogleGenAI({ apiKey });

  return async function translate(
    text: string,
    from: string,
    to: string,
    kind: TranslationKind,
  ): Promise<string> {
    return withRetry(
      async () => {
        try {
          const stream = await ai.models.generateContentStream({
            model,
            contents: text,
            config: { systemInstruction: buildSystemInstruction(glossaryPath, from, to, kind) },
          });

          let out = "";
          for await (const chunk of stream) {
            out += chunk.text ?? "";
          }
          return out.trim();
        } catch (error) {
          const failure = describeApiError(error);
          if (failure.code === 404 || /not found|not supported/i.test(failure.message)) {
            throw await explainModelFailure(ai, model, failure);
          }
          throw error;
        }
      },
      { onRetry: (note) => console.error(note), ...retry },
    );
  };
}

// "models/gemini-x is not found" is a name problem, and the useful answer is
// the list of names that do work. Asking for it costs one metadata call and
// turns a dead end into a one-line fix in .env. The code travels with the error
// so the retry loop knows not to try again.
async function explainModelFailure(
  ai: GoogleGenAI,
  model: string,
  failure: ApiFailure,
): Promise<Error> {
  let tail: string;
  try {
    const names: string[] = [];
    for await (const entry of await ai.models.list()) {
      if (entry.name) names.push(entry.name.replace(/^models\//, ""));
    }
    tail =
      `\n\nModels this key can reach:\n${names.map((name) => `  ${name}`).join("\n")}\n\n` +
      "Put one of those in GEMINI_MODEL in your .env.";
  } catch {
    tail = "\n\nListing the available models failed too, so the key may be the problem.";
  }

  return failureAsError({
    ...failure,
    code: failure.code ?? 404,
    message: `The model "${model}" did not work.\n${failure.message}${tail}`,
  });
}
