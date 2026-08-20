"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import AiTriageModal from "../components/AiTriageModal";
import BranchMap from "../components/BranchMap";
import BookingModal from "../components/BookingModal";
import CareExperience from "../components/CareExperience";
import { CmsLiveSlot } from "../components/cms";
import { CmsContentRenderer } from "../components/cms/CmsRenderer";
import Footer from "../components/Footer";
import Icon, { type IconName } from "../components/UiIcon";
import Navbar from "../components/Navbar";
import PackageVisualCard, { packageVisualStyles } from "../components/PackageVisualCard";
import PublicMotion from "../components/PublicMotion";
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
import type { Article, Branch, Doctor, HealthPackage, Specialty } from "../types/hospital";

const HERO_IMAGE =
  "https://images.pexels.com/photos/4266936/pexels-photo-4266936.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1600&h=1200&dpr=1";

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

const DemoNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="demo-note">
    <Icon name="sparkles" size={15} />
    <span>{children}</span>
  </p>
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
  // The second seed URL currently returns 404. Keep that fixture honest and use the accessible fallback.
  if (doctor.id === "doc-2") return undefined;
  return doctor.photoUrl;
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
    <DoctorPhoto doctor={doctor} featured={featured} />
    <div className="doctor-card__body">
      <p className="doctor-specialty">{doctor.specialtyName ?? "Chuyên khoa"}</p>
      <h3>{doctor.fullName}</h3>
      <p className="doctor-title">
        {doctor.title ?? "Bác sĩ chuyên khoa"}
        {doctor.experienceYears ? ` · ${doctor.experienceYears} năm kinh nghiệm` : ""}
      </p>
      <p className="doctor-bio">{doctor.bio}</p>
      <button className="text-button" onClick={() => onBook(doctor.id)} type="button">
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
  if (unavailable && !hasData) {
    return (
      <div className="catalog-status catalog-status--unavailable" role="alert">
        <span>Thông tin bệnh viện tạm thời chưa thể tải. Vui lòng thử lại sau ít phút.</span>
        <button className="text-button" onClick={onRetry} type="button">Thử tải lại</button>
      </div>
    );
  }
  if (error && !hasData) {
    return <p className="catalog-status catalog-status--error" role="alert">{error}</p>;
  }
  return null;
}

interface HomeHeroCopyProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onSearchSubmit: () => void;
  onBooking: () => void;
  onOpenAi: () => void;
  hasEmergencyBranch: boolean;
  contactPhone?: string;
  cmsHero?: CmsHeroPayload;
}

