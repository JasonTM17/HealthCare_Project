import type { Article, Doctor, HealthPackage, MedicalService } from "../types/hospital";

const TOPIC_COVER_IMAGES: Record<string, string> = {
  "tim mạch": "/media/articles/5-dau-hieu-tim-mach.jpg",
  "nhi khoa": "/media/articles/tre-bieng-an.jpg",
  "dinh dưỡng": "/media/articles/dinh-duong-tang-huyet-ap.jpg",
  "sức khỏe gia đình": "/media/articles/cham-soc-suc-khoe-tong-quat.jpg",
  "cơ xương khớp": "/media/articles/thoai-hoa-cot-song.jpg",
  "nội tiết": "/media/articles/tam-soat-tieu-duong.jpg",
  "tiêu hóa": "/media/articles/viem-loet-da-day.jpg",
  "thần kinh": "/media/articles/phong-ngua-dot-quy.jpg",
  "sản phụ khoa": "/images/packages/womens-health.jpg",
  "hô hấp": "/media/branches/branch-clinic-hall.jpg",
  "tai mũi họng": "/media/branches/branch-clinic-2.jpg",
  "da liễu": "/media/doctor-family-consult.jpg",
  "ung bướu": "/images/packages/general-checkup.jpg",
  "phòng bệnh chủ động": "/media/articles/dau-hieu-tim-mach.jpg",
  "cấp cứu": "/media/branches/branch-hospital.jpg",
  "tổng quát": "/media/articles/cham-soc-suc-khoe-tong-quat.jpg",
};

const DEFAULT_COVER = "/media/articles/cham-soc-suc-khoe-tong-quat.jpg";

function resolveCover(topic: string, slug: string): string {
  const identity = `${topic} ${slug}`.toLocaleLowerCase("vi-VN");
  if (/tim|mạch|cardio/i.test(identity)) return TOPIC_COVER_IMAGES["tim mạch"];
  if (/nhi|trẻ|pediatric/i.test(identity)) return TOPIC_COVER_IMAGES["nhi khoa"];
  if (/dinh dưỡng|ăn uống|nutrition/i.test(identity)) return TOPIC_COVER_IMAGES["dinh dưỡng"];
  if (/tiểu đường|đái tháo đường|nội tiết/i.test(identity)) return TOPIC_COVER_IMAGES["nội tiết"];
  if (/khớp|cột sống|lưng/i.test(identity)) return TOPIC_COVER_IMAGES["cơ xương khớp"];
  if (/dạ dày|tiêu hóa|gan/i.test(identity)) return TOPIC_COVER_IMAGES["tiêu hóa"];
  if (/thần kinh|đột quỵ/i.test(identity)) return TOPIC_COVER_IMAGES["thần kinh"];
  if (/phụ khoa|sinh sản|thai/i.test(identity)) return TOPIC_COVER_IMAGES["sản phụ khoa"];
  if (/hô hấp|hen|phế quản|phổi/i.test(identity)) return TOPIC_COVER_IMAGES["hô hấp"];
  if (/xoang|mũi|họng|tai/i.test(identity)) return TOPIC_COVER_IMAGES["tai mũi họng"];
  if (/da|da liễu|mụn|dị ứng/i.test(identity)) return TOPIC_COVER_IMAGES["da liễu"];
  if (/ung bướu|ung thư/i.test(identity)) return TOPIC_COVER_IMAGES["ung bướu"];
  if (/cấp cứu|sơ cứu/i.test(identity)) return TOPIC_COVER_IMAGES["cấp cứu"];
  if (/phòng bệnh/i.test(identity)) return TOPIC_COVER_IMAGES["phòng bệnh chủ động"];
  return DEFAULT_COVER;
}

/** Normalize known large-beta fixture copy before it reaches patient-facing cards. */
const SERVICE_VARIANTS = [
  ["Khám tổng quát", "Khám lâm sàng và tư vấn sức khỏe tổng quát cho nhu cầu kiểm tra định kỳ."],
  ["Khám tim mạch", "Đánh giá sức khỏe tim mạch, huyết áp và các yếu tố nguy cơ thường gặp."],
  ["Khám thần kinh", "Thăm khám các triệu chứng đau đầu, chóng mặt, rối loạn giấc ngủ và thần kinh."],
  ["Khám tiêu hóa", "Tư vấn và kiểm tra các vấn đề dạ dày, ruột, gan mật theo triệu chứng."],
  ["Khám nhi khoa", "Thăm khám và tư vấn chăm sóc sức khỏe cho trẻ em theo từng độ tuổi."],
  ["Khám sản phụ khoa", "Chăm sóc sức khỏe phụ nữ, khám thai và tư vấn sức khỏe sinh sản."],
  ["Khám cơ xương khớp", "Đánh giá đau khớp, cột sống và hạn chế vận động để chọn hướng chăm sóc phù hợp."],
  ["Khám tai mũi họng", "Kiểm tra các vấn đề về tai, mũi, họng, xoang và thính giác."],
  ["Khám da liễu", "Tư vấn và thăm khám các vấn đề về da, tóc, móng và dị ứng da."],
  ["Xét nghiệm máu", "Thực hiện các xét nghiệm máu cơ bản theo chỉ định của nhân viên y tế."],
  ["Siêu âm", "Khảo sát hình ảnh các cơ quan theo chỉ định và hướng dẫn của bác sĩ."],
  ["Điện tâm đồ", "Ghi nhận hoạt động điện của tim để hỗ trợ bác sĩ đánh giá sức khỏe tim mạch."],
] as const;

const PACKAGE_VARIANTS = [
  ["Gói kiểm tra sức khỏe cơ bản", "Khám tổng quát và các xét nghiệm nền tảng cho người trưởng thành."],
  ["Gói tầm soát tim mạch", "Đánh giá nguy cơ tim mạch, huyết áp và các chỉ số liên quan."],
  ["Gói chăm sóc tiêu hóa", "Kiểm tra các vấn đề dạ dày, gan mật và đường ruột thường gặp."],
  ["Gói theo dõi tiểu đường", "Kiểm tra đường huyết và tư vấn dinh dưỡng, vận động phù hợp."],
  ["Gói sức khỏe phụ nữ", "Khám và tư vấn chăm sóc sức khỏe phụ nữ theo từng giai đoạn."],
  ["Gói sức khỏe trẻ em", "Đánh giá tăng trưởng, dinh dưỡng và các vấn đề sức khỏe thường gặp ở trẻ."],
  ["Gói cơ xương khớp", "Đánh giá đau khớp, cột sống và hướng dẫn vận động an toàn."],
  ["Gói hô hấp", "Kiểm tra các triệu chứng ho, khó thở và sức khỏe đường hô hấp."],
  ["Gói dinh dưỡng", "Tư vấn chế độ ăn và thói quen sinh hoạt theo mục tiêu sức khỏe."],
  ["Gói kiểm tra định kỳ", "Một lựa chọn thuận tiện để rà soát sức khỏe và lên kế hoạch theo dõi."],
] as const;

export interface BigDataClinicalTemplate {
  shortTitle: string;
  category: string;
  coverImageUrl: string;
  authorName: string;
  readingMinutes: number;
  relatedSpecialtySlug: string;
  summary: string;
  body: string;
  sections: Array<{ heading: string; body: string }>;
  keyTakeaways: string[];
  warningSigns: string[];
  preventionTips: string[];
  sourceReferences: string[];
}

