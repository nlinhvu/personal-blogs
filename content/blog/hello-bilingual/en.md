---
title: "Hello, bilingual world"
description: "The first post that exists in both English and Vietnamese."
---

This post exists to prove the pipeline. It has a code block so that the
translation guard has something to protect.

```java
public record Greeting(String text) {
    public static Greeting of(String name) {
        return new Greeting("Hello, " + name);
    }
}
```

That block must be byte-identical in both language versions.
