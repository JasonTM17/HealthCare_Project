# Test kho RAG trên PostgreSQL local

Trong pgAdmin, mở database `healthcare` → **Schemas** rồi Refresh:

- `public`: dữ liệu nghiệp vụ của ứng dụng.
- `healthcare` → **Tables** → `ai_chat_documents`: kho tài liệu RAG.
- `extensions`: kiểu vector của pgvector.

Kho test dùng danh mục công khai từ database local: chi nhánh, bác sĩ, chuyên khoa, dịch vụ và gói khám. Hồ sơ bệnh nhân, tài khoản, cuộc trò chuyện và nội dung tư vấn điều trị không được đưa vào chỉ mục. Bài viết/FAQ lâm sàng cần đi qua luồng duyệt và projection của Spring; đây chưa phải bản sao toàn bộ kho tri thức trên production.

Embedding `local-hash-v2` chạy offline, phù hợp kiểm thử lưu trữ, truy xuất và nguồn tham chiếu; chất lượng ngữ nghĩa khác embedding của nhà cung cấp.

Từ thư mục gốc dự án, dùng [CLI local RAG](../plans/261001-1124-deep-ui-business-audit/assets/local-rag.py):

```powershell
& ./apps/ai-service/.venv/Scripts/python.exe ./plans/261001-1124-deep-ui-business-audit/assets/local-rag.py query --query 'địa chỉ chi nhánh bệnh viện'
```

Nếu dịch vụ AI local chưa chạy, mở một terminal riêng:

```powershell
& ./apps/ai-service/.venv/Scripts/python.exe ./plans/261001-1124-deep-ui-business-audit/assets/local-rag.py serve --port 8003
```

Kiểm thử HTTP có xác thực và câu trả lời kèm nguồn:

```powershell
& ./apps/ai-service/.venv/Scripts/python.exe ./plans/261001-1124-deep-ui-business-audit/assets/local-rag-http-smoke.py
```

[CLI](../plans/261001-1124-deep-ui-business-audit/assets/local-rag.py) có chế độ `seed` để cập nhật danh mục; sau cập nhật, khởi động lại dịch vụ AI để nạp snapshot dùng khi tạo câu trả lời. Chế độ `setup` dành cho database chưa có schema RAG; không chạy lại trên database đã cấu hình.

`.env.local-rag` giữ cấu hình và thông tin xác thực local, đã được Git bỏ qua. Giữ file trên máy; không đưa vào báo cáo hay gửi kèm source. Dịch vụ AI nghe tại `127.0.0.1:8003`; đây là API nội bộ, không phải trang chatbot cho người dùng.

Để backend native dùng kho này, cấu hình **process backend local** với `AI_SERVICE_URL=http://127.0.0.1:8003` và token tương ứng trong `.env.local-rag`, rồi khởi động backend. Container/production và cấu hình frontend hiện có chưa được chuyển sang dịch vụ này. Kiểm thử toàn bộ giao diện là một checkpoint riêng.

Kết quả cài đặt và kiểm thử được ghi tại [checkpoint local RAG](../plans/261001-1124-deep-ui-business-audit/phase-04-local-rag.md) và các báo cáo liên kết trong đó.
