---
title: "Bài nháp mẫu"
description: "Một bài nằm ngoài production cho tới khi gỡ cờ draft."
---

Bài này mang `draft: true` trong `post.yaml`, nên bản build production không
bao giờ thấy nó. Không có trang, không có mục ở trang chủ hay trang tag, không
có gì trong hai feed, không có gì trong sitemap.

Nó vẫn được kiểm. Một bài nháp gắn tag chưa khai, hoặc thiếu một trong hai file
ngôn ngữ, sẽ làm build đỏ ngay hôm viết, chứ không đợi tới hôm publish.
