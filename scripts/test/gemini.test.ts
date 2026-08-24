import { describe, it, expect, vi } from "vitest";
import { describeApiError, isTransient, withRetry, buildSystemInstruction } from "../lib/gemini";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Exactly what a 503 looked like on the first real run: an object whose
// `error.message` is itself a JSON document. Printed raw, it reaches the author
// as one line of escaped braces.
const REAL_503 = {
  error: {
    message:
      '{\n  "error": {\n    "code": 503,\n    "message": "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",\n    "status": "UNAVAILABLE"\n  }\n}\n',
    code: 503,
    status: "",
  },
};

describe("describeApiError", () => {
  it("unwraps both layers of a real api failure", () => {
    const described = describeApiError(REAL_503);
    expect(described.code).toBe(503);
    expect(described.status).toBe("UNAVAILABLE");
    expect(described.message).toBe(
      "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",
    );
    expect(described.message).not.toContain("\\n");
    expect(described.message).not.toContain("{");
  });

  it("passes an ordinary Error through", () => {
    expect(describeApiError(new Error("socket hang up")).message).toBe("socket hang up");
  });

  it("copes with a bare string", () => {
    expect(describeApiError("something went wrong").message).toBe("something went wrong");
  });

  it("reports a wrong model name with its code", () => {
    const described = describeApiError({
      error: { message: '{"error":{"code":404,"message":"models/nope is not found","status":"NOT_FOUND"}}' },
    });
    expect(described.code).toBe(404);
    expect(described.message).toContain("not found");
  });
});

describe("isTransient", () => {
  // Worth retrying: the request was fine, the service was busy.
  it.each([429, 500, 502, 503, 504])("treats %i as worth retrying", (code) => {
    expect(isTransient(code)).toBe(true);
  });

  // Retrying these just burns quota and the author's patience: the request
  // itself is what is wrong.
  it.each([400, 401, 403, 404])("treats %i as final", (code) => {
    expect(isTransient(code)).toBe(false);
  });

  it("retries a failure that carries no code at all, such as a dropped socket", () => {
    expect(isTransient(undefined)).toBe(true);
  });
});

describe("withRetry", () => {
  it("returns the first success without waiting", async () => {
    const sleep = vi.fn(async () => {});
    const work = vi.fn(async () => "done");
    expect(await withRetry(work, { attempts: 4, sleep })).toBe("done");
    expect(work).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries a busy service and succeeds on a later attempt", async () => {
    const sleep = vi.fn(async () => {});
    let calls = 0;
    const work = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw REAL_503;
      return "done";
    });
    expect(await withRetry(work, { attempts: 4, sleep })).toBe("done");
    expect(work).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("backs off further after each failure", async () => {
    const waits: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
      waits.push(ms);
    });
    await expect(
      withRetry(
        async () => {
          throw REAL_503;
        },
        { attempts: 4, sleep, baseDelayMs: 100 },
      ),
    ).rejects.toThrow(/high demand/);
    expect(waits).toEqual([100, 200, 400]);
  });

  it("gives up after the last attempt and says how many it made", async () => {
    const sleep = vi.fn(async () => {});
    await expect(
      withRetry(
        async () => {
          throw REAL_503;
        },
        { attempts: 3, sleep },
      ),
    ).rejects.toThrow(/3 attempts/);
  });

  it("does not retry a request that was wrong to begin with", async () => {
    const sleep = vi.fn(async () => {});
    const work = vi.fn(async () => {
      throw { error: { message: '{"error":{"code":400,"message":"bad request","status":"INVALID_ARGUMENT"}}' } };
    });
    await expect(withRetry(work, { attempts: 5, sleep })).rejects.toThrow(/bad request/);
    expect(work).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("tells the author each time it is about to wait", async () => {
    const notes: string[] = [];
    await withRetry(
      (() => {
        let calls = 0;
        return async () => {
          calls += 1;
          if (calls < 2) throw REAL_503;
          return "done";
        };
      })(),
      { attempts: 3, sleep: async () => {}, onRetry: (note) => notes.push(note) },
    );
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/high demand/);
    expect(notes[0]).toMatch(/retrying/i);
  });
});

