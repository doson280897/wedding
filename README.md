# Wedding Invitation Template — Thiệp cưới dùng lại

Website thiệp cưới **Cinematic Editorial / Dark Luxury** triển khai bằng GitHub Pages.
Có hai giao diện tiệc `bride` (nhà gái) / `groom` (nhà trai), album 3D, nhạc, lịch, bản đồ, QR và tiếng Việt / Anh.

### Giao diện và khách mời cá nhân hóa

- **Một nút điều khiển chung** mặc định ở **góc dưới bên phải**, có thể kéo và tự hít vào mép gần nhất. Ở màn chọn tiệc / tạo link, bảng chỉ có **Cài đặt** (VN/EN); sau khi mở thiệp, bảng thêm tab **Mục lục** (mở mặc định) trước tab **Cài đặt** (VN/EN, nhạc). Nút Mục lục nổi riêng đã được loại bỏ.
- Bong bóng nhạc **chỉ xuất hiện sau khi âm thanh phát sự kiện `playing`**, không hiện khi đang tải/buffering. Mặc định ở góc dưới trái; kéo/thả được cả lúc nhạc đang chạy, cùng cơ chế hít mép và tránh chồng lên nút chính. Chạm bong bóng mở **Pause / Resume / Stop**; Pause giữ vị trí phát, giữ bong bóng nhưng ngừng lắc và đổi màu; Resume phát tiếp tại vị trí cũ; Stop dừng hẳn và ẩn bong bóng cho đến khi bật lại từ Cài đặt.
- Link tạo khi chọn **EN** mang `lang=en`: cảnh mở cửa, lời mời và toàn bộ nội dung thiệp mở bằng tiếng Anh; tên riêng được giữ nguyên. Các chữ trong cảnh mở cửa nằm trong `wedding-info.js` → `text.vi/en["gate.*"]`.
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
  "music": { "src": "music.mp3" },
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

**[images/manifest.json](images/manifest.json)** là **nơi duy nhất quản lý album ảnh**: danh sách ảnh, thứ tự, chú thích và cấu hình tối ưu WebP. Không còn cấu hình album trùng trong `wedding-info.js` hoặc `gallery.js`.

| Mục trong `wedding-info.js`        | Nội dung bạn đổi                                                       |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `site`                             | URL website, mô tả khi chia sẻ, múi giờ, ảnh chia sẻ                   |
| `couple.bride`, `couple.groom`     | Tên hiển thị, họ tên đầy đủ, chữ viết tắt (`initial` như **N**, **S**) |
| `families.bride`, `families.groom` | Họ tên cha mẹ, địa chỉ hai gia đình (VI/EN)                            |
| `wedding.mode`                     | `"double"` (hai tiệc) hoặc `"single"` (một tiệc)                       |
| `parties.single`                   | Ngày, giờ, nhà hàng, bản đồ, ảnh, nhạc và QR của một tiệc chung        |
| `parties.bride`, `parties.groom`   | Ngày (YYYY-MM-DD), giờ lễ/tiệc, ngày âm lịch và địa điểm               |
| `parties.*.venue`                  | Tên sảnh/nhà hàng, địa chỉ, URL Google Maps, URL bản đồ nhúng          |
| `parties.*.music.src`              | Đường dẫn file MP3 cho từng lễ                                         |
| `parties.*.images`                 | Ảnh hero, ảnh kết, chân dung, favicon                                  |
| `parties.*.gift`                   | Tên ngân hàng, chủ tài khoản, số tài khoản, mã QR                      |
| `text.vi` và `text.en`             | **Toàn bộ lời mời, câu chữ, thông báo, tiêu đề** của cả hai ngôn ngữ   |

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
- `music.src`: đường dẫn MP3 tương đối với trang thiệp, giữ nguyên tên file (kể cả dấu cách/Unicode). Vu Quy dùng `audio/bride.mp3`; Tân Hôn dùng `audio/groom.mp3`. Các file được giữ nguyên chất lượng âm thanh gốc.
- Nhạc chỉ được gán source và gọi phát trực tiếp khi chạm ổ khóa. Dùng âm thanh HTML, không tải YouTube/iframe nên không bật trình phát video. Tạm dừng giữ vị trí; Dừng đặt về đầu bài. Nếu trình duyệt chặn phát hoặc mất mạng, có thể thử lại trong Tùy chỉnh → Âm nhạc.

### Hình ảnh, QR và album

Các file hình là tài nguyên vật lý: **phải upload ảnh/QR mới**, rồi thay đường dẫn của chúng trong `wedding-info.js`.
Chỉ thay chữ trong config không thể biến ảnh cưới cũ thành ảnh mới.

