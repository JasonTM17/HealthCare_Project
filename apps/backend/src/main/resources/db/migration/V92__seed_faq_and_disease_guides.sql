-- V92__seed_faq_and_disease_guides.sql
--
-- Publishes real operational content for three currently thin public surfaces:
--   1. 30 FAQs for GET /api/v1/hospital/faqs (/faq and /huong-dan pages).
--   2. 15 DISEASE_GUIDE articles for /benh-pho-bien and /benh-pho-bien/[slug].
--   3. Published CMS slots about.hero and about.body (HERO + RICH_TEXT).
--
-- Column shapes verified against: V2 (faqs/articles), V15 (article catalog
-- columns), V36 (rich content columns + CHECKs), V72 (display_order), V85
-- (slug/title CHECKs), V12/V16/V23/V24 (cms_contents + changes contract), and
-- the Faq/Article/CmsContent entities.
--
-- Public visibility contract: FaqRepository.findClinicallyEligibleActive and
-- ArticleRepository.findClinicallyEligibleDiseaseGuides only return rows whose
-- ai_content_review_heads head is APPROVED for the current revision and whose
-- latest ai_content_approval_rounds row is APPROVED, unexpired, and reviewed by
-- an ACTIVE user holding the DOCTOR role linked to an ACTIVE doctors row. V92
-- therefore seeds the full chain (revision -> head -> round -> audit events)
-- exactly like the runtime AiClinicalContentRevisionService snapshots: the FAQ
-- snapshot is jsonb_build_object('active','answer','id','question') and the
-- ARTICLE snapshot is the service's 13-field article projection. Reviewer and
-- submitter resolve to the V58/V61 demo accounts (doctor@healthcare.com linked
-- to doctors.id 30000000-...-0001, admin@healthcare.com as submitter). When a
-- user cannot be resolved the raw rows still land and the standard in-app
-- review flow can approve them later; nothing is left half-updated.
--
-- Idempotency: every INSERT is guarded - content rows by WHERE NOT EXISTS on
-- the natural key (faq question / article slug / cms slot_key), governance rows
-- by ON CONFLICT DO NOTHING on their natural PKs. Re-running against a database
-- that already holds these rows is a no-op. No V1-V91 migration is touched.

-- ---------------------------------------------------------------------------
-- 1. FAQs (30) - exploration operations, payments, insurance, results, support
-- ---------------------------------------------------------------------------

INSERT INTO faqs (
    id, question, answer, category, topic_slug, related_specialty_slug,
    topic_tags, published_at, sort_order, display_order, active
)
SELECT
    v.id::uuid,
    v.question,
    v.answer,
    v.category,
    v.topic_slug,
    v.related_specialty_slug,
    v.topic_tags::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '7 days',
    ROW_NUMBER() OVER (ORDER BY v.id),
    (SELECT COALESCE(MAX(f.display_order), -1) FROM faqs f) + ROW_NUMBER() OVER (ORDER BY v.id),
    TRUE
FROM (VALUES
    ('92000000-0000-0000-0001-000000000001',
     'Làm thế nào để đặt lịch khám tại Bệnh viện HealthCare?',
     'Bạn truy cập mục Đặt lịch trên website, chọn chuyên khoa, bác sĩ và khung giờ phù hợp, sau đó nhập số điện thoại để nhận mã xác thực OTP. Sau khi nhập đúng mã, lịch hẹn chuyển sang trạng thái đã xác nhận và bạn nhận được email kèm mã lịch hẹn. Bạn cũng có thể gọi tổng đài 1900 1234 để được nhân viên hỗ trợ đặt lịch trực tiếp.',
     'Đặt lịch khám', 'dat-lich-kham', NULL,
     '["đặt lịch", "đăng ký khám", "lịch hẹn"]'),
    ('92000000-0000-0000-0001-000000000002',
     'Mã OTP dùng để làm gì và có hiệu lực trong bao lâu?',
     'Mã OTP được gửi đến số điện thoại bạn đăng ký để xác nhận quyền sở hữu kênh liên lạc trước khi khóa lịch hẹn hoặc trả kết quả nhạy cảm. Mã có hiệu lực trong 5 phút và chỉ sử dụng được một lần. Sau ba lần nhập sai, hệ thống tạm khóa yêu cầu trong 15 phút để phòng chống tự động hóa; bạn chờ hết thời gian khóa rồi yêu cầu gửi lại mã.',
     'Đặt lịch khám', 'dat-lich-kham', NULL,
     '["OTP", "xác thực", "bảo mật"]'),
    ('92000000-0000-0000-0001-000000000003',
     'Tôi có thể đổi hoặc hủy lịch hẹn đã xác nhận không?',
     'Có. Bạn đổi hoặc hủy lịch trực tuyến trước ít nhất 2 giờ so với giờ hẹn qua mục Lịch hẹn của tôi hoặc tổng đài hỗ trợ. Việc đổi lịch giữ nguyên mã lịch hẹn và các khoản đã thanh toán; hủy lịch đúng hạn giúp bệnh viện nhường khung giờ cho người bệnh khác. Trường hợp khẩn cấp phát sinh sau mốc 2 giờ, vui lòng gọi tổng đài để được xử lý theo tình huống cụ thể.',
     'Đặt lịch khám', 'doi-huy-lich-hen', NULL,
     '["đổi lịch", "hủy lịch", "lịch hẹn"]'),
    ('92000000-0000-0000-0001-000000000004',
     'Đặt lịch khám trực tuyến có mất phí không?',
     'Việc đặt, đổi và hủy lịch trực tuyến hoàn toàn miễn phí. Bạn chỉ thanh toán viện phí khám và cận lâm sàng theo bảng giá niêm yết khi đến khám hoặc qua chuyển khoản nếu chọn thanh toán trước. Bệnh viện không thu bất kỳ khoản phụ phí nào cho việc sử dụng hệ thống đặt lịch.',
     'Thanh toán & Viện phí', 'thanh-toan-vien-phi', NULL,
     '["phí đặt lịch", "viện phí"]'),
    ('92000000-0000-0000-0001-000000000005',
     'Tôi quên mã OTP hoặc không nhận được tin nhắn thì làm thế nào?',
     'Hãy kiểm tra vùng tin nhắn quảng cáo và đảm bảo sóng điện thoại ổn định, sau đó bấm Gửi lại mã sau ít nhất 60 giây. Nếu vẫn không nhận được, bạn có thể đổi sang kênh xác thực qua email hoặc gọi tổng đài để nhân viên kiểm tra số đăng ký. Trường hợp số điện thoại đã thay đổi, mang theo giấy tờ tùy thân đến quầy lễ tân để cập nhật thông tin trước khi đặt lịch.',
     'Hỗ trợ kỹ thuật', 'ho-tro-ky-thuat', NULL,
     '["OTP", "không nhận được mã"]'),
    ('92000000-0000-0000-0001-000000000006',
     'Làm sao để tra cứu lịch hẹn đã đặt khi không có tài khoản?',
     'Bạn vào trang Tra cứu lịch hẹn, nhập mã lịch hẹn nhận qua email cùng số điện thoại đã đăng ký để xem trạng thái, giờ gặp bác sĩ và cơ sở khám. Trang tra cứu hiển thị cả ghi chú chuẩn bị trước khám nếu có. Đây là kênh tra cứu công khai nên chỉ trả về thông tin lịch hẹn, không hiển thị kết quả cận lâm sàng chi tiết.',
     'Đặt lịch khám', 'tra-cuu-lich-hen', NULL,
     '["tra cứu", "mã lịch hẹn"]'),
    ('92000000-0000-0000-0001-000000000007',
     'Thanh toán viện phí bằng chuyển khoản hoạt động như thế nào?',
     'Sau khi đặt lịch, hệ thống tạo lệnh thanh toán với nội dung chuyển khoản dạng HEALTHCARE_(mã lịch hẹn) và thông tin tài khoản bệnh viện hiển thị ngay trên trang. Khi tiền về tài khoản, hệ thống đối chiếu nội dung và tự động cập nhật lịch hẹn sang trạng thái đã thanh toán trong vòng vài phút. Bạn cần chuyển đúng nội dung để giao dịch được khớp tự động; chuyển sai nội dung sẽ phải xử lý thủ công và chậm hơn.',
     'Thanh toán & Viện phí', 'chuyen-khoan', NULL,
     '["chuyển khoản", "thanh toán", "nội dung chuyển khoản"]'),
    ('92000000-0000-0000-0001-000000000008',
     'Tôi đã chuyển khoản nhưng lịch hẹn chưa chuyển sang đã thanh toán, cần làm gì?',
     'Trước hết kiểm tra lại nội dung chuyển khoản có đúng dạng HEALTHCARE_(mã lịch hẹn) hay không và đợi thêm 15 phút vì cổng đối soát xử lý theo lô. Nếu sau 15 phút trạng thái chưa cập nhật, bạn chụp ảnh biên lai chuyển khoản và gửi qua tổng đài hoặc email hỗ trợ kèm mã lịch hẹn. Bộ phận tài chính sẽ đối soát với ngân hàng và cập nhật thủ công trong ngày làm việc.',
     'Thanh toán & Viện phí', 'chuyen-khoan', NULL,
     '["chưa cập nhật thanh toán", "đối soát"]'),
    ('92000000-0000-0000-0001-000000000009',
     'Bệnh viện có thanh toán bảo hiểm y tế được không?',
     'Có. Bệnh viện tiếp nhận bảo hiểm y tế đúng tuyến và trái tuyến theo quy định hiện hành của Bảo hiểm xã hội; mức hưởng phụ thuộc tuyến kỹ thuật của cơ sở khám và tính chất đúng hay trái tuyến. Khi đi khám, bạn mang thẻ BHYT còn hiệu lực cùng giấy tờ tùy thân; lễ tân sẽ kiểm tra và thông báo mức chi trả trước khi thực hiện dịch vụ. Các dịch vụ không nằm trong phạm vi bảo hiểm như khám theo yêu cầu vẫn được thanh toán song song.',
     'Bảo hiểm y tế', 'bao-hiem-y-te', NULL,
     '["BHYT", "đúng tuyến", "trái tuyến"]'),
    ('92000000-0000-0000-0001-000000000010',
     'Bệnh viện có bảo lãnh trực tiếp với bảo hiểm thương mại không?',
     'Bệnh viện đang hợp tác bảo lãnh trực tiếp với nhiều công ty bảo hiểm nhân thọ và bảo hiểm sức khỏe. Bạn liên hệ tổng đài trước ngày khám để kiểm tra danh sách công ty đối tác và giấy bảo lãnh còn hiệu lực. Khi đủ điều kiện bảo lãnh, bạn không cần ứng trước toàn bộ viện phí mà chỉ thanh toán phần tự trả theo hợp đồng; thời gian phê duyệt bảo lãnh thông thường từ 30 phút đến vài giờ tùy công ty.',
     'Bảo hiểm y tế', 'bao-lanh-bao-hiem', NULL,
     '["bảo hiểm thương mại", "bảo lãnh", "viện phí"]'),
    ('92000000-0000-0000-0001-000000000011',
     'Giấy xác nhận nghỉ ốm (giấy khám sickness) được cấp như thế nào?',
     'Giấy xác nhận tình trạng sức khỏe phục vụ nghỉ ốm được bác sĩ điều trị ký sau buổi khám, ghi rõ chẩn đoán và thời lượng nghỉ được khuyến nghị theo quy định. Bạn yêu cầu giấy này ngay tại phòng khám hoặc nhận qua hồ sơ điện tử và in tại quầy. Bệnh viện không cấp hồi tố cho ngày đã qua khi bạn không đến khám, vì việc cấp phải dựa trên thăm khám thực tế.',
     'Kết quả & Hồ sơ y tế', 'giay-xac-nhan', NULL,
     '["nghỉ ốm", "giấy khám bệnh", "sick leave"]'),
    ('92000000-0000-0000-0001-000000000012',
     'Sau bao lâu thì có kết quả xét nghiệm?',
     'Tùy loại xét nghiệm: các xét nghiệm huyết học và sinh hóa cơ bản có kết quả trong 2 đến 4 giờ; xét nghiệm hình ảnh như X-quang, siêu âm trả kết quả ngay trong ngày; các bản cấy vi sinh, giải trình tự gen hoặc mô bệnh học cần 2 đến 7 ngày làm việc. Thời gian hẹn trả kết quả được ghi trên phiếu chỉ định. Khi kết quả sẵn sàng, hệ thống gửi thông báo và bác sĩ sẽ giải nghĩa kết quả trong buổi hẹn trả hoặc trực tuyến.',
     'Kết quả & Hồ sơ y tế', 'ket-qua-xet-nghiem', NULL,
     '["kết quả xét nghiệm", "thời gian trả kết quả"]'),
    ('92000000-0000-0000-0001-000000000013',
     'Tôi có thể xem kết quả xét nghiệm trực tuyến không?',
     'Có. Kết quả được đăng tải trên hồ sơ điện tử cá nhân sau khi bác sĩ đã duyệt, và bạn nhận thông báo qua email hoặc tin nhắn khi có kết quả mới. Với các xét nghiệm nhạy cảm, hệ thống yêu cầu xác thực OTP trước khi hiển thị để bảo vệ thông tin. Kết quả trực tuyến có giá trị tham khảo; bản in có chữ ký và dấu của bệnh viện được cấp tại quầy hồ sơ khi bạn cần.',
     'Kết quả & Hồ sơ y tế', 'ho-so-dien-tu', NULL,
     '["xem kết quả online", "hồ sơ điện tử"]'),
    ('92000000-0000-0000-0001-000000000014',
     'Hồ sơ bệnh án điện tử gồm những thông tin gì và được bảo mật ra sao?',
     'Hồ sơ điện tử tổng hợp thông tin hành chính, chẩn đoán, đơn thuốc, kết quả cận lâm sàng và kế hoạch chăm sóc của bạn theo từng lần khám. Quyền truy cập được phân vai theo nguyên tắc tối thiểu: chỉ bác sĩ điều trị và nhân viên được phân công mới xem được hồ sơ, mọi lượt truy cập đều được ghi nhật ký kiểm toán. Bạn có quyền yêu cầu xuất bản sao hồ sơ của mình và thông báo ngay cho bệnh viện nếu phát hiện truy cập bất thường.',
     'Kết quả & Hồ sơ y tế', 'ho-so-dien-tu', NULL,
     '["bệnh án điện tử", "bảo mật dữ liệu"]'),
    ('92000000-0000-0000-0001-000000000015',
     'Trợ lý AI của bệnh viện hỗ trợ được những gì và giới hạn ở đâu?',
     'Trợ lý AI giúp bạn mô tả triệu chứng, gợi ý chuyên khoa phù hợp và giải thích cách chuẩn bị trước khám dựa trên kiến thức y khoa đã được thẩm định. Trợ lý không chẩn đoán bệnh, không kê đơn và không thay thế thăm khám của bác sĩ; mọi khuyến cáo điều trị đều phải đến từ bác sĩ sau khi xem xét trực tiếp. Khi bạn mô tả dấu hiệu nguy hiểm, trợ lý sẽ khuyến nghị liên hệ cấp cứu 115 thay vì chờ đặt lịch.',
     'Hỗ trợ kỹ thuật', 'tro-ly-ai', NULL,
     '["trợ lý AI", "gợi ý chuyên khoa", "triage"]'),
    ('92000000-0000-0000-0001-000000000016',
     'Giờ làm việc và khung giờ khám bệnh của bệnh viện là như thế nào?',
     'Khám ngoại trú làm việc từ 6h30 đến 20h00 tất cả các ngày trong tuần, kể cả ngày lễ, với khung giờ hẹn cách nhau 30 phút để hạn chế thời gian chờ. Các phòng cận lâm sàng như xét nghiệm và chẩn đoán hình ảnh mở song song với giờ khám. Giờ làm việc chi tiết từng cơ sở được cập nhật tại trang Cơ sở y tế và có thể điều chỉnh dịp lễ, bạn nên kiểm tra trước khi di chuyển.',
     'Giờ hoạt động & Cấp cứu', 'gio-lam-viec', NULL,
     '["giờ khám", "giờ làm việc"]'),
    ('92000000-0000-0000-0001-000000000017',
     'Bệnh viện có cấp cứu 24/7 không và khi nào nên gọi cấp cứu?',
     'Khoa Cấp cứu - Hồi sức hoạt động liên tục 24 giờ mọi ngày trong tuần với đội ngũ trực sẵn và xe cấp cứu của bệnh viện. Với các dấu hiệu nguy hiểm như đau ngực dữ dội, khó thở nặng, yếu liệt nửa người, co giật, chảy máu không cầm hoặc chấn thương nặng, hãy gọi 115 hoặc số cấp cứu của bệnh viện ngay thay vì đặt lịch khám thường. Đội cấp cứu sẽ hướng dẫn sơ cứu ban đầu trong khi xe đang đến.',
     'Giờ hoạt động & Cấp cứu', 'cap-cuu', 'tim-mach',
     '["cấp cứu", "115", "khẩn cấp"]'),
    ('92000000-0000-0000-0001-000000000018',
     'Tôi có thể đặt lịch khám cho bố mẹ hoặc người thân được không?',
     'Có. Khi đặt lịch, bạn nhập thông tin người bệnh bao gồm họ tên, ngày sinh và số điện thoại của người đi khám; mã xác nhận gửi về số điện thoại đó để người bệnh tự xác thực. Nếu người thân không dùng điện thoại, bạn có thể liên hệ tổng đài để được hỗ trợ đăng ký hộ theo quy trình. Người đi khám vẫn cần mang giấy tờ tùy thân của chính mình khi đến khám.',
     'Đặt lịch khám', 'dat-lich-ho-nguoi-than', NULL,
     '["đặt lịch cho người thân", "người nhà"]'),
    ('92000000-0000-0000-0001-000000000019',
     'Trẻ em đi khám cần chuẩn bị giấy tờ và người đi cùng như thế nào?',
     'Bạn mang theo giấy khai sinh hoặc thẻ BHYT của trẻ, sổ khám bệnh nếu có, và giấy tờ tùy thân của người giám hộ đi cùng. Với trẻ dưới 6 tuổi, nên có ít nhất một người thân hỗ trợ chăm sóc trong suốt quá trình khám. Khoa Nhi có khu vui chơi riêng và khung giờ khám ưu tiên cho trẻ nhỏ; hãy khai báo trung thực tiền sử dị ứng và các thuốc trẻ đang dùng để bác sĩ đánh giá an toàn.',
     'Đặt lịch khám', 'kham-nhi-khoa', 'nhi-khoa',
     '["khám trẻ em", "nhi khoa", "giấy tờ"]'),
    ('92000000-0000-0000-0001-000000000020',
     'Nếu đến trễ so với giờ hẹn thì lịch khám xử lý như thế nào?',
     'Bạn đến muộn dưới 15 phút vẫn được khám trong khung hẹn nếu phòng khám còn trống, hoặc được xếp vào thứ tự ưu tiên tiếp theo. Trễ hơn 15 phút, hệ thống chuyển lịch sang trạng thái chờ bổ sung để không làm trễ lịch của người bệnh khác; lễ tân sẽ sắp xếp khung giờ gần nhất còn trống cùng ngày. Nếu không thể khám được trong ngày, bạn có thể đổi lịch trực tuyến mà không mất phí.',
     'Đặt lịch khám', 'doi-huy-lich-hen', NULL,
     '["đến trễ", "khung giờ hẹn"]'),
    ('92000000-0000-0000-0001-000000000021',
     'Khi hủy lịch đã thanh toán, viện phí được hoàn như thế nào?',
     'Với lịch hẹn hủy trước ít nhất 2 giờ, số tiền đã thanh toán được hoàn về tài khoản nguồn trong vòng 3 đến 5 ngày làm việc theo quy định tài chính của bệnh viện. Bạn không cần làm thủ tục nào thêm; hệ thống tự khởi tạo lệnh hoàn sau khi hủy thành công và gửi thông báo qua email. Trường hợp hoàn chuyển khoản giữa các ngân hàng, thời gian phụ thuộc ngân hàng thụ hưởng và có thể lâu hơn một chút.',
     'Thanh toán & Viện phí', 'hoan-vien-phi', NULL,
     '["hoàn tiền", "hủy lịch đã thanh toán"]'),
    ('92000000-0000-0000-0001-000000000022',
     'Sau khi khám, tôi có được mua thuốc ngoài nhà thuốc của bệnh viện không?',
     'Được. Đơn thuốc điện tử do bác sĩ ký có giá trị tại nhà thuốc bệnh viện và các nhà thuốc đạt chuẩn bên ngoài; bạn nhận mã đơn cùng hướng dẫn dùng thuốc trên hồ sơ điện tử. Dù mua ở đâu, hãy tuân thủ đúng liều lượng và thời gian bác sĩ chỉ định, không tự ý tăng giảm liều hoặc dừng thuốc sớm. Nếu có tác dụng phụ bất thường, liên hệ bác sĩ điều trị trước khi thay đổi phác đồ.',
     'Kết quả & Hồ sơ y tế', 'don-thuoc', NULL,
     '["đơn thuốc", "mua thuốc ngoài"]'),
    ('92000000-0000-0000-0001-000000000023',
     'Tái khám theo hẹn của bác sĩ có cần đặt lịch lại từ đầu không?',
     'Nên đặt lại lịch tái khám để được ưu tiên đúng bác sĩ điều trị và khung giờ phù hợp với kế hoạch theo dõi. Bạn đặt tái khám trực tuyến bằng mã lịch hẹn cũ, hệ thống sẽ tự động ghép nối hồ sơ và kết quả cũ cho buổi khám. Với các bệnh mạn tính cần theo dõi lâu dài, bác sĩ có thể hẹn sẵn chu kỳ tái khám và hệ thống gửi nhắc lịch trước ngày hẹn.',
     'Đặt lịch khám', 'tai-kham', NULL,
     '["tái khám", "nhắc lịch"]'),
    ('92000000-0000-0000-0001-000000000024',
     'Khám và tư vấn từ xa hoạt động ra sao và áp dụng cho trường hợp nào?',
     'Khám từ xa phù hợp với tái khám đánh giá diễn tiến, giải thích kết quả cận lâm sàng và tư vấn dùng thuốc cho bệnh mạn tính đã ổn định. Sau khi bác sĩ xác nhận phù hợp, hệ thống gửi liên kết phòng khám trực tuyến và ghi chép tư vấn vào hồ sơ điện tử như một lần khám thông thường. Các trường hợp cần thăm khám thể chất, thủ thuật hoặc cấp cứu sẽ được bác sĩ hẹn đến cơ sở thay vì khám từ xa.',
     'Đặt lịch khám', 'kham-tu-xa', NULL,
     '["telemedicine", "tư vấn trực tuyến"]'),
    ('92000000-0000-0000-0001-000000000025',
     'Trước khi đi khám định kỳ tôi cần chuẩn bị những gì?',
     'Bạn nên mang giấy tờ tùy thân, thẻ bảo hiểm nếu có, danh mục thuốc đang dùng và các kết quả khám cũ để bác sĩ so sánh diễn tiến. Với xét nghiệm đường huyết và mỡ máu, nhịn ăn tối thiểu 8 giờ và uống nước lọc như thường lệ. Nam giới chuẩn bị khám tuyến tiền liệt hoặc phụ nữ khám phụ khoa nên ghi chú chu kỳ và triệu chứng gần nhất để khai thác chính xác hơn.',
     'Đặt lịch khám', 'chuan-bi-truoc-kham', NULL,
     '["chuẩn bị khám", "nhịn ăn xét nghiệm"]'),
    ('92000000-0000-0000-0001-000000000026',
     'Hóa đơn điện tử và chứng từ thanh toán được cấp ở đâu?',
     'Sau khi thanh toán thành công, hệ thống phát hành hóa đơn điện tử và gửi đến email bạn đã đăng ký; bản cứng có thể in tại quầy thu ngân khi cần. Chứng từ thanh toán cũng hiển thị trong mục Lịch hẹn của tôi để bạn tải lại bất cứ lúc nào. Nếu email chưa nhận được hóa đơn sau 24 giờ, kiểm tra thư mục spam hoặc liên hệ tổng đài kèm mã lịch hẹn để được cấp phát lại.',
     'Thanh toán & Viện phí', 'hoa-don-dien-tu', NULL,
     '["hóa đơn điện tử", "chứng từ"]'),
    ('92000000-0000-0000-0001-000000000027',
     'Khi cần khiếu nại hoặc góp ý về dịch vụ, tôi liên hệ qua kênh nào?',
     'Bạn gửi phản hồi qua mục Liên hệ trên website, gọi tổng đài hoặc điền phiếu đánh giá trải nghiệm sau buổi khám; mỗi phản hồi đều được cấp một mã theo dõi. Bộ phận chăm sóc khách hàng tiếp nhận, phối hợp chuyên môn liên quan và trả lời bằng văn bản trong 2 ngày làm việc đối với các khiếu nại thông thường. Các trường hợp ảnh hưởng an toàn người bệnh được ưu tiên xử lý ngay trong ngày.',
     'Hỗ trợ kỹ thuật', 'phan-hoi-khieu-nai', NULL,
     '["khiếu nại", "góp ý", "chăm sóc khách hàng"]'),
    ('92000000-0000-0000-0001-000000000028',
     'Bệnh viện có tổ chức khám sức khỏe theo đoàn thể và doanh nghiệp không?',
     'Có. Bệnh viện triển khai gói khám sức khỏe doanh nghiệp với danh mục được thiết kế theo yêu cầu ngành nghề và quy mô, thực hiện tại bệnh viện hoặc tại doanh nghiệp khi đủ điều kiện kỹ thuật. Đơn vị liên hệ bộ phận khám sức khỏe doanh nghiệp để nhận báo giá, danh mục cận lâm sàng và lịch trình dự kiến. Kết quả khám được tổng hợp thành báo cáo sức khỏe tập thể kèm khuyến cáo phòng bệnh.',
     'Đặt lịch khám', 'kham-doanh-nghiep', NULL,
     '["khám sức khỏe doanh nghiệp", "gói khám"]'),
    ('92000000-0000-0000-0001-000000000029',
     'Thông tin cá nhân và sức khỏe của tôi có bị chia sẻ ra ngoài không?',
     'Thông tin của bạn được xử lý theo chính sách bảo mật và quy định pháp luật về bảo vệ dữ liệu cá nhân, chỉ phục vụ mục đích chăm sóc và thanh toán y tế. Bệnh viện không bán hay chia sẻ dữ liệu cho mục đích thương mại; việc cung cấp cho đối tác bảo hiểm chỉ diễn ra khi bạn trực tiếp yêu cầu bảo lãnh hoặc hoàn thiện hồ sơ chi trả. Bạn có quyền yêu cầu xem, chỉnh sửa hoặc giới hạn phạm vi dữ liệu thông qua bộ phận hồ sơ.',
     'Kết quả & Hồ sơ y tế', 'bao-mat-du-lieu', NULL,
     '["quyền riêng tư", "bảo mật", "dữ liệu cá nhân"]'),
    ('92000000-0000-0000-0001-000000000030',
     'Tôi muốn thay đổi số điện thoại nhận thông báo trên lịch hẹn đã đặt thì làm thế nào?',
     'Bạn có thể cập nhật số điện thoại trong mục thông tin cá nhân sau khi đăng nhập; các lịch hẹn trong tương lai sẽ tự động dùng số mới cho thông báo và OTP. Riêng lịch hẹn đã xác nhận cần đồng bộ số mới, bạn liên hệ tổng đài kèm mã lịch hẹn để nhân viên cập nhật và xác thực lại quyền sở hữu. Việc đổi số qua kênh trực tuyến yêu cầu xác thực OTP của số hiện tại để chống mạo danh.',
     'Hỗ trợ kỹ thuật', 'ho-tro-ky-thuat', NULL,
     '["đổi số điện thoại", "thông báo lịch hẹn"]')
) AS v(id, question, answer, category, topic_slug, related_specialty_slug, topic_tags)
WHERE NOT EXISTS (SELECT 1 FROM faqs f WHERE f.question = v.question);

