import { describe, it, expect } from "vitest";
import { extractProtected, restoreProtected, assertProtectedIntact } from "../lib/protect";

describe("rule 1 — fenced code blocks", () => {
  const FENCED = `Intro.

\`\`\`java
public record Greeting(String text) {}
\`\`\`

Outro.
`;

  it("lifts a fenced block out of the prose", () => {
    const { text, tokens } = extractProtected(FENCED);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe("CODE");
    expect(text).not.toContain("public record");
    expect(text).toContain("⟦CODE_0⟧");
  });

  it("lifts a fence indented inside a list item", () => {
    const source = `- Run this:

  \`\`\`bash
  echo hi
  \`\`\`
`;
    const { text, tokens } = extractProtected(source);
    expect(tokens).toHaveLength(1);
    expect(text).not.toContain("echo hi");
  });

  it("lifts a tilde fence", () => {
    const { tokens } = extractProtected("~~~python\nprint(1)\n~~~\n");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe("CODE");
  });

  it("throws on an unclosed fence rather than sending code to the model", () => {
    expect(() => extractProtected("Intro.\n\n```java\nrecord X() {}\n")).toThrow(/unclosed/i);
  });
});

describe("rule 2 — inline code spans", () => {
  it("lifts an inline span", () => {
    const { text, tokens } = extractProtected("Call `Thread.ofVirtual()` to make one.");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe("SPAN");
    expect(text).toBe("Call ⟦SPAN_0⟧ to make one.");
  });

  it("treats a url inside a span as code, not as a link", () => {
    const { tokens } = extractProtected("Run `curl https://vulinh.dev/rss.xml` first.");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe("SPAN");
    expect(tokens[0].value).toContain("https://vulinh.dev/rss.xml");
  });
});

describe("rule 3 — markdown link and image destinations", () => {
  it("locks an image path but leaves the alt text translatable", () => {
    const { text, tokens } = extractProtected("![Virtual thread parking](./assets/park.png)");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe("URL");
    expect(tokens[0].value).toBe("./assets/park.png");
    expect(text).toContain("Virtual thread parking");

    const translated = text.replace("Virtual thread parking", "Virtual thread park lại");
    expect(restoreProtected(translated, tokens)).toBe("![Virtual thread park lại](./assets/park.png)");
  });

  it("locks a link url but leaves the link text translatable", () => {
    const { text, tokens } = extractProtected("See [the RSS feed](/vi/rss.xml) for updates.");
    expect(tokens[0].value).toBe("/vi/rss.xml");

    const translated = text.replace("the RSS feed", "feed RSS");
    expect(restoreProtected(translated, tokens)).toBe("See [feed RSS](/vi/rss.xml) for updates.");
  });

  it("locks both urls when an image is wrapped in a link", () => {
    const { tokens } = extractProtected("[![Diagram](./assets/d.png)](/blog/virtual-threads)");
    expect(tokens.map((t) => t.value)).toEqual(["./assets/d.png", "/blog/virtual-threads"]);
  });

  it("leaves an image title translatable next to a locked path", () => {
    const { text, tokens } = extractProtected('![Alt](./assets/x.png "How parking works")');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].value).toBe("./assets/x.png");
    expect(text).toContain("How parking works");
  });

  it("keeps a destination that carries balanced parentheses in one piece", () => {
    const { tokens } = extractProtected("[Wiki](https://en.wikipedia.org/wiki/Thread_(computing))");
    expect(tokens[0].value).toBe("https://en.wikipedia.org/wiki/Thread_(computing)");
  });
});

describe("rule 4 — url attributes in raw html", () => {
  it("locks a video src but leaves the fallback text translatable", () => {
    const source = `<video src="./assets/demo.mp4" controls>
Your browser cannot play this video.
</video>`;
    const { text, tokens } = extractProtected(source);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].value).toBe('"./assets/demo.mp4"');
    expect(text).toContain("Your browser cannot play this video.");
  });

  it("locks an img src but leaves its alt attribute translatable", () => {
    const { text, tokens } = extractProtected('<img src="./assets/park.gif" alt="Parking animation">');
    expect(tokens).toHaveLength(1);
    expect(text).toContain('alt="Parking animation"');
  });

  it("locks a srcset with all of its candidates", () => {
    const { tokens } = extractProtected('<img srcset="./a.png 1x, ./b.png 2x" alt="Chart">');
    expect(tokens[0].value).toBe('"./a.png 1x, ./b.png 2x"');
  });

  it("locks a poster attribute", () => {
    const { tokens } = extractProtected('<video poster="./assets/cover.png" src="./assets/d.mp4"></video>');
    expect(tokens.map((t) => t.value)).toEqual(['"./assets/cover.png"', '"./assets/d.mp4"']);
  });
});

describe("rule 5 — autolinks", () => {
  it("locks an autolink whole", () => {
    const { text, tokens } = extractProtected("Docs live at <https://vulinh.dev/blog> today.");
    expect(tokens[0].value).toBe("<https://vulinh.dev/blog>");
    expect(text).toBe("Docs live at ⟦URL_0⟧ today.");
  });
});

describe("rule 6 — bare urls in prose", () => {
  it("locks a bare url but leaves the full stop in the prose", () => {
    const { text, tokens } = extractProtected("Read https://vulinh.dev/rss.xml.");
    expect(tokens[0].value).toBe("https://vulinh.dev/rss.xml");
    expect(text).toBe("Read ⟦URL_0⟧.");
  });
});

