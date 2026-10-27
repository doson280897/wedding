# Thiệp cưới Thành Sơn & Tố Nga

Website thiệp cưới phong cách **Cinematic Editorial / Dark Luxury** (đen – vàng champagne), chạy trên GitHub Pages.

**Xem thiệp:** https://doson280897.github.io/wedding/

## Tính năng

- Banner mở đầu, lời mời cá nhân hóa bằng tham số `?to=` (ví dụ: `https://doson280897.github.io/wedding/?to=Nguyen%20Van%20A`).
- Giới thiệu cô dâu **Tố Nga** và chú rể **Thành Sơn**, thông tin hai gia đình.
- Lịch **lễ Vu Quy 14/11/2026** và **lễ Tân Hôn 29/11/2026**, đồng hồ đếm ngược.
- **Album ảnh 3D**: vuốt hoặc kéo trái/phải để xem ảnh; không có nút chỉnh depth, autoplay hay fullscreen.
- Nút **MỤC LỤC** nổi: chọn mục để cuộn mượt đến nội dung.
- **FIND YOUR WAY / Bản đồ chỉ đường** được **ẩn khỏi luồng trang chính**. Chỉ hiện trong popup khi chọn **Mục lục → Bản đồ chỉ đường**, hoặc bấm **XEM ĐỊA ĐIỂM** ở phần lịch cưới. Popup hiển thị địa điểm nhà trai và nhà gái, có liên kết Google Maps; đóng bằng **×**, bấm ngoài popup hoặc phím **Esc**.
- Giao diện responsive cho điện thoại và máy tính.

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
3. Push code lên nhánh `main`. Workflow `.github/workflows/deploy.yml` sẽ xuất bản **các file đã có sẵn trong repo**; workflow **không chạy Python để tạo ảnh**.
4. Xem trạng thái tại https://github.com/doson280897/wedding/actions và mở https://doson280897.github.io/wedding/ khi deploy thành công.

Nếu ảnh báo **404**, kiểm tra các file WebP đã có trên GitHub **đúng tên và đúng thư mục** (`assets-optimized/`, `thumbs/`) và `images.json` đã được commit. Có ảnh gốc trong `assets/` nhưng thiếu `assets-optimized/` **không đủ** để website hiển thị.

## Các file giao diện chính

- `index.html`: nội dung thiệp, địa điểm, các mục và popup bản đồ.
- `style.css`: giao diện chính, ảnh nền tối ưu.
- `script.js`: hành vi chung (ví dụ: tên khách, đếm ngược).
- `gallery.js`: album 3D lấy danh sách ảnh từ `images.json`.
- `quick-nav.css` và `quick-nav.js`: nút mục lục, cuộn đến mục, mở/đóng popup bản đồ.
- `generate_gallery.py`: chạy **local** để tạo ảnh WebP và danh sách album.

## Lưu ý trước khi gửi thiệp

Kiểm tra tên khách, ngày giờ, địa chỉ và vị trí Google Maps của hai gia đình trước khi chia sẻ. Để gửi thiệp có tên riêng, dùng `?to=` kèm tên đã mã hóa URL.
