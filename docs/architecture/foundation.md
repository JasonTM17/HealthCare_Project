# Foundation và quyết định kiến trúc

[Tài liệu](../README.md) · [System overview](system-overview.md) · [ADR](../adr/README.md)

## Các quyết định chính

| Quyết định | Rationale / nguồn |
| --- | --- |
| Spring modular monolith cho nghiệp vụ | Một transaction authority và module theo miền; [ADR-001](../adr/ADR-001-modular-monolith.md) |
| Browser BFF và session phía server | Giữ server trust token khỏi client; [Auth](../api-reference.md), [ADR-002](../adr/ADR-002-authentication-strategy.md) ghi rationale giai đoạn nền tảng |
| PostgreSQL là dữ liệu gốc | Lịch/ownership/content phải cùng transaction boundary; [Database](../database/schema-overview.md) |
| FastAPI tách riêng | Runtime AI/provider khác core; [AI README](../../apps/ai-service/README.md) |
| Booking dùng database invariants | Chống hai người cùng nhận lịch qua kiểm tra server/transaction; [ADR-003](../adr/ADR-003-appointment-concurrency.md) |
| AI sources qua eligibility/projection | Model không thay quyền đọc nguồn; [AI system](../ai-system.md) |
| Clinical demo có nhãn tổng hợp | Không trình bày fixture như điều trị thật; [ADR-005](../adr/ADR-005-synthetic-clinical-documents.md) |

## Ranh giới hiện tại

Các portal bệnh nhân/bác sĩ, clinical records, credit/consent, đối soát, tư vấn, CMS và storage có executable owners trong repo. Không giữ chúng trong danh sách “future work” chỉ vì tài liệu nền tảng cũ được viết trước khi có module.

Các giới hạn vẫn cần phân biệt: chi nhánh khác tenant; demo khác dữ liệu thật; configured integration khác live provider; PostgreSQL primary khác RAG projection; presigned URL khác encryption-at-rest. [System overview](system-overview.md) và [Security](../security.md) là đường đọc hiện tại.

## Bằng chứng theo snapshot

Không dùng chữ “verified” chung cho tất cả môi trường. Test unit, PostgreSQL integration, browser local, hosted provider và deployment là các gate riêng. Báo cáo và plan lưu trong `plans/` local (Git ignored); trạng thái hiện tại cần kiểm chứng mới ở gate phù hợp.
