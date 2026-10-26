# Thiệp cưới Thành Sơn & Tố Nga — Cinematic Editorial

Thiết kế theo mockup đen / vàng champagne: hero ảnh cưới, chân dung cô dâu/chú rể, gia đình, album ảnh 3D, lễ cưới và bản đồ.

## Ảnh riêng cần chuẩn bị

Chép ảnh vào `assets/`:

- `hero.jpg`: ảnh banner đầu trang (ưu tiên ảnh ngang).
- `son-1.jpg`, `son-2.jpg`: 2 ảnh chú rể.
- `nga-1.jpg`, `nga-2.jpg`: 2 ảnh cô dâu.
- `ending.jpg`: ảnh nền phần cuối (tùy chọn).

Nếu chưa có các file này, trang sử dụng ảnh minh họa trực tuyến để bạn xem demo. Có thể đổi đuôi file trong `index.html` và `style.css` nếu ảnh của bạn không phải JPG.

**Album ảnh 3D** tiếp tục lấy tất cả ảnh bên trong `images/`, không lấy từ `assets/`.

## Chạy local

1. Cài Python và các thư viện: `python -m pip install -r requirements.txt`
2. Chép ảnh album vào `images/`.
3. Tạo ảnh WebP nhẹ: `python generate_gallery.py`
4. Mở `index.html` bằng Live Server trong VS Code.

Khách chỉ được vuốt/kéo trái phải hoặc dùng phím mũi tên để chuyển album, không có reset, depth, autoplay, fullscreen.

## Deploy GitHub Pages

Push project lên nhánh `main`, tại GitHub → Settings → Pages → Source chọn **GitHub Actions**. Workflow sẵn có tự tạo manifest, WebP và deploy.

Kiểm tra lại thông tin địa điểm và tọa độ trên Google Maps trước khi gửi khách. Dữ liệu lễ cưới được giữ theo phiên bản trước: nhà gái 14/11/2026, nhà trai 29/11/2026.
