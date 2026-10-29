# Wedding Invitation Template — Thiệp cưới dùng lại

Website thiệp cưới **Cinematic Editorial / Dark Luxury** triển khai bằng GitHub Pages.
Có hai giao diện tiệc `bride` (nhà gái) / `groom` (nhà trai), album 3D, nhạc, lịch, bản đồ, QR và tiếng Việt / Anh.

### Giao diện và khách mời cá nhân hóa

- **Một nút điều khiển chung** mặc định ở **góc dưới bên phải**, có thể kéo và tự hít vào mép gần nhất. Ở màn chọn tiệc / tạo link, bảng chỉ có **Cài đặt** (VN/EN); sau khi mở thiệp, bảng thêm tab **Mục lục** (mở mặc định) trước tab **Cài đặt** (VN/EN, nhạc). Nút Mục lục nổi riêng đã được loại bỏ.
- Bong bóng nhạc **chỉ xuất hiện sau khi YouTube xác nhận `PLAYING`**, không hiện khi đang tải/buffering. Mặc định ở góc dưới trái; kéo/thả được cả lúc nhạc đang chạy, cùng cơ chế hít mép và tránh chồng lên nút chính. Chạm bong bóng mở **Pause / Resume / Stop**; Pause giữ vị trí phát, giữ bong bóng nhưng ngừng lắc và đổi màu; Resume phát tiếp tại vị trí cũ (tự seek nếu iframe bị tua về đầu); Stop dừng hẳn và ẩn bong bóng cho đến khi bật lại từ Cài đặt.
- Thiệp chỉ dùng **Dark Luxury** trên mọi thiết bị. Không tự đổi theo giao diện hệ điều hành và không có lựa chọn Sáng/Tối. F5 giữ ngôn ngữ trong tab đang xem; tab mới mặc định VN (trừ link có `lang=en`).
- Trong cảnh sao rơi **Ngày chung đôi** khi mở cửa, hiển thị **Trân trọng kính mời**; với link có `?to=Tên+khách`, **tên người nhận** nằm ngay dưới bằng font serif đậm, màu vàng sáng. Hero không lặp lại lời mời. Có thể sửa nhãn trong `wedding-info.js` → `text.vi["guest.recipientLabel"]` / `text.en["guest.recipientLabel"]`. Link không có tên chỉ hiện lời mời, không để dòng tên trống.


## Một tiệc hay hai tiệc — chỉ đổi trong file thông tin

Trong **[wedding-info.js](wedding-info.js)**, trường `wedding.mode` chọn kiểu tổ chức:

```js
"wedding": {
  "mode": "double"  // Hai tiệc: nhà gái và nhà trai (đang dùng)
}
```

Để tạo thiệp **một tiệc cưới chung**, đổi thành `"mode": "single"` và điền mục **`parties.single`** trong cùng file thông tin. Ví dụ:

```js
"single": {
  "date": "2027-05-21",
  "receptionTime": "17:30",
  "receptionEnd": "20:00",
  "city": { "vi": "TP. Hồ Chí Minh", "en": "Ho Chi Minh City" },
  "lunar": { "vi": "Ngày âm lịch (nếu có)", "en": "Lunar date (if desired)" },
  "venue": {
    "name": { "vi": "Nhà hàng tiệc cưới", "en": "Wedding Venue" },
    "address": { "vi": "Địa chỉ", "en": "Address" },
    "calendarAddress": { "vi": "{{parties.single.venue.name}}, {{parties.single.venue.address}}", "en": "{{parties.single.venue.name}}, {{parties.single.venue.address}}" },
    "mapUrl": "https://www.google.com/maps/...",
    "embedUrl": "https://maps.google.com/maps?..."
  },
  "music": { "youtubeId": "MÃ_VIDEO" },
  "images": { "hero": "...", "ending": "...", "favicon": "favicon-groom.svg", "portraitMain": "...", "portraitSecondary": "..." },
  "gift": { "bank": "Tên ngân hàng", "accountHolder": "Tên chủ tài khoản", "accountNumber": "...", "qrImage": "...", "qrAlt": { "vi": "Mã QR mừng cưới", "en": "Wedding gift QR" } },
  "region": { "vi": "Khu vực", "en": "Region" }
}
```

Đây là cấu trúc minh họa; **không xóa các trường đang có** khi sửa file. Các trường `parties.bride` và `parties.groom` vẫn được giữ làm mẫu cho chế độ hai tiệc, nhưng **không hiển thị ở chế độ một tiệc**.