-- ---------------------------------------------------------------------------
-- 2. FAQ clinical-eligibility chain (revision -> head -> round -> audit events)
--    Snapshot and hash mirror AiClinicalContentRevisionService.faqSnapshot.
-- ---------------------------------------------------------------------------

DO $v92_faq_chain$
DECLARE
    v_submitter UUID;
    v_reviewer UUID;
    v_submitted_at TIMESTAMPTZ := CURRENT_TIMESTAMP - INTERVAL '3 days';
    v_decided_at TIMESTAMPTZ := CURRENT_TIMESTAMP - INTERVAL '2 days';
    v_expires_at TIMESTAMPTZ := CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '180 days';
BEGIN
    SELECT u.id INTO v_submitter
    FROM users u
    WHERE u.email = 'admin@healthcare.com' AND u.status = 'ACTIVE'
    LIMIT 1;

    SELECT u.id INTO v_reviewer
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id AND r.code = 'DOCTOR'
    JOIN doctors d ON d.user_id = u.id AND d.active = TRUE
    WHERE u.email = 'doctor@healthcare.com' AND u.status = 'ACTIVE'
    LIMIT 1;

    INSERT INTO ai_content_revisions (
        source_type, source_id, content_revision, content_hash,
        content_snapshot, created_by, created_at
    )
    SELECT
        'FAQ',
        f.id,
        1,
        encode(digest(convert_to(jsonb_build_object(
            'active', f.active, 'answer', f.answer,
            'id', f.id::text, 'question', f.question
        )::text, 'UTF8'), 'sha256'), 'hex'),
        jsonb_build_object(
            'active', f.active, 'answer', f.answer,
            'id', f.id::text, 'question', f.question
        ),
        NULL,
        v_submitted_at - INTERVAL '1 hour'
    FROM faqs f
    WHERE f.id >= '92000000-0000-0000-0001-000000000001'::uuid
      AND f.id <= '92000000-0000-0000-0001-000000000030'::uuid
    ON CONFLICT (source_type, source_id, content_revision) DO NOTHING;

    INSERT INTO ai_content_review_heads (
        source_type, source_id, content_revision, content_hash,
        eligibility_revision, eligibility_state, current_approval_round,
        edited_by, submitted_at, approved_at, approval_expires_at
    )
    SELECT
        'FAQ', r.source_id, r.content_revision, r.content_hash,
        1, 'APPROVED', 1,
        NULL, v_submitted_at, v_decided_at, v_expires_at
    FROM ai_content_revisions r
    WHERE r.source_type = 'FAQ'
      AND r.source_id >= '92000000-0000-0000-0001-000000000001'::uuid
      AND r.source_id <= '92000000-0000-0000-0001-000000000030'::uuid
      AND r.content_revision = 1
    ON CONFLICT (source_type, source_id) DO NOTHING;

    IF v_submitter IS NOT NULL AND v_reviewer IS NOT NULL AND v_submitter <> v_reviewer THEN
        INSERT INTO ai_content_approval_rounds (
            source_type, source_id, content_revision, content_hash,
            approval_round, state, submitted_by, reviewed_by, reviewer_role,
            submitted_at, decided_at, expires_at, reason
        )
        SELECT
            'FAQ', r.source_id, r.content_revision, r.content_hash,
            1, 'APPROVED', v_submitter, v_reviewer, 'DOCTOR',
            v_submitted_at, v_decided_at, v_expires_at,
            'Bác sĩ chuyên khoa thẩm định nội dung hướng dẫn khám bệnh của V92'
        FROM ai_content_revisions r
        WHERE r.source_type = 'FAQ'
          AND r.source_id >= '92000000-0000-0000-0001-000000000001'::uuid
          AND r.source_id <= '92000000-0000-0000-0001-000000000030'::uuid
          AND r.content_revision = 1
        ON CONFLICT (source_type, source_id, content_revision, approval_round) DO NOTHING;

        INSERT INTO ai_content_review_events (
            event_id, source_type, source_id, content_revision, content_hash,
            eligibility_revision, approval_round, event_type, actor_id,
            actor_role, correlation_id, reason, metadata, occurred_at
        )
        SELECT
            md5('v92-faq-submitted-' || r.source_id::text)::uuid,
            'FAQ', r.source_id, r.content_revision, r.content_hash,
            1, NULL, 'SUBMITTED', v_submitter, 'ADMIN',
            md5('v92-faq-corr-sub-' || r.source_id::text)::uuid,
            NULL, '{"source": "V92 migration seed"}'::jsonb, v_submitted_at
        FROM ai_content_revisions r
        WHERE r.source_type = 'FAQ'
          AND r.source_id >= '92000000-0000-0000-0001-000000000001'::uuid
          AND r.source_id <= '92000000-0000-0000-0001-000000000030'::uuid
          AND r.content_revision = 1
        ON CONFLICT (event_id) DO NOTHING;

        INSERT INTO ai_content_review_events (
            event_id, source_type, source_id, content_revision, content_hash,
            eligibility_revision, approval_round, event_type, actor_id,
            actor_role, correlation_id, reason, metadata, occurred_at
        )
        SELECT
            md5('v92-faq-approved-' || r.source_id::text)::uuid,
            'FAQ', r.source_id, r.content_revision, r.content_hash,
            1, 1, 'APPROVED', v_reviewer, 'DOCTOR',
            md5('v92-faq-corr-app-' || r.source_id::text)::uuid,
            'Bác sĩ chuyên khoa thẩm định nội dung hướng dẫn khám bệnh của V92',
            '{"source": "V92 migration seed"}'::jsonb, v_decided_at
        FROM ai_content_revisions r
        JOIN ai_content_approval_rounds ar
          ON ar.source_type = r.source_type
         AND ar.source_id = r.source_id
         AND ar.content_revision = r.content_revision
         AND ar.approval_round = 1
        WHERE r.source_type = 'FAQ'
          AND r.source_id >= '92000000-0000-0000-0001-000000000001'::uuid
          AND r.source_id <= '92000000-0000-0000-0001-000000000030'::uuid
          AND r.content_revision = 1
        ON CONFLICT (event_id) DO NOTHING;
    END IF;
END
$v92_faq_chain$;

-- ---------------------------------------------------------------------------
-- 3. DISEASE_GUIDE articles (15) for /benh-pho-bien
--    Body is markdown ("## " sections) consumed by RichContentRenderer; the
--    "sections" jsonb is derived from the same body by splitting on "\n## "
--    so the hub detail page renders heading + section bodies and a TOC.
-- ---------------------------------------------------------------------------

INSERT INTO articles (
    id, title, slug, summary, body, published_at, active,
    category, author_name, reading_minutes, related_specialty_slug,
    cover_image_url, content_language, content_kind, audience,
    sections, tags, topic_tags, key_takeaways, warning_signs,
    prevention_tips, when_to_seek_care, source_references,
    clinical_metadata, clinical_disclaimer
)
SELECT
    v.id::uuid,
    v.title,
    v.slug,
    v.summary,
    v.body,
    CURRENT_TIMESTAMP - make_interval(days => v.days_ago),
    TRUE,
    v.category,
    v.author_name,
    v.reading_minutes,
    v.related_specialty_slug,
    v.cover_image_url,
    'vi',
    'DISEASE_GUIDE',
    'PATIENT',
    COALESCE(s.sections, '[]'::jsonb),
    v.tags::jsonb,
    v.topic_tags::jsonb,
    v.takeaways::jsonb,
    v.warnings::jsonb,
    v.prevention::jsonb,
    v.when_to_seek_care,
    v.sources::jsonb,
    '{}'::jsonb,
    v.disclaimer
