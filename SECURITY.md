# Chính sách bảo mật / Security Policy

## Báo cáo lỗ hổng

Nếu bạn tìm thấy lỗ hổng bảo mật, **vui lòng không mở public issue**.

- Dùng [GitHub Private Vulnerability Reporting](https://github.com/JasonTM17/HealthCare_Project/security/advisories/new) (tab Security → Advisories → Report a vulnerability), hoặc
- Email: jasonbmt06@gmail.com

Kèm theo: mô tả ảnh hưởng, bước tái hiện, thành phần liên quan (frontend / backend / ai-service / infrastructure), và commit hoặc phiên bản đã kiểm thử. Không đính kèm dữ liệu cá nhân thật, credentials, token hay patient data trong báo cáo.

Mình sẽ phản hồi xác nhận trong vòng vài ngày và thống nhất thời điểm công khai sau khi có bản vá.

## Phạm vi

Repo chứa mã nguồn của một demo bệnh viện số gồm Next.js frontend/BFF, Spring Boot modular monolith và FastAPI AI service. Website triển khai tại `healthcare.id.vn` và dữ liệu thật trên hệ thống vận hành nằm ngoài phạm vi repo này — báo cáo về hệ thống live vẫn được tiếp nhận qua các kênh trên.

Ranh giới bảo mật, các bề mặt cần giữ và negative cases bắt buộc kiểm chứng được mô tả trong [docs/security.md](docs/security.md). Tài liệu đó là nguồn chính xác cho auth/session, clinical authorization, AI/data boundaries, file upload và secrets handling; file này chỉ nói cách báo cáo.

## Được hỗ trợ

Chỉ nhánh `main` mới nhất nhận bản vá bảo mật. Các môi trường demo/seed local với tài khoản giả lập (`patient@healthcare.com`, `doctor@healthcare.com`, `admin@healthcare.com`) không được coi là lỗ hổng — đó là dữ liệu demo có chủ đích.