**Quan trọng với QR mừng cưới:** Khi thay `gift.bank`, `gift.accountNumber` hoặc `gift.accountHolder`, phải tạo lại mã QR cho **đúng tài khoản mới**, upload QR mới và cập nhật `gift.qrImage`. Thay số tài khoản hiển thị trong file thông tin **không tự sửa nội dung QR cũ**. Luôn thử quét mã và đối chiếu ngân hàng, số tài khoản, người nhận trước khi gửi thiệp cho khách.

### Tạo lại toàn bộ ảnh — clean rebuild bắt buộc

`python generate_gallery.py` luôn tạo mới **toàn bộ `images/optimized/` và danh sách `photos` trong `images/manifest.json`** từ ảnh gốc hiện có. Không dùng mtime, không giữ ảnh tối ưu cũ, không còn chế độ append. File dư trong cả `album/` lẫn `assets/` sẽ biến mất sau khi chạy thành công.

- **Giữ đầy đủ bộ ảnh muốn sử dụng** trong `images/original/album/`. Muốn bỏ ảnh khỏi website, bỏ ảnh gốc tương ứng rồi chạy lại.
- Album bắt buộc có ít nhất một ảnh. Ảnh hỏng/định dạng không hỗ trợ cũng làm lệnh thất bại.
- `mode` phải là `"replace"`; `optimization` hiện là `{"maxSide": 1440, "quality": 84}`. Đây là cạnh dài tối đa; ảnh nhỏ không được phóng giả lên. Đổi thông số rồi chạy lại sẽ tái tạo mọi ảnh, dù mtime không đổi.
- `shuffle`, chú thích chung và `caption` của ảnh vẫn còn trong nguồn được giữ. Danh sách ảnh được dựng lại theo tên file; khi `shuffle: false`, dùng tiền tố số nếu cần thứ tự cụ thể.
- Ảnh gốc và audio **không bị xóa**. QR và cổng/khóa nằm trong `images/static/`, dùng trực tiếp và không tham gia tối ưu hóa; rebuild không sửa hoặc xóa các file này.

**Ảnh bắt buộc:** đặt trong `images/original/assets/`, đúng chữ hoa/thường. Tên được suy ra từ `wedding-info.js`; bảng dưới là cấu hình hiện tại. Với tên có `.*`, chọn **đúng một** file có đuôi JPG/JPEG/PNG/WebP/AVIF/GIF/BMP/TIF/TIFF; phần tên trước đuôi phải khớp. Với tên có đuôi cụ thể, phải khớp cả tên và đuôi.

| Loại             | Tên file gốc bắt buộc                              |
| ---------------- | -------------------------------------------------- |
| Hero             | `hero_bride.*`, `hero_groom.*`                     |
| Ảnh kết          | `ending_bride.*`, `ending_groom.*`                 |
| Chân dung cô dâu | `nga-1.*`, `nga-2.*`                               |
| Chân dung chú rể | `son-1.*`, `son-2.*`                               |
| Câu chuyện       | `story-together.*`, `story-love.*`, `story-home.*` |

Ba tên ảnh câu chuyện lấy từ `story.images.*.sourceName` (`story-together`, `story-love`, `story-home`, không kèm đuôi); script nhận đúng một định dạng được hỗ trợ rồi sinh toàn bộ bản responsive trong `variants`. Có thể khai báo cả đuôi nếu muốn yêu cầu một file cụ thể. `story-together.*` cần rộng ít nhất 2000 px; hai ảnh còn lại ít nhất 1333 px sau xoay EXIF để srcset không khai báo kích thước giả. Hero/ảnh kết/chân dung được tạo lại theo giới hạn riêng của từng loại. Tất cả đường dẫn ảnh tối ưu trong config đều được kiểm tra, kể cả mẫu `parties.single`; những đường dẫn trùng nhau chỉ cần một ảnh gốc. Favicon ở thư mục gốc là template bắt buộc được build riêng.

**Cổng và khóa dùng sẵn:** `images/static/secret-garden-gate.webp` và `images/static/secret-garden-lock.webp`. Hai file được commit trực tiếp, không cần bản tương ứng trong `images/original/`. Generator chỉ kiểm tra chúng tồn tại và đọc được; build website sao chép nguyên byte. Nếu thay ảnh, đặt file mới trong `images/static/` rồi cập nhật `site.entrance.image`/`lock`; nên giữ PNG/WebP trong suốt cho khóa.

