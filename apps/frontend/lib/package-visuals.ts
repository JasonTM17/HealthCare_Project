import type { HealthPackage } from "../types/hospital";

export interface PackageVisual {
  imageSrc: string;
  imageAlt: string;
  category: string;
  sourceHref: string;
  sourceLabel: string;
  tone:
    | "general"
    | "cardio"
    | "metabolic"
    | "women"
    | "children"
    | "digestive"
    | "bone-joint"
    | "neurological"
    | "cancer"
    | "geriatric"
    | "men"
    | "respiratory"
    | "premarital"
    | "executive";
}

const VISUALS: Record<PackageVisual["tone"], Omit<PackageVisual, "tone">> = {
  general: {
    imageSrc: "/images/packages/general-checkup.jpg",
    imageAlt: "Người bệnh trao đổi nhu cầu sức khỏe trong phòng khám",
    category: "Khám tổng quát",
    sourceHref: "https://www.pexels.com/photo/people-woman-sitting-doctor-7088494/",
    sourceLabel: "MART PRODUCTION / Pexels",
  },
  cardio: {
    imageSrc: "/images/packages/heart-screening.jpg",
    imageAlt: "Người bệnh thực hiện kiểm tra tim mạch dưới sự theo dõi của nhân viên y tế",
    category: "Tim mạch & Huyết áp",
    sourceHref: "https://www.pexels.com/photo/patient-during-a-procedure-in-a-hospital-8460226/",
    sourceLabel: "Los Muertos Crew / Pexels",
  },
  metabolic: {
    imageSrc: "/images/packages/diabetes-screening.jpg",
    imageAlt: "Nhân viên y tế hướng dẫn kiểm tra đường huyết bằng máy đo",
    category: "Tầm soát chuyển hóa",
    sourceHref: "https://www.pexels.com/photo/glucose-meter-in-doctor-hands-7653129/",
    sourceLabel: "Pavel Danilyuk / Pexels",
  },
  women: {
    imageSrc: "/images/packages/womens-health.jpg",
    imageAlt: "Người bệnh được kiểm tra huyết áp trong buổi tư vấn sức khỏe phụ nữ",
    category: "Sức khỏe phụ nữ",
    sourceHref: "https://www.pexels.com/photo/woman-consulting-a-doctor-5215008/",
    sourceLabel: "AI25.Studio / Pexels",
  },
  children: {
    imageSrc: "/images/packages/child-checkup.jpg",
    imageAlt: "Bác sĩ khám sức khỏe cho trẻ bằng ống nghe",
    category: "Nhi khoa & Trẻ em",
    sourceHref: "https://www.pexels.com/photo/a-doctor-examining-a-child-patient-5998455/",
    sourceLabel: "Pavel Danilyuk / Pexels",
  },
  digestive: {
    imageSrc: "/images/packages/digestive-health.jpg",
    imageAlt: "Bác sĩ chuyên khoa thăm khám và tư vấn hệ tiêu hóa",
    category: "Tiêu hóa & Gan mật",
    sourceHref: "https://www.pexels.com/license/",
    sourceLabel: "HealthCare Clinical Asset",
  },
  "bone-joint": {
    imageSrc: "/images/packages/bone-joint.jpg",
    imageAlt: "Đo mật độ xương DEXA và tầm soát bệnh lý cơ xương khớp",
    category: "Cơ xương khớp",
    sourceHref: "https://www.pexels.com/license/",
    sourceLabel: "HealthCare Clinical Asset",
  },
  neurological: {
    imageSrc: "/images/packages/neurological-health.jpg",
    imageAlt: "Tầm soát chức năng thần kinh, não bộ và phòng ngừa đột quỵ",
    category: "Thần kinh & Não bộ",
    sourceHref: "https://www.pexels.com/license/",
    sourceLabel: "HealthCare Clinical Asset",
  },
  cancer: {
    imageSrc: "/images/packages/cancer-screening.jpg",
    imageAlt: "Hệ thống chẩn đoán hình ảnh và tầm soát sớm ung bướu kỹ thuật cao",
    category: "Tầm soát ung bướu",
    sourceHref: "https://www.pexels.com/license/",
    sourceLabel: "HealthCare Clinical Asset",
  },
  geriatric: {
    imageSrc: "/images/packages/geriatric-health.jpg",
    imageAlt: "Chăm sóc sức khỏe toàn diện và quản lý bệnh lý mãn tính cho người cao tuổi",
    category: "Lão khoa & Cao tuổi",
    sourceHref: "https://www.pexels.com/license/",
    sourceLabel: "HealthCare Clinical Asset",
  },
  men: {
    imageSrc: "/images/packages/mens-health.jpg",
    imageAlt: "Khám và tầm soát chuyên sâu sức khỏe phái mạnh, nội tiết và nam học",
    category: "Sức khỏe nam giới",
    sourceHref: "https://www.pexels.com/license/",
    sourceLabel: "HealthCare Clinical Asset",
  },
  respiratory: {
    imageSrc: "/images/packages/respiratory-health.jpg",
    imageAlt: "Thăm khám chức năng hô hấp, tầm soát bệnh lý phổi và phế quản",
    category: "Hô hấp & Phổi",
    sourceHref: "https://www.pexels.com/license/",
    sourceLabel: "HealthCare Clinical Asset",
  },
  premarital: {
    imageSrc: "/images/packages/premarital-checkup.jpg",
    imageAlt: "Tư vấn và kiểm tra sức khỏe tiền hôn nhân cho các cặp đôi",
    category: "Tiền hôn nhân",
    sourceHref: "https://www.pexels.com/license/",
    sourceLabel: "HealthCare Clinical Asset",
  },
  executive: {
    imageSrc: "/images/packages/executive-checkup.jpg",
    imageAlt: "Khám sức khỏe tổng quát chuyên sâu cao cấp cho doanh nhân",
    category: "Khám chuyên sâu VIP",
    sourceHref: "https://www.pexels.com/license/",
    sourceLabel: "HealthCare Clinical Asset",
  },
};