FROM (VALUES
    (
        '92000000-0000-0000-0002-000000000001',
        'Tăng huyết áp: hiểu đúng con số huyết áp và cách kiểm soát lâu dài',
        'tang-huyet-ap-huong-dan-kiem-soat',
        'Tăng huyết áp tiến triển âm thầm trong nhiều năm trước khi gây biến chứng tim mạch, não và thận. Bài viết giải thích ngưỡng huyết áp cần lưu ý, các yếu tố nguy cơ và lộ trình kiểm soát bền vững tại nhà.',
        $body$Tăng huyết áp là tình trạng áp lực máu lên thành động mạch duy trì ở mức cao hơn ngưỡng sinh lý, thường được xác định khi huyết áp tâm thu từ 140 mmHg trở lên hoặc tâm trương từ 90 mmHg trở lên qua nhiều lần đo tại các thời điểm khác nhau. Bệnh được gọi là kẻ giết người thầm lặng vì phần lớn người bệnh không có triệu chứng rõ ràng cho đến khi xuất hiện biến chứng tim, não, thận hoặc mắt.

## Dấu hiệu và biến chứng thường gặp

Phần lớn người tăng huyết áp hoàn toàn không cảm nhận được gì, vì vậy đo huyết áp định kỳ mới là cách phát hiện tin cậy nhất. Khi huyết áp tăng cao đột ngột hoặc đã có tổn thương cơ quan đích, bạn có thể gặp:
- Đau đầu vùng sau gáy, đặc biệt vào buổi sáng sau khi thức dậy.
- Chóng mặt, ù tai, hoa mắt khi đổi tư thế hoặc gắng sức.
- Mệt mỏi, hồi hộp đánh trống ngực, dễ khó chịu khi vận động.
- Chảy máu cam tái diễn, nhìn mờ tạm thời.

Biến chứng nặng nhất của tăng huyết áp gồm đột quỵ nhồi máu hoặc xuất huyết não, nhồi máu cơ tim, suy tim, suy thận mạn và tổn thương võng mạc gây suy giảm thị lực. Mức độ nguy cơ tăng theo thời gian huyết áp không được kiểm soát và các bệnh đồng mắc như đái tháo đường, rối loạn lipid máu.

## Nguyên nhân và yếu tố nguy cơ

Khoảng 90 đến 95 phần trăm trường hợp là tăng huyết áp nguyên phát, hình thành dần qua nhiều năm dưới tác động của lối sống và yếu tố di truyền. Các yếu tố nguy cơ có thể thay đổi bao gồm:
- Ăn mặn kéo dài, khẩu vị nhiều thực phẩm chế biến sẵn và nước chấm đậm.
- Ít vận động, thừa cân béo phì, vòng bụng tăng so với khuyến cáo.
- Hút thuốc lá, uống rượu bia thường xuyên.
- Căng thẳng kéo dài, thiếu ngủ, làm việc gắng sức về đêm.

Yếu tố không thể thay đổi gồm tuổi tác, tiền sử gia đình và giới tính. Người có cha hoặc mẹ mắc tăng huyết áp sớm nên bắt đầu theo dõi huyết áp từ sau tuổi 35 thay vì chờ đến khi có triệu chứng.

## Điều trị và kiểm soát bền vững

Nguyên tắc điều trị là kết hợp thay đổi lối sống với thuốc hạ áp theo toa, hướng mục tiêu đưa huyết áp về dưới 140/90 mmHg hoặc thấp hơn tùy nguy cơ tim mạch mà bác sĩ đánh giá. Người bệnh cần:
- Uống thuốc đều đặn mỗi ngày kể cả khi huyết áp đã bình thường, không tự ý ngừng thuốc vì cảm giác khỏe mạnh.
- Giảm muối ăn xuống dưới 5 gam mỗi ngày, tăng rau xanh, trái cây và ngũ cốc nguyên hạt.
- Duy trì vận động aerobic vừa sức ít nhất 150 phút mỗi tuần như đi bộ nhanh, đạp xe, bơi lội.
- Đo huyết áp tại nhà cùng giờ mỗi sáng và tối, ghi sổ theo dõi để mang đi tái khám.
- Bỏ thuốc lá, hạn chế rượu bia và duy trì cân nặng hợp lý.

Tăng huyết áp là bệnh mạn tính cần quản trị suốt đời, nhưng khi được kiểm soát tốt, người bệnh vẫn sinh hoạt, làm việc và tuổi thọ gần như bình thường. Nội dung này chỉ mang tính giáo dục sức khỏe, không thay thế thăm khám và chỉ định điều trị của bác sĩ.$body$,
        12,
        'CARDIOLOGY',
        'BS.CKII Nguyễn Trọng Khánh',
        7,
        'tim-mach',
        '/media/articles/dinh-duong-tang-huyet-ap.jpg',
        '["tăng huyết áp", "huyết áp", "tim mạch", "dinh dưỡng giảm muối"]',
        '["tăng huyết áp", "tim mạch"]',
        '["Đo huyết áp định kỳ, kể cả khi không có triệu chứng", "Uống thuốc hạ áp đều đặn, không tự ý ngừng khi huyết áp ổn", "Giảm muối dưới 5 gam/ngày và vận động 150 phút/tuần"]',
        '["Đau đầu dữ dội kèm nôn, nhìn mờ hoặc yếu liệt chi", "Đau ngực tức, khó thở khi gắng sức", "Nói líu lưỡi, méo miệng, mất thăng bằng đột ngột"]',
        '["Giảm muối và thực phẩm chế biến sẵn", "Duy trì cân nặng và vòng bụng ở mức hợp lý", "Ngủ đủ giấc, quản lý căng thẳng và bỏ thuốc lá"]',
        'Khi huyết áp đo tại nhà trên 180/110 mmHg, hoặc xuất hiện đau ngực, khó thở, yếu liệt, nói khó, cần được đánh giá y khoa ngay trong ngày, không chờ tái khám.',
        '["Hướng dẫn chẩn đoán và điều trị tăng huyết áp - Hội Tim mạch Việt Nam", "WHO Guideline for the pharmacological treatment of hypertension in adults"]',
        'Nội dung chỉ nhằm giáo dục sức khỏe, không thay thế chẩn đoán, chỉ định điều trị hoặc tư vấn trực tiếp của bác sĩ.'
    ),
    (
        '92000000-0000-0000-0002-000000000002',
        'Đái tháo đường type 2: nhận biết sớm và sống khỏe cùng bệnh mạn tính',
        'dai-thao-duong-type-2-nhan-biet-va-song-khoe',
        'Đái tháo đường type 2 thường âm thầm nhiều năm trước khi gây biến chứng mắt, thận, thần kinh và tim mạch. Bài viết trình bày dấu hiệu cảnh báo, tiêu chuẩn chẩn đoán và chiến lược kiểm soát đường huyết lâu dài.',
        $body$Đái tháo đường type 2 là rối loạn chuyển hóa đặc trưng bởi tăng đường huyết mạn tính do cơ thể kháng insulin và tuyến tụy không bù đắp đủ. Bệnh chiếm hơn 90 phần trăm tổng số người mắc đái tháo đường, thường xuất hiện sau tuổi 40 nhưng đang trẻ hóa nhanh nhờ lối sống ít vận động và chế độ ăn nhiều tinh bột tinh chế.

## Dấu hiệu và triệu chứng thường gặp

Nhiều người phát hiện bệnh tình cờ khi xét nghiệm máu định kỳ, vì giai đoạn đầu đường huyết chỉ tăng nhẹ chưa gây triệu chứng. Khi đường huyết tăng rõ, các biểu hiện điển hình bao gồm:
- Khát nước nhiều, uống nhiều nhưng vẫn khát, tiểu nhiều và tiểu đêm.
- Sụt cân không chủ ý dù ăn uống bình thường hoặc ăn nhiều hơn.
- Mệt mỏi kéo dài, giảm khả năng tập trung, buồn ngủ sau bữa ăn nhiều tinh bột.
- Vết xước, vết loét lâu lành, nhiễm trùng da hoặc nấm tái đi tái lại.
- Tê bì hoặc kiến bò đầu chi do tổn thương thần kinh ngoại vi.

Bốn biến chứng lớn cần tầm soát định kỳ gồm bệnh võng mạc gây mờ mắt, bệnh thận do đái tháo đường, bệnh thần kinh ngoại vi và bệnh mạch máu nuôi tim não. Tầm soát sớm giúp can thiệp khi tổn thương còn có thể hồi phục hoặc làm chậm tiến triển.

## Chẩn đoán và nguyên nhân

Chẩn đoán dựa trên xét nghiệm đường huyết lúc đói từ 7.0 mmol/L trở lên, HbA1c từ 6.5 phần trăm trở lên hoặc đường huyết sau dung nạp glucose đạt ngưỡng chẩn đoán, thực hiện ít nhất hai lần khi không có triệu chứng điển hình. Các yếu tố nguy cơ hàng đầu gồm:
- Thừa cân béo phì, đặc biệt mỡ nội tạng và vòng bụng lớn.
- Ít vận động thể lực dưới 150 phút mỗi tuần.
- Tiền sử gia đình mắc đái tháo đường, đặc biệt cha mẹ hoặc anh chị em ruột.
- Tiền sử đái tháo đường thai kỳ hoặc sinh con nặng trên 4 kg.
- Tăng huyết áp và rối loạn lipid máu đi kèm.

## Điều trị và kiểm soát đường huyết lâu dài

Điều trị type 2 luôn bắt đầu từ thay đổi lối sống và thuốc uống như metformin, có thể bổ sung insulin hoặc thuốc nhóm mới tùy giai đoạn mà bác sĩ chỉ định. Mục tiêu HbA1c thường dưới 7 phần trăm nhưng được cá thể hóa theo tuổi và bệnh kèm. Người bệnh cần:
- Ăn chậm, chia nhỏ bữa, giảm cơm trắng và đồ ngọt, tăng chất xơ từ rau và ngũ cốc nguyên hạt.
- Vận động aerobic 150 phút mỗi tuần kết hợp bài tập kháng lực nhẹ nhàng.
- Tự theo dõi đường huyết mao mạch theo lịch bác sĩ dặn và ghi lại để tái khám.
- Khám mắt, xét nghiệm nước tiểu kiểm tra protein và kiểm tra bàn chân định kỳ mỗi năm.
- Chăm sóc bàn chân hằng ngày, cắt móng cẩn thận, đi giày vừa chân để phòng loét bàn chân.

Đái tháo đường type 2 không thể chữa khỏi hoàn toàn nhưng hoàn toàn có thể kiểm soát tốt. Người bệnh tuân thủ điều trị và theo dõi đều đặn vẫn có chất lượng cuộc sống gần như người khỏe mạnh.

## Câu hỏi thường gặp của người đái tháo đường

Người đái tháo đường vẫn ăn cơm được với khẩu phần vừa phải, ưu tiên gạo lứt và ăn cùng rau, đạm để làm chậm tăng đường huyết sau ăn. Thuốc điều trị thường phải duy trì lâu dài, nhưng với người giảm cân tốt và vận động đều, bác sĩ có thể điều chỉnh giảm liều theo kết quả theo dõi. Khi bắt đầu tập vận động mạnh hơn, bạn cần đo đường huyết trước và sau tập, mang theo kẹo hoặc nước đường phòng hạ đường huyết. Trước khi đi khám xa hay nhập viện vì bệnh khác, nhớ báo cho nhân viên y tế biết bạn đang dùng thuốc đái tháo đường để được điều chỉnh phù hợp.

Nội dung này chỉ mang tính tham khảo, không thay thế tư vấn và chỉ định của bác sĩ.$body$,
        10,
        'ENDOCRINOLOGY',
        'ThS.BS Nguyễn Anh Duy',
        7,
        'noi-tiet',
        '/media/articles/tam-soat-tieu-duong.jpg',
        '["đái tháo đường", "HbA1c", "đường huyết", "nội tiết"]',
        '["đái tháo đường type 2", "nội tiết"]',
        '["HbA1c mục tiêu thường dưới 7 phần trăm, được cá thể hóa theo bác sĩ", "Vận động 150 phút/tuần giúp cải thiện độ nhạy insulin", "Tầm soát mắt, thận và bàn chân ít nhất mỗi năm một lần"]',
        '["Đường huyết thấp kèm vã mồ hôi, run tay, lơ mơ", "Vết loét bàn chân lan rộng, có mùi hôi", "Đau ngực, khó thở khi gắng sức ở người đái tháo đường"]',
        '["Kiểm soát cân nặng và giảm đồ uống có đường", "Ăn nhiều chất xơ, hạn chế tinh bột tinh chế", "Khám sức khỏe định kỳ gồm đường huyết và HbA1c sau tuổi 35"]',
        'Khi đường huyết đo tại nhà rất cao kèm nôn, đau bụng, thở nhanh và khát dữ dội, hoặc rất thấp kèm vã mồ hôi run và lơ mơ, cần đến cơ sở y tế ngay.',
        '["Hướng dẫn chẩn đoán và điều trị đái tháo đường típ 2 - Bộ Y tế Việt Nam", "American Diabetes Association Standards of Care in Diabetes"]',
        'Nội dung chỉ nhằm giáo dục sức khỏe, không thay thế chẩn đoán, chỉ định điều trị hoặc tư vấn trực tiếp của bác sĩ.'
    ),
    (
        '92000000-0000-0000-0002-000000000003',
        'Đau thắt lưng: phân biệt đau cơ năng và dấu hiệu cần khám sớm',
        'dau-that-lung-nguyen-nhan-va-dieu-tri',
        'Đau thắt lưng là lý do đi khám phổ biến nhất ở người lao động văn phòng. Bài viết giúp bạn phân biệt đau do tư thế, thoái hóa đốt sống với các dấu hiệu thần kinh cần được bác sĩ đánh giá sớm.',
        $body$Đau thắt lưng là cơn đau vùng cột sống từ eo dưới đến mông, có thể lan theo mặt sau đùi. Hầu hết các cơn đau thắt lưng thông thường cải thiện trong 2 đến 6 tuần với điều trị bảo tồn; tuy nhiên cách ngồi đứng và vận động sai khiến cơn đau dễ tái phát thành mạn tính nếu không được điều chỉnh.

## Dấu hiệu và mức độ cảnh báo

Đau thắt lưng cơ năng thường âm ỉ, tăng khi ngồi lâu hoặc gập lưng, giảm khi nghỉ ngơi và đổi tư thế, không kèm tê yếu chi. Bạn cần được bác sĩ thăm khám sớm hơn khi:
- Đau lan xuống chân qua đầu gối, kèm tê bì hoặc kiến bò mặt sau chi.
- Yếu cơ chân, khó nhón gót hoặc khó đứng mũi chân.
- Đau dữ dội không giảm khi nghỉ, tăng về đêm, kèm sụt cân không rõ nguyên nhân.
- Rối loạn đại tiểu tiện hoặc tê vùng yên ngựa, đây là dấu hiệu khẩn cấp.

Các dấu hiệu thần kinh ở hai gạch đầu có thể gợi ý chèn ép rễ thần kinh do thoát vị đĩa đệm và cần chẩn đoán hình ảnh kết hợp thăm khám chuyên khoa.

## Nguyên nhân và yếu tố nguy cơ

Nguyên nhân thường gặp gồm co cứng cơ do tư thế sai, thoái hóa đĩa đệm và khớp liên sống, thoát vị đĩa đệm chèn ép rễ, và hội chứng khớp chậu cùng. Các yếu tố làm tăng nguy cơ gồm:
- Ngồi liên tục trên 6 giờ mỗi ngày với lưng cong, vai gối lệch tư thế.
- Nâng vác vật nặng bằng tư thế cúi người thay vì gập gối giữ lưng thẳng.
- Cơ bụng và cơ lưng yếu do ít vận động, làm giảm khả năng nâng đỡ cột sống.
- Thừa cân tạo tải trọng lớn lên đĩa đệm thắt lưng.

## Điều trị và phòng ngừa tái phát

Điều trị nền tảng là giữ vận động trong giới hạn chịu được, kết hợp thuốc giảm đau chống viêm ngắn ngày theo toa và vật lý trị liệu. Chỉ định phẫu thuật chỉ chiếm tỷ lệ nhỏ các trường hợp có chèn ép thần kinh nặng hoặc không đáp ứng điều trị bảo tồn. Để phòng tái phát, bạn nên:
- Tập đều đặn các bài tăng cường cơ core như plank, bridge, kéo gối ôm ngực dưới hướng dẫn của kỹ thuật viên.
- Ngồi lưng thẳng tựa đầy đủ, đứng lên vận động 5 phút sau mỗi 45 đến 60 phút làm việc.
- Nâng vật nặng bằng cách gập gối, giữ vật sát người, lưng giữ thẳng.
- Ngủ đệm vừa độ cứng, tránh nằm võng võng quá mềm hoặc ngủ sấp lâu.
- Kiểm soát cân nặng và bỏ thuốc lá giúp đĩa đệm chậm lão hóa hơn.

Đau thắt lưng không phải bệnh lý phải chịu đựng; điều chỉnh tư thế sớm và tập luyện đúng giúp đa số người bệnh trở lại sinh hoạt bình thường.

## Chườm nóng, chườm lạnh và đi lại trong giai đoạn đau

Trong 48 giờ đầu sau cơn đau bội phát, chườm lạnh 15 đến 20 phút mỗi 2 đến 3 giờ giúp giảm co thắt cơ; sau giai đoạn cấp, chườm ấm thường đỡ cứng và dễ chịu hơn. Bạn vẫn nên đi bộ ngắn nhiều lần trong ngày trong giới hạn đau thay vì nằm liên tục, vì nghỉ hoàn toàn kéo dài làm hồi phục chậm hơn. Nếu sau 2 tuần vận động đúng mà đau không giảm, hoặc cơn đau tái phát nhiều lần trong năm, hãy khám chuyên khoa cơ xương khớp để được chỉ định vật lý trị liệu và chẩn đoán hình ảnh khi cần.

Nội dung này chỉ mang tính giáo dục sức khỏe, không thay thế thăm khám và chỉ định điều trị của bác sĩ.$body$,
        14,
        'MUSCULOSKELETAL',
        'BS.CKII Phạm Quốc Dũng',
        6,
        'co-xuong-khop',
        '/media/articles/thoai-hoa-cot-song.jpg',
        '["đau lưng", "thoát vị đĩa đệm", "cơ xương khớp", "vật lý trị liệu"]',
        '["đau thắt lưng", "cơ xương khớp"]',
        '["Giữ vận động nhẹ nhàng tốt hơn nằm nghỉ hoàn toàn trong đau thắt lưng thông thường", "Tập cơ core đều đặn là biện pháp phòng tái phát hiệu quả nhất", "Tê yếu chi hoặc rối loạn đại tiểu tiện cần đi khám ngay"]',
        '["Yếu chi nhanh tiến triển hoặc khó kiềm đại tiểu tiện", "Đau dữ dội sau chấn thương hoặc ngã cao", "Sốt kèm đau lưng, dấu hiệu có thể liên quan nhiễm trùng"]',
        '["Đổi tư thế mỗi 45-60 phút khi làm việc bàn ghế", "Tăng cường cơ lưng và cơ bụng theo hướng dẫn chuyên môn", "Nâng vác đúng tư thế, kiểm soát cân nặng"]',
        'Đau kéo dài quá 2 tuần không giảm, lan xuống chân kèm tê yếu, hoặc xuất hiện sốt, sụt cân, rối loạn đại tiểu tiện, cần được bác sĩ chuyên khoa thăm khám sớm.',
        '["Hướng dẫn chẩn đoán và điều trị đau cột sống thắt lưng - Hội Cơ xương khớp Việt Nam", "Lancet Low Back Pain Series: clinical management recommendations"]',
        'Nội dung chỉ nhằm giáo dục sức khỏe, không thay thế chẩn đoán, chỉ định điều trị hoặc tư vấn trực tiếp của bác sĩ.'
    ),
    (
        '92000000-0000-0000-0002-000000000004',
        'Cúm mùa: phân biệt với cảm lạnh thông thường và phòng ngừa bằng vắc xin',
        'cum-mua-dau-hieu-va-phong-ngua',
        'Cúm mùa do virus gây sốt cao, đau nhức toàn thân và mệt mỏi nặng hơn hẳn cảm lạnh. Bài viết trình bày cách nhận biết, chăm sóc tại nhà, các dấu hiệu biến chứng và vai trò của vắc xin cúm hằng năm.',
        $body$Cúm mùa là bệnh nhiễm trùng đường hô hấp cấp do virus cúm, lây truyền qua giọt bắn khi ho hắt hơi và tiếp xúc gần. Cúm thường bắt đầu đột ngột với sốt và đau nhức toàn thân nặng, trong khi cảm lạnh thông thường tiến triển từ từ với chủ yếu là nghẹt mũi và hắt hơi, ít sốt cao.

## Triệu chứng thường gặp

Triệu chứng cúm xuất hiện nhanh trong vòng 1 đến 4 ngày sau phơi nhiễm và kéo dài 5 đến 7 ngày ở người khỏe mạnh. Biểu hiện đặc trưng gồm:
- Sốt cao 38.5 đến 40 độ kèm ớn lạnh run rẩy toàn thân.
- Đau nhức cơ bắp và khớp lan tỏa, đặc biệt lưng và chân.
- Đau đầu, đau hố mắt, mệt mỏi rõ rệt khiến bạn muốn nằm nghỉ.
- Ho khan, đau họng, nghẹt mũi, có thể kèm chảy nước mắt.
- Trẻ nhỏ có thể nôn trớ, li bì và bỏ ăn.

Người cao tuổi, phụ nữ mang thai, trẻ dưới 5 tuổi, người có bệnh mạn tính như hen, tim mạch, đái tháo đường thuộc nhóm nguy cơ cao dễ tiến triển viêm phổi, viêm tai giữa, bùng phát bệnh nền hoặc suy hô hấp.

## Lây truyền và phòng ngừa

Virus cúm lây mạnh nhất trong ngày đầu có sốt và vẫn lây đến 5 đến 7 ngày, trẻ nhỏ có thể lây lâu hơn. Biện pháp phòng ngừa hiệu quả gồm:
- Tiêm vắc xin cúm hằng năm trước mùa dịch, ưu tiên nhóm nguy cơ cao và người chăm sóc trẻ nhỏ.
- Rửa tay bằng xà phòng hoặc dung dịch sát khuẩn, che miệng khi ho hắt hơi.
- Đeo khẩu trang nơi đông người trong mùa dịch, thông gió nhà ở và nơi làm việc.
- Hạn chế tiếp xúc trực tiếp với người đang sốt ho, giữ khoảng cách khi có dịch trong cộng đồng.

Vắc xin cúm không gây bệnh cúm; phản ứng thường gặp chỉ là đau nhức chỗ tiêm và sốt nhẹ trong 1 đến 2 ngày. Kháng thể cần khoảng 2 tuần để hình thành nên tiêm trước đỉnh dịch là quan trọng nhất.

## Chăm sóc tại nhà và khi nào cần đi khám

Người cúm không biến chứng cần nghỉ ngơi, uống đủ nước, hạ sốt bằng paracetamol theo liều và theo dõi diễn tiến; thuốc kháng virus như oseltamivir chỉ phát huy tốt nhất khi bác sĩ chỉ định trong 48 giờ đầu cho nhóm nguy cơ cao. Kháng sinh không tác động lên virus cúm và không nên tự dùng. Bạn cần đến cơ sở y tế khi:
- Sốt cao không giảm sau 3 ngày hoặc sốt trở lại sau khi đã đỡ.
- Khó thở, đau ngực, tím môi hoặc ho đờm mủ nhiều.
- Trẻ nhỏ li bì khó đánh thức, bỏ bú, co giật hoặc thở nhanh rút lõm lồng ngực.
- Người cao tuổi mệt lả, rối loạn ý thức hoặc bùng phát bệnh nền.

Cúm mùa tự khỏi ở phần lớn người khỏe mạnh nhưng có thể nặng nhanh ở nhóm nguy cơ, vì vậy nhận biết sớm và tiêm phòng hằng năm vẫn là chìa khóa.

## Cúm ở trẻ nhỏ và người cao tuổi

Trẻ nhỏ chưa diễn t được mệt mỏi nên bệnh cúm thường lộ qua li bì, bỏ bú, quấy khóc bất thường và sốt cao nhanh; người chăm sóc cần theo dõi nhịp thở, số lần tiểu và mức độ tỉnh táo thay vì chỉ nhìn con số nhiệt kế. Người cao tuổi có thể chỉ sốt nhẹ nhưng suy giảm rõ khả năng vận động, ăn uống và tỉnh thức, dễ bùng phát bệnh tim phổi nền. Cả hai nhóm nên được khám sớm trong ngày đầu sốt và thuộc nhóm ưu tiên tiêm vắc xin cúm hằng năm. Người chăm sóc cũng nên tiêm phòng để giảm lây ngược về nhà.

Nội dung này chỉ mang tính giáo dục sức khỏe, không thay thế thăm khám và chỉ định điều trị của bác sĩ.$body$,
        8,
        'RESPIRATORY',
        'BS.CKI Trần Mỹ Linh',
        6,
        'ho-hap',
        '/media/articles/ho-hap.jpg',
        '["cúm mùa", "vắc xin cúm", "hô hấp", "sốt"]',
        '["cúm mùa", "hô hấp"]',
        '["Tiêm vắc xin cúm hằng năm trước mùa dịch, đặc biệt với nhóm nguy cơ cao", "Nghỉ ngơi và uống đủ nước, không tự dùng kháng sinh cho cúm virus", "Đến khám khi sốt quá 3 ngày, khó thở hoặc trẻ li bì bỏ bú"]',
        '["Khó thở, đau ngực, tím môi", "Sốt cao kéo dài quá 3 ngày hoặc sốt trở lại", "Trẻ co giật, li bì khó đánh thức hoặc thở nhanh bất thường"]',
        '["Tiêm vắc xin cúm hằng năm", "Rửa tay thường xuyên và đeo khẩu trang nơi đông người", "Thông gió nơi ở và làm việc, hạn chế tiếp xúc người đang ho sốt"]',
        'Sốt không giảm sau 3 ngày, khó thở, đau ngực, tím môi, hoặc trẻ nhỏ và người cao tuổi có dấu hiệu li bì, bỏ bú, mệt lả cần được khám ngay trong ngày.',
        '["Hướng dẫn chẩn đoán và điều trị cúm - Bộ Y tế Việt Nam", "WHO Influenza: recommendations for prevention and control"]',
        'Nội dung chỉ nhằm giáo dục sức khỏe, không thay thế chẩn đoán, chỉ định điều trị hoặc tư vấn trực tiếp của bác sĩ.'
    ),
    (
        '92000000-0000-0000-0002-000000000005',
        'Viêm họng cấp: khi nào do virus, khi nào cần kháng sinh',
        'viem-hong-cap-virus-hay-khu-can-khang-sinh',
        'Đa số viêm họng cấp do virus và tự khỏi trong một tuần, chỉ một tỷ lệ nhỏ do vi khuẩn liên cầu cần kháng sinh. Bài viết giúp bạn nhận biết mức độ, chăm sóc đúng cách và tránh lạm dụng kháng sinh.',
        $body$Viêm họng cấp là tình trạng viêm niêm mạc họng gây đau rát khi nuốt, thường kèm sốt nhẹ và khàn giọng. Nguyên nhân chiếm đa số là virus hô hấp như rhinovirus, adenovirus hay virus cúm; nhiễm liên cầu nhóm A chỉ chiếm khoảng 15 đến 30 phần trăm ở trẻ em và ít hơn ở người lớn, nhưng lại là nhóm cần điều trị kháng sinh để phòng biến chứng tim và thận.

## Triệu chứng thường gặp

Viêm họng do virus thường đi kèm các biểu hiện hô hấp khác và tự giới hạn trong 5 đến 7 ngày. Biểu hiện bao gồm:
- Đau rát họng khi nuốt, khàn giọng nhẹ, ho khan.
- Sốt nhẹ đến trung bình, nghẹt mũi, hắt hơi, mệt mỏi toàn thân.
- Họng đỏ, có thể thấy dịch nhầy chảy sau mũi.

Viêm họng do liên cầu thường tiến triển nhanh với sốt cao trên 38.5 độ, amidan sưng đỏ có mủ trắng vàng, hạch cổ to đau, không kèm ho và nghẹt mũi. Trẻ có thể đau bụng kèm nôn. Mẫu bệnh cảnh này cần được bác sĩ thăm khám và xét nghiệm để quyết định kháng sinh.

## Nguyên nhân và yếu tố thuận lợi

Ngoài virus và vi khuẩn, viêm họng có thể do dị ứng, khô mũi họng, trào ngược axit hoặc tiếp xúc khói thuốc. Các yếu tố thuận lợi gồm:
- Thay đổi thời tiết lạnh, ở phòng điều hòa khô kéo dài.
- Hít khói thuốc lá chủ động hoặc thụ động.
- Nói nhiều, gắng giọng kéo dài ở giáo viên, ca sĩ, nhân viên chăm sóc khách hàng.
- Miễn dịch suy giảm, thiếu ngủ, căng thẳng.

## Chăm sóc tại nhà và phòng ngừa

Đa số trường hợp virus chỉ cần chăm sóc hỗ trợ và theo dõi tại nhà. Bạn có thể:
- Súc họng nước muối sinh lý ấm 2 đến 3 lần mỗi ngày, uống nước ấm chia nhỏ nhiều lần.
- Hạ sốt và giảm đau bằng paracetamol đúng liều theo cân nặng.
- Giữ ẩm phòng ở, tránh khói bụi và thức ăn quá cay nóng trong giai đoạn viêm.
- Nghỉ ngơi giọng nói, hạn chế gắng giọng cho đến khi họng đỡ đau.

Kháng sinh chỉ dùng khi bác sĩ xác định hoặc nghi ngờ cao nhiễm liên cầu; tự ý dùng kháng sinh cho viêm họng virus gây kháng thuốc mà không rút ngắn thời gian bệnh. Để phòng lây, che miệng khi ho, rửa tay thường xuyên, chia riêng dụng ăn uống và tránh đến nơi đông người khi đang sốt. Người viêm họng tái đi tái lại nhiều đợt trong năm nên khám tai mũi họng để tìm nguyên nhân nền như viêm xoang chảy sau, viêm amidan mạn hoặc trào ngược.

## Khi nào nên khám chuyên khoa tai mũi họng

Bạn nên khám chuyên khoa khi viêm họng tái phát nhiều hơn 5 đợt trong năm, đau kéo dài quá một tuần không giảm, hoặc kèm hạch cổ to không mất sau hai tuần. Người hay khàn tiếng trên ba tuần, khạc đờm có máu hoặc nuốt nghẹn cần được nội soi tai mũi họng để đánh giá thanh quản và vùng tâm họng. Trẻ viêm họng kèm ngáy lớn, thở miệng mạn và ngủ không sâu gợi ý phì đại amidan VA, cần thăm khám để bảo đảm đường thở và giấc ngủ của trẻ. Khám sớm giúp điều trị đúng nguyên nhân thay vì dùng kháng sinh lặp lại không cần thiết.

Nội dung này chỉ mang tính giáo dục sức khỏe, không thay thế thăm khám và chỉ định điều trị của bác sĩ.$body$,
        9,
        'OTOLARYNGOLOGY',
        'BS.CKI Đặng Thu Thảo',
        5,
        'tai-mui-hong',
        '/media/articles/tai-mui-hong.jpg',
        '["viêm họng", "kháng sinh", "tai mũi họng", "liên cầu"]',
        '["viêm họng cấp", "tai mũi họng"]',
        '["Đa số viêm họng cấp do virus, không cần kháng sinh", "Súc họng nước muối và uống nước ấm giúp giảm triệu chứng hiệu quả", "Amidan mủ kèm sốt cao không ho cần bác sĩ đánh giá để cân nhắc kháng sinh"]',
        '["Khó thở, khó mở miệng hoặc khó nuốt cả nước bọt", "Sốt cao kéo dài quá 3 ngày dù đã hạ sốt", "Sưng cổ rõ, nói như ngậm nóng hoặc một bên amidan phì to bất thường"]',
        '["Rửa tay thường xuyên, che miệng khi ho hắt hơi", "Giữ ẩm phòng, hạn chế rượu bia và thuốc lá", "Súc họng nước muối khi thời tiết thay đổi"]',
        'Đau họng kéo dài quá một tuần, amidan có mủ kèm sốt cao, khó nuốt cả nước bọt hoặc khó thở, cần được bác sĩ chuyên khoa thăm khám trong ngày.',
        '["Hướng dẫn chẩn đoán và điều trị viêm đường hô hấp trên - Bộ Y tế Việt Nam", "IDSA Guidelines for management of group A streptococcal pharyngitis"]',
        'Nội dung chỉ nhằm giáo dục sức khỏe, không thay thế chẩn đoán, chỉ định điều trị hoặc tư vấn trực tiếp của bác sĩ.'
    ),
    (
        '92000000-0000-0000-0002-000000000006',
        'Viêm dạ dày và trào ngược GERD: ăn uống thế nào cho lành',
        'viem-da-day-gerd-che-do-an-uong',
        'Đau âm ỉ trên rốn, ợ chua và nóng rát sau xương ức là biểu hiện thường gặp của viêm dạ dày và trào ngược thực quản. Bài viết trình bày nguyên nhân, vai trò vi khuẩn Hp và chế độ ăn uống giúp niêm mạc phục hồi.',
        $body$Viêm dạ dày là tình trạng viêm niêm mạc dạ dày do nhiều nguyên nhân, trong đó vi khuẩn Helicobacter pylori và việc lạm dụng thuốc giảm đau nhóm NSAID đứng hàng đầu. Khi cơ thắt thực quản dưới suy yếu, axit trào ngược lên thực quản gây GERD với cảm giác nóng rát ngực và chua miệng sau ăn.

## Triệu chứng thường gặp

Hai bệnh lý này thường chồng lấn triệu chứng và cùng xuất hiện ở một người. Bạn có thể nhận biết qua:
- Đau âm ỉ hoặc nóng rát vùng thượng vị, tăng khi đói hoặc sau bữa ăn nhiều gia vị.
- Ợ hơi ợ chua, đắng miệng buổi sáng, cảm giác chua trào lên sau xương ức.
- Đầy bụng, chậm tiêu, nhanh no dù ăn ít.
- Buồn nôn, kể cả khi mới thức dậy; giảm cảm giác thèm ăn.

Các dấu hiệu cảnh báo cần nội soi sớm gồm nôn ra máu hoặc đi ngoài phân đen, sụt cân nhanh không rõ nguyên nhân, khó nuốt tiến triển và thiếu máu. Trên 50 tuổi mới xuất hiện triệu chứng tiêu hóa cũng nên nội soi để loại trừ tổn thương nặng hơn.

## Nguyên nhân và vai trò vi khuẩn Hp

Vi khuẩn Hp là nguyên nhân mạn tính phổ biến nhất, lây qua đường ăn uống chung và có thể âm thầm gây viêm, loét, lâu năm làm tăng nguy cơ ung thư dạ dày. Các yếu tố làm nặng thêm triệu chứng gồm:
- Ăn không đúng giờ, bỏ bữa sáng, ăn khuya sát giờ ngủ.
- Rượu bia, cà phê đậm, thuốc lá và đồ uống có gas.
- Lạm dụng thuốc giảm đau NSAID như aspirin, ibuprofen không theo toa.
- Căng thẳng kéo dài làm tăng tiết axit và rối loạn vận động dạ dày.

Chẩn đoán bao gồm nội soi dạ dày đánh giá tổn thương và test phát hiện Hp; điều trị diệt Hp bằng phác đồ phối hợp thuốc theo hướng dẫn để giảm nguy cơ tái phát.

## Điều trị và chế độ ăn uống phục hồi

Điều trị nền tảng gồm thuốc ức chế bơm proton theo toa trong 4 đến 8 tuần, kết hợp diệt Hp nếu dương tính. Chế độ sinh hoạt quyết định phần lớn tốc độ hồi phục:
- Ăn đúng giờ, chia 3 bữa chính kèm bữa phụ nhẹ, không bỏ bữa và không ăn quá no.
- Không nằm ngay sau ăn; giờ ngủ cách bữa tối ít nhất 2 đến 3 giờ.
- Hạn chế đồ cay nóng, chua, cà phê đậm, rượu bia và nước có gas trong giai đoạn điều trị.
- Nấu mềm, hấp luộc ưu tiên; nhai chậm kỹ giúp giảm gánh nặng cho dạ dày.
- Giảm cân nếu thừa cân, nâng đầu giường 10 đến 15 cm với người trào ngược nhiều ban đêm.
- Không tự ý dùng thuốc giảm đau nhóm NSAID; trao đổi bác sĩ nếu cần thuốc giảm đau lâu dài.

Viêm dạ dày và GERD có thể kiểm soát tốt khi tuân thủ điều trị và điều chỉnh thói quen ăn uống kiên trì. Nếu triệu chứng tái phát sau điều trị, bạn nên tái khám để đánh giá lại và tầm soát Hp theo chỉ định.

## Sau điều trị diệt Hp cần làm gì

Sau khi kết thúc phác đồ diệt vi khuẩn Hp, bạn cần nghỉ ít nhất 4 tuần rồi thực hiện test kiểm tra như hơi thở urê hoặc xét nghiệm phân theo hẹn, vì thuốc ức chế axit đang dùng có thể làm kết quả âm tính giả; trao đổi bác sĩ về việc tạm ngưng thuốc đúng hướng dẫn trước khi kiểm tra. Để hạn chế tái nhiễm, dùng muỗng đũa riêng hoặc ăn cơm riêng trong gia đình có người nhiễm Hp, rửa tay trước ăn và sau vệ sinh. Người có người thân cùng nhà nhiễm Hp nên được tầm soát theo khuyến cáo chuyên khoa tiêu hóa.

Nội dung này chỉ mang tính giáo dục sức khỏe, không thay thế thăm khám và chỉ định điều trị của bác sĩ.$body$,
        16,
        'GASTROENTEROLOGY',
        'BS.CKII Võ Thanh Sơn',
        7,
        'tieu-hoa',
        '/media/articles/viem-loet-da-day.jpg',
        '["viêm dạ dày", "GERD", "trào ngược", "Hp"]',
        '["viêm dạ dày", "tiêu hóa"]',
        '["Nội soi và test Hp là nền tảng chẩn đoán viêm dạ dày - trào ngược", "Không nằm sau ăn và giữ giờ ngủ cách bữa tối 2-3 giờ", "Diệt Hp dương tính giúp giảm tái phát và nguy cơ ung thư dạ dày"]',
        '["Nôn ra máu hoặc đi ngoài phân đen", "Khó nuốt tiến triển, sụt cân nhanh không rõ nguyên nhân", "Đau thượng vị dữ dội đột ngột không giảm"]',
        '["Ăn đúng giờ, không ăn khuya, hạn chế cay chua và rượu bia", "Không tự ý dùng NSAID kéo dài", "Điều trị diệt Hp theo phác đồ và tái khám đúng hẹn"]',
        'Nôn ra máu, phân đen, khó nuốt, sụt cân nhanh hoặc đau không đáp ứng thuốc sau 2 tuần cần nội soi và thăm khám chuyên khoa tiêu hóa sớm.',
        '["Hướng dẫn chẩn đoán và điều trị viêm loét dạ dày tá tràng - Bộ Y tế Việt Nam", "Kyoto Global Consensus Report on Helicobacter pylori gastritis"]',
        'Nội dung chỉ nhằm giáo dục sức khỏe, không thay thế chẩn đoán, chỉ định điều trị hoặc tư vấn trực tiếp của bác sĩ.'
    ),
    (
        '92000000-0000-0000-0002-000000000007',
        'Suy giãn tĩnh mạch chi dưới: đứng nhiều, phù nhẹ và cách chăm sóc tĩnh mạch',
        'suy-gian-tinh-mach-chi-duo-huong-dan',
        'Nặng chân, phù muối chiều và tĩnh mạch nổi cuộn dưới da là dấu hiệu sớm của suy giãn tĩnh mạch chi dưới. Bài viết giải thích cơ chế, các độ bệnh và biện pháp chăm sóc giúp chậm tiến triển.',
        $body$Suy giãn tĩnh mạch chi dưới là tình trạng van tĩnh mạch suy yếu khiến máu ứ trượt xuống chân thay vì trở về tim, gây ứ huyết và tăng áp lực tĩnh mạch kéo dài. Bệnh phổ biến ở người đứng lâu, phụ nữ sau mang thai và người có tiền sử gia đình, tiến triển chậm qua nhiều năm nếu không được quản lý.

## Dấu hiệu thường gặp

Triệu chứng nặng nhất vào cuối ngày và giảm khi nâng cao chân, đây là nét đặc trưng giúp phân biệt với phù thận hay phù tim. Biểu hiện điển hình gồm:
- Nặng mỏi chân, căng tức bắp chân vào buổi chiều tối.
- Phù nhẹ quanh cổ chân, ấn lún nhẹ, thoái lui sau đêm ngủ.
- Tĩnh mạch nổi cuộn xoắn dưới da bắp chân hoặc mặt trong đùi.
- Chuột rút đêm, ngứa và nóng rát da vùng bị giãn.

Giai đoạn tiến triển có thể xuất hiện thay đổi màu da nâu sạm quanh cổ chân, viêm tĩnh mạch nông đau đỏ và loét tĩnh mạch mạn tính khó lành, đây là các dấu hiệu cần được điều trị chuyên sâu.

## Nguyên nhân và yếu tố nguy cơ

Cơ chế cốt lõi là suy van tĩnh mạch sâu hoặc nông kèm suy yếu bơm cơ bắp chân. Các yếu tố nguy cơ gồm:
- Nghề nghiệp đứng hoặc ngồi liên tục như giáo viên, đầu bếp, nhân viên bán hàng, lái xe dài đường.
- Mang thai, dùng thuốc nội tiết và thay đổi hormone.
- Thừa cân làm tăng áp lực tĩnh mạch chi dưới.
- Tiền sử gia đình giãn tĩnh mạch và tuổi tác tăng dần.

Chẩn đoán dựa vào siêu âm Doppler tĩnh mạch chi dưới để xác định vị trí và mức độ trào ngược, từ đó bác sĩ lựa chọn liệu trình phù hợp thay vì chỉ điều trị theo hình ảnh bên ngoài da.

## Điều trị và chăm sóc tĩnh mạch hằng ngày

Điều trị khởi đầu không xâm lấn luôn bao gồm tất cả các độ bệnh, kể cả khi đã can thiệp. Người bệnh nên:
- Đeo vớ ép y khoa đúng độ ép theo chỉ định, mang từ sáng khi vừa ngủ dậy trước khi xuống giường.
- Nâng cao chân 15 đến 20 cm khi nằm nghỉ, tập đi bộ hằng ngày để bơm cơ bắp chân hoạt động.
- Tránh đứng hoặc ngồi bất động quá 45 phút, vận động cổ chân xoay tròn khi phải ngồi lâu.
- Tránh tắm nước quá nóng trực tiếp lên chân, kiểm soát cân nặng hợp lý.
- Trường hợp giãn rõ, đau nhiều hoặc có biến chứng da, bác sĩ có thể chỉ định tiêm xơ hoặc phẫu thuật loại bỏ tĩnh mạch bệnh lý theo đánh giá siêu âm.

Suy giãn tĩnh mạch là bệnh mạn tiến triển chậm, phát hiện sớm và chăm sóc đúng giúp đa số người bệnh sinh hoạt bình thường và tránh loét da về sau.

## Chọn và sử dụng vớ ép đúng cách

Vớ ép y khoa được phân theo độ ép và chiều dài, chỉ nên chọn sau khi được đo chân và tư vấn vì độ ép không phù hợp gây khó chịu hoặc hiệu quả thấp. Bạn nên mang vớ vào buổi sáng ngay khi vừa thức dậy khi chân còn ít phù, và thay vớ mới sau khoảng 6 tháng vì độ đàn hồi giảm dần. Người có bệnh động mạch chi dưới nặng, suy tim mất bù hoặc nhiễm trùng da chân cần trao đổi bác sĩ trước khi dùng vớ ép, vì có những chống chỉ định cụ thể. Nếu da dưới vớ ngứa, đổi màu hoặc đau nhiều, hãy tháo vớ và đi khám.

Nội dung này chỉ mang tính giáo dục sức khỏe, không thay thế thăm khám và chỉ định điều trị của bác sĩ.$body$,
        20,
        'CARDIOLOGY',
        'BS.CKI Hoàng Bảo Trâm',
        6,
        'tim-mach',
        '/media/articles/dau-hieu-tim-mach.jpg',
        '["suy giãn tĩnh mạch", "tĩnh mạch", "vớ ép", "phù chân"]',
        '["suy giãn tĩnh mạch", "tim mạch"]',
        '["Nặng chân và phù muối chiều giảm khi nâng cao chân là dấu hiệu đặc trưng", "Vớ ép y khoa kết hợp đi bộ là nền tảng điều trị mọi giai đoạn", "Siêu âm Doppler quyết định phương án điều trị thay vì chỉ nhìn da"]',
        '["Đau tĩnh mạch nóng đỏ lan một đoạn chân đột ngột", "Phù một chân nhanh kèm đau bắp chân sâu", "Vết loét quanh cổ chân không lành sau nhiều tuần"]',
        '["Đi bộ hằng ngày và vận động cổ chân khi ngồi lâu", "Đeo vớ ép đúng độ ép theo chỉ định", "Kiểm soát cân nặng, tránh đứng ngồi bất động quá lâu"]',
        'Đau nóng đỏ một đoạn tĩnh mạch, phù chân nhanh kèm đau sâu, hoặc xuất hiện loét da quanh cổ chân cần được khám chuyên khoa tim mạch sớm.',
        '["Hướng dẫn chẩn đoán và điều trị suy tĩnh mạch chi dưới - Hội Tim mạch Việt Nam", "ESVS Clinical Practice Guidelines on the Management of Chronic Venous Disease"]',
        'Nội dung chỉ nhằm giáo dục sức khỏe, không thay thế chẩn đoán, chỉ định điều trị hoặc tư vấn trực tiếp của bác sĩ.'
    ),
    (
        '92000000-0000-0000-0002-000000000008',
        'Viêm xoang mạn tính: nghẹt mũi kéo dài không phải chỉ là cảm cúm',
        'viem-xoang-man-tinh-dau-hieu-va-dieu-tri',
        'Nghẹt mũi, dịch chảy sau mũi và đau vùng mặt kéo dài quá 10 ngày hoặc tái đi tái lại có thể là viêm xoang. Bài viết giúp bạn phân biệt với viêm mũi dị ứng và hiểu lộ trình điều trị chuẩn.',
        $body$Viêm xoang là tình trạng viêm niêm mạc các hốc xoang quanh mũi, gây tắc thoát dịch và ứ dịch mủ trong xoang. Cấp tính kéo dài dưới 4 tuần, thường sau cảm cúm; mạn tính khi triệu chứng kéo dài trên 12 tuần và thường đi kèm polyp mũi hoặc dị ứng nền.

## Triệu chứng thường gặp

Chẩn đoán viêm xoang cần ít nhất hai trong các đặc điểm sau kèm nghẹt mũi hoặc dịch chảy. Biểu hiện điển hình gồm:
- Nghẹt mũi một hoặc hai bên, giọng nói kêu như bị ngạt.
- Dịch mủ vàng xanh chảy ra mũi hoặc chảy xuống họng gây khạc đờm.
- Đau tức vùng mặt tại vị trí xoang bị viêm: trán, má, hốc mắt hoặc sau sống mũi, tăng khi cúi đầu.
- Giảm hoặc mất khứu giác kéo dài.
- Ho về đêm do dịch chảy sau mũi, mệt mỏi và hôi miệng.

Viêm mũi dị ứng gây hắt hơi sổ mũi nước trong nhưng ít đau mặt và không có dịch mủ; hai bệnh thường tồn tại song song và làm nặng nhau, nên bác sĩ có thể đánh giá cả hai khi khám.

## Nguyên nhân và yếu tố thuận lợi

Nguyên nhân trực tiếp thường là virus, kế đến vi khuẩn khi dịch ứ đọng quá lâu. Các yếu tố thuận lợi gồm:
- Viêm mũi dị ứng không được kiểm soát, polyp mũi, vẹo vách ngăn cản thoát dịch.
- Nhiễm trùng răng hàm trên lan lên xoang hàm.
- Hít khói bụi, ô nhiễm và khói thuốc lá kéo dài.
- Suy giảm miễn dịch hoặc bệnh lý bất động lông mũi hiếm gặp.

Chẩn đoán dựa trên nội soi tai mũi họng và chụp CT xoang khi cần, giúp xác định vị trí tắc và mức độ viêm để hướng dẫn điều trị.

## Điều trị và phòng ngừa tái phát

Điều trị viêm xoang cấp chú trọng mở thông lỗ thoát dịch xoang và kiểm soát viêm, viêm mạn tính cần kiên trì nhiều tuần đến nhiều tháng. Bạn nên:
- Rửa mũi bằng nước muối sinh lý dung dịch đẳng trương 2 đến 3 lần mỗi ngày, đúng kỹ thuật để rửa trôi dịch và dị nguyên.
- Dùng thuốc xịt corticoid mũi theo toa trong thời gian bác sĩ chỉ định, không tự ngừng sớm vì triệu chứng đỡ.
- Điều trị dị ứng nền bằng thuốc kháng histamine và tránh dị nguyên đã biết.
- Kháng sinh chỉ dùng khi bác sĩ đánh giá nhiễm vi khuẩn, không tự ý dùng cho viêm xoang virus.
- Tránh khói thuốc, giữ ẩm phòng ở, điều trị răng miệng và dị ứng mũi để phòng tái phát; với vẹo vách ngăn hoặc polyp nặng, phẫu thuật nội soi có thể được cân nhắc.

Viêm xoang mạn tính kiểm soát được tốt khi kết hợp điều trị đúng và chăm sóc mũi hằng ngày, giúp giảm đáng kể các đợt cấp và cải thiện chất lượng giấc ngủ, tập trung.

## Viêm xoang ở trẻ em

Ở trẻ em, viêm xoang thường được đánh giá khi triệu chứng ho, nghẹt mũi và dịch mủ kéo dài quá 10 ngày không đỡ, hoặc tái phát ngay sau khi tưởng đã hết. Trẻ nhỏ chưa biết xịt mũi đúng cách nên phụ huynh dùng dung dịch muối nhỏ mũi hoặc rửa mũi chuyên dụng theo hướng dẫn, đồng thời dạy trẻ xịt mũi từ từ khi đủ lớn. Ngáy lớn, thở miệng mạn, ngủ không sâu và giảm nghe một bên là các dấu hiệu cần khám tai mũi họng để đánh giá kèm phì đại VA và viêm tai giữa. Tiêm chủng đầy đủ và điều trị dị ứng nền giúp giảm các đợt viêm xoang tái phát ở trẻ.

Nội dung này chỉ mang tính giáo dục sức khỏe, không thay thế thăm khám và chỉ định điều trị của bác sĩ.$body$,
        24,
        'OTOLARYNGOLOGY',
        'ThS.BS Trịnh Quang Huy',
        6,
        'tai-mui-hong',
        '/media/articles/tai-mui-hong.jpg',
        '["viêm xoang", "nghẹt mũi", "rửa mũi", "polyp"]',
        '["viêm xoang", "tai mũi họng"]',
        '["Đau vùng mặt kèm dịch mủ và nghẹt mũi gợi ý viêm xoang hơn là cảm cúm", "Rửa mũi nước muối đúng kỹ thuật là nền tảng của mọi giai đoạn điều trị", "Triệu chứng kéo dài quá 12 tuần cần khám chuyên khoa để đánh giá CT xoang"]',
        '["Sốt cao kèm sưng đỏ vùng mắt hoặc trán", "Đau đầu dữ dội kèm nôn, cứng cổ", "Sụt giảm thị lực hoặc nhìn đôi"]',
        '["Rửa mũi nước muối hằng ngày, đặc biệt mùa giao mùa", "Kiểm soát dị ứng mũi và tránh khói bụi", "Điều trị răng miệng định kỳ phòng viêm xoang gốc răng"]',
        'Nghẹt mũi kèm đau mặt kéo dài quá 10 ngày, sốt cao kèm sưng quanh mắt, hoặc triệu chứng tái đi tái lại nhiều đợt trong năm cần được khám tai mũi họng.',
        '["Hướng dẫn chẩn đoán và điều trị viêm xoang - Bộ Y tế Việt Nam", "EPOS 2020: European Position Paper on Rhinosinusitis and Nasal Polyps"]',
        'Nội dung chỉ nhằm giáo dục sức khỏe, không thay thế chẩn đoán, chỉ định điều trị hoặc tư vấn trực tiếp của bác sĩ.'
    ),
    (
        '92000000-0000-0000-0002-000000000009',
        'Rối loạn tiền đình: choáng váng xoay tròn và cách phục hồi an toàn',
        'roi-loan-tien-dinh-choang-vang-xay-tron',
        'Chóng mặt xoay tròn khi đổi tư thế, kèm buồn nôn và mất thăng bằng, thường liên quan rối loạn tiền đình. Bài viết trình bày các nguyên nhân thường gặp, cách phân biệt với dấu hiệu thần kinh nguy hiểm và phục hồi.',
        $body$Rối loạn tiền đình là nhóm bệnh lý gây chóng mặt do rối loạn hệ thống cân bằng ở tai trong và đường dẫn truyền tiền đình. Người bệnh mô tả cảm giác môi trường xoay tròn, chao đảo như đi trên thuyền, thường bùng phát khi nằm nghiêng, xoay đầu hoặc đứng dậy nhanh, kèm buồn nôn và vã mồ hôi.

## Triệu chứng thường gặp

Cơn chóng mặt tiền đình thường kéo dài vài giây đến vài phút tùy nguyên nhân, lặp lại theo vị trí đầu. Các biểu hiện kèm theo gồm:
- Chóng mặt xoay tròn rõ khi nằm xuống, lật đầu sang một bên hoặc ngước nhìn lên.
- Buồn nôn, nôn, vã mồ hôi lạnh trong cơn.
- Mất thăng bằng khi đi, nghiêng về một bên.
- ù tai hoặc nghe giảm một bên tai tùy nguyên nhân kèm theo.

Đáng lưu ý, chóng mặt tiền đình lành tính phải phân biệt với chóng mặt do tổn thương não và hành não. Nếu chóng mặt kèm đau đầu dữ dội, nói khó, nhìn đôi, yếu tay chân, mất cảm giác mặt hoặc rối loạn phối hợp, đây là dấu hiệu thần kinh cần cấp cứu ngay.

## Nguyên nhân và chẩn đoán

Nguyên nhân phổ biến nhất là BPPV, tình trạng sạn canxi nhỏ (otoconia) rơi vào ống bán khớp của tai trong tạo cơn chóng ngắn vài chục giây khi đổi vị trí đầu. Các nguyên nhân khác gồm viêm thần kinh tiền đình sau nhiễm virus, bệnh Meniere với ù tai và điếc kèm theo, rối loạn tuần hoàn mạch nuôi tiền đình và tác dụng phụ một số thuốc. Chẩn đoán dựa trên thăm khám chuyên khoa với nghiệm pháp định vị và siêu âm mạch máu não khi cần, vì mỗi nguyên nhân có phác đồ xử trí khác nhau.

## Điều trị và phục hồi thăng bằng

Đa số rối loạn tiền đình cải thiện tốt với điều trị đúng nguyên nhân kết hợp tập phục hồi. Bạn nên:
- Thực hiện các bài tập định vị do bác sĩ hướng dẫn đối với BPPV, thường có hiệu quả sau 1 đến 3 buổi.
- Dùng thuốc chống chóng mặt đúng toa trong giai đoạn cấp, không lạm dụng lâu vì cản trở quá trình bù trừ.
- Tập phục hồi thăng bằng: đứng nhắm mắt cạnh điểm tựa, đi trên đường thẳng, tập xoay đầu chậm rãi tiến dần.
- Đổi tư thế chậm, nằm đầu cao khi ngủ, tránh cúi gập đầu đột ngột và lái xe trong giai đoạn đang có cơn.
- Ngủ đủ, uống đủ nước, hạn chế rượu bia và muối cao với bệnh Meniere; tái khám đúng hẹn để đánh giá bù trừ.

Rối loạn tiền đình thường lành tính và cải thiện rõ sau vài tuần tập luyện đúng cách, nhưng cần được bác sĩ loại trừ nguyên nhân nguy hiểm ngay từ lần khám đầu.

## Sống an toàn trong giai đoạn đang có cơn chóng mặt

Trong thời gian còn chóng mặt, bạn nên hạn chế lái xe, làm việc trên cao, vận hành máy móc và bơi lội một mình để tránh tai nạn do mất thăng bằng bất ngờ. Tại nhà, giữ hành lang sáng đèn, dọn bớt thảm trơn, lắp tay vịn trong phòng tắm và mang giày đế bám giúp giảm té ngã. Khi cơn chóng đến, hãy ngồi hoặc nằm xuống ngay, nhìn cố định một điểm và hít thở chậm cho đến khi cơn qua. Người cao tuổi sống một mình nên báo trước cho người thân khi các cơn tăng tần suất, và luôn mang theo điện thoại để gọi hỗ trợ khi cần.

Nội dung này chỉ mang tính giáo dục sức khỏe, không thay thế thăm khám và chỉ định điều trị của bác sĩ.$body$,
        18,
        'NEUROLOGY',
        'BS.CKII Lâm Chí Cường',
        6,
        'than-kinh',
        '/media/articles/than-kinh-dot-quy.jpg',
        '["tiền đình", "chóng mặt", "BPPV", "thần kinh"]',
        '["rối loạn tiền đình", "thần kinh"]',
        '["Chóng mặt xoay tròn theo vị trí đầu là đặc trưng của BPPV, đáp ứng tốt tập định vị", "Thuốc chống chóng mặt chỉ dùng ngắn hạn trong giai đoạn cấp", "Chóng mặt kèm nói khó, yếu chi, nhìn đôi phải cấp cứu ngay"]',
        '["Chóng mặt kèm nói líu lưỡi, nhìn đôi hoặc yếu liệt tay chân", "Đau đầu dữ dội khác thường kèm chóng mặt", "Ngất hoặc mất ý thức trong cơn chóng mặt"]',
        '["Đổi tư thế đầu chậm rãi, ngủ đầu cao nhẹ", "Tập phục hồi thăng bằng đều đặn theo hướng dẫn", "Ngủ đủ, uống đủ nước, hạn chế rượu bia"]',
        'Chóng mặt xuất hiện lần đầu dữ dội, kèm dấu hiệu thần kinh như nói khó, nhìn đôi, yếu chi, hoặc ù tai kèm giảm nghe một bên cần được thăm khám chuyên khoa trong ngày.',
        '["Hướng dẫn chẩn đoán và điều trị rối loạn tiền đình - Hội Thần kinh học Việt Nam", "Bárány Society: diagnostic criteria for vestibular disorders"]',
        'Nội dung chỉ nhằm giáo dục sức khỏe, không thay thế chẩn đoán, chỉ định điều trị hoặc tư vấn trực tiếp của bác sĩ.'
    ),
    (
        '92000000-0000-0000-0002-000000000010',
        'Sỏi thận: đau quặn thận, uống nước đúng cách và phòng tái phát',
        'soi-than-dau-quan-than-va-phong-tai-phat',
        'Sỏi thận gây đau quặn dữ dội khi sỏi di chuyển, tái phát cao nếu không điều chỉnh thói quen uống nước và ăn uống. Bài viết trình bày dấu hiệu, chẩn đoán hình ảnh và chiến lược phòng sỏi trở lại.',
        $body$Sỏi thận hình thành khi các khoáng chất trong nước tiểu kết tinh thành sỏi do nước tiểu cô đặc hoặc có nồng độ canxi, axit uric, oxalat tăng cao. Bệnh gặp ở cả nam và nữ, tái phát cao, khoảng một nửa số người từng có sỏi sẽ hình thành sỏi mới trong vòng 5 đến 10 năm nếu không thay đổi lối sống.

## Dấu hiệu thường gặp

Triệu chứng chỉ xuất hiện khi sỏi di chuyển xuống niệu quản hoặc gây tắc nghẽn. Biểu hiện gồm:
- Đau quặn từng cột từ hông lưng lan xuống bụng dưới và bẹn, người bệnh không tìm được tư thế giảm đau.
- Đái buốt, tiểu ra máu hoặc nước tiểu đục, tiểu ít đột ngột khi sỏi chặn cổ bàng quang.
- Buồn nôn nôn kèm cơn đau, chướng bụng.
- Sốt ớn lạnh khi kèm nhiễm trùng đường tiết niệu, đây là dấu hiệu cần cấp cứu.

Một số sỏi nhỏ không triệu chứng được phát hiện tình cờ khi siêu âm khám sức khỏe và vẫn cần theo dõi vì có thể lớn dần hoặc di chuyển bất kỳ lúc nào.

## Nguyên nhân và chẩn đoán

Các yếu tố thuận lợi gồm uống ít nước làm nước tiểu cô đặc, khẩu phần mặn và nhiều đạm động vật, tiền sử gia đình có sỏi, béo phì và một số bệnh như tăng axit uric, cường cận giáp. Nghề nghiệp ra mồ hôi nhiều mà bù nước không đủ làm tăng rõ nguy cơ. Chẩn đoán dựa trên siêu âm hệ tiết niệu là bước đầu, CT bụng không thuốc cản quang cho độ chính xác cao nhất khi cần quyết định can thiệp, kèm xét nghiệm nước tiểu và máu đánh giá nhiễm trùng, chức năng thận và chuyển hóa.

## Điều trị và phòng sỏi tái phát

Hướng điều trị tùy kích thước và vị trí sỏi: sỏi nhỏ có thể theo dõi và hỗ trợ tống xuất, sỏi trung bình áp dụng tán sỏi ngoài cơ thể hoặc nội soi tán sỏi qua da và qua niệu quản, sỏi lớn hình san hô thường cần phẫu thuật nội soi qua da. Dù chọn phương án nào, phòng tái phát luôn là phần bắt buộc:
- Uống đủ nước để đạt nước tiểu 2 đến 2.5 lít mỗi ngày, chia đều cả ngày, màu nước tiểu nhạt vàng.
- Giảm muối ăn dưới 5 gam mỗi ngày, hạn chế đạm động vật và nội tạng động vật.
- Không hạn chế canxi ăn uống một cách mù quáng theo khuyến cáo mới; nên duy trì sản phẩm sữa vừa đủ cùng bữa ăn, chỉ hạn chế thực phẩm giàu oxalat nếu bác sĩ đánh giá sỏi oxalat.
- Hạn chế nước ngọt có gas và đồ uống nhiều fructose.
- Tái khám siêu âm theo lịch và làm xét nghiệm phân tích thành phần sỏi nếu đã tống sỏi để cá thể hóa khuyến cáo.

Sỏi thận phòng được tái phát nhờ thói quen uống nước và khẩu phần đúng, kết hợp theo dõi định kỳ giúp phát hiện sỏi mới khi còn nhỏ dễ xử lý.

## Những hiểu lầm thường gặp về sỏi thận

Nhiều người nghĩ hạn chế canxi hoàn toàn sẽ phòng sỏi, nhưng canxi ăn uống vừa đủ cùng bữa ăn thực tế giúp gắn oxalat trong ruột và giảm nguy cơ sỏi; chỉ bổ sung canxi liều cao lúc đói mới cần thận trọng. Uống nước chanh không đường hỗ trợ tăng citrat niệu có lợi, nhưng không thay thế việc uống đủ nước lọc hằng ngày. Sỏi nhỏ không triệu chứng vẫn cần siêu âm theo lịch vì có thể lớn dần hoặc di chuyển gây đau quặn bất kỳ lúc nào. Khi đã tống sỏi hoặc mổ lấy sỏi, giữ lại viên sỏi để phân tích thành phần giúp bác sĩ cá thể hóa khuyến cáo phòng tái phát cho bạn.

Nội dung này chỉ mang tính giáo dục sức khỏe, không thay thế thăm khám và chỉ định điều trị của bác sĩ.$body$,
        22,
        'NEPHROLOGY',
        'BS.CKII Đỗ Minh Quân',
        6,
        'tiet-nieu',
        '/media/articles/nam-khoa-tiet-nieu.jpg',
        '["sỏi thận", "đau quặn thận", "tiết niệu", "phòng sỏi"]',
        '["sỏi thận", "thận - tiết niệu"]',
        '["Uống đủ nước để nước tiểu đạt 2-2.5 lít/ngày là biện pháp phòng sỏi quan trọng nhất", "Sốt kèm đau quặn thận là dấu hiệu nhiễm trùng cần cấp cứu", "Giảm muối và đạm động vật giúp giảm nguy cơ hình thành sỏi mới"]',
        '["Sốt cao ớn lạnh kèm đau quặn thận", "Không tiểu được dù có cảm giác buồn tiểu rõ", "Đau dữ dội kéo dài không giảm kèm nôn liên tục"]',
        '["Uống nước đều cả ngày, duy trì nước tiểu vàng nhạt", "Giảm muối, hạn chế đạm động vật và nước ngọt", "Tái khám siêu âm định kỳ sau khi đã điều trị sỏi"]',
        'Đau quặn thận kèm sốt, ớn lạnh, không tiểu được hoặc nôn liên tục không giữ được nước, cần đến cơ sở y tế ngay trong ngày.',
        '["Hướng dẫn chẩn đoán và điều trị sỏi tiết niệu - Bộ Y tế Việt Nam", "EAU Guidelines on Urolithiasis"]',
        'Nội dung chỉ nhằm giáo dục sức khỏe, không thay thế chẩn đoán, chỉ định điều trị hoặc tư vấn trực tiếp của bác sĩ.'
    ),
    (
        '92000000-0000-0000-0002-000000000011',
        'Viêm khớp gối: thoái hóa khớp và tập luyện đúng cho đầu gối khỏe',
        'viem-khop-goi-thoai-hoa-va-tap-luyen-dung',
        'Đau khớp gối khi lên xuống cầu thang, cứng khớp buổi sáng và sưng sau vận động là dấu hiệu thường gặp của viêm thoái hóa khớp gối. Bài viết trình bày các mức độ bệnh và tập luyện giúp bảo vệ sụn khớp.',
        $body$Viêm khớp gối trong dân gian thường dùng để chỉ thoái hóa khớp gối, bệnh lý thoái hóa do tải trọng lặp lại của sụn khớp kèm viêm màng hoạt dịch. Khớp gối chịu tải trọng gấp nhiều lần cân nặng khi lên xuống cầu thang, vì vậy thoái hóa tiến triển nhanh hơn nếu vận động sai và thừa cân.

## Dấu hiệu thường gặp

Triệu chứng tiến triển từ từ theo năm tháng và nặng lên theo mức độ thoái hóa. Bạn có thể nhận biết qua:
- Đau khớp gối khi vận động nhiều, đặc biệt lên xuống cầu thang, đứng ngồi lâu.
- Cứng khớp buổi sáng hoặc sau ngồi lâu, giảm trong vài đến 15 phút khi vận động nhẹ.
- Sưng khớp, cảm giác nóng nhẹ sau đi bộ dài.
- Tiếng lục cục trong khớp khi gấp duỗi, cảm giác khớp yếu, dễ khuỵu.
- Về giai đoạn nặng, biến dạng khớp chân vòng kiềng hoặc chéo gối và hạn chế gấp duỗi rõ.

Đau khớp gối kèm sưng nóng đỏ dữ dội, sốt hoặc chấn thương trước đó cần được khám sớm để loại trừ viêm khớp do viêm nhiễm, gout hoặc tổn thương sụn chêm và dây chằng.

## Nguyên nhân và yếu tố nguy cơ

Thoái hóa khớp gối nguyên phát liên quan tuổi tác và tải trọng lặp lại, thứ phát có thể sau chấn thương, viêm khớp hoặc dị dạng chi. Các yếu tố tăng nguy cơ gồm:
- Thừa cân béo phì, mỗi kg thừa cân tăng tải trọng lên gối nhiều lần khi leo cầu thang.
- Nghề nghiệp quỳ gối, squat nhiều hoặc khuân vác nặng thường xuyên.
- Tiền sử chấn thương dây chằng chéo, sụn chêm hoặc gãy xương quanh khớp gối.
- Ít vận động làm cơ đùi yếu, mất khả năng giảm xóc cho khớp.

Chẩn đoán chủ yếu bằng lâm sàng kết hợp X-quang đứng thẳng đánh giá khe khớp, MRI chỉ định khi nghi ngờ tổn thương sụn chêm, dây chằng hoặc hoại tử.

## Điều trị và tập luyện bảo vệ khớp

Điều trị bảo tồn là nền tảng cho đa số giai đoạn: giảm cân nếu thừa cân, thuốc giảm đau chống viêm ngắn ngày theo toa, vật lý trị liệu và tiêm nội khớp khi bác sĩ chỉ định. Phẫu thuật thay khớp dành cho giai đoạn nặng đau kéo dài ảnh hưởng sinh hoạt. Các thói quen giúp bảo vệ khớp gối gồm:
- Tăng cường cơ đùi trước với bài tập đạp xe tại chỗ không kháng lực, nhấc chân thẳng khi nằm, squat nông đúng kỹ thuật dưới hướng dẫn chuyên môn.
- Ưu tiên vận động ít tác động như bơi, đi bộ nền nhựa, đạp xe thay vì chạy downhill hoặc nhảy trên nền cứng khi đau khớp.
- Giảm cân bền vững nếu thừa cân, đây là can thiệp có tác động rõ nhất đến mức độ đau.
- Dùng gậy hỗ trợ khi đau nhiều một bên, mang giày đế êm vừa chân.
- Tránh quỳ gối, ngồi xổm sâu và leo trèo cầu thang nhiều tầng trong giai đoạn đau cấp.

Thoái hóa khớp gối không thể đảo ngược nhưng hoàn toàn kiểm soát được mức độ đau và chức năng khi kết hợp tập luyện đúng và kiểm soát tải trọng.

## Các lựa chọn can thiệp khi điều trị bảo tồn không đủ

Khi thuốc và tập luyện không kiểm soát được đau, bác sĩ có thể đề nghị tiêm nội khớp corticoid để giảm viêm ngắn hạn, tiêm acid hyaluronic nhằm bôi trơn khớp, hoặc các chương trình phục hồi chức năng chuyên sâu. Tiêm corticoid không nên lặp lại quá thường xuyên trong một năm vì có thể đẩy nhanh thoái hóa sụn. Với khớp gối thoái hóa độ nặng, biến dạng rõ, đau kéo dài ảnh hưởng giấc ngủ và di chuyển, phẫu thuật thay khớp gối nhân tạo cho kết quả tốt về giảm đau và phục hồi khả năng đi lại. Quyết định can thiệp dựa trên mức độ thoái hóa trên phim và hạn chế chức năng thực tế chứ không chỉ theo tuổi.

Nội dung này chỉ mang tính giáo dục sức khỏe, không thay thế thăm khám và chỉ định điều trị của bác sĩ.$body$,
        26,
        'MUSCULOSKELETAL',
        'BS.CKI Ngô Mai Anh',
        7,
        'co-xuong-khop',
        '/media/articles/co-xuong-khop.jpg',
        '["viêm khớp gối", "thoái hóa khớp", "vật lý trị liệu", "cơ đùi"]',
        '["viêm khớp gối", "cơ xương khớp"]',
        '["Giảm cân và tăng cường cơ đùi là hai can thiệp hiệu quả nhất với thoái hóa khớp gối", "Vận động đúng giúp nuôi dưỡng sụn khớp, nghỉ hoàn toàn làm bệnh nặng thêm", "Sưng nóng đỏ kèm sốt cần khám sớm để loại trừ viêm khớp nhiễm trùng"]',
        '["Khớp gối sưng nóng đỏ dữ dội kèm sốt", "Không duỗi hoặc gập được khớp sau chấn thương", "Đau đột ngột dữ dội kèm cảm giác khớp trật không trở lại được"]',
        '["Duy trì cân nặng hợp lý và tập cơ đùi đều đặn", "Chọn vận động ít tác động như bơi, đạp xe", "Hạn chế quỳ gối, ngồi xổm sâu và vác nặng khi có đau khớp"]',
        'Đau khớp gối kéo dài quá 2 tuần, sưng tái đi tái lại, kẹt khớp hoặc không leo cầu thang được, cần được bác sĩ cơ xương khớp thăm khám.',
        '["Hướng dẫn chẩn đoán và điều trị thoái hóa khớp - Bộ Y tế Việt Nam", "OARSI Guidelines for the non-surgical management of knee osteoarthritis"]',
        'Nội dung chỉ nhằm giáo dục sức khỏe, không thay thế chẩn đoán, chỉ định điều trị hoặc tư vấn trực tiếp của bác sĩ.'
    ),
    (
        '92000000-0000-0000-0002-000000000012',
        'Thiếu máu thiếu sắt: nhợt nhạt, mệt mỏi và tầm soát đúng cách',
        'thieu-mau-thieu-sat-dau-hieu-va-tam-soat',
        'Mệt mỏi kéo dài, da nhợt và hoa mắt khi đứng dậy có thể là thiếu máu thiếu sắt, nguyên nhân thiếu máu phổ biến nhất. Bài viết giúp bạn nhận biết, hiểu các nguyên nhân phải tìm và cách bổ sung sắt đúng.',
        $body$Thiếu máu là tình trạng khối lượng hồng cầu hoặc hemoglobin giảm dưới mức bình thường, làm giảm khả năng vận chuyển oxy của máu. Thiếu máu thiếu sắt chiếm đa số các trường hợp, đặc biệt ở phụ nữ trong độ tuổi sinh sản, trẻ em và người ăn kiêng thiếu cân bằng, nhưng nguyên nhân mất máu mạn tính ở người trưởng thành luôn cần được tìm rõ.

## Dấu hiệu thường gặp

Thiếu máu nhẹ có thể không triệu chứng, chỉ phát hiện qua xét nghiệm định kỳ. Khi mức hemoglobin giảm rõ, các biểu hiện gồm:
- Mệt mỏi kéo dài, giảm sức bền khi gắng sức, hụt hơi khi leo cầu thang.
- Da niêm mạc nhợt nhạt: nhìn lòng bàn tay, niêm mạc mắt và môi dưới dễ nhận ra nhất.
- Hoa mắt chóng mặt khi đứng dậy nhanh, tim đập nhanh nhẹ.
- Đau đầu, giảm tập trung, ngủ không sâu.
- Lưỡi nhẵn đau, giòn gãy móng, thèm ăn vật lạ như đất đá ở thiếu sắt kéo dài.

Thiếu máu nặng hoặc tiến triển nhanh gây khó thở khi nghỉ, đau ngực và phù chân, cần được đánh giá y khoa ngay.

## Nguyên nhân cần được tìm rõ

Thiếu sắt chỉ là hậu quả; tìm nguyên nhân mới là điều trị đúng. Các nhóm nguyên nhân gồm:
- Mất máu mạn tính: rong kinh đa kinh ở phụ nữ, loét dạ dày tá tràng, trĩ chảy máu, polyp hoặc tổn thương đại tràng, đặc biệt ở nam giới và phụ nữ sau mãn kinh, thiếu máu không giải thích được cần nội soi tiêu hóa.
- Thiếu hụt nạp: chế độ ăn ít thực phẩm giàu sắt, ăn chay thiếu cân bằng, kiêng khem kéo dài.
- Suy giảm hấp thu: bệnh celiac, viêm dạ dày mạn teo niêm mạc, sau phẫu thuật dạ dày.
- Tăng nhu cầu: mang thai và cho con bú, giai đoạn dậy thì tăng trưởng nhanh.

Chẩn đoán dựa trên tổng phân tích tế bào máu cùng men sắt, ferritin và khả năng vận chuyển sắt; bác sĩ sẽ chỉ định thêm nội soi tiêu hóa khi nghi ngờ mất máu đường tiêu hóa.

## Điều trị và bổ sung sắt đúng cách

Điều trị gồm bổ sung sắt theo toa kết hợp xử lý nguyên nhân, thời gian thường kéo dài vài tháng sau khi huyết học trở về bình thường để bù đầy kho sắt. Để hấp thu sắt tốt hơn:
- Uống viên sắt lúc bụng đói với nước chanh hoặc nước cam giàu vitamin C nếu dạ dày chịu được.
- Tránh uống sắt cùng trà, cà phê, sữa và thuốc kháng axit vì làm giảm hấp thu.
- Tăng thực phẩm giàu sắt như thịt đỏ nạc, gan, huyết, đậu đỗ, rau xanh đậm kết hợp trái cây giàu vitamin C cùng bữa.
- Tái khám xét nghiệm theo lịch để đánh giá đáp ứng và tìm nguyên nhân nếu huyết sắc tố không tăng như kỳ vọng; tự ý dùng sắt liều cao kéo dài có thể gây quá tải sắt và che giấu nguyên nhân mất máu chưa được phát hiện.

Thiếu máu thiếu sắt điều trị được hiệu quả khi tìm đúng nguyên nhân và bổ sung đủ thời gian, giúp phục hồi thể lực và tập trung rõ rệt.

## Thiếu máu ở phụ nữ mang thai và trẻ em

Phụ nữ mang thai cần lượng sắt tăng gần gấp đôi để tạo máu cho thai nhi, vì vậy khám thai định kỳ luôn có xét nghiệm huyết sắc tố và thường được bổ sung sắt cùng acid folic theo hướng dẫn sản khoa. Thiếu máu khi mang thai làm tăng nguy cơ đẻ non, suy dinh dưỡng thai trong tử cung và mất máu sau sinh khó chống lại. Ở trẻ em, thiếu sắt kéo dài ảnh hưởng phát triển vận động và nhận thức, vì vậy bú mẹ hoàn toàn trong 6 tháng đầu, chọn thực phẩm ăn dặm giàu sắt và khám sức khỏe định kỳ là các bước quan trọng. Không tự cho trẻ uống viên sắt liều người lớn.

Nội dung này chỉ mang tính giáo dục sức khỏe, không thay thế thăm khám và chỉ định điều trị của bác sĩ.$body$,
        15,
        'GENERAL',
        'BS.CKI Vũ Thanh Hằng',
        6,
        'huyet-hoc',
        '/media/articles/xet-nghiem-huyet-hoc.jpg',
        '["thiếu máu", "thiếu sắt", "ferritin", "huyết học"]',
        '["thiếu máu", "huyết học"]',
        '["Thiếu máu ở nam giới và phụ nữ sau mãn kinh luôn cần tìm nguyên nhân mất máu", "Uống sắt với vitamin C, tránh uống cùng trà cà phê và sữa", "Bổ sung sắt cần đủ thời gian sau khi huyết sắc tố về bình thường"]',
        '["Khó thở khi nghỉ ngơi hoặc đau ngực", "Hoa mắt choáng kèm tim đập nhanh liên tục", "Đi ngoài phân đen hoặc máu, rong kinh kéo dài quá 7 ngày"]',
        '["Khám sức khỏe định kỳ gồm công thức máu hằng năm", "Bổ sung thực phẩm giàu sắt kèm vitamin C trong khẩu phần", "Điều trị triệt để nguyên nhân mất máu như rong kinh hoặc trĩ"]',
        'Thiếu máu nặng gây khó thở, đau ngực, choáng lả, hoặc phát hiện thiếu máu không giải thích được ở nam giới và phụ nữ sau mãn kinh, cần được đánh giá y khoa sớm.',
        '["Hướng dẫn chẩn đoán và điều trị thiếu máu thiếu sắt - Bộ Y tế Việt Nam", "WHO Guideline on use of ferritin concentrations to assess iron status"]',
        'Nội dung chỉ nhằm giáo dục sức khỏe, không thay thế chẩn đoán, chỉ định điều trị hoặc tư vấn trực tiếp của bác sĩ.'
    ),
    (
        '92000000-0000-0000-0002-000000000013',
        'Bệnh trĩ: ngại đi khám là làm chậm điều trị',
        'benh-tri-dau-hieu-va-dieu-tri-dung-cach',
        'Ra máu sau đi cầu, búi trĩ sa khi rặn và cảm giác đi cầu chưa hết là triệu chứng trĩ thường gặp. Bài viết giúp bạn phân biệt các độ trĩ, điều chỉnh chế độ ăn chất xơ và biết khi nào cần nội soi loại trừ bệnh nặng hơn.',
        $body$Bệnh trĩ là tình trạng giãn phồng đường tĩnh mạch ở hậu môn trực tràng cùng với thay đổi mô đệm, tạo thành búi trĩ. Trĩ rất phổ biến và không nguy hiểm tính mạng trong đa số trường hợp, nhưng triệu chứng ra máu hậu môn dễ nhầm với polyp hoặc ung thư đại trực tràng, vì vậy chẩn đoán phân biệt bởi bác sĩ luôn cần thiết thay vì tự chẩn đoán.

## Dấu hiệu thường gặp

Trĩ nội phân độ từ 1 đến 4 theo mức độ sa búi trĩ, trĩ ngoại thường gây búi đau và cứng khi tắc mạch. Biểu hiện gồm:
- Ra máu đỏ tươi sau đi cầu, nhỏ giọt hoặc dính vào giấy, không trộn lẫn vào phân.
- Búi mềm sa ra ngoài khi rặn, có thể tự co vào hoặc phải dùng tay đẩy về.
- Ngứa rát hậu môn, ẩm ướt, cảm giác không đi cầu hết.
- Đau rõ khi tắc mạch trĩ ngoại hoặc búi trĩ sa bị nghẹt, đây là tình trạng cần xử trí sớm.

Ra máu kèm thay đổi thói quen đi cầu, phân dạng bút chì, sụt cân hoặc tuổi trên 40 có triệu chứng mới, cần nội soi đại tràng để loại trừ tổn thương trong lòng ruột thay vì chỉ điều trị trĩ theo kinh nghiệm.

## Nguyên nhân và yếu tố nguy cơ

Áp lực tăng kéo dài ở hệ tĩnh mạch hậu môn là cơ chế trung tâm. Các yếu tố gồm:
- Táo bón mạn tính, rặn mạnh, ngồi toilet đọc điện thoại lâu.
- Chế độ ăn ít chất xơ, uống ít nước làm phân khô cứng.
- Mang thai và sau sinh do tăng áp lực bụng cùng tĩnh mạch.
- Ngồi nhiều liên tục, béo phì, tiêu chảy mạn tính và rượu bia.

Chẩn đoán bằng thăm khám hậu môn trực tràng và soi hậu môn tại phòng khám; đa số trường hợp không cần thủ thuật xâm lấn để xác định.

## Điều trị và chăm sóc hằng ngày

Điều trị luôn bắt đầu từ điều chỉnh thói quen đi cầu và khẩu phần, thuốc hỗ trợ và thủ thuật cắt trĩ chỉ dùng khi cần theo độ bệnh. Bạn nên:
- Bổ sung chất xơ 25 đến 30 gam mỗi ngày từ rau, trái cây, ngũ cốc nguyên hạt và uống đủ 1.5 đến 2 lít nước.
- Đi cầu theo giờ cố định, không rặn, không ngồi toilet quá 5 đến 10 phút, bỏ thói quen đọc điện thoại trong toilet.
- Ngâm vùng hậu môn nước ấm 10 đến 15 phút sau đi cầu giúp giảm co thắt và đau.
- Vận động hằng ngày, tránh ngồi liên tục quá một giờ, hạn chế rượu bia và cay nóng trong giai đoạn đang ra máu.
- Với trĩ độ cao hoặc nghẹt, bác sĩ có thể chỉ định thắt búi trĩ bằng cao su, tiêm xơ hoặc phẫu thuật theo đánh giá chuyên khoa.

Trĩ kiểm soát tốt khi thay đổi thói quen kiên trì, nhưng bất kỳ trường hợp ra máu hậu môn nào cũng nên được bác sĩ khám ít nhất một lần để bảo đảm không bỏ sót bệnh nặng hơn.

## Trĩ trong thai kỳ và sau sinh

Mang thai làm tăng áp lực tĩnh mạch chậu cùng táo bón nội tiết, vì vậy trĩ thường xuất hiện hoặc nặng lên trong ba tháng cuối và sau sinh. Trong giai đoạn này, điều trị ưu tiên an toàn gồm tăng chất xơ, uống đủ nước, ngâm vùng hậu môn nước ấm và tránh đứng lâu; thuốc và thủ thuật chỉ thực hiện khi bác sĩ đánh giá cân nhắc lợi hại cho mẹ và bé. Đa số trĩ thai kỳ giảm rõ sau sinh khi áp lực tĩnh mạch trở về bình thường. Phụ nữ có trĩ trước khi mang thai nên trao đổi với bác sĩ sản khoa từ sớm để được hướng dẫn phòng nặng lên thay vì chịu đựng đến khi sinh xong.

Nội dung này chỉ mang tính giáo dục sức khỏe, không thay thế thăm khám và chỉ định điều trị của bác sĩ.$body$,
        19,
        'GASTROENTEROLOGY',
        'BS.CKII Cao Trí Dũng',
        6,
        'tieu-hoa',
        '/media/articles/dinh-duong-lanh-manh.jpg',
        '["bệnh trĩ", "ra máu hậu môn", "táo bón", "chất xơ"]',
        '["bệnh trĩ", "tiêu hóa"]',
        '["Ra máu hậu môn cần được bác sĩ khám ít nhất một lần để loại trừ bệnh đại tràng", "Chất xơ đủ 25-30 gam/ngày cùng uống đủ nước là nền tảng điều trị trĩ", "Không ngồi toilet quá 10 phút và bỏ thói quen đọc điện thoại khi đi cầu"]',
        '["Ra máu nhiều liên tục hoặc máu trộn lẫn vào trong phân", "Đau hậu môn dữ dội kèm búi cứng sưng, dấu hiệu nghẹt trĩ", "Sụt cân không rõ nguyên nhân kèm thay đổi thói quen đi cầu"]',
        '["Ăn đủ chất xơ và uống 1.5-2 lít nước mỗi ngày", "Đi cầu đúng giờ, không rặn và không ngồi toilet quá lâu", "Vận động hằng ngày, tránh ngồi liên tục và rượu bia"]',
        'Ra máu hậu môn lần đầu, ra máu nhiều, đau dữ dội vùng hậu môn hoặc triệu chứng kèm sụt cân và thay đổi đi cầu, cần được khám chuyên khoa tiêu hóa trong ngày.',
        '["Hướng dẫn chẩn đoán và điều trị bệnh trĩ - Bộ Y tế Việt Nam", "ASCRS Clinical Practice Guidelines for the Treatment of Hemorrhoids"]',
        'Nội dung chỉ nhằm giáo dục sức khỏe, không thay thế chẩn đoán, chỉ định điều trị hoặc tư vấn trực tiếp của bác sĩ.'
    ),
    (
        '92000000-0000-0000-0002-000000000014',
        'Đau dạ dày liên quan stress: khi tinh thần tác động lên dạ dày',
        'dau-da-day-lien-quan-stress-hieu-dung-de-dieu-tri',
        'Đau thượng vị tăng khi áp lực công việc, không tìm thấy loét trên nội soi là mẫu bệnh lý thường gặp liên quan stress. Bài viết giải thích cơ chế trục não-dạ dày, cách phân biệt với viêm loét thật và quản lý triệu chứng.',
        $body$Nhiều người bị đau nóng thượng vị, đầy hơi và chậm tiêu kéo dài nhưng nội soi không phát hiện loét hay tổn thương nặng, các bác sĩ gọi đây là chứng khó tiêu chức năng có yếu tố stress. Trục não - đường tiêu hóa kết nối hệ thần kinh với dạ dày, khiến căng thẳng kéo dài làm tăng tiết axit, rối loạn vận động và giảm ngưỡng chịu đau của dạ dày.

## Triệu chứng thường gặp

Đau dạ dày liên quan stress có nét đặc trưng theo nhịp sinh hoạt và áp lực tâm lý. Biểu hiện gồm:
- Đau nóng âm ỉ thượng vị tăng vào các giai đoạn áp lực công việc dồn dập, thi cử, mâu thuẫn gia đình.
- Đầy chướng, ợ hơi, nhanh no dù ăn lượng nhỏ.
- Buồn nôn nhẹ, ăn không ngon, sụt nhẹ cảm giác thèm ăn.
- Triệu chứng xen kẽ với giấc ngủ kém, mệt mỏi, lo âu hoặc trầm cảm nhẹ kèm theo.

Điểm phân biệt quan trọng: các dấu hiệu cảnh báo như nôn ra máu, phân đen, sụt cân nhanh, khó nuốt hoặc thiếu máu phải được nội soi loại trừ bệnh thực thể trước khi gán triệu chứng cho stress.

## Cơ chế và nguyên nhân

Stress kích hoạt trục hạ đồi - tuyến yên - thượng thận làm tăng cortisol và tăng tiết axit dạ dày, đồng thời rối loạn điều hòa vận động khiến dạ dày co bóp kém nhịp. Các yếu tố cộng hưởng gồm:
- Ăn không đúng giờ, bỏ bữa hoặc ăn nhanh trong lúc gấp gáp.
- Cà phê, trà đậm, rượu bia và thuốc lá dùng nhiều khi áp lực cao.
- Ngủ thiếu và làm việc đêm kéo dài.
- Tiền sử viêm dạ dày Hp cũ chưa được diệt trừ triệt để.

Vì vậy, đánh giá chuyên khoa tiêu hóa vẫn cần thiết để xem xét test Hp và nội soi khi phù hợp, tránh tự kết luận triệu chứng do stress mà bỏ sót bệnh lý cần điều trị.

## Quản lý triệu chứng và phục hồi

Điều trị hiệu quả nhất kết hợp hỗ trợ tiêu hóa ngắn hạn theo toa với quản lý stress bền vững. Bạn nên:
- Ăn đúng giờ, chia nhỏ bữa, nhai chậm, tránh làm việc ngay trong và ngay sau bữa ăn.
- Giảm cà phê sau giờ chiều, hạn chế rượu bia và bỏ thuốc lá trong giai đoạn triệu chứng rõ.
- Duy trì vận động nhẹ nhàng hằng ngày như đi bộ sau bữa tối, giúp điều hòa vận động đường tiêu hóa.
- Chăm sóc giấc ngủ: ngủ đủ 7 đến 8 giờ, hạn chế màn hình trước ngủ, giữ giờ ngủ cố định.
- Áp dụng kỹ thuật thư giãn như hít thở sâu, thiền ngắn hoặc yoga dưới hướng dẫn; tìm tư vấn tâm lý khi stress, lo âu kéo dài ảnh hưởng sinh hoạt.
- Dùng thuốc ức chế axit hoặc điều hòa vận động theo toa trong đợt triệu chứng rõ, tái khám để điều chỉnh thay vì tự dùng kéo dài.

Đau dạ dày liên quan stress cải thiện tốt khi bạn đồng thời chăm sóc dạ dày và tinh thần, không phải lựa chọn một trong hai.

## Khi nào nên tham vấn tâm lý

Nếu triệu chứng dạ dày đi kèm lo âu kéo dài, mất ngủ thường xuyên, mất hứng thú với việc từng thích, hoặc bạn thấy mình dùng thức ăn, rượu bia để xả stress, việc gặp chuyên gia tâm lý là một phần điều trị chính đáng chứ không phải dấu hiệu yếu đuối. Liệu pháp nhận thức hành vi đã được chứng minh giúp giảm triệu chứng khó tiêu chức năng bằng cách điều chỉnh mối liên hệ giữa suy nghĩ căng thẳng và phản ứng của đường tiêu hóa. Bạn có thể bắt đầu từ chuyên khoa tâm lý bệnh viện hoặc tư vấn từ xa; các buổi trao đổi đều được bảo mật như mọi dịch vụ y tế khác.

Nội dung này chỉ mang tính giáo dục sức khỏe, không thay thế thăm khám và chỉ định điều trị của bác sĩ.$body$,
        21,
        'GASTROENTEROLOGY',
        'BS.CKI Phan Yến Nhi',
        6,
        'tieu-hoa',
        '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
        '["đau dạ dày", "stress", "khó tiêu chức năng", "trục não-dạ dày"]',
        '["viêm dạ dày", "tiêu hóa"]',
        '["Khó tiêu chức năng có nội soi bình thường nhưng triệu chứng thật và cần được chăm sóc", "Dấu hiệu cảnh báo như phân đen, sụt cân, khó nuốt phải nội soi loại trừ trước", "Ngủ đủ và ăn đúng giờ cải thiện triệu chứng rõ rệt cùng điều trị thuốc"]',
        '["Nôn ra máu hoặc đi ngoài phân đen", "Sụt cân nhanh không chủ ý", "Khó nuốt tiến triển hoặc đau dữ dội mới xuất hiện sau tuổi 40"]',
        '["Ăn đúng giờ, nhai chậm, không làm việc sát bữa ăn", "Giảm cà phê chiều tối, rượu bia và thuốc lá", "Ngủ đủ giấc và vận động nhẹ hằng ngày"]',
        'Triệu chứng kéo dài quá 2 tuần, xuất hiện dấu hiệu cảnh báo như nôn máu, phân đen, sụt cân, khó nuốt, hoặc lo âu kéo dài ảnh hưởng sinh hoạt, cần được thăm khám chuyên khoa.',
        '["Hướng dẫn quản lý chứng khó tiêu chức năng - Bộ Y tế Việt Nam", "Rome IV Criteria: Functional Dyspepsia"]',
        'Nội dung chỉ nhằm giáo dục sức khỏe, không thay thế chẩn đoán, chỉ định điều trị hoặc tư vấn trực tiếp của bác sĩ.'
    ),
    (
        '92000000-0000-0000-0002-000000000015',
        'Bệnh tim mạch phổ biến: các bệnh lý hàng đầu và tầm soát định kỳ',
        'benh-tim-mach-pho-bien-tam-soat-dinh-ky',
        'Bệnh mạch vành, tăng huyết áp và suy tim là những bệnh tim mạch phổ biến nhất và là nguyên nhân tử vong hàng đầu. Bài viết tổng quan dấu hiệu cảnh báo, yếu tố nguy cơ và khung tầm soát nên thực hiện định kỳ.',
        $body$Hệ tim mạch gồm tim và toàn bộ mạch máu, bệnh lý ở đây thường tiến triển âm thầm nhiều năm qua quá trình xơ vữa động mạch, tăng huyết áp hoặc rối loạn nhịp trước khi biểu hiện biến chứng cấp như nhồi máu cơ tim hay đột quỵ. Nhận biết sớm yếu tố nguy cơ và tầm soát định kỳ là cách hiệu quả nhất giảm nguy cơ.

## Các bệnh lý thường gặp

Nhóm bệnh tim mạch phổ biến nhất gồm các bệnh lý mạn tính thường đi kèm nhau. Ba bệnh nền cần biết:
- Bệnh mạch vành: xơ vữa hẹp động mạch nuôi tim, biểu hiện đau ngực tức khi gắng sức, giảm khi nghỉ; nhồi máu cơ tim cấp xảy ra khi mảng xơ vữa vỡ tắc hoàn toàn.
- Tăng huyết áp: thường không triệu chứng, gây dày thành tim, suy tim và tổn thương thận, não lâu dài nếu không kiểm soát.
- Suy tim: tim bơm máu không đủ cho cơ thể, gây khó thở khi gắng sức, phù chân và mệt mỏi, thường là giai đoạn cuối của các bệnh tim không được kiểm soát.

Bên cạnh đó, rung nhĩ làm tăng nguy cơ hình thành cục máu đông và đột quỵ, bệnh van tim và bệnh động mạch ngoại biên cũng thường gặp ở người cao tuổi.

## Yếu tố nguy cơ và dấu hiệu cảnh báo

Yếu tố nguy cơ chia nhóm có thể thay đổi và không thể thay đổi. Nhóm thay đổi được gồm:
- Tăng huyết áp, đái tháo đường và rối loạn lipid máu không kiểm soát.
- Hút thuốc lá, rượu bia nhiều, béo phì đặc biệt mỡ bụng.
- Ít vận động dưới 150 phút mỗi tuần, stress mạn tính và ngủ dưới 6 giờ.

Dấu hiệu cảnh báo cần được đánh giá sớm gồm đau ngực tức đè khi gắng sức, khó thở bất thường, hồi hộp đánh trống kéo dài, ngất hoặc tiền ngất, phù hai chân cuối ngày kèm mệt mỏi lan tỏa. Đau ngực dữ dội kéo dài quá 15 phút, lan vai hàm, kèm vã mồ hôi và khó thở là dấu hiệu nghi nhồi máu cơ tim, cần gọi 115 ngay tuyệt đối không tự lái xe đến viện.

## Tầm soát định kỳ và lối sống bảo vệ tim

Tầm soát tim mạch nên bắt đầu sớm và duy trì hằng năm từ sau tuổi 40, hoặc sớm hơn nếu có yếu tố nguy cơ. Khung tầm soát cơ bản gồm:
- Đo huyết áp mỗi lần khám sức khỏe, đường huyết đói và lipid máu định kỳ hằng năm.
- Điện tâm đồ và siêu âm tim theo chỉ định của bác sĩ tim mạch tùy triệu chứng và nguy cơ.
- Đánh giá nguy cơ tim mạch 10 năm để cá thể hóa mục tiêu huyết áp, lipid và lối sống.

Để bảo vệ tim mỗi ngày, hãy duy trì chế độ ăn nhiều rau cá hạt, giảm muối dưới 5 gam, vận động aerobic 150 phút mỗi tuần, ngủ đủ giấc, bỏ thuốc lá và kiểm soát tốt huyết áp, đường huyết, mỡ máu theo hướng dẫn. Bệnh tim mạch mạn tính quản lý được tốt nếu phát hiện sớm và tuân thủ điều trị; chìa khóa là khám định kỳ chứ không đợi triệu chứng.

## Đọc hiểu các con số của tim mạch

Mục tiêu huyết áp thông thường dưới 130/80 mmHg với người có nguy cơ tim mạch, đường huyết đói khoảng 4.4 đến 7.0 mmol/L và HbA1c dưới 7 phần trăm tùy cá thể hóa, LDL cholesterol càng thấp càng tốt với người đã có bệnh mạch vành. Vòng bụng nên giữ dưới 90 cm ở nam và 80 cm ở nữ theo khuyến cáo cho người châu Á. Bạn không cần ghi nhớ mọi con số; hãy mang sổ theo dõi huyết áp và kết quả xét nghiệm đến buổi khám định kỳ, bác sĩ tim mạch sẽ giúp bạn hiểu con số nào cần ưu tiên điều chỉnh và kế hoạch đạt mục tiêu trong bao lâu.

Nội dung này chỉ mang tính giáo dục sức khỏe, không thay thế thăm khám và chỉ định điều trị của bác sĩ.$body$,
        11,
        'CARDIOLOGY',
        'BS.CKII Võ Thanh Sơn',
        7,
        'tim-mach',
        '/media/articles/5-dau-hieu-tim-mach.jpg',
        '["tim mạch", "mạch vành", "suy tim", "rung nhĩ", "tầm soát"]',
        '["bệnh tim mạch", "tim mạch"]',
        '["Đau ngực dữ dội quá 15 phút kèm vã mồ hôi cần gọi 115 ngay, không tự lái xe", "Tầm soát huyết áp, đường huyết và lipid máu hằng năm sau tuổi 40", "Vận động 150 phút/tuần và không hút thuốc giảm rõ nguy cơ tim mạch"]',
        '["Đau ngực dữ dội kéo dài quá 15 phút, lan vai hàm kèm vã mồ hôi", "Ngất đột ngột hoặc hồi hộp đánh trống kéo dài", "Khó thở tăng dần kèm phù hai chân về chiều tối"]',
        '["Khám sức khỏe tim mạch hằng năm sau tuổi 40", "Kiểm soát huyết áp, đường huyết và mỡ máu theo chỉ định", "Ăn giảm muối, vận động đều đặn và bỏ thuốc lá"]',
        'Đau ngực khi gắng sức, khó thở bất thường, ngất, hồi hộp kéo dài hoặc phù chân kèm mệt mỏi tiến triển, cần được bác sĩ tim mạch thăm khám trong ngày.',
        '["Hướng dẫn chẩn đoán và điều trị bệnh mạch vành - Hội Tim mạch Việt Nam", "ESC Guidelines for the management of cardiovascular disease in clinical practice"]',
        'Nội dung chỉ nhằm giáo dục sức khỏe, không thay thế chẩn đoán, chỉ định điều trị hoặc tư vấn trực tiếp của bác sĩ.'
    )
) AS v(
    id, title, slug, summary, body, days_ago, category, author_name,
    reading_minutes, related_specialty_slug, cover_image_url, tags, topic_tags,
    takeaways, warnings, prevention, when_to_seek_care, sources, disclaimer
)
CROSS JOIN LATERAL (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object('heading', parts.heading, 'body', parts.section_body)
            ORDER BY parts.ord
        ),
        '[]'::jsonb
    ) AS sections
    FROM (
        SELECT
            sec.ord,
            CASE
                WHEN sec.ord = 1 THEN 'Tổng quan'
                ELSE split_part(sec.chunk, E'\n', 1)
            END AS heading,
            CASE
                WHEN sec.ord = 1 THEN btrim(sec.chunk)
                WHEN position(E'\n' in sec.chunk) = 0 THEN ''
                ELSE btrim(substring(sec.chunk FROM position(E'\n' in sec.chunk) + 1))
            END AS section_body
        FROM unnest(string_to_array(btrim(v.body), E'\n## ')) WITH ORDINALITY AS sec(chunk, ord)
    ) parts
) s
WHERE NOT EXISTS (SELECT 1 FROM articles a WHERE a.slug = v.slug);

