---
title: "Bài fixture thứ nhất"
description: "Bản fixture cũ hơn. Mang theo ảnh và khối code."
---

Bài này mang hai thứ mà site dựng xong phải kiểm: một ảnh, thứ chỉ tới được
trang khi loader đưa asset import cho Astro, và một khối code Java, thứ phải ra
màu bằng class của Prism chứ không bằng thuộc tính style inline mà Content
Security Policy sẽ chặn.

![A fixture diagram](./assets/diagram.svg)

```java
public record Fixture(String name) {
  public static void main(String[] args) {
    System.out.println(new Fixture("first"));
  }
}
```
