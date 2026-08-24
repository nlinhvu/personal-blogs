---
title: "First fixture post"
description: "The older published fixture. Carries the image and the code fence."
---

This post carries the two things the built site is checked for: an image, which
only reaches the page if the loader hands Astro its asset imports, and a Java
code fence, which has to arrive coloured by Prism classes rather than by inline
style attributes the Content Security Policy would drop.

![A fixture diagram](./assets/diagram.svg)

```java
public record Fixture(String name) {
  public static void main(String[] args) {
    System.out.println(new Fixture("first"));
  }
}
```