-- ---------------------------------------------------------------------------
-- 4. ARTICLE clinical-eligibility chain
--    Snapshot and hash mirror AiClinicalContentRevisionService.articleSnapshot.
-- ---------------------------------------------------------------------------

DO $v92_article_chain$
DECLARE
    v_submitter UUID;
    v_reviewer UUID;
    v_submitted_at TIMESTAMPTZ := CURRENT_TIMESTAMP - INTERVAL '3 days';
    v_decided_at TIMESTAMPTZ := CURRENT_TIMESTAMP - INTERVAL '2 days';
    v_expires_at TIMESTAMPTZ := CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '180 days';
BEGIN
    SELECT u.id INTO v_submitter
    FROM users u
    WHERE u.email = 'admin@healthcare.com' AND u.status = 'ACTIVE'
    LIMIT 1;

    SELECT u.id INTO v_reviewer
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id AND r.code = 'DOCTOR'
    JOIN doctors d ON d.user_id = u.id AND d.active = TRUE
    WHERE u.email = 'doctor@healthcare.com' AND u.status = 'ACTIVE'
    LIMIT 1;

    INSERT INTO ai_content_revisions (
        source_type, source_id, content_revision, content_hash,
        content_snapshot, created_by, created_at
    )
    SELECT
        'ARTICLE',
        a.id,
        1,
        encode(digest(convert_to(jsonb_build_object(
            'active', a.active,
            'author_name', a.author_name,
            'body', a.body,
            'category', a.category,
            'id', a.id::text,
            'reading_minutes', a.reading_minutes,
            'related_specialty_slug', a.related_specialty_slug,
            'published_at', a.published_at,
            'sections', a.sections,
            'slug', a.slug,
            'summary', a.summary,
            'title', a.title
        )::text, 'UTF8'), 'sha256'), 'hex'),
        jsonb_build_object(
            'active', a.active,
            'author_name', a.author_name,
            'body', a.body,
            'category', a.category,
            'id', a.id::text,
            'reading_minutes', a.reading_minutes,
            'related_specialty_slug', a.related_specialty_slug,
            'published_at', a.published_at,
            'sections', a.sections,
            'slug', a.slug,
            'summary', a.summary,
            'title', a.title
        ),
        NULL,
        v_submitted_at - INTERVAL '1 hour'
    FROM articles a
    WHERE a.id >= '92000000-0000-0000-0002-000000000001'::uuid
      AND a.id <= '92000000-0000-0000-0002-000000000015'::uuid
    ON CONFLICT (source_type, source_id, content_revision) DO NOTHING;

    INSERT INTO ai_content_review_heads (
        source_type, source_id, content_revision, content_hash,
        eligibility_revision, eligibility_state, current_approval_round,
        edited_by, submitted_at, approved_at, approval_expires_at
    )
    SELECT
        'ARTICLE', r.source_id, r.content_revision, r.content_hash,
        1, 'APPROVED', 1,
        NULL, v_submitted_at, v_decided_at, v_expires_at
    FROM ai_content_revisions r
    WHERE r.source_type = 'ARTICLE'
      AND r.source_id >= '92000000-0000-0000-0002-000000000001'::uuid
      AND r.source_id <= '92000000-0000-0000-0002-000000000015'::uuid
      AND r.content_revision = 1
    ON CONFLICT (source_type, source_id) DO NOTHING;

    IF v_submitter IS NOT NULL AND v_reviewer IS NOT NULL AND v_submitter <> v_reviewer THEN
        INSERT INTO ai_content_approval_rounds (
            source_type, source_id, content_revision, content_hash,
            approval_round, state, submitted_by, reviewed_by, reviewer_role,
            submitted_at, decided_at, expires_at, reason
        )
        SELECT
            'ARTICLE', r.source_id, r.content_revision, r.content_hash,
            1, 'APPROVED', v_submitter, v_reviewer, 'DOCTOR',
            v_submitted_at, v_decided_at, v_expires_at,
            'Bác sĩ chuyên khoa thẩm định cẩm nang bệnh phổ biến của V92'
        FROM ai_content_revisions r
        WHERE r.source_type = 'ARTICLE'
          AND r.source_id >= '92000000-0000-0000-0002-000000000001'::uuid
          AND r.source_id <= '92000000-0000-0000-0002-000000000015'::uuid
          AND r.content_revision = 1
        ON CONFLICT (source_type, source_id, content_revision, approval_round) DO NOTHING;

        INSERT INTO ai_content_review_events (
            event_id, source_type, source_id, content_revision, content_hash,
            eligibility_revision, approval_round, event_type, actor_id,
            actor_role, correlation_id, reason, metadata, occurred_at
        )
        SELECT
            md5('v92-article-submitted-' || r.source_id::text)::uuid,
            'ARTICLE', r.source_id, r.content_revision, r.content_hash,
            1, NULL, 'SUBMITTED', v_submitter, 'ADMIN',
            md5('v92-article-corr-sub-' || r.source_id::text)::uuid,
            NULL, '{"source": "V92 migration seed"}'::jsonb, v_submitted_at
        FROM ai_content_revisions r
        WHERE r.source_type = 'ARTICLE'
          AND r.source_id >= '92000000-0000-0000-0002-000000000001'::uuid
          AND r.source_id <= '92000000-0000-0000-0002-000000000015'::uuid
          AND r.content_revision = 1
        ON CONFLICT (event_id) DO NOTHING;

        INSERT INTO ai_content_review_events (
            event_id, source_type, source_id, content_revision, content_hash,
            eligibility_revision, approval_round, event_type, actor_id,
            actor_role, correlation_id, reason, metadata, occurred_at
        )
        SELECT
            md5('v92-article-approved-' || r.source_id::text)::uuid,
            'ARTICLE', r.source_id, r.content_revision, r.content_hash,
            1, 1, 'APPROVED', v_reviewer, 'DOCTOR',
            md5('v92-article-corr-app-' || r.source_id::text)::uuid,
            'Bác sĩ chuyên khoa thẩm định cẩm nang bệnh phổ biến của V92',
            '{"source": "V92 migration seed"}'::jsonb, v_decided_at
        FROM ai_content_revisions r
        JOIN ai_content_approval_rounds ar
          ON ar.source_type = r.source_type
         AND ar.source_id = r.source_id
         AND ar.content_revision = r.content_revision
         AND ar.approval_round = 1
        WHERE r.source_type = 'ARTICLE'
          AND r.source_id >= '92000000-0000-0000-0002-000000000001'::uuid
          AND r.source_id <= '92000000-0000-0000-0002-000000000015'::uuid
          AND r.content_revision = 1
        ON CONFLICT (event_id) DO NOTHING;
    END IF;
