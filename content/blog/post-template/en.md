---
title: "Post template"
description: "The shape every post takes: front matter, prose, code fences, images, and a pair of language files."
---

Copy this directory to start a post. The directory name becomes the slug and the
URL, so keep it ASCII kebab-case.

Three files matter. `post.yaml` holds what both languages share — the date, the
tags, and which language was written first. `en.md` and `vi.md` hold the prose;
each carries only its own title and description.

```java
public record Greeting(String text) {
    public static Greeting of(String name) {
        return new Greeting("Hello, " + name);
    }
}
```

Every tag used here must already exist in `content/tags.yaml`. A tag that is not
declared fails the build by name rather than reaching production quietly.

```yaml
spring-boot:
  en: "Spring Boot"
  vi: "Spring Boot"
```

Images live in this post's own `assets/` directory and are written as a relative
path. Both languages point at the same file — there is one image, not a copy per
language.

![Two language files linked to the one asset directory they share](./assets/one-asset-two-languages.png)

The translation script never lets the model see code or a path. Fenced blocks,
inline spans, image paths, link URLs and `src` attributes are lifted out before
the text is sent and put back byte-for-byte afterwards, so they read the same in
both files. Alt text is the exception, and on purpose: it is prose a screen
reader speaks aloud, so it gets translated like any other sentence.
