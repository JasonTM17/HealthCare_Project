# Đóng góp cho HealthCare

[Tài liệu](README.md) · [Testing](testing.md)

## Bắt đầu một thay đổi

Đọc root README, hướng dẫn đóng góp này và tài liệu gần phần định sửa. Kiểm tra Git state, package/runtime metadata và tests liên quan. Giữ công việc dirty/untracked của người khác.

Tách trách nhiệm theo miền hiện có; tìm helper/module trước khi thêm lớp mới. Thay đổi UI/API/data cần dẫn đến executable owners và regression đúng boundary, không chỉ thêm prose.

## Đường đọc source

| Việc cần làm | Bắt đầu |
| --- | --- |
| UI/public/portal | [Frontend app](../apps/frontend/app), [components](../apps/frontend/components), [frontend guide](../apps/frontend/README.md) |
| Browser requests | [api-client.ts](../apps/frontend/lib/api-client.ts) → [BFF](../apps/frontend/lib/server/healthcare-bff.ts) |
| Business behavior | Controller → service → repository/entity trong [Core](../apps/backend/src/main/java/com/healthcare) |
| Schema | [Migrations](../apps/backend/src/main/resources/db/migration) |
| AI behavior | [AI app](../apps/ai-service/app), [gateway/chat Core](../apps/backend/src/main/java/com/healthcare/ai) |
| Infrastructure | [Infrastructure](../infrastructure), [workflows](../.github/workflows) |

## Thực hiện và review

Làm bước nhỏ theo plan đã chọn. Giữ outcome, non-goals và exit criterion rõ. Không tự thêm kiến trúc, cleanup hoặc polish ngoài mục tiêu vì phát hiện code có thể đẹp hơn.

Checkpoint dựa theo risk: syntax/static → focused regression → integration/browser khi boundary yêu cầu → independent review. Các testcase concurrency/ownership/recovery cần evidence đúng môi trường. [Testing](testing.md) sở hữu command navigation.

Code/runtime là nguồn hành vi; docs giải thích why/where và các giới hạn. Thay đổi contract, setup, operator expectations hoặc route có ảnh hưởng đến tài liệu cần cập nhật trang đang sở hữu nội dung đó. Không sao chép lại toàn bộ API inventories và config vào nhiều trang.

## Git hygiene

- Inspect diff/status trước stage; chỉ stage exact owned paths.
- Không reset/clean, đổi Git identity, force-push hoặc lấy việc untracked khác vào một commit không liên quan.
- Dùng nhánh tên theo mục tiêu và Conventional Commits mô tả thay đổi.
- Không commit `.env`, DSN, keys, cookies, reports chứa secrets hoặc `.devin/`.
- Repository yêu cầu owner-only authorship: không có agent/tool attribution trailer, header hoặc PR footer.
- Commit, push, CI, merge và production verification là các trạng thái khác nhau; chỉ báo điều thực sự quan sát.

## Handoff gọn mà đủ

Nêu outcome/files, checks đã chạy, exact snapshot, Git/release state, unresolved risk và next safe action. `NOT_RUN` không được đổi thành `PASS` vì source nhìn hợp lý. Evidence theo phiên giữ trong plans; không đưa timeline/snapshot liên tục vào evergreen docs.

## Media và tài liệu

Dùng [Media guide](media-guide.md) cho ảnh/GIF/sơ đồ. Không thay screenshot thật bằng thiết kế giả lập nhưng giữ caption “live”. Kiểm tra chữ/đường nối/alt text và nguồn gốc dữ liệu trước publish.
