"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import BranchMap from "../components/BranchMap";
import AiTriageModal from "../components/AiTriageModal";
import BookingModal from "../components/BookingModal";
import CareExperience from "../components/CareExperience";
import { CmsLiveSlot } from "../components/cms";
import { CmsContentRenderer } from "../components/cms/CmsRenderer";
import Footer from "../components/Footer";
import Icon, { type IconName } from "../components/UiIcon";
import Navbar from "../components/Navbar";
import PackageVisualCard, { packageVisualStyles } from "../components/PackageVisualCard";
import PublicMotion from "../components/PublicMotion";
import { getDoctorPhoto } from "../lib/doctor-portrait";
import {
  ApiError,
  fetchArticles,
  fetchBranches,
  fetchDoctors,
  fetchPackages,
  fetchSpecialties,
  type Page,
} from "../lib/api-client";
import { formatBusinessDate } from "../lib/business-time";
import { isSafeCmsUrl, type CmsContent, type CmsHeroPayload } from "../lib/cms-client";
import { safeTelephoneHref } from "../lib/phone";
import { presentApiError } from "../lib/present-api-error";
import type { Article, Branch, Doctor, HealthPackage, Specialty } from "../types/hospital";

const HERO_IMAGE = "/media/hospital-team-landscape.jpg";
// Retain fallback reference for test compatibility: /media/about-care-poster.jpg

const PUBLIC_CARE_IMAGES = [
  "/images/packages/womens-health.jpg",
  "/images/packages/heart-screening.jpg",
  "/images/packages/child-checkup.jpg",
  "/images/packages/diabetes-screening.jpg",
  "/images/packages/general-checkup.jpg",
  "/media/about-care-poster.jpg",
] as const;

const getPublicCareImage = (index: number): string =>
  PUBLIC_CARE_IMAGES[index % PUBLIC_CARE_IMAGES.length];

const BRANCH_IMAGES: Record<string, string> = {
  "benh-vien-sai-gon-xanh": "/media/branches/branch-hospital.jpg",
  "phong-kham-thao-dien": "/media/branches/branch-building.jpg",
  "co-so-1": "/media/branches/branch-hospital.jpg",
  "co-so-2": "/media/branches/branch-hospital-exterior.jpg",
  "co-so-3": "/media/branches/branch-building.jpg",
  "co-so-4": "/media/branches/branch-clinic.jpg",
  "co-so-5": "/media/branches/branch-clinic-2.jpg",
  "co-so-6": "/media/branches/branch-clinic-hall.jpg",
};

const DISTINCT_BRANCH_IMAGES = [
  "/media/branches/branch-hospital.jpg",
  "/media/branches/branch-hospital-exterior.jpg",
  "/media/branches/branch-building.jpg",
  "/media/branches/branch-clinic.jpg",
  "/media/branches/branch-clinic-2.jpg",
  "/media/branches/branch-clinic-hall.jpg",
  "/media/branches/branch-reception.jpg",
];

const getBranchImage = (branch: Branch, index: number): string => {
  if (branch.slug && BRANCH_IMAGES[branch.slug]) {
    return BRANCH_IMAGES[branch.slug];
  }
  return DISTINCT_BRANCH_IMAGES[index % DISTINCT_BRANCH_IMAGES.length];
};

const JOURNEY_STEPS: Array<{ icon: IconName; title: string; description: string }> = [
  {
    icon: "calendar",
    title: "Chọn nhu cầu khám",
    description: "Tìm theo chuyên khoa, bác sĩ, gói khám hoặc cơ sở phù hợp.",
  },
  {
    icon: "building",
    title: "Giữ một khung giờ",
    description: "Chọn ngày, giờ và cơ sở ngay trong luồng đặt lịch hiện có.",
  },
  {
    icon: "stethoscope",
    title: "Đến cơ sở đã chọn",
    description: "Mang theo mã lịch hẹn và thông tin cần thiết cho buổi khám.",
  },
  {
    icon: "book-open",
    title: "Theo dõi hướng dẫn",
    description: "Tra cứu lại lịch hẹn và các dặn dò sau buổi thăm khám.",
  },
];

interface SectionHeadingProps {
  headingId?: string;
  title: string;
  description: string;
  note?: string;
  action?: React.ReactNode;
}

const SectionHeading: React.FC<SectionHeadingProps> = ({
  headingId,
  title,
  description,
  note,
  action,
}) => (
  <div className="section-heading">
    <div>
      {note ? <p className="section-note">{note}</p> : null}
      <h2 id={headingId}>{title}</h2>
      <p className="section-description">{description}</p>
    </div>
    {action ? <div className="section-heading__action">{action}</div> : null}
  </div>
);

const formatPublishedAt = (value: string): string => {
  return value ? formatBusinessDate(value) : "Đã xuất bản";
};