**Khác biệt ở chế độ một tiệc:** khách mở link là gặp cổng mở thiệp; không phải chọn nhà gái/nhà trai; lịch hiển thị **một** ngày/giờ/địa điểm; lịch tải xuống `.ics` chỉ có **một sự kiện tiệc**; popup bản đồ và mừng cưới có **một lựa chọn** theo `parties.single`. Phần giới thiệu cô dâu, chú rể và hai gia đình vẫn có thể giữ nguyên. Công cụ tạo link `/?tool=links` sẽ chỉ hỏi **tên khách**, không hiện ô chọn tiệc, và link tạo ra không cần `?party=`.

**Quan trọng:** `parties.single` hiện là **dữ liệu mẫu** dựa trên ảnh/địa điểm của bộ thiệp đang có. Khi dùng cho khách mới, bắt buộc thay ngày, nhà hàng, đường dẫn map, ảnh, nhạc, tài khoản và tạo lại **mã QR đúng tài khoản mới** trước khi gửi thiệp.

**Nút chung và nút nhạc:** Kéo dùng `translate3d` theo `requestAnimationFrame`; chỉ animate khi thả rồi hít vào cạnh, giữ vùng chạm tối thiểu 44 × 44 px. Lần nhấn ngay sau khi kéo không bị chặn. Cảnh mở cổng chuyển trực tiếp từ bầu trời/tên đang phóng lớn và mờ dần sang Hero zoom-in, không giữ cảnh tĩnh 1,5 giây.

## ⭐ Hai nơi dữ liệu rõ ràng: thông tin cưới và album

**[wedding-info.js](wedding-info.js)** chứa tên, ngày, nhạc, lời mời, ảnh bìa và các bản dịch giao diện.

**[images/manifest.json](images/manifest.json)** là **nơi duy nhất quản lý album ảnh**: danh sách ảnh, chế độ thêm/thay thế, thứ tự, chú thích và cấu hình tối ưu WebP. Không còn cấu hình album trùng trong `wedding-info.js` hoặc `gallery.js`.

| Mục trong `wedding-info.js` | Nội dung bạn đổi |
| --- | --- |
| `site` | URL website, mô tả khi chia sẻ, múi giờ, ảnh chia sẻ |
| `couple.bride`, `couple.groom` | Tên hiển thị, họ tên đầy đủ, chữ viết tắt (`initial` như **N**, **S**) |
| `families.bride`, `families.groom` | Họ tên cha mẹ, địa chỉ hai gia đình (VI/EN) |
| `wedding.mode` | `"double"` (hai tiệc) hoặc `"single"` (một tiệc) |
| `parties.single` | Ngày, giờ, nhà hàng, bản đồ, ảnh, nhạc và QR của một tiệc chung |
| `parties.bride`, `parties.groom` | Ngày (YYYY-MM-DD), giờ lễ/tiệc, ngày âm lịch và địa điểm |
| `parties.*.venue` | Tên sảnh/nhà hàng, địa chỉ, URL Google Maps, URL bản đồ nhúng |
| `parties.*.music.youtubeId` | Mã video nhạc YouTube cho từng lễ |
| `parties.*.images` | Ảnh hero, ảnh kết, chân dung, favicon |
| `parties.*.gift` | Tên ngân hàng, chủ tài khoản, số tài khoản, mã QR |
| `text.vi` và `text.en` | **Toàn bộ lời mời, câu chữ, thông báo, tiêu đề** của cả hai ngôn ngữ |

### Ví dụ đổi tên và chữ viết tắt

Trong `wedding-info.js` chỉ cần thay dữ liệu:

```js
"couple": {
  "bride": { "short": "Mai", "full": "Nguyễn Thị Mai", "initial": "M" },
  "groom": { "short": "An", "full": "Trần Văn An", "initial": "A" }
}
```

Lúc vào nhà gái, monogram sẽ là **M & A**; vào nhà trai là **A & M**.
Con dấu wax ở cổng (N · S hoặc S · N), hero, thông tin gia đình, chân trang, đường dẫn tạo thiệp, lịch và tiêu đề chia sẻ đều lấy từ cấu hình.
Không cần đổi một ký tự trong `script.js`, `i18n.js` hay `index.html`.

