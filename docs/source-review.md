# Source review — 2026-10-30

Baseline: `28339ef7d5b0f1a069c3d68fcf1949b655cee938`.

## Phạm vi

Review các engine JavaScript, template HTML, CSS/cascade, cấu hình VN/EN, manifest ảnh, Python optimizer, build/deploy, formatter và test. Kiểm tra tài nguyên qua manifest và file tồn tại; không đánh giá thẩm mỹ từng ảnh hoặc nội dung pháp lý của các dịch vụ ngoài.

## Phát hiện và xử lý

| Mức  | Phát hiện                                                                               | Thay đổi                                                                                                     |
| ---- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Cao  | Deploy và browser test chạy độc lập; test thất bại vẫn có thể phát hành                 | Reusable workflow kiểm tra, `deploy.needs: validate`; phát hành đúng artifact đã test; PR cũng được kiểm tra |
| Vừa  | Build thay placeholder ngay trong source; chạy lại dễ giữ metadata/build ID cũ          | Entry point `npm run build` dựng bản sao mới trong `dist/`, test hai build liên tiếp                         |
| Vừa  | MP3 `preload=auto` cạnh tranh mạng với cổng/hero trước tương tác                        | Chỉ gán `src` trong thao tác phát, giữ `play()` đồng bộ với click                                            |
| Vừa  | Album duyệt toàn bộ thẻ ở mọi frame                                                     | Duyệt tập thẻ gần camera và thẻ vừa rời vùng nhìn; cache eviction chỉ duyệt ảnh đã tải                       |
| Vừa  | Đóng bản đồ từ menu trả focus về liên kết trong panel đã ẩn                             | Trả focus về nút mở menu; regression test mở lại bản đồ                                                      |
| Vừa  | Các thiết bị wheel dùng đơn vị line/page không đạt ngưỡng pixel nhất quán               | Chuẩn hóa deltaMode trước khi tính bước album                                                                |
| Vừa  | File introSound tùy chọn không được đóng gói nếu nằm ngoài các file nhạc chính          | Build sao chép cả âm thanh mở cổng từ config                                                                 |
| Thấp | Workflow format sửa file trên runner rồi bỏ kết quả, không phát hiện source chưa format | Prettier được pin, format toàn bộ source, check trong CI; Python format bằng Black                           |
| Thấp | Social preview và đóng gói nằm trong YAML dài, khó chạy ở local                         | Tách `scripts/build-social-preview.py` và `scripts/build-site.cjs`                                           |

## Bằng chứng hiệu năng và bảo toàn chất lượng

- Hai MP3 hiện tại có dung lượng 6,844,077 và 5,054,464 byte. Trước tương tác, implementation mới không gán source nên không yêu cầu MP3. Đây là tải được hoãn, không phải số byte tiết kiệm cho khách đã phát nhạc; browser có thể chỉ tải một phần ở bản cũ.
- Với active range hiện tại, mỗi frame album duyệt tối đa 13 thẻ gần camera cộng tập thẻ visible trước đó (thường không quá 9). Chi phí transform không tăng tuyến tính theo toàn bộ album. Việc tạo DOM ban đầu và resize vẫn O(N), chưa phải DOM virtualization hoàn toàn.
- Đã so sánh 53 file ảnh/nhạc giữa source và `dist/`: SHA-256 giống nhau. Giữ nguyên toàn bộ bytes ảnh/nhạc, tham số kích thước, độ sâu, easing và chất lượng fullscreen. Không tái nén tài nguyên.
- Không đưa số % tăng tốc, FPS, Lighthouse hay Core Web Vitals khi chưa đo trên thiết bị và mạng đại diện. Test 150 ảnh kiểm tra wrap, loading và cache; không thay thế profiling GPU/điện thoại thật.

## Quyết định kiến trúc

Giữ JavaScript thuần và GitHub Pages. Trang đã dùng ResizeObserver, IntersectionObserver, Web Animations API, container queries và responsive images. Không thêm React/Next/Three.js chỉ để đổi công nghệ: chưa có vấn đề cụ thể cần các dependency đó. Giữ đường dẫn runtime gốc để hạn chế rủi ro URL, cascade và thứ tự khởi tạo; tổ chức công cụ, test và tài liệu thành thư mục riêng.

