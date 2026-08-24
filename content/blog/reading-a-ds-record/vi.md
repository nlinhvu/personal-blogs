---
title: "Đọc một DS record"
description: "Bật DNSSEC khiến tôi chỉ còn đúng một dòng để nhập tại registrar, chứa đầy những con số không ai giải thích. Tất cả trừ một trong số đó đều có thể được tính toán lại từ đầu."
---

Việc bật DNSSEC cho domain này chỉ mất hai dòng Terraform. Sau đó, Cloudflare đưa cho tôi một dòng để tự tay nhập vào Namecheap:

```text
vulinh.dev. 3600 IN DS 2371 13 2 D5C70F86555DE9975775DC154D7C3060B78C1CA240F6BD39B90709FBCC69C3E2
```

Bốn giá trị, không lời giải thích. Nhập các con số vào một biểu mẫu của registrar mà không biết ý nghĩa của chúng là cách người ta tự làm hỏng domain của mình, vì vậy tôi đã đi tìm hiểu. Dưới đây là ý nghĩa của từng giá trị, và cách kiểm tra xem có phải Cloudflare chỉ đơn giản là tự bịa ra chúng hay không.

## DNSSEC ký những gì, và không ký những gì

Một câu trả lời DNS thông thường không mang theo signature. Resolver của bạn hỏi xem `vulinh.dev` nằm ở đâu, một thực thể nào đó trả lời, và không có cách nào để biết thực thể đó là authoritative server hay là một kẻ lạ mặt trên đường truyền. Đầu độc cache của một resolver và mọi người dùng phía sau nó sẽ đi đến máy của bạn cho đến khi record giả mạo hết hạn.

DNSSEC ký từng record. Resolver kiểm tra signature và vứt bỏ câu trả lời nếu nó không khớp. Điều đó mang lại tính xác thực và tính toàn vẹn — câu trả lời đến từ đúng server và được gửi đến mà không bị thay đổi.

Nó không mang lại sự riêng tư. DNSSEC là một signature, không phải là một chiếc phong bì. Bất kỳ ai theo dõi đường truyền vẫn nhìn thấy những tên miền bạn đang tra cứu; việc ẩn thông tin đó cần đến DNS over HTTPS hoặc DNS over TLS, vốn là những protocol khác nhau giải quyết một vấn đề khác.

## Chuỗi liên kết, và mắt xích còn thiếu

Không ai được tin tưởng một mình. Mỗi cấp độ sẽ bảo chứng cho cấp độ bên dưới nó:

![Chuỗi tin cậy DNSSEC: root bảo chứng cho .dev, .dev bảo chứng cho vulinh.dev bằng một DS record, và record đó chính là mắt xích còn thiếu](./assets/chain-of-trust.svg)

Các resolver đi kèm với key của root được tích hợp sẵn — trust anchor — và đi xuống từ đó. Cloudflare đã ký zone của tôi và công bố các key:

```bash
dig +short DNSKEY vulinh.dev @8.8.8.8
```

```text
256 3 13 oJMRESz5E4gYzS/q6XDrvU1qMPYIjCWzJaOau8XNEZeqCYKD5ar0IRd8KqXXFJkqmVfRvMGPmM1x8fGAa2XhSA==
257 3 13 mdsswUyr3DPW132mOi8V9xESWE8jTo0dxCjjnopKl+GqJxpVXckHAeF+KkxLbxILfDLUT0rAK9iUzy1L53eKGQ==
```

Hai key, và những con số dẫn đầu sẽ giải thích lý do. Trường `flags` được đọc theo từng bit: bit `256` có nghĩa là key này dùng để ký các DNS record, và bit `1` đánh dấu nó là điểm truy cập an toàn (secure entry point) mà một DS record trỏ vào. Vì vậy `257` là Key Signing Key và `256` là Zone Signing Key. ZSK ký các record thông thường và rotate thường xuyên. KSK chỉ ký ZSK, và hiếm khi rotate — bởi vì mỗi lần rotate đồng nghĩa với việc phải nhập lại DS record tại registrar. `3` ở giữa là trường protocol. Nó luôn là `3` và không mang thông tin gì.

But `.dev` vẫn chưa bảo chứng cho tôi:

```bash
dig +short DS vulinh.dev @8.8.8.8
```

```text
(empty)
```

Dòng trống đó chính là toàn bộ công việc cần làm. DS record phải nằm ở parent zone, bởi vì một record bảo chứng cho một zone sẽ trở nên vô giá trị nếu nó nằm bên trong chính zone mà nó bảo chứng — nếu giả mạo được zone thì bạn cũng giả mạo luôn cả sự bảo chứng đó.

## Bốn con số

![Bốn trường của một DS record, được mã hóa màu đối chiếu với chính record đó: key tag, algorithm, digest type và digest](./assets/ds-anatomy.svg)