END
$v92_article_chain$;

-- ---------------------------------------------------------------------------
-- 5. Published CMS slots about.hero (HERO) and about.body (RICH_TEXT)
--    Payload key names match CmsRenderer.tsx (eyebrow/title/body/ctaLabel/
--    ctaHref for HERO; title/body for RICH_TEXT). slot_key satisfies the V23
--    public route regex and the V24 hero=>HERO / body=>RICH_TEXT contract.
-- ---------------------------------------------------------------------------

INSERT INTO cms_contents (
    id, slot_key, component_type, payload, status, version, created_at, updated_at
)
SELECT
    '92000000-0000-0000-0003-000000000001'::uuid,
    'about.hero',
    'HERO',
    '{"eyebrow":"Giới thiệu Bệnh viện HealthCare","title":"Hệ thống y tế vì sức khỏe cộng đồng","body":"Hơn 25 năm đồng hành cùng người bệnh với đội ngũ bác sĩ chuyên khoa giàu kinh nghiệm, hệ thống chẩn đoán hình ảnh và xét nghiệm chuẩn quốc tế cùng quy trình khám chữa bệnh lấy sự an toàn của người bệnh làm trung tâm.","ctaLabel":"Đặt lịch khám","ctaHref":"/dat-lich"}'::jsonb,
    'PUBLISHED',
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM cms_contents c WHERE c.slot_key = 'about.hero');

