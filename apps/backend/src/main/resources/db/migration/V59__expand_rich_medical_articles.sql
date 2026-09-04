-- V59__expand_rich_medical_articles.sql
-- Expand articles with rich, authoritative, long-form clinical content and section guides

UPDATE articles
SET reading_minutes = 7,
    summary = 'Đau ngực, khó thở khi gắng sức, hồi hộp bất thường hay phù hai chân... là những tín hiệu lâm sàng quan trọng cảnh báo bệnh lý mạch vành và suy tim đang tiến triển âm thầm.',
    body = 'Bệnh lý tim mạch được mệnh danh là "kẻ giết người thầm lặng", là nguyên nhân tử vong hàng đầu trên toàn cầu cũng như tại Việt Nam, cướp đi sinh mạng của hơn 200.000 người mỗi năm. Điều đáng lo ngại là phần lớn các biến cố tim mạch cấp tính (như nhồi máu cơ tim, đột quỵ) đều bắt nguồn từ những tổn thương tiến triển âm ỉ trong nhiều năm mà người bệnh không hề hay biết.

Dưới đây là 5 dấu hiệu cảnh báo lâm sàng cốt lõi do Đội ngũ Bác sĩ Chuyên khoa Tim mạch Bệnh viện HealthCare tổng hợp, giúp bạn nhận biết sớm và xử trí kịp thời:

1. Đau tức ngực, cảm giác đè nặng hoặc bỏng rát sau xương ức
Cơn đau thắt ngực là triệu chứng kinh điển và quan trọng nhất. Cảm giác thường được mô tả như có vật nặng hàng chục kg đè lên ngực, bóp nghẹt hoặc nóng rát sau xương ức. Cơn đau có thể lan lên cằm, cổ, vai trái hoặc dọc mặt trong cánh tay trái xuống ngón tay. Đau thường xuất hiện khi gắng sức (leo cầu thang, chạy bộ, xúc động mạnh) và thuyên giảm khi nghỉ ngơi hoặc ngậm thuốc giãn mạch.

2. Khó thở bất thường khi vận động nhẹ hoặc khi nằm đầu thấp
Khó thở là dấu hiệu suy tim ứ huyết hoặc thiếu máu cục bộ cơ tim. Người bệnh cảm thấy hụt hơi, ngột ngạt dù chỉ làm các công việc nhẹ hàng ngày. Đặc biệt, triệu chứng khó thở kịch phát về đêm (phải ngồi dậy để thở) hoặc khó thở khi nằm phẳng là tín hiệu cảnh báo tim đang bị quá tải tuần hoàn nghiêm trọng.

3. Hồi hộp, đánh trống ngực, nhịp tim không đều hoặc hẫng nhịp
Cảm giác tim đập thình thịch trong lồng ngực, đập quá nhanh (>100 lần/phút lúc nghỉ) hoặc bỏ nhịp (hẫng một nhịp rồi đập mạnh bù lại). Rối loạn nhịp tim như rung nhĩ có thể hình thành cục máu đông trong buồng tim, di chuyển lên não gây nhồi máu não tắc mạch.

4. Phù hai chi dưới, đặc biệt là mu bàn chân và cẳng chân
Khi chức năng bơm máu của thất phải suy giảm, máu tĩnh mạch ngoại vi bị ứ trệ, làm tăng áp lực thủy tĩnh và thoát dịch vào mô kẽ. Phù tim thường đối xứng hai bên, tăng dần về chiều tối sau một ngày đứng hoặc đi lại, ấn vào có vết lõm rõ ràng, sáng ngủ dậy có thể giảm bớt.

5. Mệt mỏi kiệt sức kéo dài, chóng mặt hoặc choáng ngất
Cảm giác uể oải, mất sức không rõ nguyên nhân dù đã nghỉ ngơi đầy đủ. Khi cung lượng tim giảm, lượng máu và oxy tưới cho não và các cơ quan không đủ, dẫn đến choáng váng, hoa mắt, thậm chí ngất xỉu đột ngột.

────────────────────────────────────────────────────────────
THỜI GIAN VÀNG TRONG CẤP CỨU TIM MẠCH (QUY TẮC 60 - 90 PHÚT)
────────────────────────────────────────────────────────────
Nếu cơn đau ngực kéo dài trên 15-20 phút kèm theo vã mồ hôi lạnh, buồn nôn, khó thở, huyết áp tụt:
- DỪNG NGAY mọi hoạt động, ngồi tựa lưng hoặc nằm đầu cao 30-45 độ.
- Nới lỏng cổ áo, thắt lưng, giữ không gian thông thoáng.
- GỌI CẤP CỨU 115 hoặc hotline cấp cứu tim mạch của bệnh viện ngay lập tức.
- Tuyệt đối không tự lái xe hoặc để người bệnh tự đi bộ đến bệnh viện.