Mẫu `{{couple.bride.short}}`, `{{parties.groom.dateDots}}`, `{{parties.bride.venue.name}}` trong phần `text` tự động đọc trường cấu hình. Không xóa dấu ngoặc của chúng nếu muốn chữ tự thay theo dữ liệu.

### Ngày giờ và nhạc

- `date`: định dạng `YYYY-MM-DD`, ví dụ `2027-03-15`.
- `ceremonyTime`, `ceremonyEnd`, `receptionTime`, `receptionEnd`: giờ 24h như `09:00`.
- `site.timezone`: dạng `+07:00`. Countdown và lịch ICS đều đọc từ đó.
- `music.youtubeId`: phần ID của link `youtube.com/watch?v=...`, **không** nhập cả URL.

### Hình ảnh, QR và album

Các file hình là tài nguyên vật lý: **phải upload ảnh/QR mới**, rồi thay đường dẫn của chúng trong `wedding-info.js`.
Chỉ thay chữ trong config không thể biến ảnh cưới cũ thành ảnh mới.

**Quan trọng với QR mừng cưới:** Khi thay `gift.bank`, `gift.accountNumber` hoặc `gift.accountHolder`, phải tạo lại mã QR cho **đúng tài khoản mới**, upload QR mới và cập nhật `gift.qrImage`. Thay số tài khoản hiển thị trong file thông tin **không tự sửa nội dung QR cũ**. Luôn thử quét mã và đối chiếu ngân hàng, số tài khoản, người nhận trước khi gửi thiệp cho khách.

### Album ảnh — chỉ quản lý trong `images/manifest.json`

```json
{
  "mode": "append",
  "shuffle": true,
  "optimization": { "maxSide": 960, "quality": 80 },
  "captions": {
    "vi": ["CHÚNG MÌNH", "BÊN NHAU"],
    "en": ["US", "TOGETHER"]
  },
  "total": 2,
  "photos": [
    { "src": "images/optimized/album/anh-1.webp", "name": "Ảnh 1", "width": 640, "height": 960 },
    { "src": "images/optimized/album/anh-2.webp", "name": "Ảnh 2", "width": 960, "height": 640 }
  ]
}
```

- `mode: "append"`: giữ ảnh có trong `photos` và bổ sung ảnh gốc mới; `"replace"`: tạo danh sách chỉ từ ảnh gốc hiện có (nếu không còn ảnh gốc, album sẽ rỗng). Hãy để `append` khi chỉ thêm ảnh cưới mới.
- `shuffle: true`: xáo ảnh mỗi lần mở album; `false`: hiển thị theo đúng thứ tự mảng `photos`.
- `optimization`: giới hạn cạnh dài WebP (`maxSide`), chất lượng (`quality`). `total` do script cập nhật.
- `captions.vi/en`: chú thích xoay vòng. Có thể đặt chú thích riêng từng ảnh trong `photos` bằng `"caption": {"vi": "Khoảnh khắc của chúng mình", "en": "Our moment"}`.
- `photos`: danh sách **được website hiển thị**. Bạn có thể sắp thứ tự, thêm mục trỏ tới file WebP đã có, sửa chú thích, hoặc bỏ mục. Lưu ý nếu bỏ mục mà ảnh gốc cùng tên vẫn có trong thư mục gốc, chạy generator sẽ thêm ảnh đó lại; hãy chuyển/xóa file gốc tương ứng.
- Các dòng chữ nút và bản dịch giao diện chung (ví dụ: "Đang tải album", "Xem toàn màn hình") vẫn ở `wedding-info.js` vì dùng chung hệ thống ngôn ngữ, không phải dữ liệu ảnh.

**Thêm ảnh mới:** chép ảnh vào `images/original/album/` trên máy tính rồi chạy:

```powershell
python -m pip install -r requirements.txt
python generate_gallery.py
```

Script sẽ tối ưu ảnh mới vào `images/optimized/album/` và tự cập nhật **chính `images/manifest.json`**, giữ các mục ảnh cũ và chú thích chỉnh tay khi `mode: "append"`.

Sau đó **commit/push `images/manifest.json` và ảnh mới trong `images/optimized/`** để website được cập nhật. Ảnh gốc `images/original/` được Git ignore nên không bị đẩy lên GitHub. Workflow deploy hiện **không tự chạy** `generate_gallery.py`; phải chạy local trước hoặc tự khai báo ảnh WebP đã tối ưu trong manifest.

