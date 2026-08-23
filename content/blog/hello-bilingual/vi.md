---
title: "Xin chào thế giới song ngữ"
description: "Bài đầu tiên tồn tại ở cả tiếng Anh lẫn tiếng Việt."
---

Bài này tồn tại để chứng minh đường ống chạy được. Nó có một code block để
rào bảo vệ bản dịch có thứ để bảo vệ.

```java
public record Greeting(String text) {
    public static Greeting of(String name) {
        return new Greeting("Hello, " + name);
    }
}
```

Khối đó phải giống hệt từng byte ở cả hai bản ngôn ngữ.