**QR mừng cưới dùng sẵn:** `images/static/gift-qr-bride.png` và `images/static/gift-qr-groom.png`. Config `parties.*.gift.qrImage` trỏ trực tiếp tới hai file PNG này (kể cả mẫu `single`). Không cần QR trong `images/original/`; generator không resize/nén hoặc xóa QR, build website sao chép nguyên byte.

```powershell
# Cài dependency (lần đầu)
python -m pip install -r requirements.txt

# Xem tên bắt buộc theo config hiện tại
python generate_gallery.py --list-required

# Kiểm tra, chưa thay đổi bộ ảnh đang dùng
python generate_gallery.py --check

# Tạo lại toàn bộ bộ ảnh tối ưu
python generate_gallery.py
npx prettier --write images/manifest.json
```

**Theo dõi tiến độ:** Khi chạy generator (kể cả `--check`), terminal hiển thị ngay từng giai đoạn, tên ảnh đang kiểm tra/xử lý, số ảnh đã xong/tổng số, phần trăm của từng nhóm ảnh và thời gian đã chạy. Mỗi ảnh tối ưu có thời gian xử lý riêng. Log được đẩy ra ngay qua stderr để xem được cả trong PowerShell và khi chuyển hướng log, không cần thêm `python -u`. Chỉ hiện `HOÀN TẤT` sau khi cập nhật đầu ra thành công; `--list-required` vẫn chỉ in danh sách tên file.

**Nếu thiếu/sai tên/ảnh hỏng:** script báo `FAILED`, liệt kê lỗi và thoát với mã `1`. Bộ ảnh tối ưu và manifest đang dùng giữ nguyên. Script tạo bộ mới trong thư mục tạm trước khi thay thế; nếu ghi manifest thất bại thì khôi phục bộ ảnh cũ. Không chạy đồng thời nhiều tiến trình; lock bảo vệ việc ghi. Nếu máy bị tắt đột ngột trong lúc publish, cần kiểm tra thư mục `.gallery-build-*`/lock trước khi chạy lại; không cam kết atomic cho mất điện giữa hai thao tác filesystem.

Sau khi thành công, dùng **`git add -A images/optimized images/manifest.json`**, kiểm tra diff, commit và push — cần stage cả file đã xóa. `images/original/` được Git ignore, không push ảnh gốc. Workflow deploy **không tự chạy generator** vì repository không chứa ảnh gốc; nó chỉ kiểm tra/build các ảnh tối ưu đã commit.

