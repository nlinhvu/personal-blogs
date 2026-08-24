---
title: "Post template"
description: "The shape every post takes: front matter, prose, code fences, and a pair of language files."
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

Code blocks are carried across the translation untouched, so anything inside a
fence must read the same in both files.