function glossary(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), "gl-"));
  const path = join(dir, "glossary.yaml");
  writeFileSync(path, body);
  return path;
}

describe("buildSystemInstruction", () => {
  // Measured on the first real run. The prompt opened with "You translate
  // technical blog posts", and the model was then handed the bare string "What
  // a virtual thread does when it blocks" — a title. It wrote the blog post.
  // A field has to say it is a field.
  it("tells the model a field is one value, not a post to write", () => {
    const path = glossary("[]\n");
    const prompt = buildSystemInstruction(path, "English", "Vietnamese", "field");
    expect(prompt).toMatch(/single|one value|one line/i);
    expect(prompt).toMatch(/front matter/i);
    expect(prompt).not.toMatch(/headings, /i);
  });

  // The house rule: a term of the trade stays in English, full stop. record,
  // signature, key and fingerprint are terms a software engineer reads as
  // terms — translating them costs the reader the word they would search for.
  // Vietnamese is the exception, and the glossary is where exceptions live.
  it.each(["body", "field"] as const)("tells the %s that English is the default", (kind) => {
    const prompt = buildSystemInstruction(glossary("[]\n"), "English", "Vietnamese", kind);
    expect(prompt).toMatch(/keep .*in English/i);
    // The glossary is the only thing that may send a term the other way.
    expect(prompt).toMatch(/only .*glossary|glossary .*only/i);
    // And an uncertain call lands on English rather than on a guess.
    expect(prompt).toMatch(/in doubt|unsure|not sure/i);
  });

  it.each(["body", "field"] as const)("names the terms the %s must not translate", (kind) => {
    const prompt = buildSystemInstruction(glossary("[]\n"), "English", "Vietnamese", kind);
    // A rule with no examples is a rule a model can agree with and still break.
    // These four are the ones it got wrong, or would have.
    for (const keep of ["record", "signature", "key", "fingerprint", "registrar", "registry"]) {
      expect(prompt, `${keep} must be named as a term to keep`).toContain(keep);
    }
  });

  it.each(["body", "field"] as const)("does not tell the %s to translate any term", (kind) => {
    const prompt = buildSystemInstruction(glossary("[]\n"), "English", "Vietnamese", kind);
    // The earlier prompt carried a "translate these" list. It is gone: nothing
    // outside the glossary may turn a term into Vietnamese.
    for (const gone of ["bản ghi", "chữ ký", "dấu vân tay"]) {
      expect(prompt, `${gone} must not be offered as a translation`).not.toContain(gone);
    }
  });

  it("keeps the markdown rules for a body", () => {
    const prompt = buildSystemInstruction(glossary("[]\n"), "English", "Vietnamese", "body");
    expect(prompt).toMatch(/headings/i);
  });

  it("gives a field the glossary too, because a title carries terms", () => {
    const path = glossary('- en: "virtual thread"\n  vi: "virtual thread"\n');
    expect(buildSystemInstruction(path, "English", "Vietnamese", "field")).toContain(
      "virtual thread",
    );
  });

  it("carries every glossary term and its note into the prompt", () => {
    const dir = mkdtempSync(join(tmpdir(), "gl-"));
    const path = join(dir, "glossary.yaml");
    writeFileSync(path, '- en: "virtual thread"\n  vi: "virtual thread"\n  note: "Keep in English."\n');

    const prompt = buildSystemInstruction(path, "English", "Vietnamese", "body");
    expect(prompt).toContain("from English to Vietnamese");
    expect(prompt).toContain('"virtual thread" -> "virtual thread" (Keep in English.)');
  });

  it("names every placeholder shape the guard can produce", () => {
    const dir = mkdtempSync(join(tmpdir(), "gl-"));
    const path = join(dir, "glossary.yaml");
    writeFileSync(path, "[]\n");

    const prompt = buildSystemInstruction(path, "English", "Vietnamese", "body");
    for (const kind of ["CODE", "SPAN", "URL"]) expect(prompt).toContain(kind);
  });
});