function HomeHeroCopy({
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
  onBooking,
  onOpenAi,
  hasEmergencyBranch,
  contactPhone,
  cmsHero,
}: HomeHeroCopyProps): React.ReactElement {
  const cmsCta = cmsHero?.ctaLabel && cmsHero.ctaHref && isSafeCmsUrl(cmsHero.ctaHref)
    ? { label: cmsHero.ctaLabel, href: cmsHero.ctaHref }
    : null;

  return (
    <div className="hero-copy" data-cms-managed={cmsHero ? "hero-copy" : undefined}>
      <p className="hero-kicker">
        <span className="hero-kicker__line" aria-hidden="true" />
        {cmsHero?.eyebrow ?? "Bệnh viện đa khoa HealthCare"}
      </p>
      <h1 id="hero-title">
        {cmsHero?.title ?? <>Lắng nghe trước. <span>Chăm sóc đúng.</span></>}
      </h1>
      <p className="hero-description">
        {cmsHero?.body ?? "Tìm bác sĩ theo chuyên môn, chọn cơ sở thuận tiện và chủ động khung giờ thăm khám."}
      </p>
      <div className="hero-actions">
        {cmsCta ? (
          <a className="button button--amber" href={cmsCta.href}>
            {cmsCta.label}
            <Icon name="arrow-up-right" size={18} />
          </a>
        ) : (
          <button className="button button--amber" onClick={onBooking} type="button">
            Đặt lịch khám
            <Icon name="arrow-up-right" size={18} />
          </button>
        )}
        <Link className="button button--hero-secondary" href="/doctors">
          Tìm bác sĩ
          <Icon name="arrow-up-right" size={18} />
        </Link>
      </div>
      <div className="hero-trust" aria-label="Điểm nhấn của trải nghiệm đặt khám">
        <div className="hero-trust__item">
          <span className="hero-trust__icon"><Icon name="check" size={16} /></span>
          <span><strong>Chủ động đặt lịch</strong><small>Chọn bác sĩ và khung giờ</small></span>
        </div>
        <div className="hero-trust__item">
          <span className="hero-trust__icon"><Icon name="building" size={16} /></span>
          <span><strong>Thông tin rõ ràng</strong><small>Chuyên khoa, bác sĩ, chi phí</small></span>
        </div>
        <div className="hero-trust__item">
          <span className="hero-trust__icon hero-trust__icon--accent"><Icon name="phone" size={16} /></span>
          <span><strong>{hasEmergencyBranch ? "Hotline cấp cứu" : "Hỗ trợ khách hàng"}</strong><small>{contactPhone ?? "Xem kênh liên hệ"}</small></span>
        </div>
      </div>
      <form className="hero-search" onSubmit={(event) => { event.preventDefault(); onSearchSubmit(); }}>
        <label className="sr-only" htmlFor="hero-search-input">
          Tìm bác sĩ hoặc chuyên khoa
        </label>
        <Icon name="search" size={19} />
        <input
          aria-describedby="hero-search-help"
          id="hero-search-input"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Tìm bác sĩ hoặc chuyên khoa"
          type="search"
          value={searchQuery}
        />
        <button type="submit">Tìm kiếm</button>
      </form>
      <p className="hero-search__help" id="hero-search-help">
        Tìm trong catalog công khai để chọn hướng đặt lịch phù hợp.
      </p>
      <div className="hero-actions">
        {cmsCta ? (
          <a className="button button--amber" href={cmsCta.href}>
            {cmsCta.label}
            <Icon name="arrow-up-right" size={18} />
          </a>
        ) : (
          <button className="button button--amber" onClick={onBooking} type="button">
            Đặt lịch khám
            <Icon name="arrow-up-right" size={18} />
          </button>
        )}
        <button className="button button--hero-secondary" onClick={onOpenAi} type="button">
          Mô tả triệu chứng
          <Icon name="activity" size={18} />
        </button>
        <Link className="button button--hero-secondary" href="/doctors">
          Tìm bác sĩ
          <Icon name="arrow-up-right" size={18} />
        </Link>
      </div>
      <DemoNote>
        {cmsHero ? "Nội dung hero do quản trị viên xuất bản; catalog và trợ lý AI vẫn được cập nhật theo hệ thống." : "Catalog công khai được cập nhật theo hệ thống; trợ lý AI cần đăng nhập để hoạt động."}
      </DemoNote>
      <div className="hero-trust" aria-label="Điểm nhấn của trải nghiệm đặt khám">
        <div className="hero-trust__item">
          <span className="hero-trust__icon"><Icon name="check" size={16} /></span>
          <span><strong>Luồng 4 bước</strong><small>Chọn, giữ, xác nhận</small></span>
        </div>
        <div className="hero-trust__item">
          <span className="hero-trust__icon"><Icon name="building" size={16} /></span>
          <span><strong>Chọn đúng cơ sở</strong><small>Hiển thị ngay trong lịch</small></span>
        </div>
        <div className="hero-trust__item">
          <span className="hero-trust__icon hero-trust__icon--accent"><Icon name="phone" size={16} /></span>
          <span><strong>{hasEmergencyBranch ? "Hotline cấp cứu" : "Liên hệ cơ sở"}</strong><small>{contactPhone ?? "Chưa cung cấp số điện thoại"}</small></span>
        </div>
      </div>
    </div>
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
            alt="Bác sĩ trao đổi cùng người bệnh trong buổi tư vấn"
            className="hero-visual__image"
            fill
            priority
            sizes="(max-width: 900px) 100vw, 46vw"
            src={HERO_IMAGE}
          />
        )}
        <span className="hero-visual__index" aria-hidden="true">01</span>
        <span className="hero-visual__care-line" aria-hidden="true"><span /></span>
      </div>
      <div className="hero-visual__floating-label">
        <span><Icon name="heart" size={20} /></span>
        <p><small>Đồng hành liền mạch</small><strong>Từ đặt lịch đến sau thăm khám</strong></p>
      </div>
      <figcaption>
        {safeCmsImage ? "Hình ảnh hoạt động do quản trị viên xuất bản." : "Ảnh minh họa từ Unsplash."}
      </figcaption>
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
        });
      } catch (error: unknown) {
        if (!cancelled) {
          setCatalogUnavailable(!(error instanceof ApiError) || error.status >= 500);
          setCatalogError(error instanceof Error ? error.message : "Không thể tải catalog hiện tại.");
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

  const handleAiSpecialtySelect = (_specialtyName: string, specialtyId?: string): void => {
    // Preserve the backend identity even when the homepage catalog is still
    // loading or unavailable. BookingModal will reconcile it after its own
    // authoritative catalog read instead of silently opening an unfiltered flow.
    handleOpenBooking(undefined, specialtyId, undefined);
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
  const featuredDoctor = filteredDoctors[0];
  const supportingDoctors = filteredDoctors.slice(1, 4);
  const homeHeroProps: HomeHeroCopyProps = {
    searchQuery,
    setSearchQuery,
    onSearchSubmit: handleHeroSearchSubmit,
    onBooking: () => handleOpenBooking(),
    onOpenAi: () => setIsAiTriageOpen(true),
    hasEmergencyBranch: Boolean(emergencyBranch),
    contactPhone,
  };

    return (
      <div className="site-shell">
      <PublicMotion />
      <Navbar
        branches={branches}
        onOpenAiTriage={() => setIsAiTriageOpen(true)}
        onOpenBooking={() => handleOpenBooking()}
      />

      <main id="main-content" tabIndex={-1}>
        <section className="hero-section" aria-labelledby="hero-title">
          <CmsLiveSlot
            className="hero-inner"
            fallback={<HomeHeroComposition {...homeHeroProps} />}
            hideWhenNotFound
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

        <section className="cms-live-region" id="cms-live" aria-labelledby="cms-live-title">
          <div className="section-inner">
            <h2 className="sr-only" id="cms-live-title">Thông báo từ bệnh viện</h2>
            <div className="cms-live-region__grid">
              <CmsLiveSlot hideWhenNotFound slug="home" slotKey="body" />
              <div className="cms-live-region__aside">
                <CmsLiveSlot hideWhenNotFound slug="home" slotKey="sidebar" />
              </div>
            </div>
          </div>
        </section>

        <section className="care-section" aria-labelledby="care-title">
          <div className="care-inner">
            <h2 className="sr-only" id="care-title">Lối tắt chăm sóc</h2>
            <div className="care-links" aria-label="Lối tắt chăm sóc">
              <button className="care-link" onClick={() => handleOpenBooking()} type="button">
                <span className="care-link__icon"><Icon name="calendar" size={21} /></span>
                <span>
                  <strong>Đặt lịch khám</strong>
                  <small>Chọn bác sĩ và khung giờ</small>
                </span>
                <Icon name="chevron-right" size={18} />
              </button>
              <Link className="care-link" href="/doctors">
                <span className="care-link__icon"><Icon name="user" size={21} /></span>
                <span>
                  <strong>Trợ lý triệu chứng</strong>
                    <small>Gợi ý theo triệu chứng · cần đăng nhập</small>
                </span>
                <Icon name="chevron-right" size={18} />
              </Link>
              <Link className="care-link" href="#packages">
                <span className="care-link__icon"><Icon name="layers" size={21} /></span>
                <span>
                  <strong>Gói khám & dịch vụ</strong>
                  <small>So sánh lựa chọn theo nhu cầu</small>
                </span>
                <Icon name="chevron-right" size={18} />
              </Link>
              <Link className="care-link" href="/specialties">
                <span className="care-link__icon"><Icon name="stethoscope" size={21} /></span>
                <span>
                  <strong>Chuyên khoa</strong>
                  <small>Chọn theo nhu cầu thăm khám</small>
                </span>
                <Icon name="chevron-right" size={18} />
              </Link>
              {contactHref ? (
                <a className={`care-link${emergencyBranch ? " care-link--emergency" : ""}`} href={contactHref}>
                  <span className="care-link__icon"><Icon name="phone" size={21} /></span>
                  <span><strong>{emergencyBranch ? "Cấp cứu" : "Gọi bệnh viện"}</strong><small>{contactPhone}</small></span>
                  <Icon name="chevron-right" size={18} />
                </a>
              ) : (
                <Link className="care-link" href="/contact">
                  <span className="care-link__icon"><Icon name="phone" size={21} /></span>
                  <span><strong>Liên hệ bệnh viện</strong><small>Xem các kênh hỗ trợ</small></span>
                  <Icon name="chevron-right" size={18} />
                </Link>
              )}
            </div>
          </div>
        </section>

        <CareExperience />

        <section className="section section--specialties" id="specialties" aria-labelledby="specialties-title">
          <div className="section-inner">
            <SectionHeading
              action={<Link className="section-link" href="/specialties">Xem tất cả chuyên khoa <Icon name="arrow-right" size={17} /></Link>}
              description="Tìm hiểu phạm vi thăm khám và chọn chuyên khoa phù hợp với nhu cầu của bạn."
              headingId="specialties-title"
              note="Chuyên môn sâu"
              title="Chuyên khoa nổi bật"
            />
            <div className="specialty-layout">
              <aside className="specialty-aside">
                <div className="specialty-aside__mark"><Icon name="stethoscope" size={28} /></div>
                <h3>Chọn đúng chuyên khoa từ bước đầu.</h3>
                <p>Xem thông tin điều trị, đội ngũ bác sĩ và đặt lịch theo nhu cầu của bạn.</p>
              </aside>
              <div className="specialty-list">
                <CatalogStatus error={catalogError} hasData={Boolean(catalog)} loading={catalogLoading} onRetry={retryCatalog} unavailable={catalogUnavailable} />
                {!catalogLoading && catalog && filteredSpecialties.length > 0 ? filteredSpecialties.slice(0, 8).map((specialty, index) => (
                  <article className="specialty-row" key={specialty.id}>
                    <span className="specialty-row__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <div className="specialty-row__content">
                      <span className="specialty-row__icon"><Icon name={getSpecialtyIcon(specialty)} size={20} /></span>
                      <div>
                        <h3><Link href={`/specialties/${specialty.slug}`}>{specialty.name}</Link></h3>
                        <p>{specialty.description}</p>
                      </div>
                    </div>
                    <button className="icon-button" aria-label={`Đặt lịch theo chuyên khoa ${specialty.name}`} onClick={() => handleOpenBooking(undefined, specialty.id)} type="button">
                      <Icon name="arrow-up-right" size={18} />
                    </button>
                  </article>
                )) : !catalogLoading && catalog ? (
                  <div className="empty-state">
                    <p>{searchQuery ? `Chưa có chuyên khoa khớp với “${searchQuery}”.` : "Chưa có chuyên khoa đang cung cấp."}</p>
                    <button className="text-button" onClick={() => setSearchQuery("")} type="button">Xóa tìm kiếm <Icon name="x" size={17} /></button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className={`section section--doctors${catalogError ? " section--unavailable" : ""}`} id="doctors" aria-labelledby="doctors-title">
          <div className="section-inner">
            <SectionHeading
              action={<button className="section-link section-link--button" onClick={() => handleOpenBooking()} type="button">Đặt lịch với bác sĩ <Icon name="arrow-right" size={17} /></button>}
              description="Hồ sơ công khai giúp bạn chọn đúng chuyên môn và mở luồng đặt lịch."
              headingId="doctors-title"
              note="Đội ngũ chuyên gia"
              title="Bác sĩ đồng hành cùng bạn"
            />
            <CatalogStatus error={catalogError} hasData={Boolean(catalog)} loading={catalogLoading} onRetry={retryCatalog} unavailable={catalogUnavailable} />
            {!catalogLoading && featuredDoctor ? (
              <div className="doctor-layout">
                <DoctorCard doctor={featuredDoctor} featured onBook={(doctorId) => handleOpenBooking(doctorId)} />
                <div className="doctor-stack">
                  {supportingDoctors.map((doctor) => (
                    <DoctorCard doctor={doctor} key={doctor.id} onBook={(doctorId) => handleOpenBooking(doctorId)} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state empty-state--wide">
                <p>{catalog ? (searchQuery ? `Chưa có bác sĩ khớp với “${searchQuery}”.` : "Chưa có bác sĩ đang cung cấp.") : ""}</p>
                <button className="text-button" onClick={() => setSearchQuery("")} type="button">Xóa tìm kiếm <Icon name="x" size={17} /></button>
              </div>
            )}
          </div>
        </section>

        <section className={`section section--packages${catalogError ? " section--unavailable" : ""}`} id="packages" aria-labelledby="packages-title">
          <div className="section-inner">
            <SectionHeading
              action={<Link className="section-link" href="/packages">Xem danh mục gói khám <Icon name="arrow-right" size={17} /></Link>}
              description="Các gói khám đang cung cấp; giá và mô tả hiển thị theo thông tin công khai."
              headingId="packages-title"
              note="Gói khám sức khỏe"
              title="Chủ động chăm sóc sức khỏe"
            />
            <CatalogStatus error={catalogError} hasData={Boolean(catalog)} loading={catalogLoading} onRetry={retryCatalog} unavailable={catalogUnavailable} />
            {!catalogLoading && catalog && packages.length > 0 ? (
              <div className={packageVisualStyles.homeRail} aria-label="Các gói khám sức khỏe">
                {packages.slice(0, 4).map((packageItem, index) => (
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
            ) : !catalogLoading && catalog ? (
              <div className="empty-state empty-state--wide"><p>Danh sách gói khám đang được cập nhật.</p></div>
            ) : null}
          </div>
        </section>

        <section className="section section--journey" id="guide" aria-labelledby="journey-title">
          <div className="section-inner">
            <div className="journey-layout">
              <div>
                <SectionHeading
                  description="Một trình tự ngắn để người bệnh biết mình cần chuẩn bị gì trước và sau cuộc hẹn."
                  headingId="journey-title"
                  note="Hướng dẫn thăm khám"
                  title="Bốn bước cho một cuộc hẹn thuận tiện"
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
              note="Hệ thống cơ sở"
              title="Tìm cơ sở thuận tiện"
            />
            <div className="branch-layout">
              <div className="branch-intro">
                <div className="branch-intro__topline"><Icon name="location" size={20} /><span>TP. Hồ Chí Minh</span></div>
                <h3>Chọn nơi bạn muốn bắt đầu chăm sóc.</h3>
                <p>Địa chỉ và giờ làm việc lấy từ catalog công khai. Hãy kiểm tra lại trước khi đến.</p>
                {contactHref ? <a className="text-button" href={contactHref}>{emergencyBranch ? "Gọi hotline cấp cứu" : "Gọi cơ sở"} <Icon name="phone" size={17} /></a> : <Link className="text-button" href="/contact">Xem thông tin liên hệ <Icon name="arrow-up-right" size={17} /></Link>}
              </div>
              <div className="branch-list">
                <CatalogStatus error={catalogError} hasData={Boolean(catalog)} loading={catalogLoading} onRetry={retryCatalog} unavailable={catalogUnavailable} />
                {!catalogLoading && catalog && branches.map((branch, index) => (
                  <article className="branch-row" key={branch.id}>
                    <span className="branch-row__index">0{index + 1}</span>
                    <div>
                      <h3>{branch.name}</h3>
                      <p><Icon name="location" size={15} />{branch.address}</p>
                      <p><Icon name="clock" size={15} />{branch.workingHours ?? "Giờ làm việc đang cập nhật."}</p>
                    </div>
                    <div className="branch-row__actions">
                      {safeTelephoneHref(branch.phone) ? <a href={safeTelephoneHref(branch.phone) ?? undefined} aria-label={`Gọi ${branch.name}`}>{branch.phone}</a> : <span className="resource-muted">Số điện thoại đang cập nhật.</span>}
                      <BranchMap address={branch.address} branchName={branch.name} className="branch-row__map-link" variant="link" />
                      <button className="outline-button outline-button--small" onClick={() => handleOpenBooking(undefined, undefined, undefined, branch.id)} type="button">Đặt lịch</button>
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
              note="Cẩm nang sức khỏe"
              title="Thông tin sức khỏe hữu ích"
            />
            <div className="content-layout">
              <article className="video-card">
                <div className="video-card__visual">
                  <span className="video-card__label">Gợi ý đọc</span>
                  <span className="video-card__circle"><Icon name="play" size={22} /></span>
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

      <button
        aria-label="Mở công cụ hỗ trợ chọn chuyên khoa"
        className="ai-navigator-fab"
        onClick={() => setIsAiTriageOpen(true)}
        type="button"
      >
        <span className="ai-navigator-fab__icon"><Icon name="stethoscope" size={20} /></span>
        <span className="ai-navigator-fab__copy"><strong>Chọn chuyên khoa</strong><small>Hỗ trợ theo nhu cầu</small></span>
        <Icon name="arrow-up-right" size={17} />
      </button>

      <Footer branches={branches} cmsSlug="home" />

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
      <AiTriageModal
        emergencyContact={emergencyBranch?.emergencyHotline}
        isOpen={isAiTriageOpen}
        onClose={() => setIsAiTriageOpen(false)}
        onSelectSpecialtyForBooking={handleAiSpecialtySelect}
      />
    </div>
  );
}