INSERT INTO cms_contents (
    id, slot_key, component_type, payload, status, version, created_at, updated_at
)
SELECT
    '92000000-0000-0000-0003-000000000002'::uuid,
    'about.body',
    'RICH_TEXT',
    '{"title":"Sứ mệnh chăm sóc lấy người bệnh làm trung tâm","body":"HealthCare xây dựng quy trình thăm khám liên chuyên môn, bảo mật hồ sơ điện tử theo chuẩn kiểm toán và cam kết thông tin minh bạch về lộ trình điều trị. Mỗi chuyên khoa đều có hội đồng chuyên môn rà soát phác đồ định kỳ để người bệnh nhận được chăm sóc an toàn, hiệu quả và nhân văn."}'::jsonb,
    'PUBLISHED',
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM cms_contents c WHERE c.slot_key = 'about.body');

-- Publish one durable change-feed row per seeded slot so already-open frontend
-- sessions reconcile through SSE replay/heartbeat, mirroring the seed scripts.
INSERT INTO cms_content_changes (
    content_id, slot_key, content_version, published, actor_email,
    component_type, status, payload, public_event, changed_at
)
SELECT
    c.id,
    c.slot_key,
    c.version,
    TRUE,
    'admin@healthcare.com',
    c.component_type,
    c.status,
    c.payload,
    TRUE,
    c.updated_at
FROM cms_contents c
WHERE c.slot_key IN ('about.hero', 'about.body')
  AND NOT EXISTS (
      SELECT 1
      FROM cms_content_changes ch
      WHERE ch.content_id = c.id
        AND ch.content_version = c.version
        AND ch.published = TRUE
  );
