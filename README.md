# Thiệp cưới Thành Sơn & Tố Nga

Website thiệp cưới phong cách **Cinematic Editorial / Dark Luxury**, chạy trên GitHub Pages.

**Live:** https://doson280897.github.io/wedding/

## Cấu trúc repository

```text
wedding/
├── .github/workflows/deploy.yml
├── images/
│   ├── original/
│   │   ├── assets/        # hero, ending, chân dung gốc — local only
│   │   └── album/         # album gốc — local only
│   ├── optimized/
│   │   ├── assets/        # WebP dùng trực tiếp trên website
│   │   └── album/         # WebP album
│   └── manifest.json      # danh sách album
├── gallery.js
├── generate_gallery.py
├── i18n.js
├── index.html
├── quick-nav.css
├── quick-nav.js
├── requirements.txt
├── script.js
└── style.css
```

Ảnh gốc nằm trong `images/original/` và bị ignore bởi Git. GitHub chỉ cần `images/optimized/` cùng `images/manifest.json`.

## Tính năng chính

- Thiệp cá nhân hoá bằng `?to=`.
- VN / EN, mặc định VN.
- Phong thư mở đầu kiểu **botanical ivory** với thiệp giấy, sage green + champagne gold, animation card trượt khỏi phong bì; countdown hai ngày cưới và lưu lịch ICS.
- Album 3D dạng **ribbon vô hạn** dùng native momentum + scroll-snap.
- Ring buffer cố định 31 slide, phù hợp album 100+ ảnh mà không render toàn bộ.
- Decode album theo hàng đợi tối đa 4 ảnh song song; mobile chỉ transform vùng card gần viewport.
- Google Maps chỉ tải khi mở popup.
- Nhạc nền Web Audio tuỳ chọn.
- Cache-busting theo commit SHA khi deploy.
- Open Graph preview được GitHub Actions tạo từ hero tối ưu.

## Quản lý ảnh

### Ảnh chính

Đặt ảnh gốc vào `images/original/assets/`:

```text
hero.jpg
ending.jpg
son-1.jpg
son-2.jpg
nga-1.jpg
nga-2.jpg
```

### Album

Đặt ảnh cưới gốc vào:

```text
images/original/album/
```

Có thể có thư mục con. Generator giữ thứ tự tự nhiên theo tên file.

### Generate ảnh web

```powershell
python -m pip install -r requirements.txt
python generate_gallery.py
```

Output:

```text
images/optimized/assets/*.webp
images/optimized/album/**/*.webp
images/manifest.json
```

Album tối đa 960px, WebP quality 80. Mỗi thumbnail có fingerprint riêng để ảnh không đổi tiếp tục dùng browser cache.

Generator không phá dữ liệu khi chạy trên clone chỉ có ảnh tối ưu: nếu thiếu ảnh gốc, output hiện có được giữ nguyên.

## Commit ảnh

Chỉ commit:

```text
images/optimized/assets/
images/optimized/album/
images/manifest.json
```

Không commit ảnh trong `images/original/`.

Sau khi cập nhật ảnh:

```powershell
git add images/optimized images/manifest.json
git commit -m "Update wedding images"
git push origin main
```

## Deploy

Workflow `.github/workflows/deploy.yml`:

1. Checkout source.
2. Tạo `og-preview.jpg` từ `images/optimized/assets/hero.webp`.
3. Stamp build ID để cache-busting CSS/JS/ảnh chính.
4. Upload và deploy GitHub Pages.

Workflow không cần ảnh gốc.

## Runtime files

- `index.html`: markup chính.
- `style.css`: giao diện và responsive.
- `script.js`: guest name, countdown, envelope, calendar, music, progress/reveal.
- `gallery.js`: album ribbon vô hạn.
- `i18n.js`: VN/EN.
- `quick-nav.js`, `quick-nav.css`: menu nổi và popup bản đồ.
- `generate_gallery.py`: pipeline ảnh chạy local.

## Ghi chú

- `version.json` và `og-preview.jpg` được tạo lúc deploy, không commit.
- Nếu ảnh 404, kiểm tra `images/optimized/` và `images/manifest.json`.
- Để gửi thiệp có tên riêng, dùng `?to=` với tên đã URL-encode.
