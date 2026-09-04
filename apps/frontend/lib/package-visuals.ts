import type { HealthPackage } from "../types/hospital";

export interface PackageVisual {
  imageSrc: string;
  imageAlt: string;
  category: string;
  sourceHref: string;
  sourceLabel: string;
  tone: "general" | "cardio" | "metabolic" | "women" | "children" | "digestive";
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
    category: "Tim mạch",
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
    imageAlt: "Người bệnh được kiểm tra huyết áp trong buổi tư vấn sức khỏe",
    category: "Sức khỏe phụ nữ",
    sourceHref: "https://www.pexels.com/photo/woman-consulting-a-doctor-5215008/",
    sourceLabel: "AI25.Studio / Pexels",
  },
  children: {
    imageSrc: "/images/packages/child-checkup.jpg",
    imageAlt: "Bác sĩ khám sức khỏe cho trẻ bằng ống nghe",
    category: "Nhi khoa",
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
};

function resolveTone(packageItem: Pick<HealthPackage, "slug" | "name">): PackageVisual["tone"] {
  const identity = `${packageItem.slug} ${packageItem.name}`.toLocaleLowerCase("vi-VN");

  if (/tim|cardio/.test(identity)) return "cardio";
  if (/tiểu đường|tieu-duong|đường huyết|duong-huyet|chuyển hóa|chuyen-hoa/.test(identity)) return "metabolic";
  if (/phụ nữ|phu-nu|sản|san-khoa/.test(identity)) return "women";
  if (/trẻ em|tre-em|nhi khoa|nhi-khoa/.test(identity)) return "children";
  if (/tiêu hóa|tieu-hoa|dạ dày|da-day|gan mật|gan-mat|đại tràng|dai-trang/.test(identity)) return "digestive";
  return "general";
}

export function getPackageVisual(packageItem: Pick<HealthPackage, "slug" | "name">): PackageVisual {
  const tone = resolveTone(packageItem);
  return { ...VISUALS[tone], tone };
}
