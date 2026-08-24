---
title: "Draft example"
description: "A post that stays out of production until the draft flag comes off."
---

This post carries `draft: true` in its `post.yaml`, so a production build never
sees it. No page, no entry on the home page or the tag pages, nothing in either
feed, nothing in the sitemap.

It is still checked. A draft that names an undeclared tag, or that is missing one
of its two language files, fails the build the same day it is written rather than
the day it is published.
