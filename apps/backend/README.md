# Backend HealthCare

[Repo overview](../../README.md) · [Architecture](../../docs/architecture/system-overview.md) · [API](../../docs/api-reference.md)

Spring Boot modular monolith, JDK 21; [pom.xml](pom.xml) và Maven wrapper sở hữu build/runtime contract.

## Chạy và kiểm thử

Từ repo root, đọc [Getting started](../../docs/getting-started.md) để chọn Compose hoặc process riêng. Từ apps/backend, sau khi cung cấp cấu hình dependencies:

~~~powershell
.\mvnw.cmd spring-boot:run
.\mvnw.cmd -B verify
~~~

Trước integration suite, chạy [backend test preflight](../../scripts/check-backend-test-preflight.ps1) và đọc [Testing](../../docs/testing.md). Integration DB cleanup chỉ được phép trên database test dedicated. Không khẳng định mọi suite tự tạo Testcontainer; [test infrastructure](src/test/java/com/healthcare) và [CI](../../.github/workflows/ci.yml) sở hữu dependency selection.

## Navigation theo miền

| Boundary | Owner |
| --- | --- |
| Browser sessions/JWT/BFF trust | [auth](src/main/java/com/healthcare/auth), [security](src/main/java/com/healthcare/security) |
| Hospital catalog | [hospital](src/main/java/com/healthcare/hospital) |
| Booking/schedule | [appointment](src/main/java/com/healthcare/appointment), [scheduling](src/main/java/com/healthcare/scheduling) |
| Clinical/care plan/consultation | [clinical](src/main/java/com/healthcare/clinical), [careplan](src/main/java/com/healthcare/careplan), [consultation](src/main/java/com/healthcare/consultation) |
| Payment/review/webhook | [payment](src/main/java/com/healthcare/payment) |
| CMS/publication | [cms](src/main/java/com/healthcare/cms) |
| AI/policy/history/credits | [ai](src/main/java/com/healthcare/ai) |
| Objects/documents/notifications | [storage](src/main/java/com/healthcare/storage), [document](src/main/java/com/healthcare/document), [notification](src/main/java/com/healthcare/notification) |
| Schema | [Flyway migrations](src/main/resources/db/migration) |
| Environment contract | [application.yml](src/main/resources/application.yml), [.env.example](../../.env.example) |

## Invariants

Slot reservation belongs to transaction-scoped PostgreSQL locks and constraints; branch/schedule checks still apply on reschedule. Clinical role checks must include ownership/linkage. Payment webhook receipt is separate from authorized review. AI service authentication and source policy cannot be bypassed through a UI toggle.

[Business workflows](../../docs/business-workflows.md), [Security](../../docs/security.md) và [Database](../../docs/database/schema-overview.md) giải thích các boundary này với source owners.

## Time và persistence

SQL TIME là wall-clock scheduling; instant/offset timestamps là hợp đồng khác. LocalTimeTypeContributor đăng ký JDBC 4.2 binding để các query/attribute không phụ thuộc JVM timezone. Không sửa hàng lịch sử hoặc bật broad Hibernate flag thay cho chẩn đoán time mapping.

Compose/staging/non-local AI hop cần shared service token. Bare local unauthenticated mode, nếu chọn, có escape-hatch riêng và không tương đương môi trường Compose/hosted. [AI README](../ai-service/README.md) sở hữu runtime/provider contract.
