// Where the posts are. A build input, not a constant.
//
// Every deployment reads ../content. The test build points CONTENT_DIR at a
// fixed fixture set instead, so publishing a post, sending one back to draft or
// renaming a slug — all routine editorial acts — can never turn the suite red.
// Before this existed the worker tests fetched real post URLs, and marking two
// posts as drafts broke seventeen of them at once.
export const CONTENT_BASE = process.env.CONTENT_DIR ?? "../content";