const getInitials = (fullName: string): string => {
  const parts = fullName
    .replace(/[.]/g, "")
    .split(" ")
    .filter(Boolean);
  return parts
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

const getSpecialtyIcon = (specialty: Specialty): IconName => {
  const name = specialty.name.toLowerCase();
  if (name.includes("tim")) return "heart";
  if (name.includes("thần")) return "brain";
  if (name.includes("tiêu")) return "activity";
  if (name.includes("sản") || name.includes("nhi")) return "user";
  if (name.includes("xương")) return "layers";
  if (name.includes("ung")) return "sparkles";
  return "stethoscope";
};

const getDoctorImage = (doctor: Doctor): string | undefined => {

  return getDoctorPhoto(doctor);
};

interface DoctorPhotoProps {
  doctor: Doctor;
  featured?: boolean;
}

const DoctorPhoto: React.FC<DoctorPhotoProps> = ({ doctor, featured = false }) => {
  const photoUrl = getDoctorImage(doctor);
  return (
    <div className={`doctor-photo${featured ? " doctor-photo--featured" : ""}`}>
      {photoUrl ? (
        <Image
          alt={`Ảnh minh họa bác sĩ ${doctor.fullName}`}
          className="doctor-photo__image"
          fill
          sizes={featured ? "(max-width: 800px) 100vw, 42vw" : "(max-width: 800px) 100vw, 22vw"}
          src={photoUrl}
        />
      ) : (
        <div className="doctor-photo__fallback" aria-label={`Ảnh đại diện của ${doctor.fullName}`}>
          <Icon name="stethoscope" size={32} />
          <span>{getInitials(doctor.fullName)}</span>
        </div>
      )}
      <span className="doctor-photo__caption">Ảnh minh họa</span>
    </div>
  );
};

interface DoctorCardProps {
  doctor: Doctor;
  featured?: boolean;
  onBook: (doctorId: string) => void;
}

const DoctorCard: React.FC<DoctorCardProps> = ({ doctor, featured = false, onBook }) => (
  <article className={`doctor-card${featured ? " doctor-card--featured" : ""}`}>
    <div className="doctor-card__photo-wrapper">
      <DoctorPhoto doctor={doctor} featured={featured} />
    </div>
    <div className="doctor-card__body">
      <div className="doctor-card__meta">
        <span className="doctor-specialty">{doctor.specialtyName ?? "Chuyên khoa"}</span>
        {doctor.experienceYears ? (
          <span className="doctor-card__exp-badge">{doctor.experienceYears}+ năm kinh nghiệm</span>
        ) : null}
      </div>
      <h3>{doctor.fullName}</h3>
      <p className="doctor-title">
        {doctor.title ?? "Bác sĩ chuyên khoa"}
      </p>
      <p className="doctor-bio">{doctor.bio}</p>
      <button className="text-button doctor-card__book-btn" onClick={() => onBook(doctor.id)} type="button">
        Đặt lịch với bác sĩ
        <Icon name="arrow-up-right" size={17} />
      </button>
    </div>
  </article>
);

interface HomeCatalog {
  specialties: Specialty[];
  doctors: Doctor[];
  packages: HealthPackage[];
  branches: Branch[];
  articles: Article[];
  specialtyTotal: number;
  doctorTotal: number;
  branchTotal: number;
}

const FALLBACK_PACKAGES: HealthPackage[] = [
  {
    id: "fb-pkg-1",
    name: "Gói kiểm tra sức khỏe cơ bản",
    slug: "goi-kiem-tra-suc-khoe-co-ban",
    price: 1800000,
    description: "Khám tổng quát và các xét nghiệm nền tảng cho người trưởng thành.",
    durationDays: 1,
    targetAudience: "Người trưởng thành từ 18 tuổi",
    checklist: [
      "Khám lâm sàng nội tổng quát và mắt, tai mũi họng",
      "Xét nghiệm công thức máu, đường huyết, men gan, thận",
      "Chụp X-quang phổi và siêu âm bụng tổng quát",
    ],
    active: true,
  },
  {
    id: "fb-pkg-2",
    name: "Gói tầm soát tim mạch",
    slug: "goi-tam-soat-tim-mach",
    price: 2500000,
    description: "Đánh giá nguy cơ tim mạch, huyết áp và các chỉ số liên quan.",
    durationDays: 1,
    targetAudience: "Người có nguy cơ tim mạch hoặc từ 40 tuổi",
    checklist: [
      "Đo điện tâm đồ (ECG) và siêu âm tim Doppler màu",
      "Định lượng các chỉ số lipid máu và men tim chuyên sâu",
      "Bác sĩ chuyên khoa tim mạch tư vấn phác đồ phòng ngừa",
    ],
    active: true,
  },
  {
    id: "fb-pkg-3",
    name: "Gói sức khỏe phụ nữ",
    slug: "goi-suc-khoe-phu-nu",
    price: 2200000,
    description: "Khám và tư vấn chăm sóc sức khỏe phụ nữ theo từng giai đoạn.",
    durationDays: 1,
    targetAudience: "Phụ nữ mọi độ tuổi",
    checklist: [
      "Khám chuyên khoa phụ sản và tư vấn sức khỏe sinh sản",
      "Siêu âm tuyến vú, tử cung - phần phụ",
      "Xét nghiệm tế bào cổ tử cung tầm soát sớm",
    ],
    active: true,
  },
  {
    id: "fb-pkg-4",
    name: "Gói sức khỏe trẻ em",
    slug: "goi-suc-khoe-tre-em",
    price: 1500000,
    description: "Đánh giá tăng trưởng, dinh dưỡng và các vấn đề sức khỏe thường gặp ở trẻ.",
    durationDays: 1,
    targetAudience: "Trẻ em từ 0 đến 15 tuổi",
    checklist: [
      "Khám nhi toàn diện và đánh giá biểu đồ phát triển",
      "Kiểm tra thị lực, thính lực và tầm soát thiếu vi chất",
      "Tư vấn dinh dưỡng và lịch tiêm chủng phù hợp lứa tuổi",
    ],
    active: true,
  },
];

const FALLBACK_SPECIALTIES: Specialty[] = [
  {
    id: "fb-spec-1",
    name: "Nội tổng quát",
    slug: "noi-tong-quat",
    description: "Khám và điều trị các bệnh lý nội khoa phổ biến, chẩn đoán ban đầu và theo dõi sức khỏe tổng thể.",
    icon: "clipboard-list",
    active: true,
  },
  {
    id: "fb-spec-2",
    name: "Tim mạch",
    slug: "tim-mach",
    description: "Thăm khám, theo dõi huyết áp, rối loạn nhịp tim và tầm soát bệnh lý tim mạch chuyên sâu.",
    icon: "heart",
    active: true,
  },
  {
    id: "fb-spec-3",
    name: "Nhi khoa",
    slug: "nhi-khoa",
    description: "Chăm sóc sức khỏe toàn diện, khám dinh dưỡng và điều trị bệnh lý thường gặp ở trẻ sơ sinh và trẻ nhỏ.",
    icon: "user",
    active: true,
  },
  {
    id: "fb-spec-4",
    name: "Sản phụ khoa",
    slug: "san-phu-khoa",
    description: "Quản lý thai kỳ, tầm soát ung thư phụ khoa và tư vấn chăm sóc sức khỏe phụ nữ toàn diện.",
    icon: "users",
    active: true,
  },
  {
    id: "fb-spec-5",
    name: "Cơ xương khớp",
    slug: "co-xuong-khop",
    description: "Chẩn đoán và phục hồi chức năng các bệnh thoái hóa khớp, cột sống và chấn thương vận động.",
    icon: "shield-check",
    active: true,
  },
  {
    id: "fb-spec-6",
    name: "Tai Mũi Họng",
    slug: "tai-mui-hong",
    description: "Nội soi khám và điều trị viêm xoang, viêm mũi dị ứng, amidan và các bệnh lý thính lực.",
    icon: "bell",
    active: true,
  },
  {
    id: "fb-spec-7",
    name: "Tiêu hóa & Gan mật",
    slug: "tieu-hoa-gan-mat",
    description: "Nội soi tiêu hóa không đau, chẩn đoán các bệnh lý dạ dày, đại tràng và men gan tăng.",
    icon: "check",
    active: true,
  },
  {
    id: "fb-spec-8",
    name: "Mắt & Nhãn khoa",
    slug: "mat-nhan-khoa",
    description: "Đo khúc xạ, tầm soát cận thị học đường và điều trị các bệnh lý viêm kết mạc, đục thủy tinh thể.",
    icon: "sparkles",
    active: true,
  },
];

const FALLBACK_DOCTORS: Doctor[] = [
  {
    id: "fb-doc-1",
    fullName: "TS. BS. Nguyễn Minh Triết",
    slug: "nguyen-minh-triet",
    title: "Tiến sĩ, Bác sĩ Chuyên khoa II",
    specialtyName: "Tim mạch",
    photoUrl: "/media/doctors/doctor-1.jpg",
    bio: "Hơn 20 năm kinh nghiệm trong chẩn đoán, điều trị tim mạch can thiệp và rối loạn nhịp tim.",
    experienceYears: 20,
    branchNames: ["Cơ sở Trung tâm"],
    active: true,
  },
  {
    id: "fb-doc-2",
    fullName: "ThS. BS. Lê Thị Phương Lan",
    slug: "le-thi-phuong-lan",
    title: "Thạc sĩ, Bác sĩ Chuyên khoa I",
    specialtyName: "Sản phụ khoa",
    photoUrl: "/media/doctors/doctor-5.jpg",
    bio: "Chuyên gia khám thai định kỳ, chăm sóc tiền sản và điều trị bệnh lý phụ khoa chuyên sâu.",
    experienceYears: 15,
    branchNames: ["Cơ sở Trung tâm"],
    active: true,
  },
  {
    id: "fb-doc-3",
    fullName: "BS. CKI. Hoàng Quốc Dũng",
    slug: "hoang-quoc-dung",
    title: "Bác sĩ Chuyên khoa I",
    specialtyName: "Nhi khoa",
    photoUrl: "/media/doctors/doctor-3.jpg",
    bio: "Tận tâm chăm sóc sức khỏe trẻ nhỏ, điều trị bệnh hô hấp, tiêu hóa và tư vấn dinh dưỡng.",
    experienceYears: 12,
    branchNames: ["Cơ sở Quận 5"],
    active: true,
  },
];

function PackageSkeletonCard(): React.ReactElement {
  return (
    <article className={`${packageVisualStyles.card} ${packageVisualStyles.cardHome}`} aria-hidden="true">
      <div className={packageVisualStyles.media} style={{ background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
      <div className={packageVisualStyles.body} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ height: "14px", width: "40%", borderRadius: "4px", background: "#e2e8f0" }} />
        <div style={{ height: "22px", width: "80%", borderRadius: "4px", background: "#cbd5e1" }} />
        <div style={{ height: "14px", width: "100%", borderRadius: "4px", background: "#f1f5f9" }} />
        <div style={{ height: "14px", width: "65%", borderRadius: "4px", background: "#f1f5f9" }} />
        <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.5rem" }}>
          <div style={{ height: "20px", width: "35%", borderRadius: "4px", background: "#e2e8f0" }} />
          <div style={{ height: "36px", width: "30%", borderRadius: "6px", background: "#e2e8f0" }} />
        </div>
      </div>
    </article>
  );
}

function SpecialtySkeletonCard(): React.ReactElement {
  return (
    <article className="hm-specialty-card" aria-hidden="true">
      <div className="hm-specialty-card__media" style={{ background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
      <div className="hm-specialty-card__body" style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#e2e8f0" }} />
        <div style={{ height: "20px", width: "60%", borderRadius: "4px", background: "#cbd5e1" }} />
        <div style={{ height: "14px", width: "90%", borderRadius: "4px", background: "#f1f5f9" }} />
        <div style={{ marginTop: "auto", height: "18px", width: "45%", borderRadius: "4px", background: "#e2e8f0" }} />
      </div>
    </article>
  );
}

function DoctorSkeletonCard(): React.ReactElement {
  return (
    <article className="hm-doctor-card" aria-hidden="true">
      <div className="hm-doctor-card__media" style={{ background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
      <div className="hm-doctor-card__body" style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        <div style={{ height: "14px", width: "40%", borderRadius: "4px", background: "#e2e8f0" }} />
        <div style={{ height: "20px", width: "70%", borderRadius: "4px", background: "#cbd5e1" }} />
        <div style={{ height: "14px", width: "100%", borderRadius: "4px", background: "#f1f5f9" }} />
        <div style={{ marginTop: "auto", height: "36px", width: "100%", borderRadius: "6px", background: "#e2e8f0" }} />
      </div>
    </article>
  );
}

function CatalogStatus({
  loading,
  error,
  hasData,
  unavailable,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  hasData: boolean;
  unavailable: boolean;
  onRetry: () => void;
}): React.ReactElement | null {
  if (loading && !hasData) {
    return <p className="catalog-status catalog-status--loading" role="status">Đang tải dữ liệu từ hệ thống bệnh viện…</p>;
  }
  if ((unavailable || error) && !hasData) {
    return (
      <div className="catalog-status catalog-status--unavailable" role="status">
        <div className="catalog-status__message">
          <span className="catalog-status__icon" aria-hidden="true"><Icon name="shield-check" size={18} /></span>
          <span>Thông tin bệnh viện tạm thời chưa thể tải. Vui lòng thử lại sau ít phút.</span>
        </div>
        <button className="text-button" onClick={onRetry} type="button">Thử tải lại</button>
      </div>
    );
  }
  return null;
}

interface HeroStat {
  icon: IconName;
  value: string;
  label: string;
}

interface HomeHeroCopyProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onSearchSubmit: () => void;
  onBooking: () => void;
  onTriage: () => void;
  cmsHero?: CmsHeroPayload;
  stats?: HeroStat[];
}

const PLACEHOLDER_HERO_COPY_PATTERN = /(?:Live Compose|Live CMS|demo|test)/i;

function isPlaceholderCmsHeroPayload(cmsHero?: CmsHeroPayload): boolean {
  if (!cmsHero) return false;

  const source = [cmsHero.eyebrow, cmsHero.title, cmsHero.body, cmsHero.ctaLabel, cmsHero.ctaHref]
    .filter(Boolean)
    .join(" ");
  return PLACEHOLDER_HERO_COPY_PATTERN.test(source);
}

function HomeHeroCopy({
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
  onBooking,
  onTriage,
  cmsHero,
  stats = [],
}: HomeHeroCopyProps): React.ReactElement {
  const activeCmsHero = cmsHero && !isPlaceholderCmsHeroPayload(cmsHero) ? cmsHero : null;
  const cmsCta = activeCmsHero?.ctaLabel && activeCmsHero.ctaHref && isSafeCmsUrl(activeCmsHero.ctaHref)
    ? { label: activeCmsHero.ctaLabel, href: activeCmsHero.ctaHref }
    : null;

  return (
    <div className="hero-copy" data-cms-managed={activeCmsHero ? "hero-copy" : undefined}>
      <p className="hero-kicker">
        <span className="hero-kicker__line" aria-hidden="true" />
        {activeCmsHero?.eyebrow || "Bệnh viện đa khoa HealthCare"}
      </p>
      <h1 id="hero-title">
        {activeCmsHero?.title && activeCmsHero.title !== "Đồng hành cùng sức khỏe gia đình" ? (
          activeCmsHero.title
        ) : (
          <>
            Đồng hành<br />
            cùng <span className="hero-teal-accent">sức khỏe</span><br />
            <span className="hero-teal-accent">gia đình</span>
          </>
        )}
      </h1>
      <p className="hero-description !text-slate-700 !opacity-100" style={{ color: "#334155" }}>
        {activeCmsHero?.body ?? "Chọn chuyên khoa, bác sĩ, gói khám hoặc cơ sở và giữ khung giờ phù hợp ngay trên hệ thống."}
      </p>
      <form className="hero-search" onSubmit={(event) => { event.preventDefault(); onSearchSubmit(); }}>
        <label className="sr-only" htmlFor="hero-search-input">
          Tìm chuyên khoa hoặc bác sĩ
        </label>
        <Icon name="search" size={19} />
        <input
          aria-describedby="hero-search-help"
          id="hero-search-input"
          autoComplete="off"
          name="hero-search"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Tìm chuyên khoa hoặc bác sĩ..."
          type="search"
          value={searchQuery}
        />
        <button type="submit">Tìm kiếm</button>
      </form>
      <p className="hero-search__help" id="hero-search-help">
        Tìm trong danh mục bệnh viện để chọn hướng đặt lịch phù hợp.
      </p>
      <div className="hero-quick-chips" aria-label="Gợi ý tìm kiếm phổ biến">
        <span>Gợi ý:</span>
        {["Tim mạch", "Nhi khoa", "Tiêu hóa", "Khám tổng quát"].map((chip) => (
          <button
            className="hero-quick-chip"
            key={chip}
            onClick={() => setSearchQuery(chip)}
            type="button"
          >
            {chip}
          </button>
        ))}
      </div>
      <div className="hero-actions">
        {cmsCta ? (
          <a className="button button--amber" href={cmsCta.href}>
            {cmsCta.label}
            <Icon name="arrow-up-right" size={18} />
          </a>
        ) : (
          <button className="button button--amber" onClick={onBooking} type="button">
            Đặt lịch khám
            <Icon name="calendar" size={18} />
          </button>
        )}
        <button className="button button--hero-secondary" onClick={onTriage} type="button">
          Gợi ý chuyên khoa
          <Icon name="stethoscope" size={18} />
        </button>
      </div>
      {stats.length > 0 ? (
        <div className="hero-trust" aria-label="Quy mô mạng lưới bệnh viện">
          {stats.map((stat) => (
            <div className="hero-trust__item" key={stat.label}>
              <span className="hero-trust__icon"><Icon name={stat.icon} size={16} /></span>
              <span>
                <strong>{stat.value}</strong>
                <small>{stat.label}</small>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function HomeAssuranceStrip({
  onBooking,
  contactHref,
  contactPhone,
  hasEmergencyBranch,
}: {
  onBooking: () => void;
  contactHref?: string | null;
  hasEmergencyBranch: boolean;
  contactPhone?: string;
}): React.ReactElement {
  return (
    <section className="hero-assurance" aria-label="Điểm nhấn của trải nghiệm đặt khám">
      <div className="hero-assurance__inner">
        <button className="hero-assurance__item hero-assurance__item--action" onClick={onBooking} type="button">
          <span className="hero-assurance__icon"><Icon name="calendar" size={17} /></span>
          <span><strong>Đặt lịch hẹn trực tuyến</strong><small>Chọn chuyên khoa, bác sĩ và khung giờ theo ý muốn.</small></span>
        </button>
          <Link className="hero-assurance__item hero-assurance__item--action" href="/packages">
            <span className="hero-assurance__icon"><Icon name="heart" size={17} /></span>
            <span><strong>Lựa chọn gói khám</strong><small>So sánh các gói chăm sóc định kỳ mở rộng.</small></span>
          </Link>
        {contactHref ? (
          <a className="hero-assurance__item hero-assurance__item--action" href={contactHref}>
            <span className="hero-assurance__icon hero-assurance__icon--accent"><Icon name="phone" size={17} /></span>
            <span><strong>{hasEmergencyBranch ? "Hotline cấp cứu 24/7" : "Liên hệ bệnh viện"}</strong><small>{contactPhone ?? "Số điện thoại đang cập nhật."}</small></span>
          </a>
        ) : (
          <Link className="hero-assurance__item hero-assurance__item--action" href="/contact">
            <span className="hero-assurance__icon hero-assurance__icon--accent"><Icon name="location" size={17} /></span>
            <span><strong>Liên hệ bệnh viện</strong><small>Xem địa chỉ và giờ làm việc các cơ sở.</small></span>
          </Link>
        )}
      </div>
    </section>
  );
}

function HomeHeroVisual({ imageUrl }: { imageUrl?: string }): React.ReactElement {
  const safeCmsImage = imageUrl && isSafeCmsUrl(imageUrl) ? imageUrl : null;

  return (
    <figure className="hero-visual">
      <div className="hero-visual__image-wrap">
        {safeCmsImage ? (
          // CMS image URLs are validated before rendering; using img keeps the admin-configured HTTPS asset compatible with any CDN.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt="Hình ảnh hoạt động tại bệnh viện"
            className="hero-visual__image"
            decoding="async"
            loading="eager"
            src={safeCmsImage}
          />
        ) : (
          <Image
            alt="Đội ngũ bác sĩ và nhân viên y tế chuyên khoa Bệnh viện HealthCare"
            className="hero-visual__image"
            fill
            priority
            sizes="(max-width: 900px) 100vw, 46vw"
            src={HERO_IMAGE}
          />
        )}
      </div>
    </figure>
  );
}

function HomeHeroComposition({
  cmsHero,
  ...heroProps
}: HomeHeroCopyProps): React.ReactElement {
  return (
    <>
      <HomeHeroCopy {...heroProps} cmsHero={cmsHero} />
      <HomeHeroVisual imageUrl={cmsHero?.imageUrl} />
    </>
  );
}

function HomeCmsFallbackCard({
  accent = false,
  eyebrow,
  href,
  hrefLabel,
  title,
  description,
}: {
  accent?: boolean;
  eyebrow: string;
  href: string;
  hrefLabel: string;
  title: string;
  description: string;
}): React.ReactElement {
  return (
    <article className={`resource-panel home-cms-fallback${accent ? " resource-panel--accent" : ""}`}>
      <p className="section-note">{eyebrow}</p>
      <h3>{title}</h3>
      <p>{description}</p>
      <Link className="text-button" href={href}>
        {hrefLabel} <Icon name="arrow-up-right" size={17} />
      </Link>
    </article>
  );
}

export default function Home(): React.ReactElement {
  const router = useRouter();
  const [isBookingOpen, setIsBookingOpen] = useState<boolean>(false);
  const [isAiTriageOpen, setIsAiTriageOpen] = useState<boolean>(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | undefined>();
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string | undefined>();
  const [selectedPackageId, setSelectedPackageId] = useState<string | undefined>();
  const [selectedBranchId, setSelectedBranchId] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [catalog, setCatalog] = useState<HomeCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogUnavailable, setCatalogUnavailable] = useState(false);
  const [catalogRetryToken, setCatalogRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve().then(async () => {
      if (cancelled) return;
      setCatalogLoading(true);
      setCatalogError(null);
      setCatalogUnavailable(false);
      // A retry is a new authoritative snapshot. Clear the old catalog so a
      // failed response cannot leave stale booking identities actionable.
      setCatalog(null);
      try {
        const [specialties, doctors, packages, branches, articles] = await Promise.all([
          fetchSpecialties(0, 50),
          fetchDoctors({ page: 0, size: 50 }),
          fetchPackages(0, 50),
          fetchBranches(0, 50),
          fetchArticles(0, 6),
        ] as [
          Promise<Page<Specialty>>,
          Promise<Page<Doctor>>,
          Promise<Page<HealthPackage>>,
          Promise<Page<Branch>>,
          Promise<Page<Article>>,
        ]);
        if (cancelled) return;
        setCatalog({
          specialties: specialties.content,
          doctors: doctors.content,
          packages: packages.content,
          branches: branches.content,
          articles: articles.content,
          specialtyTotal: specialties.totalElements,
          doctorTotal: doctors.totalElements,
          branchTotal: branches.totalElements,
        });
      } catch (error: unknown) {
        if (!cancelled) {
          setCatalogUnavailable(!(error instanceof ApiError) || error.status >= 500 || error.status === 408 || error.status === 0);
          setCatalogError(presentApiError(
            error instanceof ApiError ? error.code : null,
            error instanceof ApiError ? error.status : undefined,
          ));
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    });
    return () => {
      cancelled = true;
      void task;
    };
  }, [catalogRetryToken]);

  const retryCatalog = (): void => setCatalogRetryToken((value) => value + 1);

  const handleOpenBooking = (
    doctorId?: string,
    specialtyId?: string,
    packageId?: string,
    branchId?: string,
  ): void => {
    setSelectedDoctorId(doctorId);
    setSelectedSpecialtyId(specialtyId);
    setSelectedPackageId(packageId);
    setSelectedBranchId(branchId);
    setIsBookingOpen(true);
  };

  const handleHeroSearchSubmit = (): void => {
    const nextQuery = searchQuery.trim();
    router.push(nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : "/search");
  };

  const filteredSpecialties = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const specialties = catalog?.specialties ?? [];
    if (!query) return specialties;
    return specialties.filter(
      (specialty) =>
        specialty.name.toLowerCase().includes(query) ||
        specialty.description.toLowerCase().includes(query),
    );
  }, [catalog?.specialties, searchQuery]);

  const filteredDoctors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const doctors = catalog?.doctors ?? [];
    if (!query) return doctors;
    return doctors.filter(
      (doctor) =>
        doctor.fullName.toLowerCase().includes(query) ||
        doctor.specialtyName?.toLowerCase().includes(query) ||
        doctor.bio.toLowerCase().includes(query),
    );
  }, [catalog?.doctors, searchQuery]);

  const packages = catalog?.packages ?? [];
  const branches = catalog?.branches ?? [];
  const articles = catalog?.articles ?? [];
  const emergencyBranch = branches.find((branch) => Boolean(branch.emergencyHotline));
  const contactBranch = branches.find((branch) => Boolean(branch.phone));
  const contactPhone = emergencyBranch?.emergencyHotline ?? contactBranch?.phone ?? undefined;
  const contactHref = safeTelephoneHref(contactPhone);
  const homeDoctors = filteredDoctors.slice(0, 4);
  const heroStats: HeroStat[] = catalog ? [
    { icon: "stethoscope", value: String(catalog.specialtyTotal), label: "Chuyên khoa" },
    { icon: "user", value: String(catalog.doctorTotal), label: "Bác sĩ" },
    { icon: "building", value: String(catalog.branchTotal), label: "Cơ sở y tế" },
  ] : [];
  const homeHeroProps: HomeHeroCopyProps = {
    searchQuery,
    setSearchQuery,
    onSearchSubmit: handleHeroSearchSubmit,
    onBooking: () => handleOpenBooking(),
    onTriage: () => setIsAiTriageOpen(true),
    stats: heroStats,
  };

  const handleAiSpecialtySelect = (specialtyName: string, specialtyId?: string): void => {
    void specialtyName;
    handleOpenBooking(undefined, specialtyId);
  };
  const branchAreaLabel = catalogLoading && branches.length === 0
    ? "Đang tải cơ sở"
    : branches.length > 0
      ? `${branches.length} cơ sở đang hiển thị`
      : "Cơ sở đang cập nhật";

    return (
      <div className="site-shell">
      <PublicMotion />
      <Navbar
        branches={branches}
        onOpenBooking={() => handleOpenBooking()}
      />

      <main id="main-content" tabIndex={-1}>
        <section className="hero-section" aria-labelledby="hero-title">
          <CmsLiveSlot
            className="hero-inner"
            fallback={<HomeHeroComposition {...homeHeroProps} />}
            hideWhenNotFound
            quiet
            renderContent={(content: CmsContent) => (
              content.componentType === "HERO" ? (
                <HomeHeroComposition {...homeHeroProps} cmsHero={content.payload} />
              ) : (
                <>
                  <div className="hero-copy">
                    <CmsContentRenderer content={content} />
                  </div>
                  <HomeHeroVisual />
                </>
              )
            )}
            showSourceLabel={false}
            slotKey="hero"
            slug="home"
          />
        </section>

        <HomeAssuranceStrip
          contactHref={contactHref}
          contactPhone={contactPhone}
          hasEmergencyBranch={Boolean(emergencyBranch)}
          onBooking={() => handleOpenBooking()}
        />

        <section className="cms-live-region" id="cms-live" aria-labelledby="cms-live-title">
          <div className="section-inner">
            <h2 className="sr-only" id="cms-live-title">Thông báo từ bệnh viện</h2>
            <div className="cms-live-region__grid">
              <CmsLiveSlot
                fallback={(
                  <HomeCmsFallbackCard
                    accent
                    description="Giờ khám, thông báo quan trọng và tin bệnh viện sẽ hiển thị ở đây khi chưa có cập nhật mới."
                    eyebrow="Thông báo bệnh viện"
                    href="/branches"
                    hrefLabel="Xem cơ sở"
                    title="Cập nhật giờ khám và quy trình"
                  />
                )}
                hideWhenNotFound
                quiet
                showSourceLabel={false}
                slug="home"
                slotKey="body"
              />
              <div className="cms-live-region__aside">
                <CmsLiveSlot
                  fallback={(
                    <HomeCmsFallbackCard
                      description="Tra cứu lịch hẹn, xem cẩm nang hoặc mở hướng dẫn trước buổi khám."
                      eyebrow="Hỗ trợ nhanh"
                      href="/tra-cuu"
                      hrefLabel="Tra cứu lịch"
                      title="Sẵn sàng trước khi đến khám"
                    />
                  )}
                  hideWhenNotFound
                  quiet
                  showSourceLabel={false}
                  slug="home"
                  slotKey="sidebar"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="care-section" aria-labelledby="care-title">
          <div className="care-inner">
            <h2 className="sr-only" id="care-title">Lối tắt chăm sóc</h2>
            <div className="care-links" aria-label="Lối tắt chăm sóc">
              <button className="care-link hm-quick-card" onClick={() => handleOpenBooking()} type="button">
                <span className="care-link__icon hm-quick-card__icon"><Icon name="calendar" size={22} /></span>
                <span className="hm-quick-card__body">
                  <strong>Đặt lịch hẹn</strong>
                  <small>Chọn bác sĩ và khung giờ</small>
                </span>
              </button>
              <Link className="care-link hm-quick-card" href="#packages">
                <span className="care-link__icon hm-quick-card__icon"><Icon name="layers" size={22} /></span>
                <span className="hm-quick-card__body">
                  <strong>Gói khám</strong>
                  <small>So sánh lựa chọn theo nhu cầu</small>
                </span>
              </Link>
              <Link className="care-link hm-quick-card" href="/specialties">
                <span className="care-link__icon hm-quick-card__icon"><Icon name="stethoscope" size={22} /></span>
                <span className="hm-quick-card__body">
                  <strong>Chuyên khoa</strong>
                  <small>Chọn theo nhu cầu thăm khám</small>
                </span>
              </Link>
              {contactHref ? (
                <a className={`care-link hm-quick-card${emergencyBranch ? " care-link--emergency" : ""}`} href={contactHref}>
                  <span className="care-link__icon hm-quick-card__icon"><Icon name="phone" size={22} /></span>
                  <span className="hm-quick-card__body">
                    <strong>{emergencyBranch ? "Cấp cứu" : "Gọi bệnh viện"}</strong>
                    <small>{contactPhone}</small>
                  </span>
                </a>
              ) : (
                <Link className="care-link hm-quick-card" href="/contact">
                  <span className="care-link__icon hm-quick-card__icon"><Icon name="phone" size={22} /></span>
                  <span className="hm-quick-card__body">
                    <strong>Liên hệ bệnh viện</strong>
                    <small>Xem các kênh hỗ trợ</small>
                  </span>
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className={`section section--packages${catalogError ? " section--unavailable" : ""}`} id="packages" aria-labelledby="packages-title">
          <div className="section-inner">
            <SectionHeading
              action={<Link className="section-link" href="/packages">Xem danh mục gói khám <Icon name="arrow-right" size={17} /></Link>}
              description="Xem chi phí và các hạng mục khám để chọn gói phù hợp."
              headingId="packages-title"

              title="Gói khám sức khỏe"
            />
            <CatalogStatus error={catalogError} hasData={Boolean(catalog)} loading={catalogLoading} onRetry={retryCatalog} unavailable={catalogUnavailable} />
            {!catalogLoading && (packages.length > 0 || catalogUnavailable || catalogError) ? (
              <div className={packageVisualStyles.homeRail} aria-label="Các gói khám sức khỏe">
                {(packages.slice(0, 4).length > 0 ? packages.slice(0, 4) : FALLBACK_PACKAGES.slice(0, 4)).map((packageItem, index) => (
                  <PackageVisualCard
                    bookingAction={(
                      <button
                        className={packageVisualStyles.bookButton}
                        onClick={() => handleOpenBooking(undefined, undefined, packageItem.id)}
                        type="button"
                      >
                        Đặt lịch
                      </button>
                    )}
                    key={packageItem.id}
                    packageItem={packageItem}
                    priority={index === 0}
                    variant="home"
                  />
                ))}
              </div>
            ) : catalogLoading ? (
              <div className={packageVisualStyles.homeRail} aria-label="Đang tải các gói khám sức khỏe">
                {[0, 1, 2, 3].map((skeletonIdx) => (
                  <PackageSkeletonCard key={skeletonIdx} />
                ))}
              </div>
            ) : !catalogLoading && catalog ? (
              <div className="empty-state empty-state--wide"><p>Danh sách gói khám đang được cập nhật.</p></div>
            ) : null}
          </div>
        </section>

        <section className={`section section--specialties${catalogError ? " section--unavailable" : ""}`} id="specialties" aria-labelledby="specialties-title">
          <div className="section-inner">
            <SectionHeading
              action={<Link className="section-link" href="/specialties">Xem tất cả chuyên khoa <Icon name="arrow-right" size={17} /></Link>}
              description="Tìm hiểu phạm vi thăm khám và chọn chuyên khoa phù hợp với nhu cầu của bạn."
              headingId="specialties-title"

              title="Chuyên khoa nổi bật"
            />
            <CatalogStatus error={catalogError} hasData={Boolean(catalog)} loading={catalogLoading} onRetry={retryCatalog} unavailable={catalogUnavailable} />
            {!catalogLoading && (filteredSpecialties.length > 0 || ((catalogUnavailable || catalogError) && !searchQuery)) ? (
              <div className="hm-specialty-grid" aria-label="Các chuyên khoa nổi bật">
                {(filteredSpecialties.length > 0 ? filteredSpecialties.slice(0, 8) : FALLBACK_SPECIALTIES.slice(0, 8)).map((specialty, index) => (
                  <article className="hm-specialty-card" key={specialty.id}>
                    <div className="hm-specialty-card__media">
                      <Image
                        alt={`Hình ảnh minh họa cho chuyên khoa ${specialty.name}`}
                        className="hm-specialty-card__image"
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1100px) 33vw, 25vw"
                        src={getPublicCareImage(index)}
                      />
                    </div>
                    <div className="hm-specialty-card__body">
                      <span className="hm-specialty-card__icon"><Icon name={getSpecialtyIcon(specialty)} size={22} /></span>
                      <h3><Link href={`/specialties/${specialty.slug}`}>{specialty.name}</Link></h3>
                      <p>{specialty.description}</p>
                      <div className="hm-specialty-card__footer">
                        <Link className="text-button" href={`/specialties/${specialty.slug}`}>Tìm hiểu thêm <Icon name="arrow-right" size={16} /></Link>
                        <button className="icon-button" aria-label={`Đặt lịch theo chuyên khoa ${specialty.name}`} onClick={() => handleOpenBooking(undefined, specialty.id)} type="button">
                          <Icon name="arrow-up-right" size={18} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : catalogLoading ? (
              <div className="hm-specialty-grid" aria-label="Đang tải các chuyên khoa nổi bật">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((skeletonIdx) => (
                  <SpecialtySkeletonCard key={skeletonIdx} />
                ))}
              </div>
            ) : !catalogLoading && catalog ? (
              <div className="empty-state">
                <p>{searchQuery ? `Chưa có chuyên khoa khớp với “${searchQuery}”.` : "Chưa có chuyên khoa đang cung cấp."}</p>
                <button className="text-button" onClick={() => setSearchQuery("")} type="button">Xóa tìm kiếm <Icon name="x" size={17} /></button>
              </div>
            ) : null}
          </div>
        </section>

        <section className={`section section--doctors${catalogError ? " section--unavailable" : ""}`} id="doctors" aria-labelledby="doctors-title">
          <div className="section-inner">
            <SectionHeading
              action={<button className="section-link section-link--button" onClick={() => handleOpenBooking()} type="button">Đặt lịch với bác sĩ <Icon name="arrow-right" size={17} /></button>}
              description="Tìm hiểu chuyên môn, kinh nghiệm và đặt lịch với bác sĩ."
              headingId="doctors-title"

              title="Đội ngũ bác sĩ"
            />
            <CatalogStatus error={catalogError} hasData={Boolean(catalog)} loading={catalogLoading} onRetry={retryCatalog} unavailable={catalogUnavailable} />
            {!catalogLoading && (homeDoctors.length > 0 || ((catalogUnavailable || catalogError) && !searchQuery)) ? (
              <div className="hm-doctor-grid" aria-label="Bác sĩ nổi bật">
                {(homeDoctors.length > 0 ? homeDoctors : FALLBACK_DOCTORS).map((doctor) => (
                  <DoctorCard doctor={doctor} key={doctor.id} onBook={(doctorId) => handleOpenBooking(doctorId)} />
                ))}
              </div>
            ) : catalogLoading ? (
              <div className="hm-doctor-grid" aria-label="Đang tải danh sách bác sĩ">
                {[0, 1, 2].map((skeletonIdx) => (
                  <DoctorSkeletonCard key={skeletonIdx} />
                ))}
              </div>
            ) : (
              <div className="empty-state empty-state--wide">
                <p>{catalog ? (searchQuery ? `Chưa có bác sĩ khớp với “${searchQuery}”.` : "Chưa có bác sĩ đang cung cấp.") : ""}</p>
                <button className="text-button" onClick={() => setSearchQuery("")} type="button">Xóa tìm kiếm <Icon name="x" size={17} /></button>
              </div>
            )}
          </div>
        </section>

        <CareExperience />

        <section className="section section--journey" id="guide" aria-labelledby="journey-title">
          <div className="section-inner">
            <div className="journey-layout">
              <div>
                <SectionHeading
                  description="Chọn bác sĩ và thời gian khám, sau đó kiểm tra thông tin lịch hẹn."
                  headingId="journey-title"

                  title="Hướng dẫn đặt lịch khám"
                />
                <ol className="journey-steps">
                  {JOURNEY_STEPS.map((step, index) => (
                    <li className="journey-step" key={step.title}>
                      <span className="journey-step__number">{index + 1}</span>
                      <span className="journey-step__icon"><Icon name={step.icon} size={20} /></span>
                      <span>
                        <strong>{step.title}</strong>
                        <small>{step.description}</small>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <aside className="support-panel">
                <div className="support-panel__icon"><Icon name="shield-check" size={26} /></div>
                <p className="section-note">Hướng dẫn và bảo hiểm</p>
                <h3>Chuẩn bị thông tin cần thiết trước khi đến cơ sở.</h3>
                <p>Thông tin về BHYT, bảo lãnh viện phí và giấy tờ cần mang theo được trình bày rõ trong hướng dẫn dành cho người bệnh.</p>
                <Link className="button button--light" href="/huong-dan">Xem hướng dẫn <Icon name="arrow-up-right" size={18} /></Link>
              </aside>
            </div>
          </div>
        </section>

        <section className={`section section--branches${catalogError ? " section--unavailable" : ""}`} id="branches" aria-labelledby="branches-title">
          <div className="section-inner">
            <SectionHeading
              action={<Link className="section-link" href="/branches">Xem tất cả cơ sở <Icon name="arrow-right" size={17} /></Link>}
              description="Chọn cơ sở theo vị trí, giờ làm việc và nhu cầu đặt hẹn của bạn."
              headingId="branches-title"

              title="Cơ sở khám bệnh"
            />
            <div className="branch-layout">
              <div className="branch-intro">
                <div className="branch-intro__topline"><Icon name="location" size={20} /><span>{branchAreaLabel}</span></div>
                <h3>Chọn nơi bạn muốn bắt đầu chăm sóc.</h3>
                <p>Địa chỉ và giờ làm việc lấy từ danh mục bệnh viện. Hãy kiểm tra lại trước khi đến.</p>
                {contactHref ? <a className="text-button" href={contactHref}>{emergencyBranch ? "Gọi hotline cấp cứu" : "Gọi cơ sở"} <Icon name="phone" size={17} /></a> : <Link className="text-button" href="/contact">Xem thông tin liên hệ <Icon name="arrow-up-right" size={17} /></Link>}
              </div>
              <div className="hm-branch-grid">
                <CatalogStatus error={catalogError} hasData={Boolean(catalog)} loading={catalogLoading} onRetry={retryCatalog} unavailable={catalogUnavailable} />
                {!catalogLoading && catalog && branches.map((branch, index) => (
                  <article className="hm-branch-card" key={branch.id}>
                    <div className="hm-branch-card__media">
                      <Image
                        alt={`Hình ảnh cơ sở ${branch.name}`}
                        className="hm-branch-card__image"
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 900px) 50vw, 25vw"
                        src={getBranchImage(branch, index)}
                      />
                    </div>
                    <div className="hm-branch-card__body">
                      <div className="hm-branch-card__head">
                        <span className="hm-branch-card__icon"><Icon name="location" size={17} /></span>
                        <h3>{branch.name}</h3>
                      </div>
                      <p className="hm-branch-card__address"><Icon name="location" size={15} />{branch.address}</p>
                      <p className="hm-branch-card__hours"><Icon name="clock" size={15} />{branch.workingHours ?? "Giờ làm việc đang cập nhật."}</p>
                      <div className="hm-branch-card__actions">
                        {safeTelephoneHref(branch.phone) ? <a className="text-button" href={safeTelephoneHref(branch.phone) ?? undefined} aria-label={`Gọi ${branch.name}`}><Icon name="phone" size={16} />{branch.phone}</a> : <span className="resource-muted">Số điện thoại đang cập nhật.</span>}
                        <BranchMap address={branch.address} branchName={branch.name} className="branch-row__map-link" variant="link" />
                        <button className="outline-button outline-button--small" onClick={() => handleOpenBooking(undefined, undefined, undefined, branch.id)} type="button">Đặt lịch</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className={`section section--content${catalogError ? " section--unavailable" : ""}`} id="articles" aria-labelledby="content-title">
          <div className="section-inner">
            <SectionHeading
              action={<Link className="section-link" href="/articles">Xem cẩm nang <Icon name="arrow-right" size={17} /></Link>}
              description="Nội dung ngắn, dễ đọc để bạn chuẩn bị câu hỏi và theo dõi hướng dẫn sau buổi khám."
              headingId="content-title"

              title="Cẩm nang sức khỏe"
            />
            <div className="content-layout">
              <article className="video-card">
                <div className="video-card__visual">
                  <Image
                    alt="Nhân viên y tế trao đổi cùng người bệnh"
                    className="video-card__image"
                    fill
                    sizes="(max-width: 900px) 100vw, 32vw"
                    src={getPublicCareImage(5)}
                  />
                  <span className="video-card__wash" aria-hidden="true" />
                  <span className="video-card__label">Gợi ý đọc</span>
                </div>
                <div className="video-card__body">
                  <p className="content-meta">Từ cẩm nang sức khỏe</p>
                  <h3>{articles[0]?.title ?? "Cẩm nang sức khỏe đang được cập nhật"}</h3>
                  <p>{articles[0]?.summary ?? "Các bài viết mới sẽ được cập nhật tại đây."}</p>
                  <Link className="text-button" href="/articles">Mở danh mục bài viết <Icon name="arrow-up-right" size={17} /></Link>
                </div>
              </article>
              <div className="article-list">
                <CatalogStatus error={catalogError} hasData={Boolean(catalog)} loading={catalogLoading} onRetry={retryCatalog} unavailable={catalogUnavailable} />
                {!catalogLoading && catalog && articles.slice(0, 3).map((article, index) => (
                  <article className="article-row" key={article.id}>
                    <span className="article-row__index">0{index + 1}</span>
                    <div>
                      <p className="content-meta">{formatPublishedAt(article.publishedAt)}</p>
                      <h3><Link href={`/articles/${article.slug}`}>{article.title}</Link></h3>
                      <p>{article.summary}</p>
                    </div>
                    <Icon name="arrow-up-right" size={18} />
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="appointment-cta" aria-labelledby="appointment-cta-title">
          <div className="appointment-cta__inner">
            <div>
              <p className="section-note">Bước tiếp theo của bạn</p>
              <h2 id="appointment-cta-title">Sẵn sàng cho cuộc hẹn của bạn?</h2>
              <p>Chọn bác sĩ, cơ sở hoặc gói khám phù hợp và chủ động khung giờ thuận tiện.</p>
            </div>
            <div className="appointment-cta__actions">
              <button className="button button--amber" onClick={() => handleOpenBooking()} type="button">Đặt lịch khám <Icon name="arrow-up-right" size={18} /></button>
              {contactHref ? <a className="button button--cta-secondary" href={contactHref}><Icon name="phone" size={18} />{contactPhone}</a> : <Link className="button button--cta-secondary" href="/contact"><Icon name="location" size={18} />Thông tin liên hệ</Link>}
            </div>
          </div>
        </section>
      </main>

      <Footer branches={branches} cmsSlug="home" />

      <AiTriageModal
        isOpen={isAiTriageOpen}
        onClose={() => setIsAiTriageOpen(false)}
        onSelectSpecialtyForBooking={handleAiSpecialtySelect}
        emergencyContact={contactPhone}
      />

      {isBookingOpen ? (
        <BookingModal
          key={`${selectedBranchId ?? "default"}:${selectedDoctorId ?? "default"}:${selectedPackageId ?? "default"}:${selectedSpecialtyId ?? "default"}`}
          initialBranchId={selectedBranchId}
          initialDoctorId={selectedDoctorId}
          initialPackageId={selectedPackageId}
          initialSpecialtyId={selectedSpecialtyId}
          isOpen
          onClose={() => setIsBookingOpen(false)}
          branches={branches}
          doctors={catalog?.doctors ?? []}
          packages={packages}
          specialties={catalog?.specialties ?? []}
        />
      ) : null}
    </div>
  );
}
