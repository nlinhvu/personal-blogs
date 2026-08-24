---
title: "Bài mẫu"
description: "Hình dạng chung của mọi bài: front matter, phần chữ, rào code, và một cặp file hai ngôn ngữ."
---

Chép thư mục này để bắt đầu một bài mới. Tên thư mục chính là slug và cũng là
URL, nên giữ nó ở dạng ASCII kebab-case.

Ba file quan trọng. `post.yaml` giữ những gì hai ngôn ngữ dùng chung — ngày
đăng, tag, và ngôn ngữ viết trước. `en.md` và `vi.md` giữ phần chữ; mỗi file chỉ
mang tiêu đề và mô tả của riêng nó.

```java
public record Greeting(String text) {
    public static Greeting of(String name) {
        return new Greeting("Hello, " + name);
    }
}
```

Mọi tag dùng ở đây phải có sẵn trong `content/tags.yaml`. Tag chưa khai sẽ làm
build đỏ và nêu đúng tên nó, thay vì lọt lên production trong im lặng.

```yaml
spring-boot:
  en: "Spring Boot"
  vi: "Spring Boot"
```

Phần trong rào code được mang nguyên vẹn qua bản dịch, nên mọi thứ nằm trong rào
phải giống hệt nhau ở cả hai file.
