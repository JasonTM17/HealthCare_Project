import type { Article, Doctor, HealthPackage, MedicalService } from "../types/hospital";

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

const ARTICLE_VARIANTS = [
  "Nhận biết sớm dấu hiệu cần đi khám",
  "Hướng dẫn chuẩn bị trước buổi khám",
  "Thói quen hằng ngày giúp chăm sóc sức khỏe",
  "Giải đáp câu hỏi thường gặp",
  "Khi nào nên trao đổi với bác sĩ",
  "Gợi ý theo dõi triệu chứng tại nhà",
  "Dinh dưỡng và vận động phù hợp",
  "Chăm sóc sức khỏe cho cả gia đình",
  "Những điều cần biết trước khi xét nghiệm",
  "Tóm tắt dễ hiểu từ đội ngũ chuyên môn",
] as const;

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
  if (index === null || !/^Bài viết y khoa số \d+$/i.test(article.title.trim())) return article;
  const topic = article.category?.trim() || "Sức khỏe chủ động";
  const variant = ARTICLE_VARIANTS[(index - 1) % ARTICLE_VARIANTS.length];
  const cycle = Math.floor((index - 1) / ARTICLE_VARIANTS.length) + 1;
  const topicText = topic.toLocaleLowerCase("vi-VN");
  return {
    ...article,
    title: `${topic}: ${variant}${cycle > 1 ? ` · phần ${cycle}` : ""}`,
    summary: `Thông tin dễ hiểu về ${topicText} để bạn chuẩn bị câu hỏi và trao đổi với bác sĩ.`,
    body: `Bài viết cung cấp gợi ý thực tế về ${topicText}. Nếu triệu chứng kéo dài, nặng lên hoặc ảnh hưởng sinh hoạt, hãy liên hệ nhân viên y tế để được hướng dẫn.`,
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
