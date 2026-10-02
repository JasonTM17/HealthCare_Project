# Chatbot stability fix — runbook & deploy notes

Ngày: 2026-10-02 · Branch: `fix/ai-chat-stability` (merge vào main qua PR)

Fix một chuỗi lỗi khiến chatbot AI hỏng trên production lẫn local: tin nhắn
treo vĩnh viễn ở "Đang gửi…", lỗi liên tục, và câu trả lời thật bị thay bằng
fallback chung chung sau nhiều giây chờ.

## Nguyên nhân gốc (đã xác minh bằng code + probe production)

| # | Lớp | Nguyên nhân |
|---|-----|-------------|
| R1 | frontend | Trang `/patient/chat` nuốt im lặng AbortError (deadline 33s) — không lỗi hiển thị, không retry; `finally` bị staleness-guard chặn nên máy trạng thái gửi có thể kẹt vĩnh viễn, khóa mọi lần gửi sau. Widget bị wedged khi click feedback giữa lúc đang gửi (feedback abort + bump epoch). |
| R2 | backend | `future.get()` không có timeout (JDK request-timeout chỉ chặn nhận header) — upstream đình trệ body ghim vĩnh viễn servlet thread; prod chỉ có **16** Tomcat threads → cạn pool, toàn bộ backend chết. |
| R3 | backend | Một lượt chat patient = 2 lần gọi nối tiếp, mỗi lần tới 35s (tổng ≈ 70s) trong khi BFF deadline chỉ 30s → lượt chậm nào cũng thành 502 cho user. |
| R4 | ai-service | psycopg không đặt `statement_timeout` — Supabase pooler đình trệ làm treo request vô hạn (nuôi R2/R3). |
| R5 | ai-service | `/chat/generate/stream` giả-stream: không phát byte nào trong lúc chờ LLM → gateway cắt kết nối nhàn rỗi. |
| R6 | ai-service | `_local_embedding` hash **có nhân vị trí** + không fold dấu tiếng Việt → cosine similarity gần ngẫu nhiên → grounding hầu như không tìm được nguồn → answer không citation → backend vứt answer (gate an toàn, đúng thiết kế) → fallback chung chung sau ~7s (đã tái hiện bằng probe production: `public_uncited_remote_answer`, 7.1s). |
| R7 | frontend | Chip "-1 lượt / câu hỏi" là **chuỗi cứng** trong code, không phải số liệu. |

## Thay đổi

### Frontend (`apps/frontend`)
- `app/patient/chat/page.tsx`: máy trạng thái gửi reset **vô điều kiện** trong
  `finally` (staleness chỉ được gate dữ liệu); abort ngoài ý muốn hiển thị lỗi
  retryable `CHAT_REQUEST_TIMEOUT` ("Hết thời gian chờ phản hồi…"); thêm nút
  **Dừng** khi đang gửi; chip quota render từ hằng số thật
  `AI_CHAT_CREDIT_COST_PER_QUESTION = 1` → "1 lượt / câu hỏi (hoàn lại nếu lỗi)".
- `components/FloatingHealthAssistant.tsx`: feedback no-op khi đang gửi + disable
  nút; cùng invariant reset vô điều kiện; abort ngoài ý muốn → lỗi retryable.
- `components/AssistantProvider.tsx`: thêm copy lỗi `CHAT_REQUEST_TIMEOUT`
  (retryable). Idempotency-key lifecycle **giữ nguyên** — retry sau timeout tái
  dùng cùng key, backend dedupe, không bị trừ credit hai lần.

### Backend (`apps/backend`)
- `AiService.java`: `future.get(budget + 2s)`; quá hạn → `future.cancel(true)` +
  502 "AI service is unavailable" (cùng đường xử lý như mọi upstream failure).
- Budgets mới theo-lượt (env, default): `AI_CHAT_RETRIEVE_TIMEOUT_MS=6000`,
  `AI_CHAT_GENERATE_TIMEOUT_MS=18000` — chỉ áp cho retrieve/generate/stream của
  chat patient; public `/chat`, triage, search, RAG admin giữ 35s.
- `application.yml`: đã đăng ký keys kèm contract
  browser 33s > BFF 30s ≥ 6s + 18s + ~2s.
- `render.yaml`: ai-service đặt `AI_TIMEOUT_SECONDS=18` (≤ ngân sách generate
  18s + 2s slack của backend) để provider tự timeout trước khi backend hủy
  lượt — tránh bị hủy VÀ vẫn bị tính phí.

### ai-service (`apps/ai-service`)
- `supabase_rag.py`: `options="-c statement_timeout=…"` trên connection
  (env `SUPABASE_DB_STATEMENT_TIMEOUT_MS`, default 5000, bounds 500–30000).
