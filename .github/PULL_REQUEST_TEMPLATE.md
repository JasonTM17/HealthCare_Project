## Tóm tắt

<!-- Thay đổi gì và tại sao? Link issue liên quan nếu có. -->

## Phạm vi thay đổi

<!-- Đánh dấu các surface bị ảnh hưởng -->

- [ ] Frontend (`apps/frontend`)
- [ ] Backend (`apps/backend`)
- [ ] AI service (`apps/ai-service`)
- [ ] Database migrations (`apps/backend/src/main/resources/db/migration`)
- [ ] Infrastructure / Compose / Supabase
- [ ] CI/CD (`.github/workflows`)
- [ ] Docs

## Verification

<!-- Báo cáo trạng thái THẬT: PASS / FAIL / BLOCKED / NOT_RUN cho từng gate.
     "Chạy được trên máy mình" hay mock không được ghi là PASS cho luồng live. -->

- [ ] `npm run verify` (apps/frontend)
- [ ] `./mvnw -B verify` (apps/backend)
- [ ] `python -m pytest` + `ruff` + `mypy` (apps/ai-service)
- [ ] `docker compose -f infrastructure/docker-compose.yml config --quiet`
- [ ] Không có secret, `.env`, credentials hay dữ liệu thật trong diff

## Rủi ro và rollback

<!-- Migration không tương thích ngược? Feature flag? Cần thay đổi env trên môi trường deploy? -->