LỜI KHUYÊN TẦM SOÁT ĐỊNH KỲ TỪ BÁC SĨ HEALTHCARE:
Người từ 40 tuổi trở lên, hoặc người có tiền sử gia đình có bệnh tim sớm, người thừa cân béo phì, hút thuốc lá, đái tháo đường nên chủ động thực hiện gói tầm soát tim mạch chuyên sâu (ECG, Siêu âm tim Doppler, nghiệm pháp gắng sức, xét nghiệm men tim và mỡ máu toàn phần) ít nhất mỗi năm một lần.'
WHERE slug = 'dau-hieu-canh-bao-benh-tim-mach';

UPDATE articles
SET reading_minutes = 6,
    summary = 'Kiểm soát muối dưới 5g/ngày, tăng cường Kali, Magie từ thực phẩm tươi và áp dụng nghiêm ngặt chế độ ăn DASH giúp hạ huyết áp tương đương với thuốc điều trị khởi đầu.',
    body = 'Tăng huyết áp là một trong những yếu tố nguy cơ hàng đầu dẫn đến tai biến mạch máu não, suy tim và suy thận mạn. Theo các khuyến cáo mới nhất từ Hiệp hội Tim mạch Quốc tế (ISH) và Hội Tim mạch học Việt Nam, thay đổi lối sống và tuân thủ chế độ dinh dưỡng hợp lý có thể giúp hạ huyết áp tâm thu từ 8 - 14 mmHg, tương đương với hiệu quả của một loại thuốc hạ áp đơn trị liệu liều khởi đầu.

Dưới đây là cẩm nang dinh dưỡng khoa học theo tiêu chuẩn DASH (Dietary Approaches to Stop Hypertension) được thiết kế riêng cho người bệnh Việt Nam:

1. NGUYÊN TẮC GIẢM MUỐI (NATRI) - CHÌA KHÓA VÀNG
- Hạn chế lượng muối ăn vào dưới 5g/ngày (tương đương khoảng 1 thìa cà phê gạt ngang muối tinh, hoặc 1.5 thìa nước mắm ngon).
- Không để sẵn lọ muối, nước mắm trên bàn ăn; tập thói quen nếm món ăn trước khi nêm thêm gia vị.
- Cảnh giác với "muối ẩn" trong thực phẩm chế biến sẵn: xúc xích, dăm bông, đồ hộp, mì ăn liền, dưa cà muối, khô cá, các loại sốt công nghiệp.
- Thay thế vị mặn bằng các loại thảo mộc tự nhiên: chanh, gừng, tỏi, tiêu, ngò, rau thơm để kích thích vị giác.

2. TĂNG CƯỜNG KALI, MAGIE VÀ CHẤT XƠ HÒA TAN
- Kali giúp thận đào thải bớt natri qua đường tiểu và làm giãn thành mạch: chuối, bơ, cam, dưa hấu, khoai lang, bí đỏ, rau bina (cải bó xôi).
- Chất xơ hòa tan giúp giảm hấp thu cholesterol xấu (LDL-C): yến mạch, các loại đậu (đậu đen, đậu đỏ, đậu gà), hạt chia, táo, lê.
- Mục tiêu: Tối thiểu 400 - 500g rau củ và 200 - 300g trái cây tươi mỗi ngày.

3. LỰA CHỌN NGUỒN ĐẠM VÀ CHẤT BÉO LÀNH MẠNH
- Ưu tiên cá béo giàu Omega-3 (cá hồi, cá thu, cá trích, cá ngừ) ít nhất 2-3 bữa/tuần giúp bảo vệ nội mạc mạch máu và chống viêm.
- Sử dụng thịt nạc gia cầm bỏ da, trứng (3-4 quả/tuần), đạm thực vật từ đậu hũ, sữa chua không đường.
- Hạn chế tối đa mỡ động vật, phủ tạng (lòng, gan, cật), bơ động vật; chuyển sang dùng dầu thực vật ép lạnh (dầu olive, dầu đậu nành, dầu mè) ở lượng vừa phải.

4. HẠN CHẾ CÁC CHẤT KÍCH THÍCH VÀ CỒN
- Rượu bia làm kích thích hệ thần kinh giao cảm, gây co mạch và giảm tác dụng của thuốc hạ áp. Nam giới không nên uống quá 2 đơn vị cồn/ngày, nữ giới không quá 1 đơn vị cồn/ngày.
- Giảm cà phê đặc, nước tăng lực, trà đặc vào buổi tối để đảm bảo giấc ngủ sâu - yếu tố quyết định điều hòa huyết áp ban đêm.

5. NGUYÊN TẮC THEO DÕI HUYẾT ÁP TẠI NHÀ
- Đo huyết áp 2 lần mỗi ngày (buổi sáng sau khi thức dậy và buổi tối trước khi đi ngủ).
- Nghỉ ngơi tĩnh ít nhất 5-10 phút trước khi đo, không hút thuốc hoặc uống cà phê 30 phút trước đó.
- Ghi chép chỉ số vào sổ nhật ký sức khỏe hoặc ứng dụng của bệnh viện để bác sĩ điều chỉnh liều thuốc tối ưu trong các lần tái khám.'
WHERE slug = 'dinh-duong-hop-ly-nguoi-tang-huyet-ap';

