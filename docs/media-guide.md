# Ảnh, GIF và sơ đồ của repo

[Tài liệu](README.md) · [README gallery](../README.md#trải-nghiệm-và-gif)

## Nguồn gốc

Media trong `docs/assets/repo-tours` được ghi từ stack `healthcare-local-demo` trên localhost:3000 với dữ liệu minh họa. Phiên bệnh nhân, bác sĩ và admin tách riêng. Login thực hiện trước context ghi video, không ghi form mật khẩu hoặc lưu browser storage state ra file.

Tour public gồm discovery và trang đặt lịch; patient/doctor/admin gồm các màn hình đọc. Không tạo lịch, gửi chat, phê duyệt giao dịch, sửa role hoặc publish CMS để ghi hình.

WebM do Playwright ghi được chuyển thành GIF 5 fps, chiều rộng 960px; bỏ 1,5 giây khởi tạo browser ở đầu để GIF mở bằng giao diện. GIF không có âm thanh; giảm fps/resolution phục vụ dung lượng repo. Đây là ghi hình điều hướng thật, không phải một chuỗi mockups hoặc các screenshot ghép để giả thao tác.

Ảnh desktop là viewport 1440×900; ảnh mobile là 390×844. Chúng không tự chứng minh mọi viewport không overflow hoặc toàn bộ accessibility matrix đã pass.

## Tài sản hiện tại

| Nhóm | GIF | Ảnh chính |
| --- | --- | --- |
| Public | [public-tour.gif](assets/repo-tours/public-tour.gif) | [home](assets/repo-tours/public-01.png), [mobile](assets/repo-tours/public-mobile.png) |
| Patient | [patient-tour.gif](assets/repo-tours/patient-tour.gif) | [dashboard](assets/repo-tours/patient-01.png), [records](assets/repo-tours/patient-03.png), [chat](assets/repo-tours/patient-05.png) |
| Doctor | [doctor-tour.gif](assets/repo-tours/doctor-tour.gif) | [dashboard](assets/repo-tours/doctor-01.png), [care plans](assets/repo-tours/doctor-04.png) |
| Admin | [admin-tour.gif](assets/repo-tours/admin-tour.gif) | [dashboard](assets/repo-tours/admin-01.png), [doctor directory](assets/repo-tours/admin-02.png), [CMS](assets/repo-tours/admin-04.png) |

Media cũ trong `docs/assets/screenshots` và `demo.gif` là tài sản trước phiên này. `demo.gif` được script cũ ghép từ ảnh; không gọi nó là capture liên tục. Gallery chính sử dụng tên tài sản mới để tránh nhầm bằng chứng và cache cũ.

## Tái tạo tour

Đọc [Getting started](getting-started.md) và [demo runbook](local-demo-runbook.md). Dùng [capture script](media-tools/capture-repo-tours.cjs) và [convert script](media-tools/convert-tours.cjs) đã đóng gói cùng tài liệu; không phụ thuộc kế hoạch local bị Git bỏ qua.

1. Xác nhận đúng local seeded stack và dependency Playwright/Chromium, FFmpeg.
2. Cấp mật khẩu local demo qua `REPO_DEMO_PASSWORD` trong process chạy capture; helper không lưu mật khẩu mặc định. Không ghi giá trị vào evidence.
3. Chạy `node docs/media-tools/capture-repo-tours.cjs` từ repo root; role headings và actual routes phải pass. `REPO_TOUR_NAMES` giới hạn tour cần chụp lại.
4. Chạy `node docs/media-tools/convert-tours.cjs` khi manifest đã đủ routes và video. Raw WebM và manifest làm việc nằm trong thư mục `docs/media-tools` được ignore; không đưa chúng vào Git.
5. Decode GIF, kiểm tra frame đầu/giữa/cuối, route assertions, dữ liệu giả lập và không có màn hình login/error lẫn vào gallery.

Mỗi lần chụp là một snapshot riêng. Image revision label `unknown` phải được ghi nhận là chưa xác minh parity với source, không suy ra current HEAD từ UI đẹp.

## Sơ đồ

Sơ đồ hệ thống hiện là Mermaid gốc trong [README](../README.md#kiến-trúc-hệ-thống) và [System overview](architecture/system-overview.md); GitHub tự render theo theme của người đọc. [system-overview.mmd](architecture/system-overview.mmd) và [deployment-local.mmd](architecture/deployment-local.mmd) là bản nguồn dễ chỉnh sửa; cập nhật khối Markdown và tệp `.mmd` cùng lúc khi thay đổi node hoặc edge.

ERD nằm trong [Database](database/schema-overview.md); sequence và lifecycle nằm trong [Business workflows](business-workflows.md), [API](api-reference.md) và [AI](ai-system.md). Kiểm tra render thực tế ở cả light/dark: label không đè node, đường có điều kiện còn rõ và chữ vẫn đọc được khi thu nhỏ. Không cần export PNG/SVG để đọc tài liệu trên GitHub.

## Giới hạn bằng chứng

[Media provenance](assets/repo-tours/provenance.json) ghi thời điểm, routes, heading checks và metadata của GIF đã xuất bản; không chứa storage state hoặc video path local. Báo cáo kiểm chứng theo phiên được giữ trong `plans/` local. Không đưa credential, raw provider payload hoặc dữ liệu người thật vào repo để chứng minh demo. Một GIF chỉ mở trang không đủ chứng minh end-to-end mutation, database durability hay live deployment.
