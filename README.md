# Thiệp cưới Thành Sơn & Tố Nga

Website thiệp cưới phong cách **Cinematic Editorial / Dark Luxury** (đen – vàng champagne), chạy trên GitHub Pages.

**Xem thiệp:** https://doson280897.github.io/wedding/

## Tính năng

- Banner mở đầu, lời mời cá nhân hóa bằng tham số `?to=` (ví dụ: `https://doson280897.github.io/wedding/?to=Nguyen%20Van%20A`).
- Giới thiệu cô dâu **Tố Nga** và chú rể **Thành Sơn**, thông tin hai gia đình.
- Lịch **lễ Vu Quy 14/11/2026** và **lễ Tân Hôn 29/11/2026**, đồng hồ đếm ngược.
- **Album ảnh 3D dạng ribbon vô hạn**: dùng native horizontal momentum + `scroll-snap`; các ảnh nối sát thành một dải liền, ảnh cuối nối ảnh đầu. Ring buffer cố định 31 slide chỉ xoay node ngoài màn hình và bù chính xác `scrollLeft` trong cùng frame, nên không có cú “giật về giữa”. Dù có 100+ ảnh cũng không render toàn bộ album cùng lúc.
- Nút **MỤC LỤC** nổi: chọn mục để cuộn mượt đến nội dung.
- **FIND YOUR WAY / Bản đồ chỉ đường** được **ẩn khỏi luồng trang chính**. Chỉ hiện trong popup khi chọn **Mục lục → Bản đồ chỉ đường**, hoặc bấm **XEM ĐỊA ĐIỂM** ở phần lịch cưới. Popup hiển thị địa điểm nhà trai và nhà gái, có liên kết Google Maps; đóng bằng **×**, bấm ngoài popup hoặc phím **Esc**.
- Giao diện responsive cho điện thoại và máy tính.
- **VN / EN**: mặc định là tiếng Việt. Chế độ VN dùng toàn bộ nội dung tiếng Việt; khi chuyển sang EN, toàn bộ giao diện và nội dung động chuyển sang tiếng Anh. Lựa chọn được lưu trên trình duyệt.
- **Phong thư mở đầu** nhẹ, chỉ xuất hiện lần đầu trong phiên; có thể bỏ qua.
- **Countdown hai ngày cưới**: khách chuyển giữa lễ Vu Quy (14/11) và lễ Tân Hôn (29/11).
- **Lưu ngày cưới vào lịch**: tải file ICS cho từng bên, dùng được với lịch điện thoại/Google Calendar/Outlook.
- **Nhạc nền tùy chọn**: ambient nhẹ bằng Web Audio, chỉ phát sau khi khách chủ động bật; không cần file MP3.
- **Album preload có giới hạn**: manifest được tải sớm khi khách tiến gần album; tối đa 31 ảnh trong ring được fetch/decode theo hàng đợi tối đa 4 ảnh song song, ưu tiên ảnh ở tâm. Mỗi frame chỉ tính 3D cho 9 card gần viewport trên mobile hoặc 11 card trên desktop; 100+ ảnh vẫn không bị tải/render toàn bộ cùng lúc.
- **Preview khi chia sẻ Zalo/Facebook**: Open Graph dùng `og-preview.jpg` 1200×630 được GitHub Actions tạo từ `assets-optimized/hero.webp`; không dùng ảnh gốc.
- **Cache-busting tự động**: mỗi deploy tạo `version.json` và đóng dấu commit SHA vào CSS/JS/ảnh chính; trang cũ tự phát hiện build mới và reload sang URL có `_v=` mới. Album dùng `no-store` cho manifest và, sau lần generate kế tiếp, mỗi thumbnail có fingerprint riêng để code deploy không bắt trình duyệt tải lại ảnh không đổi.
- **Generator an toàn**: nếu clone GitHub không có ảnh gốc trong `images/` hoặc `assets/`, script giữ nguyên `images.json`, `thumbs/` và `assets-optimized/` thay vì xóa/ghi rỗng.

## Cấu trúc ảnh — chỉ push ảnh tối ưu

**Ảnh gốc chỉ giữ trên máy**, không đưa vào GitHub:

| Thư mục / file | Vai trò | Push lên GitHub? |
| --- | --- | --- |
| `assets/` | Ảnh gốc cho banner, chân dung, ảnh cuối | **Không** |
| `images/` | Ảnh gốc cho album 3D | **Không** |
| `assets-optimized/` | Ảnh WebP nhẹ dùng trên website | **Có** |
| `thumbs/` | Ảnh album WebP đã thu nhỏ | **Có** |
| `images.json` | Danh sách ảnh album | **Có** |