describe("rule 7 — reference link definitions", () => {
  it("locks the url in a reference definition", () => {
    const source = "See [the feed][feed].\n\n[feed]: /vi/rss.xml\n";
    const { text, tokens } = extractProtected(source);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].value).toBe("/vi/rss.xml");
    expect(text).toContain("[feed]: ⟦URL_0⟧");
  });
});

describe("rule ordering", () => {
  it("does not tokenise links or urls that live inside a code block", () => {
    const source = `\`\`\`markdown
![Alt](./assets/x.png) and https://vulinh.dev
\`\`\`
`;
    const { tokens } = extractProtected(source);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe("CODE");
  });

  it("does not tokenise a url that lives inside an inline span", () => {
    const { tokens } = extractProtected("Try `<img src=\"./a.png\">` in a post.");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe("SPAN");
  });
});

const MIXED = `---
title: "Hello"
---

Call \`Thread.ofVirtual()\` and read [the docs](/blog/virtual-threads "Deep dive").

![A parked thread](./assets/park.png)

<video src="./assets/demo.mp4" controls>
Your browser cannot play this video.
</video>

\`\`\`java
public record Greeting(String text) {}
\`\`\`

Mirror at <https://vulinh.dev/blog> or https://vulinh.dev/rss.xml.

[feed]: /vi/rss.xml
`;

describe("round trip", () => {
  it("restores a document carrying every protected kind back to the original", () => {
    const { text, tokens } = extractProtected(MIXED);
    expect(restoreProtected(text, tokens)).toBe(MIXED);
  });

  it("restores every protected span byte-for-byte after the prose changed", () => {
    const { text, tokens } = extractProtected(MIXED);
    const translated = text
      .replace("A parked thread", "Một thread đang park")
      .replace("Your browser cannot play this video.", "Trình duyệt của bạn không phát được video này.");
    const restored = restoreProtected(translated, tokens);

    expect(restored).toContain("./assets/park.png");
    expect(restored).toContain("./assets/demo.mp4");
    expect(restored).toContain("public record Greeting(String text) {}");
    expect(restored).toContain("Một thread đang park");
    expect(restored).toContain("Trình duyệt của bạn không phát được video này.");
  });

  it("throws when a placeholder went missing", () => {
    const { tokens } = extractProtected(MIXED);
    expect(() => restoreProtected("no placeholders here", tokens)).toThrow(/placeholder/i);
  });

  it("throws when the translation duplicated a placeholder", () => {
    // A model that reworks a sentence can emit the same token twice. Only the
    // first gets replaced, and the second lands in the published file as
    // literal ⟦URL_0⟧ text. Neither the missing-placeholder check nor the
    // intact check sees it, because nothing went missing and nothing changed.
    const { text, tokens } = extractProtected("See [the feed](/rss.xml).");
    const doubled = text.replace("⟦URL_0⟧", "⟦URL_0⟧ ⟦URL_0⟧");
    expect(() => restoreProtected(doubled, tokens)).toThrow(/twice|duplicat/i);
  });

  it("allows a code block that itself contains placeholder-shaped text", () => {
    // This blog writes about this guard. A fenced example showing ⟦CODE_0⟧ is
    // ordinary content, and counting placeholders after the code went back in
    // would flag the author's own example as a model error.
    const source = "Intro.\n\n```text\n⟦CODE_0⟧ ⟦CODE_0⟧\n```\n";
    const { text, tokens } = extractProtected(source);
    expect(restoreProtected(text, tokens)).toBe(source);
  });

  it("restores a block containing regex replacement patterns verbatim", () => {
    // A shell or regex example carrying $& or $1 is ordinary prose in this blog.
    // String.replace reads those as backreferences, so a naive restore corrupts
    // exactly the posts most likely to contain them.
    const source = `Before.

\`\`\`bash
sed -E 's/(a)(b)/\\2$1 $& $$/' file
\`\`\`
`;
    const { text, tokens } = extractProtected(source);
    expect(restoreProtected(text, tokens)).toBe(source);
  });
});

describe("assertProtectedIntact", () => {
  it("passes on an honest round trip", () => {
    const { text, tokens } = extractProtected(MIXED);
    const restored = restoreProtected(text, tokens);
    expect(() => assertProtectedIntact(MIXED, restored)).not.toThrow();
  });

  it("throws when a code block was altered", () => {
    const tampered = MIXED.replace("public record Greeting", "public record LoiChao");
    expect(() => assertProtectedIntact(MIXED, tampered)).toThrow(/CODE/);
  });

  it("throws when an image path was translated", () => {
    const tampered = MIXED.replace("./assets/park.png", "./assets/thread-park.png");
    expect(() => assertProtectedIntact(MIXED, tampered)).toThrow(/URL/);
  });

  it("throws when the model invented an extra link", () => {
    const tampered = MIXED.replace("Mirror at", "Mirror at [here](/made-up) or at");
    expect(() => assertProtectedIntact(MIXED, tampered)).toThrow(/URL/);
  });

  it("allows the translation to reorder two links", () => {
    // The guarantee is content, not position: every protected span in the output
    // is byte-identical to one in the input, none lost and none invented. A
    // translator that swaps two links to fit Vietnamese word order broke nothing.
    const source = "Read [A](/a) then [B](/b).";
    const reordered = "Đọc [B](/b) rồi [A](/a).";
    expect(() => assertProtectedIntact(source, reordered)).not.toThrow();
  });
});