function resolveTone(packageItem: Pick<HealthPackage, "slug" | "name">): PackageVisual["tone"] {
  const identity = `${packageItem.slug} ${packageItem.name}`.toLocaleLowerCase("vi-VN");

  if (/tim|mạch|cardio|huyết áp|huyet-ap/.test(identity)) return "cardio";
  if (/tiểu đường|tieu-duong|đường huyết|duong-huyet|chuyển hóa|chuyen-hoa|tuyến giáp|tuyen-giap/.test(identity)) return "metabolic";
  if (/phụ nữ|phu-nu|phụ khoa|phu-khoa|thai sản|thai-san|sản|san-khoa|sinh sản|tử cung|buồng trứng/.test(identity)) return "women";
  if (/tiền hôn nhân|tien-hon-nhan|cặp đôi|cap-doi|hôn nhân|hon-nhan/.test(identity)) return "premarital";
  if (/trẻ em|tre-em|nhi|nhi-khoa|cho bé|cho-be|trẻ nhỏ|tre-nho/.test(identity)) return "children";
  if (/tiêu hóa|tieu-hoa|dạ dày|da-day|gan mật|gan-mat|đại tràng|dai-trang|vi khuẩn hp|nội soi/.test(identity)) return "digestive";
  if (/xương khớp|xuong-khop|cơ xương khớp|co-xuong-khop|loãng xương|loang-xuong|cột sống|cot-song|thoái hóa/.test(identity)) return "bone-joint";
  if (/thần kinh|than-kinh|đột quỵ|dot-quy|não|nao-bo|tai biến|tiền đình/.test(identity)) return "neurological";
  if (/ung bướu|ung-buou|ung thư|ung-thu|tầm soát u|tam-soat-u|sinh thiết|marker ung thư/.test(identity)) return "cancer";
  if (/cao tuổi|cao-tuoi|lão khoa|lao-khoa|người già|nguoi-gia|hưu trí/.test(identity)) return "geriatric";
  if (/nam giới|nam-gioi|nam khoa|nam-khoa|phái mạnh|tuyến tiền liệt/.test(identity)) return "men";
  if (/hô hấp|ho-hap|phổi|phoi|phế quản|phe-quan|hen suyễn/.test(identity)) return "respiratory";
  if (/vip|doanh nhân|doanh-nhan|chuyên sâu|toàn diện cao cấp|executive/.test(identity)) return "executive";

  return "general";
}

export function getPackageVisual(packageItem: Pick<HealthPackage, "slug" | "name">): PackageVisual {
  const tone = resolveTone(packageItem);
  const baseVisual = VISUALS[tone];

  const rankMatch = packageItem.name.match(/Hạng\s*(\d+)/i) || packageItem.slug.match(/goi-(\d+)/i);
  if (rankMatch) {
    const rankNum = parseInt(rankMatch[1], 10);
    if (tone === "general" && rankNum % 2 === 0) {
      return { ...VISUALS.executive, tone };
    }
    if (tone === "bone-joint" && rankNum % 2 === 1 && rankNum > 3) {
      return { ...VISUALS.geriatric, tone };
    }
  }

  return { ...baseVisual, tone };
}
