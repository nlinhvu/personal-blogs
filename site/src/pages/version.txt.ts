import type { APIRoute } from "astro";

/**
 * What version of the site is actually being served.
 *
 * `wrangler deploy` returning is NOT the same as the new version answering at
 * the edge: measured 2026-08-25, an asset added by a deploy still 404ed 0.8s
 * after the upload finished. A smoke test that polls a URL which already
 * existed -- the home page, say -- passes on the first attempt against the OLD
 * version and proves nothing, which is exactly how a green gate let a 404
 * through to the assertions behind it.
 *
 * This file is the fix: it changes every commit, so the pipeline can wait for
 * the one it just pushed. See .github/scripts/wait-for-version.sh.
 *
 * The fallback is a word rather than an empty string, and the check is falsy
 * rather than nullish, because a composite action input that is not passed
 * arrives as "" and not as undefined. An empty body would compare equal to an
 * unset GITHUB_SHA and wave a broken deploy through; "dev" can never equal a
 * commit hash, so a missing stamp fails loudly instead.
 */
export function buildStamp(raw: string | undefined): string {
  return raw?.trim() || "dev";
}

export const GET: APIRoute = () =>
  new Response(`${buildStamp(process.env.BUILD_SHA)}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