**`2371` là key tag.** Một checksum 16-bit được tính toán từ chính key đó. Không bí mật, không ngẫu nhiên, và không đảm bảo là duy nhất. Khi một zone công bố nhiều key, một resolver sẽ sử dụng tag để đoán xem nên thử cái nào trước thay vì thử tất cả. Hai key có thể trùng khớp (collide), và không có gì bị hỏng cả — resolver chỉ đơn giản là thử cả hai. Hãy nghĩ về bốn chữ số cuối của một số điện thoại: đủ để thu hẹp phạm vi tìm kiếm, nhưng không đủ để xác định danh tính của bất kỳ ai.

**`13` là algorithm.** Một mã số từ registry của IANA, không phải là con số do ai đó tự chọn. `8` là RSA với SHA-256, được root sử dụng để ký `.dev`. `13` là ECDSA P-256 với SHA-256, được Cloudflare sử dụng vì một ECDSA key nhỏ hơn khoảng bốn lần so với một RSA key có độ mạnh tương đương. Key nhỏ hơn nghĩa là các response vẫn vừa vặn trong một UDP packet thay vì phải chuyển sang dùng TCP, điều này nhanh hơn và khiến các cuộc tấn công khuếch đại (amplification attack) có ít đất diễn hơn.

**`2` là digest type**, cũng lấy từ một IANA registry. `1` là SHA-1 và đã lỗi thời. `2` là SHA-256 và là thứ mà mọi người đang dùng hiện nay.

**`D5C70F86...` là digest**, và nó là mấu chốt của toàn bộ cơ chế này. Registry `.dev` không lưu giữ KSK của tôi. Nó lưu giữ một fingerprint của nó. Khi một resolver yêu cầu, `.dev` sẽ chuyển giao fingerprint đó, resolver sẽ hash KSK do `vulinh.dev` công bố, và so sánh. Một văn phòng cấp hộ chiếu không giữ ngón tay của bạn; họ giữ một bức ảnh chụp vân tay, và máy quét ở cửa khẩu sẽ so sánh chúng.

![Cách một resolver kiểm tra một zone: parent registry giữ một fingerprint, zone công bố công khai key của nó, và resolver hash key đó rồi so sánh cả hai](./assets/fingerprint-check.svg)

## Tự tính toán DS

Cloudflare tạo ra cặp key. Đó là nơi duy nhất yếu tố ngẫu nhiên xuất hiện. DS record sau đó được *suy ra* từ public key bằng một công thức trong RFC 4034, nghĩa là bất kỳ ai cũng có thể tính toán lại nó — bao gồm cả tôi, trước khi nhập nó vào một biểu mẫu có thể khiến domain của tôi bị offline:

```python
import base64, hashlib

# Exactly what Cloudflare publishes for the zone, read with:
#   dig +short DNSKEY vulinh.dev @8.8.8.8
FLAGS      = 257          # 257 = Key Signing Key
PROTOCOL   = 3            # always 3
ALGORITHM  = 13           # ECDSA P-256 with SHA-256
PUBLIC_KEY = "mdsswUyr3DPW132mOi8V9xESWE8jTo0dxCjjnopKl+GqJxpVXckHAeF+KkxLbxILfDLUT0rAK9iUzy1L53eKGQ=="

# DNSKEY RDATA: flags | protocol | algorithm | public key
rdata = (
    FLAGS.to_bytes(2, "big")
    + bytes([PROTOCOL, ALGORITHM])
    + base64.b64decode(PUBLIC_KEY)
)

# Owner name in DNS wire format: length-prefixed labels, null terminated
owner = b"\x06vulinh\x03dev\x00"

# DS digest = SHA-256(owner name || DNSKEY RDATA), RFC 4034 section 5.1.4
digest = hashlib.sha256(owner + rdata).hexdigest().upper()

# Key tag, RFC 4034 appendix B
ac = 0
for i, b in enumerate(rdata):
    ac += b if (i & 1) else (b << 8)
ac += (ac >> 16) & 0xFFFF
key_tag = ac & 0xFFFF

print("computed key tag :", key_tag)
print("computed digest  :", digest)
```

```text
computed key tag : 2371
computed digest  : D5C70F86555DE9975775DC154D7C3060B78C1CA240F6BD39B90709FBCC69C3E2

cloudflare said  : DS 2371 13 2 D5C70F86555DE9975775DC154D7C3060B78C1CA240F6BD39B90709FBCC69C3E2
```

Khớp từng ký tự một. Kịch bản dài ba mươi dòng đó cũng chính là, ở một mức độ nào đó, những gì mọi validating resolver trên internet thực hiện với zone của tôi.

Nó cũng có một hệ quả thực tế. Rotate KSK và cả tag lẫn digest đều thay đổi, vì vậy DS phải được nhập lại tại registrar. Đó là lý do tại sao KSK giữ nguyên trong khi ZSK có thể rotate một cách tự do.

## Thứ tự là quan trọng, và sai sót sẽ phải trả giá đắt

```text
1. Cloudflare signs the zone and publishes DNSKEY
2. Enter the DS at the registrar
3. The DS propagates to the .dev registry
4. Cloudflare flips the zone from pending to active
```