Thay đổi cấu hình 1440/84 không tự tăng nét 30 ảnh WebP đã commit: cần chạy generator với bộ ảnh gốc đầy đủ trên máy rồi push kết quả. Không dùng ảnh WebP 960 px cũ làm nguồn nếu muốn có thêm chi tiết.

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
npm run build
```

`npm run build` tạo website trong `dist/`, giữ nguyên source. Chạy `npm run serve` để xem tại http://127.0.0.1:8000. Cần Node.js 22+, Python 3.12+ và `python3 -m pip install -r requirements.txt`. `build-wedding.cjs` là adapter nội bộ được gọi trên bản sao trong `dist/`, không chạy trực tiếp tại thư mục source.

### Kiểm tra tự động

- **Unit/config:** `node --test tests/*.test.cjs`
- **Browser:** `npm ci`, `npx playwright install --with-deps chromium webkit`, `npm run build`, rồi `npm run test:browser`. Playwright tự mở HTTP server phục vụ `dist/`.
- **CI:** workflow `Cross-device browser compatibility` chạy unit + các luồng chính trên Chromium, một nhóm nhỏ trên iPhone WebKit và thao tác vuốt Android khi sửa nguồn; bản 8 thiết bị có thể bật bằng `workflow_dispatch` với tùy chọn `extended=true`. Workflow `Deploy Wedding` gọi lại bộ kiểm tra này và chỉ phát hành khi job kiểm tra thành công. Pull request cũng chạy kiểm tra.

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
Dành cho máy local: chạy `npm ci`, `python3 -m pip install -r requirements.txt`, `npx playwright install chromium webkit firefox`, sau đó `npm test`, `npm run build` và `npm run test:browser`.
CI chạy toàn bộ kịch bản trên desktop Chromium, các test `@mobile` trên iPhone WebKit và test `@gesture` trên Android. Full 8-device matrix có thể chạy từ **Actions → Cross-device browser compatibility → Run workflow → extended**.

### Chọn ứng dụng lịch

Bấm **Lưu vào lịch** để chọn sự kiện lễ/tiệc, sau đó mở Google Calendar, Outlook.com hoặc tải tệp `.ics` cho ứng dụng lịch trên máy. Ứng dụng phù hợp với hệ điều hành nằm đầu, các lựa chọn còn lại thu trong **Ứng dụng khác** (mặc định đóng). Thiết bị Apple gợi ý Apple Calendar, Android gợi ý Google Calendar, Windows gợi ý Outlook.com; đây là gợi ý theo thiết bị, không phải phát hiện app đã cài. Nếu trình duyệt chia sẻ được tệp lịch, có thêm nút mở bảng chọn ứng dụng của hệ điều hành. Khách tự xem và xác nhận lưu; thiệp không tự thêm sự kiện vào tài khoản. Nút tải cả lễ và tiệc vẫn giữ hai sự kiện riêng với đúng ngày giờ/địa điểm từ `wedding-info.js`. Chế độ một tiệc chỉ có một sự kiện. Bảng chọn dùng chung ngôn ngữ VN/EN.

Hai nút **Xem địa điểm / Lưu vào lịch** trong thẻ tiệc dùng hai cột bằng nhau, cùng chiều cao và khoảng cách riêng; biểu tượng SVG dùng chung nét, không phụ thuộc emoji của thiết bị.

### Nhịp mở cổng

Cổng mở khoảng 6,5 giây: mở khóa → ánh vàng ở khe cửa và viền cánh → hai cánh mở lệch nhẹ 60 ms → tên và lời mời hiện lần lượt → hòa vào hero. Các mốc chính nằm ở `GATE_*_MS` trong `script.js`; thời lượng CSS nhận cùng giá trị qua biến `--gate-*-time`. Chế độ giảm chuyển động vẫn giữ lời mời tĩnh khoảng 2,2 giây.

Mặt trời có quầng sáng nhịp chậm, tia nghiêng nhẹ và sáng lên một nhịp khi mở khóa. Mặt trăng có ánh bạc ấm, bốn sao sáng lệch nhịp. Các vòng lặp dừng khi cửa mở hoặc bị ẩn; chế độ giảm chuyển động dùng hình tĩnh. Hiệu ứng dùng CSS, không thêm ảnh hay vòng lặp JavaScript.

### Kiểm tra hồi quy và tiết kiệm tài nguyên

Animation của cổng được tạm dừng khi tab ẩn và khôi phục khi quay lại. Nhạc có watchdog 15 giây cho cả lần phát đầu lẫn khi buffering lại: nếu không phát tiếp được, giao diện cho thử lại và giữ vị trí phát gần nhất. CI kiểm tra cổng/nhạc cùng các luồng tương tác; chuyển cảnh được kiểm tra theo thời lượng chung và trạng thái hiển thị thực tế.

### Secret garden entrance

The approved gate artwork is layered in `fairy-gate.css`: two masked leaves rotate around the inner jambs while the floral arch stays fixed. The lock is a separate transparent image and uses a gentle light highlight instead of visible instruction text. The closed gate has no captions; three small butterflies drift around the flowers and stop after entry. As the leaves open, the camera approaches and the entire gate dissolves, revealing the wedding day, couple names and tagline. These introduction lines then fade, leaving only the invitation greeting and optional guest name before the hero appears. Change the artwork paths in `wedding-info.js` → `site.entrance`. Both WebP assets together are about 220 KB.

### Bố cục thích ứng

Tiêu đề và nhãn ngắn được đo theo khung chứa thực tế trong `typography.js`, tính lại khi đổi kích thước hoặc ngôn ngữ và khi font tải xong. Đoạn dài giữ cỡ dễ đọc; các ngắt dòng chủ ý vẫn được giữ.

Lưới dùng kích thước nội dung để tự đổi số cột. Album nội suy kích thước, khoảng cách và độ sâu từ chiều rộng khung, đồng thời hủy tọa độ kéo cũ khi xoay máy. Nút nổi và bảng tùy chỉnh bám vùng `visualViewport`, có tính lại khoảng tránh tai thỏ sau khi đổi chiều. Các hằng số khoảng cách và cỡ tối thiểu là giới hạn thiết kế, không phải danh sách mẫu điện thoại.

### Quy tắc phát triển giao diện chung

- `layout.js` là nguồn duy nhất đọc vùng hiển thị và safe-area, gom sự kiện vào một animation frame. Các nút và panel dùng `WeddingLayout.viewport()` / `subscribe()`; CSS dùng `--viewport-width/height/left/top` và có fallback khi JavaScript chưa tải.
- `responsive.css` quản lý reflow, lưới, viewport và quy tắc chữ. CSS của từng thành phần chỉ quản lý hình thức riêng; không thêm nhánh theo tên điện thoại hoặc hệ điều hành.
- Tiêu đề/câu ngắn có `data-text-fit="heading"` hoặc `"label"`; đoạn dài có `data-text-flow="prose"`. CSS xử lý bố cục trước, `typography.js` chỉ bổ sung phép đo khi cần giữ câu ngắn trong một dòng, có giới hạn cỡ dễ đọc.
- Kiểm tra bằng tình huống khung hẹp/rộng, xoay chiều, giảm vùng nhìn thấy và tăng lại kích thước. Các trình duyệt chạy cùng bộ hành vi để phát hiện khác biệt; không duy trì giao diện riêng cho từng nền tảng.

## Cấu trúc và quy trình bảo trì

| Vị trí                            | Trách nhiệm                                              |
| --------------------------------- | -------------------------------------------------------- |
| `wedding-info.js`                 | Thông tin cặp đôi, tiệc, tài nguyên và VN/EN             |
| `images/manifest.json`            | Cấu hình và danh sách album                              |
| `index.html`, các file JS/CSS gốc | Các thành phần giao diện; giữ thứ tự script/CSS hiện tại |
| `scripts/`                        | Build website, sinh ảnh chia sẻ, kiểm tra cú pháp        |
| `tests/`                          | Unit/config/build và kiểm thử trình duyệt                |
| `docs/`                           | Kiến trúc, kết quả review và giới hạn kiểm chứng         |
| `dist/`                           | Website sinh tự động, không commit                       |

Chạy `npm run format` trước khi commit; `npm run format:check` kiểm tra cùng phiên bản Prettier đã khóa trong lockfile. Python dùng `python3 -m black generate_gallery.py scripts/build-social-preview.py tests/test_generate_gallery.py` (Black 25.9.0). EditorConfig thống nhất UTF-8, LF và thụt dòng.

Nhạc MP3 chỉ được gán source khi khách mở thiệp/bật nhạc; `play()` vẫn chạy trực tiếp trong click để giữ user activation trên iOS. Album chỉ duyệt các thẻ gần camera cộng các thẻ vừa rời vùng nhìn ở mỗi frame. Không giảm kích thước, chất lượng hay số lượng ảnh; nguồn fullscreen giữ nguyên.

Xem [review kỹ thuật](docs/source-review.md) để biết phạm vi, bằng chứng và các bước tiếp theo.

Kiểm tra pipeline ảnh riêng: `python -m unittest discover -s tests -p "test_*.py"`. Test dùng ảnh giả trong thư mục tạm, không cần ảnh gốc riêng tư và không sửa bộ ảnh thật. CI chạy bộ test này trước khi build.

### Tự động căn khuôn mặt trong khung chân dung

Sau khi thay ảnh gốc đúng tên bắt buộc, chạy `python3 generate_gallery.py`. Script dùng OpenCV YuNet để tìm khuôn mặt ngay trên máy, rồi tạo `images/optimized/portrait-focus.json` cùng bộ ảnh mới. Commit cả metadata và ảnh được tạo. Website đọc metadata, tự căn lại khi kích thước khung hoặc thiết bị thay đổi; không tải mô hình AI trên trình duyệt, không gửi ảnh đến dịch vụ ngoài và không crop lại file ảnh.

Cài dependency bằng `python3 -m pip install -r requirements.txt`. Model đã đi kèm trong `scripts/models/` và được kiểm tra SHA-256. Không cần tải model mỗi lần chạy. Thiếu model hoặc lỗi xử lý sẽ dừng trước khi thay bộ ảnh cũ. `--check` chỉ kiểm tra đầu vào, chưa chạy nhận diện.

Nếu không thấy mặt, script cảnh báo và website dùng `parties.bride/groom.portraitPosition.main` / `.secondary` trong `wedding-info.js` làm vị trí dự phòng. Nếu thấy nhiều mặt, website căn vùng chứa tất cả; nếu vùng mặt quá lớn so với khung, dùng `contain` để tránh cắt mặt (có thể xuất hiện khoảng trống). Nhận diện không đảm bảo đúng với mọi ảnh, nhất là mặt bị che hoặc quay nghiêng; nên xem lại giao diện sau khi đổi ảnh. Metadata thiếu hoặc không tải được cũng dùng vị trí dự phòng. Không sửa ảnh trực tiếp trong `optimized/`: luôn chạy lại script để tọa độ khớp ảnh mới.