Luồng dữ liệu: `wedding-info.js` → preferences/i18n → các component. `images/manifest.json` → gallery. Build chỉ dựng metadata, favicon, share card và package công khai. Các globals `WeddingI18n`, `WeddingPreferences`, `WeddingLayout`, `WeddingControlHub` là hợp đồng hiện tại giữa các file; tránh thêm dependency ngầm mới.

## Phần cần theo dõi

- `style.css` vẫn có nhiều lớp override lịch sử. Chuyển sang CSS layers hoặc tách component sâu hơn cần visual snapshots làm chuẩn; đợt này format nhưng giữ cascade.
- Trang đang chủ động chặn pinch zoom bằng viewport, touch-action và event handler. Đây là hạn chế accessibility cho khách cần phóng lớn; nên thống nhất hành vi zoom trước khi đổi interaction toàn trang.
- **Đã xử lý ở đợt clean rebuild tiếp theo:** `generate_gallery.py` luôn tạo lại từ ảnh gốc đầy đủ, bắt buộc đủ tài nguyên, không dùng mtime. Cấu hình album mới là 1440 px/quality 84; bộ ảnh cũ chỉ đổi sau khi chủ repo chạy với ảnh gốc và commit kết quả.
- Cache ảnh ngoài album vẫn đổi theo build SHA; có thể chuyển sang content hash để tái sử dụng cache qua các lần chỉ sửa chữ. Cần một asset resolver chung cho cả preload/CSS/JS để tránh tải hai URL cho một ảnh.
- Google Fonts và bản đồ là dependency ngoài; cần thử mạng yếu/đứt mạng và trình duyệt Zalo thật. Có thể self-host font sau khi xác nhận license và subset tiếng Việt đầy đủ.
- Công cụ tạo link là giao diện public, không phải admin authentication. Không đưa dữ liệu riêng tư hoặc secret vào config/frontend.
- Test WebKit giả lập không xác nhận toàn bộ hành vi âm thanh/iOS Safari thật.

## Kiểm chứng

- Baseline: 13 unit/config tests đạt.
- Sau thay đổi: kiểm tra cú pháp JavaScript, unit/config/build tests, build local và format check.
- Test bổ sung: build hai lần không sửa source, giữ bytes media, không đưa file nội bộ lên site; không tải MP3 trước tương tác; focus bản đồ; album 150 ảnh wrap hai chiều và giới hạn nguồn ảnh giữ lại.
- Browser runner local không tải được Chromium/WebKit (archive tải về không hợp lệ). Trạng thái browser CI được báo trong PR; không coi unit/build pass là browser pass.

## Tài liệu nền tảng

- [Media preload](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preload)
- [Reusable GitHub Actions workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)

## Follow-up review — baseline 0562c82

Reviewed the current runtime modules (entrance/audio, gallery/lightbox, i18n/preferences, controls, calendar, typography and portrait framing), templates/styles, configuration, image generation, packaging and Actions workflows. Existing automated coverage supplies functional evidence; this is not a claim that every possible configuration or physical device has been verified.

Fixed findings:

- **Medium:** face detection treated a configured portrait URL as a literal filesystem path. Query strings/fragments and percent-encoded filenames could fail a clean rebuild. Parse the URL path and retain the original URL as the metadata key. External HTTP(S) portraits now explicitly warn and use the existing framing fallback, without fetching remote files. Reject local traversal, absolute paths and unsupported schemes.
- **Medium:** OpenCV filename-based reads can fail for Unicode paths on Windows. Read bytes through NumPy and decode the image from memory; regression coverage uses a Vietnamese filename.
- **Low:** JavaScript string replacement interpreted dollar substitution tokens in configured metadata/initials. Use replacement callbacks so escaped configuration text stays literal. Regression coverage checks metadata and SVG output across repeated builds.

Validation: 17 JavaScript tests, 18 Python tests, source syntax/format and production build pass locally. Browser CI runs on the PR. Tests include URL queries/fragments, encoded Vietnamese names, external fallback and rejected paths. No image/audio bytes or compression settings changed. No new runtime dependencies were added (NumPy is already required by OpenCV).

Remaining limitations from the earlier review still apply: historical CSS overrides need visual baselines before broad consolidation; pinch zoom is currently disabled; simulated WebKit does not replace physical iOS/Zalo testing; external fonts/maps require live network access. No FPS or performance percentage is claimed without profiling.