- `main.py`: `/chat/generate/stream` trả response ngay, phát heartbeat SSE
  `: ping` mỗi 5s trong lúc chờ generation (Spring parser đã bỏ qua dòng `:`);
  khi generation lỗi muộn phát `event: error` (content-free). Semaphore
  concurrency giờ env-configurable (`LLM_MAX_CONCURRENCY`, default 8, clamp
  1..64).
- `embeddings.py`: **local-hash-v2** — bag-of-words position-independent +
  fold dấu (NFD strip Mn + casefold), một hàm fold dùng chung query/ingest;
  giữ contract 384-dim + unit-norm.

## Deploy (KHÔNG deploy tự động — thực hiện thủ công)

Thứ tự an toàn:

1. **ai-service (Render, `healthcare-beta-ai`)** deploy trước. Lưu ý `EMBEDDING_PROVIDER=local`
   trên prod → model id đổi thành `local-hash-v2`. RAG sẽ **fail closed** (lỗi
   contract, không trả kết quả rác) cho tới khi reindex xong (bước 3) — trong
   cửa sổ đó mọi câu trả lời rơi vào fallback như hành vi hiện tại, tức
   worst-case không tệ hơn hiện trạng.
2. **Backend (Render, `healthcare-beta-backend`)**: image pinned theo digest —
   rebuild image từ branch này, cập nhật digest trong `render.yaml`
   (xem commit mẫu `1606bf8`), deploy. Budgets mới có default đúng, không bắt
   buộc thêm env trên Render; muốn tune runtime thì set
   `AI_CHAT_RETRIEVE_TIMEOUT_MS` / `AI_CHAT_GENERATE_TIMEOUT_MS`.
3. **Reindex RAG (bắt buộc, cùng buổi với bước 1)**:
   1. `delete from healthcare.ai_chat_documents;` (tombstone qua service API
      không đủ — upsert từ chối replay cùng revision). **Lưu ý:** bảng rỗng
      nghĩa là eligibility-revision guard tạm ngưng (upsert nhận mọi revision)
      — phải chạy trọn delete → sync → verify trong MỘT phiên, không để dở.
   2. Kích hoạt lại Spring projection sync để ingest lại bằng `local-hash-v2`
      (`AI_RAG_INGEST_ENABLED=true` đã bật trên backend prod).
   3. Xác minh: `select embedding_model, count(*) from healthcare.ai_chat_documents group by 1;`
      — chỉ còn `local-hash-v2`.
   4. Probe: POST `/api/v1/public/ai/chat` câu "Bệnh viện có bác sĩ nào khám
      tim mạch…" qua site → kỳ vọng `provenance` khác `local_fallback`, có
      citations (nếu vẫn fallback → gate đang hoạt động, xem lại corpus).
   5. Cảnh báo chưa xác minh được từ môi trường này: Supavisor pooler có thể
      không chuyển tiếp tham số startup `options` xuống Postgres — nếu bị strip
      thì `statement_timeout` không có tác dụng (không hại, chỉ mất tầng giới
      hạn). Kiểm tra trên staging bằng một query `select 1, pg_sleep(8);` qua
      đúng connection string và xem nó bị hủy ở ~5s hay không.
4. **Frontend (Vercel)** deploy từ branch này (sau khi merge).

## Xác minh sau deploy

- Probe health: `GET /livez` (ai), `GET /actuator/health` (backend), site `/`.
- Probe chat greeting + câu tra cứu (như trên) — đo `time_total`.
- Quan sát log backend: `AI upstream request for /chat/generate did not complete
  within…` (bound mới hoạt động), và không còn thread ghim dài hạn.
- Trang `/patient/chat`: gửi tin, bấm **Dừng** giữa chừng, gửi lại — không kẹt;
  để hết 33s (nếu upstream chậm) → thấy lỗi retryable, gửi lại OK, credit
  không bị trừ hai lần.

## Cửa sổ rollback

- Backend: trả lại digest cũ trong `render.yaml`.
- ai-service: rollback deploy; sau đó **phải reindex ngược về `local-hash`**
  nếu đã chạy bước 3 (delete + ingest lại).
- Frontend: redeploy commit trước.

## Giới hạn còn lại (không thuộc fix này)

- Giấc ngủ Render Free (cold start ~26s) vẫn tồn tại — keep-warm hai chiều đã
  giảm thiểu; budget mới đảm bảo cold-start degrade thành fallback trong cửa sổ
  BFF thay vì 502.
- Lane chunked (`AI_CHAT_CHUNKED_ENABLED`) vẫn tắt ở prod; heartbeat đã sẵn
  sàng khi bật.
- Chất lượng grounding phụ thuộc corpus Supabase đủ nội dung (đã có
  `chat-ux-proposal.md`, ingest vận hành).