Đặt các ảnh chính trong `assets/` với tên (đuôi có thể là JPG, PNG, WebP…):

```text
assets/
├── hero.jpg        # Ảnh banner đầu trang
├── ending.jpg      # Ảnh nền cuối thiệp
├── son-1.jpg       # Chú rể, ảnh 1
├── son-2.jpg       # Chú rể, ảnh 2
├── nga-1.jpg       # Cô dâu, ảnh 1
└── nga-2.jpg       # Cô dâu, ảnh 2
```

Đặt ảnh album tùy ý trong `images/`. Script `generate_gallery.py` tạo `assets-optimized/*.webp`, `thumbs/**/*.webp` và `images.json`. Ảnh gốc không bị thay đổi. **Không cần đổi đường dẫn trong HTML/CSS khi đổi ảnh gốc cùng tên**; chỉ chạy script để tạo lại ảnh WebP.

## Chạy và cập nhật ảnh ở máy tính

Cài Python, sau đó chạy tại thư mục dự án:

```powershell
python -m pip install -r requirements.txt
python generate_gallery.py
```

Mở `index.html` bằng **Live Server** trong VS Code để xem thử. Kiểm tra các ảnh sau đã được tạo trước khi push: `assets-optimized/hero.webp`, `assets-optimized/ending.webp`, `assets-optimized/son-1.webp`, `assets-optimized/son-2.webp`, `assets-optimized/nga-1.webp`, `assets-optimized/nga-2.webp`; cùng với `thumbs/` và `images.json`.

**Quan trọng:** Không chạy `generate_gallery.py` trên bản clone chỉ có ảnh tối ưu nhưng **không có ảnh gốc**: script sẽ tạo manifest rỗng và có thể xóa các file tối ưu hiện có.

### Push lần đầu sau khi chuyển sang chế độ ảnh nhẹ

Nếu Git từng theo dõi ảnh gốc:

```powershell
git rm -r --cached --ignore-unmatch assets images
```

Lệnh trên chỉ ngừng theo dõi ảnh trong Git, **không xóa ảnh trên máy**. Sau đó:

```powershell
git add .gitignore
git add assets-optimized thumbs images.json
git commit -m "Update optimized wedding images"
git push origin main
```

Nếu có thay đổi code, hãy `git add` thêm các file tương ứng trước khi commit. Về sau, mỗi khi thay ảnh: cập nhật ảnh gốc trên máy → `python generate_gallery.py` → commit & push **chỉ ảnh đã tối ưu**.

> Lưu ý: `.gitignore` ngăn việc thêm ảnh gốc vào các commit mới; **không tự xóa ảnh gốc khỏi lịch sử Git cũ** nếu chúng từng được push.

## Deploy GitHub Pages

1. Vào repository → **Settings → Pages → Build and deployment**.
2. Đặt **Source: GitHub Actions**.
3. Push code lên nhánh `main`. Workflow `.github/workflows/deploy.yml` xuất bản các file đã có sẵn và chỉ tạo thêm `og-preview.jpg` từ **ảnh hero WebP đã tối ưu**. Workflow **không cần ảnh gốc** và không tạo lại album.
4. Xem trạng thái tại https://github.com/doson280897/wedding/actions và mở https://doson280897.github.io/wedding/ khi deploy thành công.

Nếu ảnh báo **404**, kiểm tra các file WebP đã có trên GitHub **đúng tên và đúng thư mục** (`assets-optimized/`, `thumbs/`) và `images.json` đã được commit. Có ảnh gốc trong `assets/` nhưng thiếu `assets-optimized/` **không đủ** để website hiển thị.

## Các file giao diện chính

- `index.html`: nội dung thiệp, địa điểm, các mục và popup bản đồ.
- `style.css`: giao diện chính, ảnh nền tối ưu.
- `i18n.js`: từ điển VN/EN, chuyển ngôn ngữ và lưu lựa chọn.
- `script.js`: tên khách, countdown 2 ngày, phong thư, lưu lịch, nhạc nền, scroll/reveal.
- `gallery.js`: album 3D lấy danh sách ảnh từ `images.json` và chỉ khởi tạo khi khách cuộn gần tới album.
- `quick-nav.css` và `quick-nav.js`: nút mục lục, cuộn đến mục, mở/đóng popup bản đồ.
- `generate_gallery.py`: chạy **local** để tạo ảnh WebP và danh sách album.

## Lưu ý trước khi gửi thiệp

Kiểm tra tên khách, ngày giờ, địa chỉ và vị trí Google Maps của hai gia đình trước khi chia sẻ. Để gửi thiệp có tên riêng, dùng `?to=` kèm tên đã mã hóa URL.