UPDATE articles
SET reading_minutes = 6,
    summary = 'Biếng ăn ở trẻ phần lớn là sinh lý hoặc tâm lý do thói quen ép ăn sai cách. Phụ huynh cần bình tĩnh áp dụng quy tắc "đói mới ăn" và giới hạn bữa ăn dưới 30 phút.',
    body = 'Biếng ăn ở trẻ em là nỗi ám ảnh lớn nhất của nhiều bậc phụ huynh, dẫn đến tâm lý căng thẳng trong mỗi bữa ăn và nguy cơ suy dinh dưỡng, còi xương, suy giảm miễn dịch nếu không được xử trí đúng khoa học. Tuy nhiên, theo các chuyên gia Nhi khoa, hơn 60% trường hợp "biếng ăn" thực chất chỉ là hiện tượng sinh lý tạm thời hoặc bắt nguồn từ các thói quen chăm sóc chưa chuẩn xác của gia đình.

1. PHÂN LOẠI BIẾNG ĂN THEO NGUYÊN NHÂN LÂM SÀNG
- Biếng ăn sinh lý: Thường xuất hiện ở các giai đoạn chuyển tiếp vận động như trẻ tập lẫy (3-4 tháng), mọc răng và tập bò (6-9 tháng), tập đi (10-12 tháng) hoặc giai đoạn khẳng định cái tôi (2-3 tuổi). Trẻ vẫn chơi ngoan, nhanh nhẹn nhưng giảm lượng ăn trong 1-2 tuần rồi tự hồi phục.
- Biếng ăn tâm lý: Xuất hiện khi trẻ bị ép ăn quá mức, bị đe dọa, la mắng hoặc bị lừa nuốt thức ăn. Bữa ăn trở thành "chiến trường" gây ức chế tiết dịch vị tiêu hóa.
- Biếng ăn bệnh lý: Trẻ mắc các bệnh viêm loét miệng họng, tưa lưỡi, nhiễm giun sán, loạn khuẩn đường ruột do dùng kháng sinh, hoặc thiếu hụt các vi chất thiết yếu (kẽm, sắt, vitamin nhóm B, lysine).

2. 4 SAI LẦM PHỔ BIẾN CẦN TRÁNH TUYỆT ĐỐI
- Ép trẻ ăn bằng mọi giá: Bắt trẻ ngồi một chỗ hàng giờ, bóp mũi, đè ngửa ép nuốt. Điều này tạo phản xạ nôn trớ sợ hãi kéo dài.
- Cho trẻ vừa ăn vừa xem TV/điện thoại, ăn rong: Trẻ ăn thụ động, mất phản xạ nhai nuốt và não bộ không cảm nhận được vị giác hay tín hiệu no.
- Cho ăn vặt quá gần bữa chính: Bánh kẹo, nước ngọt, sữa hộp làm tăng đường huyết tức thời khiến dạ dày gửi tín hiệu "đã no giả tạo" lên não.
- Bữa ăn kéo dài quá 30 phút: Thức ăn nguội ngắt, biến chất, vi khuẩn xâm nhập và giảm cảm giác ngon miệng.

3. PHÁC ĐỒ 5 BƯỚC KHẮC PHỤC BIẾNG ĂN KHOA HỌC
- Nguyên tắc "Đói mới ăn": Khoảng cách giữa các bữa ăn (kể cả cữ sữa) nên từ 3 - 3.5 giờ để dạ dày kịp tiêu hóa hết và tạo cảm giác đói thực sự.
- Giới hạn bữa ăn tối đa 30 phút: Sau 30 phút, dọn bữa ăn nhẹ nhàng mà không la mắng hay đền bù ngay bằng sữa hoặc bánh kẹo.
- Đa dạng màu sắc và hình thức chế biến: Trẻ ăn bằng mắt trước; hãy trang trí đĩa ăn bắt mắt, cho trẻ tham gia chuẩn bị món ăn phù hợp lứa tuổi.
- Tôn trọng quyền tự chủ của trẻ: Cho trẻ tự xúc ăn, chọn món trẻ thích trong phạm vi dinh dưỡng cho phép.
- Bổ sung vi chất đúng chỉ định: Tham khảo ý kiến bác sĩ để bổ sung Kẽm (Zinc), Vitamin D3, Men vi sinh (Probiotics) giúp tái tạo tế bào vị giác và kích thích thèm ăn tự nhiên.

4. KHI NÀO CẦN ĐƯA TRẺ ĐẾN BỆNH VIỆN KHÁM NGAY?
Phụ huynh cần đưa trẻ đến gặp Bác sĩ Nhi khoa khi có các dấu hiệu:
- Trẻ sụt cân hoặc không tăng cân liên tục trong 2-3 tháng.
- Trẻ nôn trớ tái diễn, đi tiêu phân sống, táo bón hoặc tiêu chảy kéo dài.
- Trẻ mệt mỏi, da xanh xao, rụng tóc hình vành khăn, chậm biết đi hoặc chậm phát triển vận động.
- Trẻ sốt, quấy khóc bỏ bú, nuốt đau hoặc có tổn thương trong khoang miệng.'
WHERE slug = 'tre-bieng-an-hieu-dung-de-cham-dung';