Thực hiện bước 2 trước bước 1 và các resolver sẽ bắt đầu yêu cầu một signature mà zone không thể tạo ra. Chúng không hề nhún vai rồi bỏ qua. Chúng sẽ trả về `SERVFAIL`, nghĩa là domain hoàn toàn không thể phân giải (resolve) được — đối với tất cả những ai có resolver thực hiện validate DNSSEC, bao gồm cả `8.8.8.8`.

Đó là một lỗi rất khó chịu để chẩn đoán, bởi vì nó không xảy ra với tất cả mọi người. Trang web vẫn hoạt động đối với những người dùng các resolver không thực hiện validate và biến mất đối với những người khác, điều này trông giống như hầu hết mọi vấn đề ngoại trừ lỗi DNS.

Trong khi đó, `tofu plan` liên tục báo cáo sự sai lệch (drift):

```text
~ status = "pending" -> "active"
```

Đó không phải là một bug cần phải tốn công tìm kiếm. Cloudflare không thể tự mình thay đổi trạng thái; nó phải chờ parent registry. Plan này sẽ ngừng báo cáo drift một khi DS được ghi nhận và lan truyền (propagate). Trước khi xử lý một trạng thái chờ (pending), điều đáng hỏi là: nó đang chờ đợi điều gì, và việc đó có phải là việc của tôi hay không?

## Tại sao một blog tĩnh lại cần bận tâm

Câu hỏi hay. Ở đây không có phần đăng nhập và nội dung hoàn toàn công khai.

Lý do mạnh mẽ nhất là việc cấp phát certificate. Một Certificate Authority chứng minh bạn sở hữu một domain chủ yếu thông qua DNS — họ yêu cầu bạn xuất bản một TXT record và sau đó tra cứu nó. Ai đó có thể giả mạo câu trả lời DNS của bạn có thể vượt qua bước kiểm tra đó và được cấp một certificate thật cho domain của bạn. Tại thời điểm đó, HTTPS không bảo vệ được ai nữa: trình duyệt vẫn hiển thị biểu tượng ổ khóa bình thường, vì certificate đó là thật.

Các CAA record giới hạn những authority nào được phép cấp phát cho một domain, nhưng một CAA record cũng chỉ là một DNS record khác và cũng có thể bị giả mạo. DNSSEC là thứ giúp cho CAA thực sự có ý nghĩa.

Tóm tắt một cách trung thực: DNSSEC không giúp ngăn chặn một cuộc tấn công vào blog này ngay hôm nay. Nó là một khoản bảo hiểm giá rẻ chống lại một lỗi hiếm gặp nhưng cực kỳ khó khắc phục — mất quyền kiểm soát danh tính của domain. Hai dòng Terraform, một biểu mẫu tại registrar, miễn phí tại Cloudflare. Với mức giá đó, nó không cần một lý do quá to tát để chứng minh sự cần thiết của mình.

## Kiểm tra xem nó đã hoạt động chưa

```bash
dig +dnssec vulinh.dev @8.8.8.8 | grep -oE 'flags: [a-z ]+'
```

```text
flags: qr rd ra ad
```

Flag `ad` viết tắt của authenticated data (dữ liệu đã được xác thực), và đó là bằng chứng quan trọng nhất. Nó có nghĩa là resolver đã đi dọc theo chuỗi từ root xuống, kiểm tra mọi signature, và thấy tất cả chúng đều hợp lệ.

Hai điều khác tôi rút ra được từ việc này. Các con số trong các network protocol hầu hết là các bảng tra cứu của registry, chứ không phải là những lựa chọn tùy ý — nếu gặp một con số lạ, hãy đi tìm xem nó thuộc về IANA registry nào thay vì tự đoán. Và một vài bước thủ công cũng không sao cả. Việc nhập DS record đó chỉ xảy ra một lần trong đời của một domain. Tự động hóa nó sẽ đồng nghĩa với việc cần thêm một API credential khác và một nhà cung cấp khác chỉ để tiết kiệm hai phút. Ghi lại ranh giới đó ở nơi mà người tiếp theo có thể tìm thấy là đủ rồi.

## Nguồn tham khảo

- [Cloudflare — DNSSEC](https://developers.cloudflare.com/dns/dnssec/)
- [RFC 4034 — Resource Records for DNSSEC](https://datatracker.ietf.org/doc/html/rfc4034), nơi chứa các công thức tính digest và key tag
- [IANA — DNSSEC Algorithm Numbers](https://www.iana.org/assignments/dns-sec-alg-numbers/dns-sec-alg-numbers.xhtml)
- [IANA — DS Digest Types](https://www.iana.org/assignments/ds-rr-types/ds-rr-types.xhtml)
- <https://dnsviz.net/> vẽ ra toàn bộ chuỗi tin cậy cho một domain, đây là cách nhanh nhất để xem mắt xích bị đứt nằm ở đâu

Mọi thứ ở trên đều là các public DNS record. Bạn có thể tự mình đọc các key của domain này bằng `dig`: https://dnsviz.net/d/vulinh.dev/dnssec/