export const BIG_DATA_CLINICAL_ARTICLES: BigDataClinicalTemplate[] = [
  {
    shortTitle: "5 dấu hiệu cảnh báo bệnh tim mạch và cách kiểm soát huyết áp hiệu quả",
    category: "Tim mạch",
    coverImageUrl: "/media/articles/5-dau-hieu-tim-mach.jpg",
    authorName: "BS.CKII Trần Quốc Huy",
    readingMinutes: 6,
    relatedSpecialtySlug: "tim-mach",
    summary: "Đau tức ngực, khó thở khi gắng sức, hồi hộp trống ngực hay sưng phù bàn chân là những tín hiệu chỉ điểm sớm của bệnh lý tim mạch. Phát hiện sớm qua điện tâm đồ và siêu âm tim Doppler giúp giảm 70% nguy cơ biến cố nhồi máu cơ tim.",
    body: "Bệnh tim mạch vẫn là nguyên nhân hàng đầu gây tử vong trên toàn cầu cũng như tại Việt Nam. Quá trình xơ vữa động mạch diễn tiến âm thầm từ rất sớm trước khi xuất hiện cơn thiếu máu cơ tim cục bộ. Hiểu rõ các dấu hiệu cảnh báo sớm và chủ động tầm soát định kỳ là biện pháp bảo vệ sức khỏe trái tim bền vững.",
    sections: [
      {
        heading: "1. Nhận biết các triệu chứng tim mạch điển hình",
        body: "Cơn đau thắt ngực thường xuất hiện ở vùng sau xương ức, có cảm giác đè nặng, bóp nghẹt lan lên vai trái, cằm hoặc mặt trong cánh tay trái. Cơn đau thường tăng lên khi vận động gắng sức và giảm khi nghỉ ngơi. Bên cạnh đó, tình trạng khó thở khi nằm đầu thấp hoặc phải thức giấc giữa đêm để thở là dấu hiệu gợi ý suy tim ứ huyết.",
      },
      {
        heading: "2. Vai trò của cận lâm sàng trong tầm soát tim mạch",
        body: "Điện tâm đồ (ECG) 12 chuyển đạo ghi nhận các rối loạn nhịp tim và dấu hiệu thiếu máu cơ tim. Siêu âm tim Doppler màu cho phép đánh giá phân suất tống máu (EF), độ dày thành tim và chức năng các van tim. Xét nghiệm mỡ máu (Lipid panel) và định lượng men tim Troponin I/T giúp phân tầng nguy cơ tim mạch chính xác.",
      },
      {
        heading: "3. Phác đồ bảo vệ tim mạch và thói quen sinh hoạt",
        body: "Áp dụng chế độ ăn Địa Trung Hải giàu chất chống oxy hóa, cá béo giàu Omega-3, hạt ngũ cốc nguyên cám. Giảm lượng natri dưới 2g/ngày (tương đương 5g muối ăn). Tập thể dục nhịp điệu mức độ trung bình ít nhất 30 phút mỗi ngày, 5 ngày mỗi tuần. Tuyệt đối không hút thuốc lá và kiểm soát cân nặng hợp lý.",
      },
    ],
    keyTakeaways: [
      "Đau thắt ngực lan ra vai hoặc cánh tay trái cần được khám chuyên khoa tim mạch sớm",
      "Siêu âm tim và điện tâm đồ giúp phát hiện tổn thương cơ tim trước khi có biến chứng",
      "Chế độ ăn giảm muối (< 5g/ngày) và vận động 150 phút/tuần giúp ổn định huyết áp lâu dài",
    ],
    warningSigns: [
      "Cơn đau thắt ngực kéo dài trên 15 phút không thuyên giảm khi nghỉ ngơi",
      "Khó thở kịch phát đi kèm vã mồ hôi lạnh, choáng váng hoặc ngất xỉu",
      "Hồi hộp, tim đập nhanh không đều kèm cảm giác hẫng hụt lồng ngực",
    ],
    preventionTips: [
      "Đo huyết áp tại nhà 2 lần/ngày (sáng sau ngủ dậy và tối trước khi đi ngủ)",
      "Hạn chế các món ăn chế biến sẵn, thực phẩm đóng hộp nhiều muối",
      "Khám tim mạch định kỳ 6 tháng một lần đối với người trên 40 tuổi",
    ],
    sourceReferences: [
      "Khuyến cáo chẩn đoán và điều trị tăng huyết áp - Hội Tim mạch học Việt Nam",
      "European Society of Cardiology (ESC) Guidelines for Cardiovascular Disease Prevention - 2026",
    ],
  },
  {
    shortTitle: "Chế độ dinh dưỡng khoa học cho người rối loạn mỡ máu và thừa cân",
    category: "Dinh dưỡng",
    coverImageUrl: "/media/articles/dinh-duong-tang-huyet-ap.jpg",
    authorName: "BS.CKI Đặng Thu Nga",
    readingMinutes: 5,
    relatedSpecialtySlug: "tim-mach",
    summary: "Rối loạn mỡ máu (tăng Cholesterol, Triglyceride) là nguyên nhân chính dẫn đến mảng xơ vữa động mạch. Thay đổi chế độ ăn theo mô hình Đĩa ăn cân bằng dinh dưỡng giúp hạ mỡ máu an toàn mà không làm mất cơ bắp.",
    body: "Chế độ ăn đóng vai trò then chốt trong việc kiểm soát lipid máu. Khoảng 80% cholesterol do gan tự tổng hợp và 20% đến từ thức ăn. Một chế độ ăn khoa học giúp kích hoạt chuyển hóa lipid, bảo vệ chức năng gan và giảm gánh nặng cho hệ tuần hoàn.",
    sections: [
      {
        heading: "1. Hiểu đúng về các chỉ số mỡ máu",
        body: "Cholesterol toàn phần, LDL-C (cholesterol xấu), HDL-C (cholesterol tốt) và Triglyceride là 4 chỉ số cơ bản. Mục tiêu điều trị là đưa LDL-C xuống dưới ngưỡng an toàn theo phân tầng nguy cơ và duy trì HDL-C ở mức cao bằng vận động thể lực.",
      },
      {
        heading: "2. Cấu trúc bữa ăn lành mạnh theo mô hình MyPlate",
        body: "Một nửa khẩu phần ăn nên là rau củ quả đa dạng màu sắc để cung cấp vitamin và chất xơ hòa tan. Một phần tư khẩu phần là protein nạc như cá, thịt gia cầm không da hoặc các loại đậu. Một phần tư còn lại là tinh bột phức hợp có chỉ số GI thấp như gạo lứt, yến mạch, khoai lang luộc.",
      },
      {
        heading: "3. Những thực phẩm cần hạn chế tối đa",
        body: "Chất béo chuyển hóa (Trans fat) có trong mì ăn liền, bánh ngọt nướng, đồ chiên rán nhiều lần làm tăng mạnh LDL-C và hạ HDL-C. Hạn chế mỡ động vật, nội tạng động vật, lòng đỏ trứng vượt mức, đồng thời cắt giảm hoàn toàn các loại nước ngọt chứa si-rô bắp fructose cao.",
      },
      {
        heading: "4. Kế hoạch vận động hỗ trợ chuyển hóa",
        body: "Tập luyện sức bền (đi bộ nhanh, chạy bộ nhẹ, đạp xe) kết hợp các bài tập kháng lực (chống đẩy, plank, tạ nhẹ) 2-3 buổi mỗi tuần giúp kích thích enzyme lipoprotein lipase phân giải chất béo trong lòng mạch.",
      },
    ],
    keyTakeaways: [
      "Chất xơ hòa tan trong yến mạch và rau củ giúp đào thải bớt cholesterol qua đường tiêu hóa",
      "Tránh chất béo chuyển hóa trong thức ăn nhanh và đồ chiên ngập dầu",
      "Vận động thể lực thường xuyên là cách hiệu quả nhất để nâng cao chỉ số mỡ tốt HDL-C",
    ],
    warningSigns: [
      "Xuất hiện u vàng (Xanthoma) quanh mí mắt hoặc ở gân gót chân",
      "Đau tức hạ sườn phải, đầy bụng khó tiêu kéo dài do gan nhiễm mỡ tiến triển",
      "Chỉ số Triglyceride tăng quá cao (> 10 mmol/L) có nguy cơ gây viêm tụy cấp",
    ],
    preventionTips: [
      "Ăn ít nhất 400g rau xanh và quả chín ít ngọt mỗi ngày",
      "Ưu tiên sử dụng dầu thực vật chưa no (dầu ô liu, dầu hạt cải, dầu hướng dương)",
      "Làm xét nghiệm bộ mỡ máu định kỳ 6 - 12 tháng/lần",
    ],
    sourceReferences: [
      "Viện Dinh dưỡng Quốc gia - Hướng dẫn dinh dưỡng dự phòng các bệnh mạn tính không lây",
      "American Heart Association (AHA) Diet and Lifestyle Recommendations",
    ],
  },
  {
    shortTitle: "Trẻ biếng ăn và chậm tăng cân: Cách can thiệp đúng từ chuyên gia nhi khoa",
    category: "Nhi khoa",
    coverImageUrl: "/media/articles/tre-bieng-an.jpg",
    authorName: "BS.CKI Nguyễn Thị Mai",
    readingMinutes: 6,
    relatedSpecialtySlug: "nhi-khoa",
    summary: "Biếng ăn ở trẻ có thể bắt nguồn từ tâm lý sợ ăn do bị ép buộc, thiếu hụt vi chất dinh dưỡng kẽm - sắt, hoặc rối loạn tiêu hóa nhẹ. Xây dựng môi trường ăn uống tích cực và bổ sung vi chất đúng chỉ định giúp trẻ ăn ngon miệng trở lại.",
    body: "Tình trạng biếng ăn kéo dài ảnh hưởng trực tiếp đến sự phát triển thể chất và trí não của trẻ trong 1000 ngày đầu đời. Cha mẹ cần kiên nhẫn phân tích nguyên nhân sinh lý hay bệnh lý để có giải pháp phù hợp thay vì lạm dụng men tiêu hóa kéo dài.",
    sections: [
      {
        heading: "1. Phân loại biếng ăn sinh lý và biếng ăn tâm lý",
        body: "Biếng ăn sinh lý thường xuất hiện tại các giai đoạn mốc phát triển: biết lẫy, mọc răng, biết bò, tập đi... và thường tự hết sau 1-2 tuần. Biếng ăn tâm lý do trẻ bị ép ăn quá mức, ăn rong, vừa ăn vừa xem điện thoại tạo cảm giác ức chế phản xạ tiết enzym dạ dày.",
      },
      {
        heading: "2. Tầm quan trọng của các vi chất dinh dưỡng",
        body: "Thiếu kẽm làm teo gai vị giác khiến trẻ mất cảm giác ngon miệng. Thiếu máu thiếu sắt khiến trẻ mệt mỏi, kém hoạt bát. Bổ sung kẽm hữu cơ, Lysine, Vitamin nhóm B theo từng đợt có kiểm soát giúp cải thiện chuyển hóa nhanh chóng.",
      },
      {
        heading: "3. Quy tắc bàn ăn giúp trẻ hợp tác vui vẻ",
        body: "Mỗi bữa ăn chỉ nên kéo dài tối đa 30 phút. Không sử dụng thiết bị điện tử trong bữa ăn. Cho trẻ tham gia vào việc chuẩn bị thức ăn đơn giản. Tạo khoảng cách giữa các cữ ăn từ 2.5 đến 3 giờ để dạ dày trẻ kịp rỗng và tạo cảm giác đói tự nhiên.",
      },
    ],
    keyTakeaways: [
      "Không ép trẻ ăn khi trẻ đã no, tránh gây hội chứng sợ ăn tâm lý",
      "Bữa ăn không kéo dài quá 30 phút và tuyệt đối không vừa ăn vừa xem điện thoại",
      "Khám dinh dưỡng khi trẻ chậm tăng cân liên tục trong 2 - 3 tháng liên tiếp",
    ],
    warningSigns: [
      "Trẻ sụt cân, đứng cân trên biểu đồ tăng trưởng liên tục 3 tháng",
      "Da xanh xao, niêm mạc mắt nhợt nhạt, tóc thưa rụng hình vành khăn",
      "Kèm theo sốt, tiêu chảy mạn tính hoặc nôn trớ tái diễn sau mỗi cữ ăn",
    ],
    preventionTips: [
      "Thiết lập lịch ăn uống cố định các bữa chính và bữa phụ",
      "Đa dạng hóa màu sắc và cách bài trí món ăn kích thích thị giác của trẻ",
      "Tẩy giun định kỳ cho trẻ từ 12 tháng tuổi trở lên mỗi 6 tháng",
    ],
    sourceReferences: [
      "Hướng dẫn quốc gia về dinh dưỡng cho trẻ nhỏ - Bộ Y tế Việt Nam",
      "American Academy of Pediatrics (AAP) Pediatric Nutrition Handbook",
    ],
  },
  {
    shortTitle: "Tầm soát sớm và quản lý bệnh đái tháo đường Type 2 an toàn",
    category: "Nội tiết",
    coverImageUrl: "/media/articles/tam-soat-tieu-duong.jpg",
    authorName: "BS.CKII Võ Thị Mai",
    readingMinutes: 7,
    relatedSpecialtySlug: "noi-tong-hop",
    summary: "Hơn 50% người mắc tiểu đường không có triệu chứng ban đầu rõ rệt. Xét nghiệm HbA1c và đường huyết lúc đói giúp phát hiện tiền đái tháo đường, can thiệp đảo ngược bệnh trước khi xảy ra biến chứng mắt, thận và thần kinh ngoại biên.",
    body: "Đái tháo đường Type 2 là bệnh lý mạn tính gia tăng nhanh chóng theo xu hướng đô thị hóa. Nếu kiểm soát tốt đường huyết mục tiêu, người bệnh hoàn toàn có thể sống khỏe mạnh và tuổi thọ tương đương người bình thường.",
    sections: [
      {
        heading: "1. Các mốc xét nghiệm chẩn đoán và mục tiêu kiểm soát",
        body: "Đường huyết đói >= 7.0 mmol/L hoặc HbA1c >= 6.5% xác định chẩn đoán đái tháo đường. Với người đã mắc bệnh, mục tiêu HbA1c thường duy trì dưới 7.0% (hoặc dưới 6.5% ở người trẻ chưa có biến chứng) để ngăn ngừa tổn thương vi mạch.",
      },
      {
        heading: "2. Chăm sóc bàn chân và phòng ngừa loét đái tháo đường",
        body: "Biến chứng thần kinh cảm giác ngoại biên khiến bệnh nhân mất cảm giác đau đớn khi giẫm phải vật nhọn hoặc bị bỏng nước nóng. Cần rửa chân bằng nước ấm, lau khô kỹ các kẽ ngón chân và kiểm tra lòng bàn chân mỗi ngày bằng gương soi.",
      },
      {
        heading: "3. Nguyên tắc vận động và dinh dưỡng an toàn",
        body: "Chia nhỏ khẩu phần, không bỏ bữa để tránh hạ đường huyết đột ngột. Uống đủ nước. Mang theo kẹo ngọt hoặc gói đường nhỏ khi tập thể dục để phòng ngừa triệu chứng vã mồ hôi, run tay chân do hạ đường huyết.",
      },
    ],
    keyTakeaways: [
      "Xét nghiệm chỉ số HbA1c phản ánh mức đường huyết trung bình trong 3 tháng",
      "Phát hiện ở giai đoạn tiền đái tháo đường có thể đảo ngược bằng giảm 5-7% cân nặng",
      "Kiểm tra và chăm sóc bàn chân hằng ngày là bắt buộc đối với bệnh nhân đái tháo đường",
    ],
    warningSigns: [
      "Vã mồ hôi, bủn rủn tay chân, tim đập nhanh, choáng váng (hạ đường huyết cấp)",
      "Khát nước liên tục, tiểu nhiều lần, hơi thở có mùi táo chín hoặc axeton",
      "Tê bì, châm chích như kim châm ở hai bàn chân kéo dài",
    ],
    preventionTips: [
      "Ưu tiên tinh bột có chỉ số GI thấp như ngũ cốc nguyên cám, gạo mầm",
      "Khám mắt định kỳ soi đáy mắt 1 năm/lần để tầm soát bệnh võng mạc tiểu đường",
      "Theo dõi đường huyết mao mạch tại nhà theo lịch hướng dẫn của bác sĩ",
    ],
    sourceReferences: [
      "Hướng dẫn chẩn đoán và điều trị đái tháo đường Type 2 - Bộ Y tế",
      "American Diabetes Association (ADA) Standards of Care in Diabetes - 2026",
    ],
  },
  {
    shortTitle: "Nhận diện sớm dấu hiệu đột quỵ não và tận dụng thời gian vàng cấp cứu",
    category: "Thần kinh",
    coverImageUrl: "/media/articles/phong-ngua-dot-quy.jpg",
    authorName: "ThS.BS Trần Thu Hà",
    readingMinutes: 7,
    relatedSpecialtySlug: "than-kinh",
    summary: "Đột quỵ là tình trạng cấp cứu y khoa khẩn cấp. Ghi nhớ quy tắc FAST giúp nhận biết nhanh cơn đột quỵ trong 1 phút để gọi cấp cứu 115 ngay lập tức, tận dụng khung giờ vàng 4.5 giờ đầu cứu sống nhu mô não.",
    body: "Mỗi phút trôi qua sau khi tắc mạch máu não, có khoảng 2 triệu tế bào thần kinh chết đi không thể phục hồi. Hiểu biết của người nhà và cộng đồng chính là yếu tố quyết định người bệnh có được can thiệp kịp thời hay không.",
    sections: [
      {
        heading: "1. Nhớ nằm lòng quy tắc FAST",
        body: "F (Face): Mặt mất cân đối, méo miệng khi cười. A (Arm): Một bên tay hoặc chân bị yếu, rơi xuống khi cố giơ lên. S (Speech): Lời nói ú ớ, nói ngọng hoặc không hiểu lời nói. T (Time): Thời gian là não bộ, gọi ngay 115 hoặc đưa đến bệnh viện có đơn vị đột quỵ gần nhất.",
      },
      {
        heading: "2. Những sai lầm chết người cần tuyệt đối tránh",
        body: "Không cạo gió, không chích lể máu ngón tay hay dái tai. Không tự ý cho uống thuốc hạ huyết áp hoặc An Cung Ngưu Hoàng Hoàn khi chưa có kết quả chụp CT não loại trừ xuất huyết não, vì việc cho uống khi bệnh nhân tri giác không tỉnh táo rất dễ gây sặc vào phổi dẫn đến suy hô hấp tử vong.",
      },
      {
        heading: "3. Tầm soát yếu tố nguy cơ đột quỵ từ sớm",
        body: "Kiểm soát tốt huyết áp dưới 130/80 mmHg, điều trị rung nhĩ bằng thuốc chống đông theo chỉ định, tầm soát hẹp động mạch cảnh bằng siêu âm Doppler mạch máu vùng cổ.",
      },
    ],
    keyTakeaways: [
      "Quy tắc FAST: Méo mặt - Liệt tay - Nói khó - Gọi cấp cứu ngay",
      "Thời gian vàng dùng thuốc tiêu sợi huyết là 4.5 giờ đầu tiên",
      "Tuyệt đối không chích lể hay vắt chanh vào miệng người đang nghi ngờ đột quỵ",
    ],
    warningSigns: [
      "Đột ngột yếu liệt hoặc tê bì một nửa người (mặt, tay, chân)",
      "Đột ngột mất thị lực ở một hoặc cả hai mắt, nhìn đôi",
      "Đau đầu dữ dội đột ngột chưa từng có kèm nôn ói và mất thăng bằng",
    ],
    preventionTips: [
      "Uống thuốc hạ huyết áp đều đặn mỗi ngày theo đơn, không tự ý ngưng thuốc",
      "Bỏ thuốc lá hoàn toàn và hạn chế tối đa uống rượu bia",
      "Khám chuyên khoa thần kinh khi có cơn thiếu máu não thoáng qua (TIA)",
    ],
    sourceReferences: [
      "Khuyến cáo xử trí đột quỵ thiếu máu não cấp - Hội Đột quỵ Việt Nam",
      "AHA/ASA Guidelines for the Early Management of Patients With Acute Ischemic Stroke",
    ],
  },
  {
    shortTitle: "Viêm loét dạ dày tá tràng và vi khuẩn HP: Hiểu đúng phác đồ điều trị dứt điểm",
    category: "Tiêu hóa",
    coverImageUrl: "/media/articles/viem-loet-da-day.jpg",
    authorName: "BS.CKI Lê Văn Đức",
    readingMinutes: 6,
    relatedSpecialtySlug: "tieu-hoa",
    summary: "Vi khuẩn HP (Helicobacter pylori) lây truyền chủ yếu qua đường ăn uống chung đụng. Nhận biết triệu chứng đau dạ dày, chỉ định nội soi không đau và tuân thủ phác đồ kháng sinh 14 ngày giúp tiệt trừ vi khuẩn triệt để.",
    body: "Viêm loét dạ dày tá tràng gây ảnh hưởng lớn đến chất lượng sống, tiềm ẩn biến chứng chảy máu tiêu hóa hoặc thủng dạ dày nếu không điều trị bài bản. Việc tiệt trừ vi khuẩn HP đúng phác đồ là biện pháp hữu hiệu nhất phòng ngừa ung thư dạ dày tái phát.",
    sections: [
      {
        heading: "1. Đường lây nhiễm HP trong gia đình và xã hội",
        body: "Vi khuẩn HP lây qua đường miệng - miệng (dùng chung bát nước chấm, thìa đũa, gắp thức ăn cho nhau) và đường phân - miệng (nguồn nước hoặc rau sống nhiễm bẩn). Khử khuẩn đồ dùng gia đình và tạo thói quen dùng đũa muỗng riêng là biện pháp phòng tránh bền vững.",
      },
      {
        heading: "2. Chẩn đoán chính xác bằng nội soi và test hơi thở C13",
        body: "Nội soi tiêu hóa ống mềm không đau giúp bác sĩ quan sát chi tiết ổ loét và làm sinh thiết Clo-test. Sau khi hoàn thành phác đồ điều trị, test hơi thở C13 là phương pháp kiểm tra lại độ sạch vi khuẩn an toàn, nhẹ nhàng và có độ chính xác cao nhất.",
      },
      {
        heading: "3. Nguyên tắc vàng khi dùng thuốc tiệt trừ HP",
        body: "Bệnh nhân cần uống thuốc kháng sinh đúng giờ, đủ 14 ngày, không được bỏ cữ thuốc dù triệu chứng đau đã hết sau 3-4 ngày đầu. Ngừng thuốc sớm là nguyên nhân hàng đầu khiến vi khuẩn biến đổi kháng thuốc.",
      },
    ],
    keyTakeaways: [
      "Nhiễm HP cần tuân thủ uống đủ liều thuốc liên tục 14 ngày theo đúng đơn bác sĩ",
      "Test hơi thở C13 là phương pháp không xâm lấn tiêu chuẩn để kiểm tra kết quả tiệt trừ HP",
      "Thay đổi thói quen ăn uống riêng đũa muỗng để tránh lây nhiễm chéo trong gia đình",
    ],
    warningSigns: [
      "Đau bụng thượng vị dữ dội đột ngột, bụng cứng như gỗ (nguy cơ thủng ổ loét)",
      "Nôn ra dịch màu nâu đen hoặc đi đại tiện phân đen như nhựa đường",
      "Sụt cân nhanh kèm chán ăn, nuốt nghẹn dai dẳng ở người trên 40 tuổi",
    ],
    preventionTips: [
      "Hạn chế ăn đồ cay nóng, thức ăn ngâm muối chua, đồ hun khói và rượu bia",
      "Không tự ý mua và dùng các thuốc giảm đau chống viêm không steroid (NSAID)",
      "Tái khám kiểm tra test HP sau khi ngừng thuốc kháng sinh ít nhất 4 tuần",
    ],
    sourceReferences: [
      "Đồng thuận chẩn đoán và điều trị nhiễm HP tại Việt Nam - Hội Khoa học Tiêu hóa",
      "Maastricht VI/Florence Consensus Report on Management of Helicobacter pylori",
    ],
  },
  {
    shortTitle: "Thoái hóa cột sống thắt lưng: Cách phòng ngừa và phục hồi chức năng không phẫu thuật",
    category: "Cơ xương khớp",
    coverImageUrl: "/media/articles/thoai-hoa-cot-song.jpg",
    authorName: "ThS.BS Phạm Hoàng Yến",
    readingMinutes: 6,
    relatedSpecialtySlug: "co-xuong-khop",
    summary: "Đau mỏi thắt lưng sau ngày dài ngồi làm việc là biểu hiện của thoái hóa cột sống sớm. Áp dụng vật lý trị liệu, kéo giãn cột sống kết hợp các bài tập tăng cường khối cơ lõi giúp 90% bệnh nhân bình phục mà không cần can thiệp dao kéo.",
    body: "Cột sống thắt lưng là trụ cột chịu lực chính cho toàn bộ cơ thể. Lối sống tĩnh tại văn phòng kết hợp với tư thế sai lệch khi cúi bê đồ nặng đẩy nhanh tiến trình mất nước đĩa đệm và thoái hóa khớp liên mấu.",
    sections: [
      {
        heading: "1. Cơ chế gây đau và thoái hóa cột sống",
        body: "Khi đĩa đệm giảm độ ngậm nước, khoảng cách giữa các đốt sống hẹp lại, hình thành các gai xương nhỏ chèn ép vào rễ thần kinh tọa hoặc các thụ cảm thể cảm giác màng xương gây đau nhức âm ỉ kéo dài.",
      },
      {
        heading: "2. Phục hồi chức năng và vật lý trị liệu chuyên sâu",
        body: "Điều trị kết hợp sóng ngắn nhiệt sâu, điện xung giảm đau TENS, kéo giãn cột sống định lượng bằng máy vi tính giúp giải áp nội đĩa đệm và thư giãn nhóm cơ co thắt cạnh sống.",
      },
      {
        heading: "3. Nguyên tắc công thái học (Ergonomics) trong sinh hoạt",
        body: "Khi nhấc vật nặng, luôn gập đầu gối hạ thấp trọng tâm, giữ thẳng cột sống lưng và ôm sát vật thể vào ngực. Đặt màn hình máy tính ngang tầm mắt, ghế ngồi có đệm đỡ thắt lưng và đứng dậy vận động sau mỗi 45-60 phút.",
      },
    ],
    keyTakeaways: [
      "Hơn 90% cơn đau thắt lưng cơ năng cải thiện tốt bằng phục hồi chức năng và tập luyện",
      "Luôn giữ lưng thẳng và dùng lực đùi gối khi nâng vác vật nặng từ sàn nhà",
      "Tập các bài tập cơ bụng và cơ dựng sống (Core muscles) giúp bảo vệ cột sống lâu dài",
    ],
    warningSigns: [
      "Đau thắt lưng lan xuống mông, mặt sau đùi và bàn chân kèm tê bì mất cảm giác",
      "Yếu cơ chân, không thể nhấc đầu ngón chân lên khi đi lại",
      "Bí tiểu, són tiểu hoặc tê bì mất cảm giác vùng hội âm (Hội chứng chùm đuôi ngựa cấp)",
    ],
    preventionTips: [
      "Tập bơi lội hoặc đi bộ nhẹ nhàng 30 phút/ngày giúp giãn cơ lưng",
      "Kiểm soát cân nặng để giảm áp lực tỳ đè lên sụn khớp và đốt sống thắt lưng",
      "Tránh nằm đệm quá mềm bị lún cong võng cột sống lưng khi ngủ",
    ],
    sourceReferences: [
      "Hướng dẫn chẩn đoán và điều trị các bệnh cơ xương khớp - Bộ Y tế",
      "North American Spine Society (NASS) Clinical Guidelines for Lumbar Spondylolisthesis",
    ],
  },
  {
    shortTitle: "Các mốc khám thai quan trọng và tầm soát dị tật thai nhi chuẩn y khoa",
    category: "Sản phụ khoa",
    coverImageUrl: "/images/packages/womens-health.jpg",
    authorName: "BS.CKII Trần Thanh Mai",
    readingMinutes: 6,
    relatedSpecialtySlug: "san-phu-khoa",
    summary: "Quản lý thai kỳ toàn diện qua các mốc tuần 11-13, tuần 20-22 và tuần 30-32 giúp phát hiện sớm các bất thường di truyền, kiểm soát tiền sản giật và đảm bảo hành trình vượt cạn an toàn cho cả mẹ và bé.",
    body: "Khám thai định kỳ không chỉ để ngắm nhìn sự lớn lên của thai nhi mà còn là quy trình y khoa nghiêm ngặt nhằm đánh giá sức khỏe của người mẹ và chức năng trao đổi chất của bánh nhau.",
    sections: [
      {
        heading: "1. Mốc 11 - 13 tuần 6 ngày: Đo độ mờ da gáy và xét nghiệm NIPT",
        body: "Đây là thời điểm vàng để đo khoảng sáng sau gáy thai nhi và làm xét nghiệm sàng lọc tiền sản không xâm lấn (NIPT). NIPT phân tích các đoạn DNA tự do của thai nhi trong máu mẹ để sàng lọc hội chứng Down, Edwards, Patau với độ chính xác trên 99%.",
      },
      {
        heading: "2. Mốc 20 - 22 tuần: Siêu âm khảo sát hình thái học chi tiết",
        body: "Bác sĩ siêu âm sẽ khảo sát tỉ mỉ từng cơ quan của thai nhi: cấu trúc não thất, tim 4 buồng, cấu trúc mặt (loại trừ sứt môi, hở hàm ếch), thành bụng, cột sống và các chi.",
      },
      {
        heading: "3. Mốc 24 - 28 tuần: Nghiệm pháp dung nạp glucose đường uống",
        body: "Tầm soát đái tháo đường thai kỳ bằng nghiệm pháp uống 75g đường. Việc phát hiện và điều chỉnh dinh dưỡng kịp thời giúp phòng tránh thai to, hạ đường huyết sơ sinh và đa ối.",
      },
    ],
    keyTakeaways: [
      "Tuyệt đối không bỏ lỡ mốc siêu âm đo độ mờ da gáy từ tuần 11 đến tuần 13 ngày 6",
      "Xét nghiệm NIPT an toàn tuyệt đối cho thai nhi và cho kết quả sàng lọc di truyền chính xác cao",
      "Tầm soát tiểu đường thai kỳ ở tuần 24-28 giúp bảo vệ sức khỏe chuyển hóa của cả mẹ và con",
    ],
    warningSigns: [
      "Ra máu âm đạo dù chỉ một lượng nhỏ ở bất kỳ thời điểm nào của thai kỳ",
      "Đau đầu dữ dội, hoa mắt chóng mặt, phù nhanh ở mặt và mu bàn tay (Dấu hiệu tiền sản giật)",
      "Thai máy giảm rõ rệt (dưới 4 lần cử động trong 1 giờ khi mẹ nằm yên tĩnh)",
    ],
    preventionTips: [
      "Uống bổ sung Acid Folic (400 - 800 mcg/ngày) từ trước khi mang thai 3 tháng",
      "Tiêm ngừa vaccine uốn ván và vaccine cúm theo lịch khuyến cáo của bác sĩ sản khoa",
      "Khám thai đều đặn theo lịch hẹn và đo huyết áp mỗi lần tái khám",
    ],
    sourceReferences: [
      "Hướng dẫn quốc gia về các dịch vụ chăm sóc sức khỏe sinh sản - Bộ Y tế",
      "ACOG Practice Bulletin: Screening for Fetal Chromosomal Abnormalities",
    ],
  },
  {
    shortTitle: "Viêm phế quản và hen phế quản ở người trưởng thành: Cách kiểm soát cơn khó thở",
    category: "Hô hấp",
    coverImageUrl: "/media/branches/branch-clinic-hall.jpg",
    authorName: "BS.CKII Đặng Minh Tuấn",
    readingMinutes: 5,
    relatedSpecialtySlug: "noi-tong-hop",
    summary: "Ho kéo dài, thở khò khè khi thay đổi thời tiết là dấu hiệu đường thở tăng phản ứng. Đo chức năng hô hấp (Hô hấp ký) và sử dụng thuốc hít định liều đúng kỹ thuật giúp kiểm soát hen phế quản và bảo vệ dung tích phổi.",
    body: "Bệnh hô hấp mạn tính làm suy giảm đáng kể khả năng vận động và sinh hoạt hàng ngày nếu người bệnh chỉ dùng thuốc cắt cơn ngắn hạn mà bỏ qua liệu trình kiểm soát viêm đường thở dài hạn.",
    sections: [
      {
        heading: "1. Phân biệt viêm phế quản cấp và hen phế quản",
        body: "Viêm phế quản cấp thường đi kèm sốt, đau rát họng, ho có đờm và tự thuyên giảm sau 10-14 ngày. Hen phế quản có tính chất mạn tính, cơn khó thở và thở rít hay tái phát về đêm hoặc sáng sớm khi gặp không khí lạnh.",
      },
      {
        heading: "2. Vai trò của đo chức năng hô hấp (Spirometry)",
        body: "Đo hô hấp ký trước và sau khi xịt thuốc giãn phế quản là tiêu chuẩn vàng chẩn đoán hội chứng tắc nghẽn đường dẫn khí và đánh giá mức độ hồi phục của luồng khí thở.",
      },
      {
        heading: "3. Kỹ thuật sử dụng bình xịt định liều MDI có buồng đệm",
        body: "Lắc đều bình xịt, thở ra hết sức, ngậm kín ống ngậm, ấn bình xịt đồng thời hít vào chậm và sâu trong 3-5 giây, sau đó nín thở 10 giây. Súc miệng kỹ bằng nước sạch sau khi dùng thuốc hít chứa Corticoid để tránh khản tiếng và nấm miệng.",
      },
    ],
    keyTakeaways: [
      "Hen phế quản cần dùng thuốc kiểm soát dự phòng hàng ngày, không chỉ dùng thuốc cắt cơn",
      "Kỹ thuật hít thở đúng cách quyết định hơn 80% hiệu quả của các loại thuốc xịt hen",
      "Súc miệng sau khi xịt thuốc hít để phòng tránh nấm họng và khản tiếng",
    ],
    warningSigns: [
      "Khó thở dữ dội, không thể nói hết một câu trọn vẹn mà phải ngắt quãng để thở",
      "Môi và đầu ngón tay tím tái, co kéo rõ rệt hõm ức và cơ liên sườn",
      "Xịt thuốc cắt cơn dạng hít 2 lần liên tiếp cách nhau 20 phút nhưng không đỡ khó thở",
    ],
    preventionTips: [
      "Tránh xa khói thuốc lá chủ động và thụ động, giữ nhà cửa thông thoáng không nấm mốc",
      "Đeo khẩu trang lọc bụi mịn khi di chuyển trên đường phố đông đúc",
      "Tiêm vaccine phòng cúm hàng năm và vaccine phế cầu định kỳ",
    ],
    sourceReferences: [
      "Hướng dẫn chẩn đoán và điều trị hen phế quản người lớn - Bộ Y tế",
      "Global Initiative for Asthma (GINA) Global Strategy for Asthma Management and Prevention",
    ],
  },
  {
    shortTitle: "Viêm mũi xoang mạn tính: Hướng dẫn chăm sóc và rửa mũi đúng cách tại nhà",
    category: "Tai mũi họng",
    coverImageUrl: "/media/branches/branch-clinic-2.jpg",
    authorName: "BS.CKI Đỗ Khắc Cường",
    readingMinutes: 5,
    relatedSpecialtySlug: "tai-mui-hong",
    summary: "Nghẹt mũi, chảy dịch mũi sau, nhức trán và nặng vùng gò má là các triệu chứng viêm mũi xoang dai dẳng. Rửa mũi bằng bình chuyên dụng nước muối sinh lý đẳng trương giúp làm sạch dịch mủ và phục hồi niêm mạc xoang.",
    body: "Hệ thống xoang cạnh mũi được lót bởi lớp biểu mô có hệ thống lông chuyển liên tục vận chuyển chất nhầy ra hốc mũi. Khi lỗ thông xoang bị tắc nghẽn do phù nề, vi khuẩn sẽ phát triển gây viêm mủ ứ đọng.",
    sections: [
      {
        heading: "1. Cơ chế phát sinh viêm mũi xoang",
        body: "Dị ứng thời tiết, vẹo vách ngăn mũi, polyp mũi hoặc nhiễm trùng răng hàm trên là những nguyên nhân phổ biến gây bít tắc phức hợp lỗ thông ngách xoang, dẫn tới tình trạng ứ dịch và viêm xoang mạn tính.",
      },
      {
        heading: "2. Quy trình rửa mũi xoang an toàn bằng bình áp lực thấp",
        body: "Sử dụng nước muối sinh lý 0.9% ấm (hoặc gói muối pha với nước tinh khiết). Cúi đầu trên bồn rửa mặt, nghiêng nhẹ sang một bên, thở hoàn toàn bằng miệng khi bóp nhẹ bình nước muối để dòng nước đi từ lỗ mũi bên này chảy ra lỗ mũi bên kia mà không gây sặc lên tai.",
      },
      {
        heading: "3. Cảnh báo về việc lạm dụng thuốc nhỏ co mạch",
        body: "Các loại thuốc nhỏ mũi co mạch (chứa Oxymetazoline, Xylometazoline) chỉ được dùng tối đa 3-5 ngày. Dùng kéo dài sẽ gây hiện tượng dội ngược giãn mạch (viêm mũi do thuốc), làm nghẹt mũi nặng hơn và nhờn thuốc.",
      },
    ],
    keyTakeaways: [
      "Rửa mũi bằng nước muối sinh lý ấm là biện pháp hỗ trợ điều trị viêm xoang rất hiệu quả",
      "Tuyệt đối không dùng thuốc xịt co mạch mũi quá 5 ngày liên tục để tránh viêm mũi do thuốc",
      "Nội soi tai mũi họng ống mềm giúp quan sát chính xác vị trí mủ và cấu trúc vách ngăn",
    ],
    warningSigns: [
      "Đau nhức dữ dội quanh hốc mắt, sưng nề mi mắt hoặc nhìn mờ, nhìn đôi",
      "Sốt cao kèm theo đau đầu dữ dội và cứng gáy (nguy cơ biến chứng nội sọ)",
      "Chảy máu mũi lượng nhiều không cầm được sau 15 phút đè ép cánh mũi",
    ],
    preventionTips: [
      "Giữ ấm vùng cổ ngực và mũi khi thời tiết chuyển lạnh hoặc nằm phòng điều hòa",
      "Vệ sinh máy lạnh và quạt định kỳ để loại bỏ nấm mốc và bụi bẩn trong không khí",
      "Điều trị dứt điểm các bệnh lý sâu răng và viêm nướu răng hàm trên",
    ],
    sourceReferences: [
      "Khuyến cáo điều trị viêm mũi xoang - Hội Tai Mũi Họng Việt Nam",
      "European Position Paper on Rhinosinusitis and Nasal Polyps (EPOS)",
    ],
  },
  {
    shortTitle: "Viêm da cơ địa và phục hồi hàng rào bảo vệ da trong thời tiết hanh khô",
    category: "Da liễu",
    coverImageUrl: "/media/doctor-family-consult.jpg",
    authorName: "ThS.BS Vũ Thanh Trúc",
    readingMinutes: 5,
    relatedSpecialtySlug: "da-lieu",
    summary: "Ngứa ngáy, da khô tróc vảy và nứt nẻ là những đợt bùng phát của viêm da cơ địa. Liệu pháp dưỡng ẩm đúng cách trong vòng 3 phút sau tắm và sử dụng thuốc bôi đặc hiệu giúp xoa dịu làn da nhạy cảm.",
    body: "Hàng rào biểu bì da hoạt động như bức tường gạch vữa vững chắc ngăn cản mất nước và ngăn vi khuẩn dị nguyên xâm nhập. Ở người viêm da cơ địa, sự thiếu hụt filaggrin và lipid gian bào làm hàng rào này bị suy yếu.",
    sections: [
      {
        heading: "1. Quy tắc dưỡng ẩm '3 phút vàng' sau tắm",
        body: "Tắm với nước ấm vừa phải trong vòng 5-10 phút, sử dụng sữa tắm dịu nhẹ không chứa xà phòng tẩy rửa mạnh. Thấm khô nhẹ bằng khăn bông mềm và thoa ngay kem dưỡng ẩm chứa Ceramide, Hyaluronic Acid hoặc Urea trong vòng 3 phút khi da còn đang có độ ẩm tự nhiên.",
      },
      {
        heading: "2. Sử dụng thuốc bôi chống viêm an toàn",
        body: "Trong đợt viêm cấp có đỏ và rỉ dịch, bác sĩ da liễu sẽ kê kem bôi Corticoid với hoạt lực phù hợp cho từng vùng da (mặt dùng loại nhẹ, thân mình dùng loại trung bình) trong thời gian ngắn, sau đó chuyển sang thuốc ức chế calcineurin để duy trì ổn định.",
      },
      {
        heading: "3. Loại trừ các yếu tố kích ứng từ môi trường",
        body: "Mặc quần áo chất liệu cotton thoáng mát, tránh sợi len và sợi tổng hợp cọ xát trực tiếp vào da. Cắt ngắn móng tay để tránh cào gãi làm trầy xước da dẫn đến bội nhiễm vi khuẩn tụ cầu vàng.",
      },
    ],
    keyTakeaways: [
      "Thoa kem dưỡng ẩm ngay trong vòng 3 phút sau khi tắm giúp khóa ẩm tối ưu",
      "Không tự ý mua kem trộn hoặc corticoid không rõ nguồn gốc bôi mặt kéo dài",
      "Cắt móng tay và tránh cào gãi để ngăn ngừa nhiễm trùng da thứ phát",
    ],
    warningSigns: [
      "Vùng da viêm xuất hiện mụn mủ, đóng vảy tiết màu vàng mật ong và sưng đau",
      "Sốt cao kèm tổn thương da lan rộng nhanh chóng (nghi ngờ chốc lở hoặc eczema herpeticum)",
      "Ngứa dữ dội gây mất ngủ hoàn toàn và ảnh hưởng nghiêm trọng đến sinh hoạt",
    ],
    preventionTips: [
      "Duy trì thói quen bôi kem dưỡng ẩm tối thiểu 2-3 lần mỗi ngày cả khi da đã lành",
      "Sử dụng máy tạo độ ẩm trong phòng ngủ khi sử dụng điều hòa nhiệt độ",
      "Giặt quần áo bằng nước giặt dịu nhẹ, không chứa hương liệu nhân tạo đậm đặc",
    ],
    sourceReferences: [
      "Hướng dẫn chẩn đoán và điều trị bệnh viêm da cơ địa - Bệnh viện Da liễu Trung ương",
      "American Academy of Dermatology (AAD) Atopic Dermatitis Clinical Guidelines",
    ],
  },
  {
    shortTitle: "Tầm soát ung thư đường tiêu hóa: Nội soi phát hiện sớm polyp và tổn thương tiền ung thư",
    category: "Ung bướu",
    coverImageUrl: "/images/packages/general-checkup.jpg",
    authorName: "BS.CKII Ngô Quang Huy",
    readingMinutes: 6,
    relatedSpecialtySlug: "tieu-hoa",
    summary: "Ung thư dạ dày và đại trực tràng hoàn toàn có thể chữa khỏi nếu phát hiện ở giai đoạn sớm. Nội soi tiêu hóa độ phân giải cao kết hợp nhuộm màu NBI giúp nhận diện và cắt bỏ polyp tiền ung thư ngay trong lúc nội soi.",
    body: "Hầu hết các khối u đại trực tràng đều phát triển từ những polyp tuyến lành tính nhỏ trong thời gian từ 5 đến 10 năm. Việc chủ động tầm soát giúp cắt đứt chuỗi tiến triển này trước khi ung thư xâm lấn.",
    sections: [
      {
        heading: "1. Ai nên chủ động tầm soát ung thư tiêu hóa?",
        body: "Người từ 45 tuổi trở lên (hoặc từ 40 tuổi nếu trong gia đình có bố mẹ hoặc anh chị em từng mắc ung thư tiêu hóa). Người có thói quen hút thuốc, uống rượu bia, ăn nhiều thịt đỏ chế biến sẵn và ít chất xơ.",
      },
      {
        heading: "2. Kỹ thuật nội soi nhuộm màu NBI hiện đại",
        body: "Công nghệ dải tần ánh sáng hẹp (NBI) phóng đại hình ảnh cấu trúc vi mạch máu và bề mặt niêm mạc lên hàng trăm lần, giúp phân định rõ ranh giới giữa mô lành và mô ung thư biểu mô sớm.",
      },
      {
        heading: "3. Cắt polyp qua nội soi: Nhẹ nhàng, không phẫu thuật mở",
        body: "Các polyp phát hiện trong quá trình nội soi đại trực tràng sẽ được bác sĩ tiến hành cắt bỏ bằng thòng lọng điện (Snare polypectomy) nhẹ nhàng, không gây đau đớn và gửi bệnh phẩm làm giải phẫu bệnh kiểm tra tế bào học.",
      },
    ],
    keyTakeaways: [
      "Cắt bỏ polyp trong lúc nội soi đại trực tràng giúp giảm đến 80% nguy cơ ung thư đại tràng",
      "Nội soi tiêu hóa không đau (tiền mê nhẹ) rất êm dịu, không gây cảm giác khó chịu",
      "Người từ 45 tuổi nên nội soi đại trực tràng tầm soát định kỳ mỗi 5 - 10 năm một lần",
    ],
    warningSigns: [
      "Đại tiện ra máu tươi hoặc máu lẫn phân sẫm màu kéo dài",
      "Thay đổi thói quen đi tiêu (táo bón xen kẽ tiêu chảy) kéo dài trên 4 tuần",
      "Sụt cân bất thường không rõ nguyên nhân kèm theo mệt mỏi suy nhược",
    ],
    preventionTips: [
      "Ăn nhiều rau củ quả tươi, ngũ cốc giàu chất xơ hòa tan để ruột hoạt động tốt",
      "Hạn chế các loại thịt đỏ nướng, thịt xông khói, xúc xích và đồ uống có cồn",
      "Duy trì tập thể dục thể thao đều đặn giúp tăng nhu động ruột tống xuất độc chất",
    ],
    sourceReferences: [
      "Hướng dẫn chẩn đoán và điều trị ung thư đại trực tràng - Bộ Y tế",
      "American Cancer Society (ACS) Guidelines for Colorectal Cancer Screening",
    ],
  },
  {
    shortTitle: "Quản lý tủ thuốc gia đình và kỹ năng sơ cấp cứu tai nạn sinh hoạt thường gặp",
    category: "Sức khỏe gia đình",
    coverImageUrl: "/media/articles/cham-soc-suc-khoe-tong-quat.jpg",
    authorName: "BS.CKI Hoàng Văn Long",
    readingMinutes: 5,
    relatedSpecialtySlug: "noi-tong-hop",
    summary: "Tủ thuốc gia đình chuẩn bị đúng cách và kiến thức sơ cứu bỏng, dị vật đường thở hay vết thương hở giúp bảo vệ các thành viên trong những phút đầu quan trọng trước khi tiếp cận nhân viên y tế.",
    body: "Tai nạn sinh hoạt trong gia đình như bỏng nước sôi, té ngã trầy xước hoặc dị vật đường thở ở trẻ nhỏ có thể xảy ra bất cứ lúc nào. Sự bình tĩnh và xử trí đúng kỹ thuật ban đầu giảm thiểu tối đa các di chứng đáng tiếc.",
    sections: [
      {
        heading: "1. Danh mục thuốc và vật tư y tế thiết yếu tại nhà",
        body: "Tủ thuốc nên có thuốc hạ sốt giảm đau Paracetamol (dạng viên cho người lớn và gói/siro cho trẻ em), dung dịch sát khuẩn Povidone-Iodine hoặc Chlorhexidine, nước muối sinh lý 0.9%, băng gạc vô khuẩn, kéo y tế, nhiệt kế điện tử và máy đo huyết áp bắp tay.",
      },
      {
        heading: "2. Các bước sơ cứu bỏng nhiệt đúng y khoa",
        body: "Lập tức ngâm hoặc xối nhẹ vùng bị bỏng dưới vòi nước mát sạch trong vòng 15-20 phút để hạ nhiệt độ mô tế bào. Tuyệt đối không bôi kem đánh răng, nước mắm, mỡ trăn hay trứng gà lên vết bỏng vì rất dễ gây nhiễm trùng nặng.",
      },
      {
        heading: "3. Kỹ thuật sơ cứu hóc dị vật bằng nghiệm pháp Heimlich",
        body: "Đứng sau lưng nạn nhân, vòng hai tay ôm quanh eo, một tay nắm thành quả đấm đặt phía trên rốn và dưới mũi ức, tay kia bọc lấy quả đấm rồi giật mạnh theo hướng từ trước ra sau và từ dưới lên trên để tạo áp lực đẩy dị vật ra ngoài.",
      },
    ],
    keyTakeaways: [
      "Sơ cứu bỏng đúng cách là xối nước mát sạch liên tục 15-20 phút, không bôi kem đánh răng",
      "Học thành thạo thủ thuật Heimlich để cứu người bị hóc dị vật thức ăn trong bữa cơm",
      "Kiểm tra hạn sử dụng của thuốc trong tủ thuốc gia đình định kỳ 6 tháng một lần",
    ],
    warningSigns: [
      "Vết thương hở chảy máu phun thành tia hoặc máu đỏ tươi không cầm sau 10 phút ép chặt",
      "Bỏng vùng mặt, cổ, khớp lớn hoặc diện tích bỏng lớn hơn bàn tay nạn nhân",
      "Nạn nhân bất tỉnh, ngưng thở hoặc thở ngáp cá sau tai nạn điện giật hay ngã cao",
    ],
    preventionTips: [
      "Đặt tủ thuốc ở vị trí cao, thoáng mát, xa tầm với của trẻ nhỏ",
      "Dán nhãn ghi rõ công dụng và liều dùng trên từng hộp thuốc trong gia đình",
      "Lưu sẵn số điện thoại cấp cứu 115 và số đường dây nóng bệnh viện gần nhất",
    ],
    sourceReferences: [
      "Tài liệu hướng dẫn sơ cấp cứu ban đầu cho cộng đồng - Hội Chữ thập đỏ Việt Nam",
      "American Red Cross First Aid/CPR/AED Participant's Manual",
    ],
  },
  {
    shortTitle: "Hội chứng thị giác màn hình và bảo vệ đôi mắt cho người làm việc văn phòng",
    category: "Sức khỏe gia đình",
    coverImageUrl: "/media/branches/branch-hospital.jpg",
    authorName: "BS.CKI Nguyễn Lan Anh",
    readingMinutes: 5,
    relatedSpecialtySlug: "noi-tong-hop",
    summary: "Mỏi mắt, khô rát mắt và đau nhức thái dương sau nhiều giờ nhìn màn hình là dấu hiệu của hội chứng thị giác máy tính. Áp dụng quy tắc 20-20-20 và bổ sung nước mắt nhân tạo không chất bảo quản giúp đôi mắt sáng khỏe.",
    body: "Khi tập trung nhìn vào màn hình máy tính hoặc điện thoại thông minh, tần số chớp mắt giảm từ 15-20 lần/phút xuống chỉ còn 5-7 lần/phút. Điều này làm cho màng phim nước mắt bay hơi nhanh chóng, dẫn đến tổn thương bề mặt biểu mô giác mạc.",
    sections: [
      {
        heading: "1. Nguyên tắc nghỉ ngơi mắt 20 - 20 - 20",
        body: "Cứ sau mỗi 20 phút làm việc với màn hình điện tử, hãy phóng tầm mắt nhìn vào một vật thể ở khoảng cách 20 feet (khoảng 6 mét) trong ít nhất 20 giây. Động tác này giúp cơ thể mi trong mắt được thả lỏng hoàn toàn, chấm dứt tình trạng co quắp điều tiết.",
      },
      {
        heading: "2. Chọn lựa nước mắt nhân tạo an toàn",
        body: "Nên chọn các loại nước mắt nhân tạo dạng tép đơn liều (chứa Sodium Hyaluronate 0.1% - 0.18%) không chứa chất bảo quản BAK (Benzalkonium chloride), có thể nhỏ nhiều lần trong ngày mà không gây độc tính cho tế bào biểu mô giác mạc.",
      },
      {
        heading: "3. Điều chỉnh ánh sáng và vị trí màn hình chuẩn",
        body: "Màn hình nên đặt cách mắt khoảng 50-60cm, tâm màn hình thấp hơn tầm mắt nhìn ngang khoảng 10-15cm để mí mắt che bớt bề mặt nhãn cầu, giảm diện tích bốc hơi nước mắt. Điều chỉnh độ sáng màn hình tương đồng với ánh sáng phòng làm việc.",
      },
    ],
    keyTakeaways: [
      "Áp dụng quy tắc 20-20-20 giúp mắt thư giãn sau mỗi 20 phút làm việc máy tính",
      "Ưu tiên sử dụng nước mắt nhân tạo đơn liều không chứa chất bảo quản",
      "Khoảng cách từ mắt tới màn hình tối ưu là 50 - 60cm với độ cao thấp hơn tầm mắt",
    ],
    warningSigns: [
      "Đau nhức mắt dữ dội lan lên đầu kèm nhìn thấy quầng sáng xanh đỏ quanh bóng đèn",
      "Mờ mắt đột ngột ở một mắt, xuất hiện nhiều đốm đen ruồi bay kèm chớp sáng",
      "Mắt đỏ rực, sợ ánh sáng và có cảm giác cộm xốn như có dị vật sắc nhọn trong mắt",
    ],
    preventionTips: [
      "Chớp mắt chủ động và thường xuyên hơn khi đọc văn bản trên thiết bị điện tử",
      "Bổ sung thực phẩm giàu Vitamin A, Lutein và Zeaxanthin (cà rốt, bí đỏ, rau bina)",
      "Đi khám đo khúc xạ và kiểm tra đáy mắt định kỳ mỗi năm một lần",
    ],
    sourceReferences: [
      "Hướng dẫn điều trị và chăm sóc bệnh khô mắt - Hội Nhãn khoa Việt Nam",
      "American Optometric Association (AOA) Computer Vision Syndrome Guidelines",
    ],
  },
  {
    shortTitle: "Rối loạn giấc ngủ và căng thẳng mạn tính: Phục hồi năng lượng bằng thói quen lành mạnh",
    category: "Sức khỏe gia đình",
    coverImageUrl: "/media/doctor-family-consult.jpg",
    authorName: "ThS.BS Bùi Minh Trí",
    readingMinutes: 6,
    relatedSpecialtySlug: "than-kinh",
    summary: "Khó vào giấc ngủ, thức giấc giữa đêm hoặc dậy mệt mỏi báo hiệu rối loạn nhịp sinh học do stress. Thực hành vệ sinh giấc ngủ (Sleep Hygiene) kết hợp liệu pháp thư giãn hơi thở giúp cải thiện chất lượng giấc ngủ tự nhiên.",
    body: "Giấc ngủ là khoảng thời gian vàng để não bộ kích hoạt hệ thống glymphatic dọn dẹp các độc chất chuyển hóa tích tụ sau một ngày hoạt động. Mất ngủ kéo dài làm tăng gấp đôi nguy cơ trầm cảm, suy giảm trí nhớ và tăng huyết áp.",
    sections: [
      {
        heading: "1. Vệ sinh giấc ngủ (Sleep Hygiene) - Chìa khóa vàng cho giấc ngủ ngon",
        body: "Đi ngủ và thức dậy vào một khung giờ cố định mỗi ngày, kể cả dịp cuối tuần. Phòng ngủ cần yên tĩnh, tối và nhiệt độ mát mẻ (khoảng 22-25 độ C). Không sử dụng giường ngủ để làm việc hoặc xem tivi.",
      },
      {
        heading: "2. Hạn chế ánh sáng xanh và chất kích thích",
        body: "Ánh sáng xanh từ màn hình điện thoại ức chế tuyến tùng tiết melatonin - hormone gây ngủ. Cần tắt toàn bộ thiết bị điện tử trước khi đi ngủ ít nhất 60 phút. Tránh uống cà phê, trà đậm hoặc nước tăng lực sau 14h chiều.",
      },
      {
        heading: "3. Kỹ thuật thở thư giãn 4 - 7 - 8 kích hoạt hệ phó giao cảm",
        body: "Hít vào từ từ bằng mũi trong 4 giây, nín thở giữ hơi trong 7 giây, sau đó thở ra nhẹ nhàng bằng miệng tạo âm thanh êm dịu trong 8 giây. Lặp lại 4 chu kỳ giúp làm dịu hệ thần kinh giao cảm và đưa cơ thể vào trạng thái sẵn sàng ngủ.",
      },
    ],
    keyTakeaways: [
      "Cố định giờ đi ngủ và thức dậy mỗi ngày để thiết lập đồng hồ sinh học chuẩn xác",
      "Tắt điện thoại và màn hình máy tính trước khi lên giường ít nhất 1 giờ",
      "Kỹ thuật thở 4-7-8 giúp xoa dịu lo âu và đưa tâm trí vào giấc ngủ dễ dàng",
    ],
    warningSigns: [
      "Mất ngủ liên tục trên 3 tuần gây giảm sút nghiêm trọng hiệu suất công việc",
      "Cơn hoảng loạn (Panic attack) tim đập thình thịch, khó thở, cảm giác nghẹt thở",
      "Xuất hiện cảm giác bi quan, mất hứng thú với mọi sở thích hoặc có suy nghĩ tiêu cực",
    ],
    preventionTips: [
      "Tắm nước ấm trước khi đi ngủ 1-2 tiếng giúp hạ nhiệt độ trung tâm cơ thể",
      "Không ăn bữa tối quá no hoặc sử dụng rượu bia làm chất giải tỏa stress",
      "Tập thể dục nhịp điệu vào ban ngày, tránh tập nặng sát giờ đi ngủ",
    ],
    sourceReferences: [
      "Hướng dẫn chẩn đoán và điều trị mất ngủ - Viện Sức khỏe Tâm thần Quốc gia",
      "American Academy of Sleep Medicine (AASM) Clinical Practice Guideline",
    ],
  },
  {
    shortTitle: "Chăm sóc sức khỏe người cao tuổi: Phòng ngừa té ngã và kiểm soát bệnh lý đa mạn tính",
    category: "Sức khỏe gia đình",
    coverImageUrl: "/media/articles/cham-soc-suc-khoe-tong-quat.jpg",
    authorName: "BS.CKII Phan Bích Ngọc",
    readingMinutes: 6,
    relatedSpecialtySlug: "noi-tong-hop",
    summary: "Té ngã ở người cao tuổi có thể dẫn đến gãy cổ xương đùi hoặc chấn thương sọ não nguy hiểm. Đánh giá mật độ xương, rà soát tương tác thuốc và cải thiện môi trường sống giúp bảo vệ người cao tuổi sống vui khỏe, tự chủ.",
    body: "Quá trình lão hóa tự nhiên dẫn đến tình trạng suy giảm khối cơ (Sarcopenia), loãng xương và giảm thị lực thính lực. Chăm sóc người cao tuổi đòi hỏi sự phối hợp đa chuyên khoa và sự thấu hiểu đồng hành từ các thành viên trong gia đình.",
    sections: [
      {
        heading: "1. Nguyên nhân và hậu quả nghiêm trọng của té ngã",
        body: "Té ngã thường do hạ huyết áp tư thế, giảm thị lực, tác dụng phụ của thuốc an thần hoặc sàn nhà trơn trượt. Gãy xương đùi ở người già khiến người bệnh phải nằm bất động lâu, dễ gặp biến chứng loét tỳ đè, viêm phổi ứ đọng và huyết khối tĩnh mạch sâu.",
      },
      {
        heading: "2. Cải thiện môi trường sống an toàn trong gia đình",
        body: "Lắp đặt thanh vịn chắc chắn trong nhà tắm và cạnh bồn cầu. Dán miếng chống trượt trên sàn gạch men. Bố trí đủ ánh sáng ở hành lang và cầu thang, đặc biệt là đèn ngủ ban đêm. Loại bỏ thảm chùi chân trơn trượt và dây điện vướng víu.",
      },
      {
        heading: "3. Rà soát danh mục thuốc định kỳ cùng bác sĩ",
        body: "Người cao tuổi thường mắc cùng lúc 3-4 bệnh mạn tính (tăng huyết áp, tiểu đường, thoái hóa khớp) và phải uống nhiều loại thuốc (Polypharmacy). Việc mang toàn bộ các loại thuốc đang dùng đến bác sĩ rà soát giúp loại trừ các tương tác thuốc bất lợi.",
      },
    ],
    keyTakeaways: [
      "Lắp tay vịn trong nhà vệ sinh và đảm bảo đủ ánh sáng lối đi ban đêm để phòng té ngã",
      "Đo mật độ xương DEXA để phát hiện loãng xương và điều trị bổ sung Canxi/Vitamin D kịp thời",
      "Mang toàn bộ đơn thuốc và thuốc đang uống đi khám để bác sĩ rà soát tương tác thuốc",
    ],
    warningSigns: [
      "Té ngã bất ngờ dù không bị vấp ngã (nguy cơ cơn thiếu máu não hoặc rối loạn nhịp tim)",
      "Đau chói vùng háng hoặc không thể đứng dậy sau một cú ngã nhẹ",
      "Lú lẫn, quên đường về nhà hoặc không nhận ra người thân trong gia đình",
    ],
    preventionTips: [
      "Tập dưỡng sinh, thái cực quyền hoặc đi bộ nhẹ nhàng 20-30 phút/ngày để rèn thăng bằng",
      "Bổ sung thực phẩm giàu đạm dễ tiêu (cá, sữa chua, trứng) để duy trì khối lượng cơ",
      "Kiểm tra thị lực và thay kính phù hợp định kỳ mỗi năm một lần",
    ],
    sourceReferences: [
      "Khuyến cáo chăm sóc sức khỏe người cao tuổi - Hội Lão khoa Việt Nam",
      "World Health Organization (WHO) Integrated Care for Older People (ICOPE) Guidelines",
    ],
  },
];

