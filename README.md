# Wedding Invitation Template — Thiệp cưới dùng lại

Website thiệp cưới **Cinematic Editorial / Dark Luxury** triển khai bằng GitHub Pages.
Có hai giao diện tiệc `bride` (nhà gái) / `groom` (nhà trai), album 3D, nhạc, lịch, bản đồ, QR và tiếng Việt / Anh.

### Giao diện và khách mời cá nhân hóa

- Nút nổi **Tùy chỉnh** (có thể kéo thả) gom **VN / EN**, **Sáng / Tối** và **nhạc nền** vào một bảng; nút **Mục lục** vẫn riêng để truy cập nhanh các phần thiệp. Nhạc chỉ hiển thị khi đã vào thiệp của một bên.
- Chế độ **Sáng** dùng nền kem và màu xanh lá dịu; **Tối** giữ phong cách dark luxury. Album 3D và ảnh bìa vẫn tối có chủ đích để ảnh rõ chiều sâu, không bị lóa. Ngôn ngữ và chế độ hiển thị được ghi nhớ **trong tab đang xem** qua trạng thái lịch sử trình duyệt: F5 giữ lựa chọn, mở tab mới bắt đầu với **VN + Tối** (trừ link có `lang=en`).
- Với link có `?to=Tên+khách`, cả phong bì và hero hiển thị **Kính mời** phía trên, **tên người nhận** ở dòng dưới bằng font serif đậm. Có thể sửa nhãn trong `wedding-info.js` → `text.vi["guest.recipientLabel"]` / `text.en["guest.recipientLabel"]`. Link không có tên vẫn giữ lời mời chung.


## ⭐ Chỉ sửa một file khi làm thiệp mới

**[wedding-info.js](wedding-info.js)** là **file thông tin duy nhất** phải cập nhật khi làm thiệp cho cặp đôi khác.
Không chỉnh tên, ngày, chữ viết tắt, nhạc hoặc lời mời trực tiếp trong HTML/CSS/JS nữa.

| Mục trong `wedding-info.js` | Nội dung bạn đổi |
| --- | --- |
| `site` | URL website, mô tả khi chia sẻ, múi giờ, ảnh chia sẻ |
| `couple.bride`, `couple.groom` | Tên hiển thị, họ tên đầy đủ, chữ viết tắt (`initial` như **N**, **S**) |
| `families.bride`, `families.groom` | Họ tên cha mẹ, địa chỉ hai gia đình (VI/EN) |
| `parties.bride`, `parties.groom` | Ngày (YYYY-MM-DD), giờ lễ/tiệc, ngày âm lịch và địa điểm |
| `parties.*.venue` | Tên sảnh/nhà hàng, địa chỉ, URL Google Maps, URL bản đồ nhúng |
| `parties.*.music.youtubeId` | Mã video nhạc YouTube cho từng lễ |
| `parties.*.images` | Ảnh hero, ảnh kết, chân dung, favicon |
| `parties.*.gift` | Tên ngân hàng, chủ tài khoản, số tài khoản, mã QR |
| `gallery` | File manifest album hoặc danh sách ảnh tự chọn |
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
Tên trên phong bì, hero, thông tin gia đình, chân trang, đường dẫn tạo thiệp, lịch và tiêu đề chia sẻ đều lấy từ cấu hình.
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

Nếu giữ `gallery.photos: null`, album sẽ tự đọc `gallery.manifest` (mặc định `images/manifest.json`) do pipeline tạo.

**Khi làm thiệp cho cặp đôi khác:** đặt `gallery.mode` thành `"replace"` để bộ tạo ảnh **không trộn ảnh cưới cũ** vào manifest mới. Giá trị `"append"` mặc định giữ nguyên bộ ảnh hiện tại khi bổ sung ảnh. Chế độ `"replace"` không xóa ảnh trong repository, chỉ không đưa ảnh cũ vào danh sách hiển thị.


Nếu muốn hoàn toàn chọn danh sách ảnh ngay trong file thông tin, điền:

```js
"gallery": {
  "manifest": "images/manifest.json",
  "photos": [
    { "src": "images/optimized/album/anh-1.webp", "width": 640, "height": 960 },
    { "src": "images/optimized/album/anh-2.webp", "width": 960, "height": 640 }
  ]
}
```

Để tối ưu ảnh mới trên máy cá nhân:

```powershell
python -m pip install -r requirements.txt
python generate_gallery.py
```

Ảnh gốc `images/original/` được Git ignore. File ảnh tối ưu nằm trong `images/optimized/`; manifest là file kỹ thuật tự sinh, **không phải file nội dung cần chỉnh tay**.

## Các file khác chỉ là template / engine

- `index.html`: cấu trúc giao diện, không chứa dữ liệu cưới cố định.
- `style.css`, `quick-nav.css`, `link-tool.css`, `settings.css`: giao diện responsive, light/dark và thiết kế bảng tùy chỉnh.
- `i18n.js`: máy dịch VN/EN; đọc `text` và trường thông tin từ `wedding-info.js`.
- `script.js`: phong bì, tên, monogram, countdown, ICS, nhạc.
- `link-tool.js`: tạo link thiệp cá nhân hóa ngay trong trang chính, dùng chung nút VN/EN.
- `gallery.js`: album 3D và fullscreen.
- `quick-nav.js`: cơ chế kéo thả nút nổi, popup menu, bản đồ, QR.
- `preferences.js`: trạng thái ngôn ngữ và giao diện riêng của tab, được giữ khi F5 nhưng không truyền sang tab mới.
- `settings.js`: cùng một bảng tùy chỉnh ngôn ngữ, light/dark, âm nhạc và lưu sở thích.
- `quick-nav.js`: nút Tùy chỉnh mặc định góc trên phải và Mục lục góc dưới phải mỗi lần tải lại. Có thể kéo đến nơi khác trong phiên xem hiện tại.
- `build-wedding.cjs`: sinh metadata Open Graph và favicon từ cấu hình.
- `generate_gallery.py`: quy trình tối ưu ảnh.
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

## Các đường dẫn

- Trang chọn tiệc: `/`
- Công cụ tạo lời mời: `/?tool=links`
- Nhà gái: `/?party=bride`
- Nhà trai: `/?party=groom`
- Thiệp riêng: `/?party=bride&to=Anh+Minh`
- Tiếng Anh: `?lang=en`

**Nguyên tắc bảo trì:** Cập nhật thông tin khách hàng **chỉ trong `wedding-info.js`**. Sửa các file còn lại **chỉ khi muốn nâng cấp giao diện hoặc tính năng**.
