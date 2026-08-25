// The Open Graph card, as a plain object tree.
//
// satori accepts React elements OR bare { type, props } objects. This project
// has no React, so it builds the objects directly -- which also keeps this file
// pure data with no I/O, so it is testable in plain Node.
//
// This layout is DELIBERATELY plain. It is placeholder composition, not a
// design decision: Phase 5 builds the design system and rebuilds this card.

export interface OgCardInput {
  siteName: string;
  title: string;
  tagLabels: string[];
  date: string;
}

export interface OgNode {
  type: string;
  props: {
    style?: Record<string, unknown>;
    children?: unknown;
  };
}

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const el = (style: Record<string, unknown>, children: unknown): OgNode => ({
  type: "div",
  props: { style, children },
});

// Three steps rather than a formula: a formula invites tuning, and every tune
// is a rebuild of every image. Measured against the longest real title.
function titleSize(title: string): number {
  if (title.length > 90) return 52;
  if (title.length > 55) return 64;
  return 80;
}

export function buildOgCard(input: OgCardInput): OgNode {
  const footer = [input.tagLabels.join(" · "), input.date].filter(Boolean).join(" · ");

  return el(
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      backgroundColor: "#0b0b0e",
      color: "#e4e4e7",
      padding: 72,
      fontFamily: "Inter",
    },
    [
      el(
        { fontSize: 28, letterSpacing: 2, textTransform: "uppercase", color: "#a1a1aa" },
        input.siteName,
      ),
      el({ fontSize: titleSize(input.title), lineHeight: 1.2, display: "flex" }, input.title),
      el({ fontSize: 26, color: "#a1a1aa" }, footer),
    ],
  );
}