function fixtureIndex(slug: string, prefix: string): number | null {
  const match = new RegExp(`^${prefix}-(\\d+)$`).exec(slug.trim());
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function presentPublicService(service: MedicalService): MedicalService {
  const index = fixtureIndex(service.slug, "dv");
  if (index === null || !/^Dịch vụ y tế \d+$/i.test(service.name.trim())) return service;
  const [name, description] = SERVICE_VARIANTS[(index - 1) % SERVICE_VARIANTS.length];
  const cycle = Math.floor((index - 1) / SERVICE_VARIANTS.length) + 1;
  return { ...service, name: cycle === 1 ? name : `${name} · lần ${cycle}`, description };
}

export function presentPublicPackage(item: HealthPackage): HealthPackage {
  const index = fixtureIndex(item.slug, "goi");
  if (index === null || !/^Gói khám sức khỏe cấp [A-Z] #\d+$/i.test(item.name.trim())) return item;
  const [name, description] = PACKAGE_VARIANTS[(index - 1) % PACKAGE_VARIANTS.length];
  const cycle = Math.floor((index - 1) / PACKAGE_VARIANTS.length) + 1;
  return { ...item, name: cycle === 1 ? name : `${name} · lựa chọn ${cycle}`, description };
}

export function presentPublicArticle(article: Article): Article {
  const index = fixtureIndex(article.slug, "bv");
  if (index === null || !/^Bài viết y khoa số \d+$/i.test(article.title.trim())) {
    const resolvedCover = article.coverImageUrl?.trim() || resolveCover(article.category || "", article.slug || article.title);
    return {
      ...article,
      coverImageUrl: resolvedCover,
    };
  }

  const topic = article.category?.trim() || "Sức khỏe chủ động";
  const template = BIG_DATA_CLINICAL_ARTICLES[(index - 1) % BIG_DATA_CLINICAL_ARTICLES.length];
  const cycle = Math.floor((index - 1) / BIG_DATA_CLINICAL_ARTICLES.length) + 1;
  const resolvedCover = article.coverImageUrl?.trim() || template.coverImageUrl || resolveCover(topic, article.slug);

  return {
    ...article,
    coverImageUrl: resolvedCover,
    title: `${topic}: ${template.shortTitle}${cycle > 1 ? ` · phần ${cycle}` : ""}`,
    summary: template.summary,
    body: template.body,
    sections: template.sections,
    keyTakeaways: template.keyTakeaways,
    warningSigns: template.warningSigns,
    preventionTips: template.preventionTips,
    sourceReferences: template.sourceReferences,
    authorName: article.authorName && article.authorName !== "Đội ngũ chuyên môn" ? article.authorName : template.authorName,
    readingMinutes: article.readingMinutes || template.readingMinutes,
    relatedSpecialtySlug: article.relatedSpecialtySlug || template.relatedSpecialtySlug,
    category: topic,
  };
}

export function dedupePublicDoctors(doctors: Doctor[]): Doctor[] {
  const seen = new Set<string>();
  return doctors.filter((doctor) => {
    const key = [
      doctor.fullName.trim().toLocaleLowerCase("vi-VN"),
      doctor.bio.trim().toLocaleLowerCase("vi-VN"),
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function presentPublicPage<T, P extends { content: T[] }>(page: P, transform: (value: T) => T): P {
  return { ...page, content: page.content.map(transform) };
}