## Các file khác chỉ là template / engine

- `index.html`: cấu trúc giao diện, không chứa dữ liệu cưới cố định.
- `style.css`, `quick-nav.css`, `link-tool.css`, `settings.css`: giao diện responsive Dark Luxury và thiết kế bảng tùy chỉnh.
- `i18n.js`: máy dịch VN/EN; đọc `text` và trường thông tin từ `wedding-info.js`.
- `script.js`: hiệu ứng mở cổng, tên, monogram, countdown, ICS và nhạc.
- `link-tool.js`: tạo link thiệp cá nhân hóa ngay trong trang chính, dùng chung nút VN/EN.
- `gallery.js`: album 3D và fullscreen.
- `quick-nav.js`: một cơ chế kéo-thả/hít mép cho nút chung và bong bóng nhạc, liên kết Mục lục, popup bản đồ và QR.
- `preferences.js`: trạng thái ngôn ngữ và giao diện riêng của tab, được giữ khi F5 nhưng không truyền sang tab mới.
- `settings.js`: bảng tab Mục lục/Cài đặt, ngôn ngữ, nhạc và trạng thái panel.
  - Sau F5, nút điều khiển chung mặc định **dưới phải**; bong bóng nhạc (nếu đang phát) bắt đầu **dưới trái**. Cả hai có thể kéo/hít vào mép khác trong phiên xem.
- `build-wedding.cjs`: sinh metadata Open Graph và favicon từ cấu hình.
- `generate_gallery.py`: đọc thiết lập album từ manifest và bổ sung ảnh WebP vào danh sách ở cùng file.
- `tests/compatibility.spec.cjs`: bộ test thiết bị/desktop.

## Chạy và deploy

Source được deploy khi push lên nhánh `main` thông qua `.github/workflows/deploy.yml`.
Khi deploy, GitHub Actions sẽ đọc **chính `wedding-info.js`** để tạo tiêu đề trang, favicon monogram, ảnh xem trước khi chia sẻ, thông số cache và website.

```bash
node --check wedding-info.js
node --check i18n.js
node --check preferences.js
node --check settings.js
node --check script.js
node --check link-tool.js
node build-wedding.cjs
```

Lưu ý: `node build-wedding.cjs` sinh ra các file build trong thư mục hiện tại, thường chạy trên runner GitHub Actions thay vì sửa source đã commit.

### Kiểm tra tự động

- **Unit/config:** `node --test tests/*.test.cjs`
- **Browser:** `npm install --no-save --no-package-lock @playwright/test`, `npx playwright install --with-deps chromium webkit firefox`, chạy `python3 -m http.server 8000` và `npx playwright test tests/compatibility.spec.cjs`.
- **CI:** workflow `Cross-device browser compatibility` chạy unit + trình duyệt Chromium, Android, iPhone WebKit và Firefox khi sửa nguồn; bản 8 thiết bị có thể bật bằng `workflow_dispatch` với tùy chọn `extended=true`. Workflow `Deploy Wedding` phải thành công riêng để website được phát hành.

Album chỉ tải ảnh ở gần vùng hiển thị; animation mở cổng dùng `transform/opacity`, giữ tính năng giảm chuyển động của thiết bị.

## Các đường dẫn

- Trang chọn tiệc: `/`
- Công cụ tạo lời mời: `/?tool=links`
- Nhà gái: `/?party=bride`
- Nhà trai: `/?party=groom`
- Thiệp riêng: `/?party=bride&to=Anh+Minh`
- Tiếng Anh: `?lang=en`

**Nguyên tắc bảo trì:** Cập nhật thông tin khách hàng **chỉ trong `wedding-info.js`**. Sửa các file còn lại **chỉ khi muốn nâng cấp giao diện hoặc tính năng**.


### Kiểm thử và dependency

Dự án dùng Playwright **1.64.1** cố định trong `package.json` và workflow CI (không dùng `latest`).
Dành cho máy local: chạy `npm install`, `npx playwright install chromium webkit firefox`, sau đó `npm run test:unit` và `npm run test:browser` (cần mở HTTP server cổng 8000 tại thư mục repo trước khi chạy browser test).
CI tự chạy smoke trên desktop Chromium, Android Chromium, iPhone WebKit và Firefox; full 8-device matrix có thể chạy từ **Actions → Cross-device browser compatibility → Run workflow → extended**.
