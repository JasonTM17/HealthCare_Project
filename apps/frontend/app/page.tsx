"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import AiTriageModal from "../components/AiTriageModal";
import BookingModal from "../components/BookingModal";
import { CmsLiveSlot } from "../components/cms";
import Footer from "../components/Footer";
import Icon, { type IconName } from "../components/UiIcon";
import Navbar from "../components/Navbar";
import {
  fetchArticles,
  fetchBranches,
  fetchDoctors,
  fetchPackages,
  fetchSpecialties,
  type Page,
} from "../lib/api-client";
import type { Article, Branch, Doctor, HealthPackage, Specialty } from "../types/hospital";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1600&q=85";

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

const formatCurrency = (price: number): string =>
  new Intl.NumberFormat("vi-VN").format(price);

const formatPublishedAt = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Đã xuất bản"
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(date);
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
        <div className="doctor-photo__fallback" aria-label={`Ảnh demo của ${doctor.fullName}`}>
          <Icon name="stethoscope" size={32} />
          <span>{getInitials(doctor.fullName)}</span>
        </div>
      )}
      <span className="doctor-photo__caption">Ảnh demo local</span>
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

interface PackageRowProps {
  packageItem: HealthPackage;
  onBook: (packageId: string) => void;
}

const PackageRow: React.FC<PackageRowProps> = ({ packageItem, onBook }) => (
  <article className="package-row">
    <div>
      <p className="package-row__price">{formatCurrency(packageItem.price)} VNĐ</p>
      <h3>{packageItem.name}</h3>
      <p>{packageItem.description}</p>
    </div>
    <div className="package-row__actions">
      <Link href={`/goi-kham/${packageItem.slug}`} className="text-button">
        Xem gói
        <Icon name="arrow-up-right" size={17} />
      </Link>
      <button className="outline-button outline-button--small" onClick={() => onBook(packageItem.id)} type="button">
        Đặt lịch
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
}: {
  loading: boolean;
  error: string | null;
  hasData: boolean;
}): React.ReactElement | null {
  if (loading && !hasData) {
    return <p className="catalog-status catalog-status--loading" role="status">Đang tải dữ liệu từ hệ thống bệnh viện…</p>;
  }
  if (error && !hasData) {
    return <p className="catalog-status catalog-status--error" role="alert">{error}</p>;
  }
  return null;
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

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve().then(async () => {
      if (cancelled) return;
      setCatalogLoading(true);
      setCatalogError(null);
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
        if (!cancelled) setCatalogError(error instanceof Error ? error.message : "Không thể tải catalog từ backend.");
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    });
    return () => {
      cancelled = true;
      void task;
    };
  }, []);

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
    const matchedSpecialty = specialtyId
      ? (catalog?.specialties ?? []).find((specialty) => specialty.id === specialtyId)
      : undefined;
    handleOpenBooking(undefined, matchedSpecialty?.id, undefined);
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
  const contactPhone = emergencyBranch?.emergencyHotline ?? contactBranch?.phone;
  const featuredPackage = packages.find((packageItem) => packageItem.featured) ?? packages[0];
  const supportingPackages = packages.filter((packageItem) => packageItem.id !== featuredPackage?.id);
  const featuredDoctor = filteredDoctors[0];
  const supportingDoctors = filteredDoctors.slice(1, 4);

  return (
    <div className="site-shell">
      <Navbar
        branches={branches}
        onOpenAiTriage={() => setIsAiTriageOpen(true)}
        onOpenBooking={() => handleOpenBooking()}
      />

      <main>
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-inner">
            <div className="hero-copy">
              <p className="hero-kicker">
                <span className="hero-kicker__line" aria-hidden="true" />
                Chăm sóc có định hướng
              </p>
              <h1 id="hero-title">
                Để mỗi lần đi khám <span>an tâm hơn.</span>
              </h1>
              <p className="hero-description">
                Tìm bác sĩ, chọn cơ sở và đặt lịch trong một hành trình rõ ràng.
              </p>
              <form
                className="hero-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  const nextQuery = searchQuery.trim();
                  router.push(nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : "/search");
                }}
              >
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
                Tìm trong catalog đang được cung cấp bởi backend để chọn hướng đặt lịch phù hợp.
              </p>
              <div className="hero-actions">
                <button className="button button--amber" onClick={() => handleOpenBooking()} type="button">
                  Đặt lịch khám
                  <Icon name="arrow-up-right" size={18} />
                </button>
                <button className="button button--hero-secondary" onClick={() => setIsAiTriageOpen(true)} type="button">
                  Mô tả triệu chứng
                  <Icon name="activity" size={18} />
                </button>
              </div>
              <DemoNote>
                Catalog công khai lấy từ backend; trợ lý AI gọi backend khi bạn đã đăng nhập.
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
                  <span><strong>{emergencyBranch ? "Hotline từ backend" : "Liên hệ cơ sở"}</strong><small>{contactPhone ?? "Chưa cung cấp số điện thoại"}</small></span>
                </div>
              </div>
            </div>

            <figure className="hero-visual">
              <div className="hero-visual__image-wrap">
                <Image
                  alt="Không gian chăm sóc y tế sáng và thân thiện"
                  className="hero-visual__image"
                  fill
                  priority
                  sizes="(max-width: 900px) 100vw, 46vw"
                  src={HERO_IMAGE}
                />
              </div>
              <figcaption>
                Ảnh minh họa từ Unsplash. Giao diện và dữ liệu hiện tại phục vụ bản demo local.
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="section section--cms-live" id="cms-live" aria-labelledby="cms-live-title">
          <div className="section-inner">
            <SectionHeading
              description="Khối này đọc trực tiếp từ CMS. Khi quản trị viên xuất bản thay đổi, nội dung cập nhật qua change-feed mà không cần tải lại trang."
              headingId="cms-live-title"
              note="Cập nhật từ bệnh viện"
              title="Thông tin mới nhất cho hành trình chăm sóc"
            />
            <CmsLiveSlot className="mt-6" slug="home" slotKey="hero" />
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
              <CmsLiveSlot hideWhenNotFound slug="home" slotKey="body" />
              <div className="grid gap-6">
                <CmsLiveSlot hideWhenNotFound slug="home" slotKey="sidebar" />
                <CmsLiveSlot hideWhenNotFound slug="home" slotKey="footer" />
              </div>
            </div>
          </div>
        </section>

        <section className="care-section" aria-labelledby="care-title">
          <div className="care-inner">
            <div className="care-intro">
              <p className="section-note">Điểm bắt đầu</p>
              <h2 id="care-title">Bạn cần tìm gì hôm nay?</h2>
              <p>Gõ tên bác sĩ hoặc chuyên khoa để lọc nhanh nội dung phù hợp bên dưới.</p>
            </div>

            <form
              className="care-search"
              onSubmit={(event) => {
                event.preventDefault();
                handleOpenBooking();
              }}
            >
              <label htmlFor="care-search-input">Tìm bác sĩ hoặc chuyên khoa</label>
              <div className="care-search__control">
                <Icon name="search" size={19} />
                <input
                  aria-describedby="care-search-help"
                  id="care-search-input"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Ví dụ: Tim Mạch, Nhi Khoa..."
                  type="search"
                  value={searchQuery}
                />
                <button className="button button--primary" type="submit">
                  Đặt theo nhu cầu
                </button>
              </div>
              <p id="care-search-help">Kết quả tìm kiếm được lọc từ catalog công khai hiện tại.</p>
            </form>

            <div className="care-links" aria-label="Lối tắt chăm sóc">
              <button className="care-link" onClick={() => handleOpenBooking()} type="button">
                <span className="care-link__icon"><Icon name="calendar" size={21} /></span>
                <span>
                  <strong>Đặt lịch khám</strong>
                  <small>Chọn bác sĩ và khung giờ</small>
                </span>
                <Icon name="chevron-right" size={18} />
              </button>
              <button className="care-link care-link--accent" onClick={() => setIsAiTriageOpen(true)} type="button">
                <span className="care-link__icon"><Icon name="sparkles" size={21} /></span>
                <span>
                  <strong>Trợ lý triệu chứng</strong>
                  <small>Gợi ý từ backend · cần đăng nhập</small>
                </span>
                <Icon name="chevron-right" size={18} />
              </button>
              <Link className="care-link" href="#packages">
                <span className="care-link__icon"><Icon name="layers" size={21} /></span>
                <span>
                  <strong>Gói khám & dịch vụ</strong>
                  <small>So sánh lựa chọn theo nhu cầu</small>
                </span>
                <Icon name="chevron-right" size={18} />
              </Link>
              <Link className="care-link" href="/#branches">
                <span className="care-link__icon"><Icon name="location" size={21} /></span>
                <span>
                  <strong>Cơ sở gần bạn</strong>
                  <small>Xem địa chỉ và giờ làm việc</small>
                </span>
                <Icon name="chevron-right" size={18} />
              </Link>
            </div>
          </div>
        </section>

        <section className="section section--specialties" id="specialties" aria-labelledby="specialties-title">
          <div className="section-inner">
            <SectionHeading
              action={<Link className="section-link" href="/specialties">Xem tất cả chuyên khoa <Icon name="arrow-right" size={17} /></Link>}
              description="Bắt đầu từ điều bạn đang quan tâm. Mỗi chuyên khoa có thông tin riêng để bạn chuẩn bị tốt hơn cho cuộc hẹn."
              headingId="specialties-title"
              note="Danh mục chăm sóc"
              title="Chuyên khoa cho từng nhu cầu"
            />
            <div className="specialty-layout">
              <aside className="specialty-aside">
                <div className="specialty-aside__mark"><Icon name="stethoscope" size={28} /></div>
                <h3>Thông tin rõ ràng trước khi đặt hẹn.</h3>
                <p>Chọn một chuyên khoa để xem mô tả, bác sĩ liên quan và mở luồng đặt lịch.</p>
                <DemoNote>Dữ liệu chuyên khoa được tải từ catalog công khai.</DemoNote>
              </aside>
              <div className="specialty-list">
                <CatalogStatus error={catalogError} hasData={Boolean(catalog)} loading={catalogLoading} />
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
                    <p>{searchQuery ? `Chưa có chuyên khoa khớp với “${searchQuery}”.` : "Backend chưa có chuyên khoa active."}</p>
                    <button className="text-button" onClick={() => setSearchQuery("")} type="button">Xóa tìm kiếm <Icon name="x" size={17} /></button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="section section--doctors" id="doctors" aria-labelledby="doctors-title">
          <div className="section-inner">
            <SectionHeading
              action={<button className="section-link section-link--button" onClick={() => handleOpenBooking()} type="button">Đặt lịch với bác sĩ <Icon name="arrow-right" size={17} /></button>}
              description="Hồ sơ được lấy từ catalog backend để bạn chọn đúng chuyên môn và mở luồng đặt lịch."
              headingId="doctors-title"
              note="Đội ngũ chuyên gia"
              title="Một bác sĩ phù hợp có thể bắt đầu từ một câu hỏi"
            />
            <CatalogStatus error={catalogError} hasData={Boolean(catalog)} loading={catalogLoading} />
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
                <p>{catalog ? (searchQuery ? `Chưa có bác sĩ khớp với “${searchQuery}”.` : "Backend chưa có bác sĩ active.") : ""}</p>
                <button className="text-button" onClick={() => setSearchQuery("")} type="button">Xóa tìm kiếm <Icon name="x" size={17} /></button>
              </div>
            )}
          </div>
        </section>

        <section className="section section--packages" id="packages" aria-labelledby="packages-title">
          <div className="section-inner">
            <SectionHeading
              action={<Link className="section-link" href="/packages">Xem danh mục gói khám <Icon name="arrow-right" size={17} /></Link>}
              description="Các gói khám active được lấy từ backend; giá và mô tả hiển thị đúng theo contract công khai."
              headingId="packages-title"
              note="Gói khám sức khỏe"
              title="Chủ động kiểm tra, bắt đầu từ điều phù hợp"
            />
            <div className="package-layout">
              {featuredPackage ? (
                <article className="package-feature">
                  <div>
                    <span className="package-badge">Từ catalog backend</span>
                    <p className="package-feature__eyebrow">Gói nổi bật</p>
                    <h3>{featuredPackage.name}</h3>
                    <p>{featuredPackage.description}</p>
                    <p className="package-feature__price">{formatCurrency(featuredPackage.price)} <span>VNĐ</span></p>
                    <ul>
                      {featuredPackage.checklist?.slice(0, 4).map((item) => (
                        <li key={item}><Icon name="check" size={17} />{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="package-feature__actions">
                    <button className="button button--amber" onClick={() => handleOpenBooking(undefined, undefined, featuredPackage.id)} type="button">
                      Đặt gói khám này <Icon name="arrow-up-right" size={18} />
                    </button>
                    <Link className="text-button text-button--light" href={`/packages/${featuredPackage.slug}`}>Xem chi tiết <Icon name="arrow-right" size={17} /></Link>
                  </div>
              </article>
              ) : null}
              <div className="package-list">
                <CatalogStatus error={catalogError} hasData={Boolean(catalog)} loading={catalogLoading} />
                {!catalogLoading && catalog && supportingPackages.map((packageItem) => (
                  <PackageRow key={packageItem.id} onBook={(packageId) => handleOpenBooking(undefined, undefined, packageId)} packageItem={packageItem} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section section--journey" id="guide" aria-labelledby="journey-title">
          <div className="section-inner">
            <div className="journey-layout">
              <div>
                <SectionHeading
                  description="Một trình tự ngắn để người bệnh biết mình cần chuẩn bị gì trước và sau cuộc hẹn."
                  headingId="journey-title"
                  note="Hành trình đặt khám"
                  title="Bốn bước để buổi khám bắt đầu nhẹ nhàng hơn"
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

        <section className="section section--branches" id="branches" aria-labelledby="branches-title">
          <div className="section-inner">
            <SectionHeading
              action={<Link className="section-link" href="/branches">Xem tất cả cơ sở <Icon name="arrow-right" size={17} /></Link>}
              description="Chọn cơ sở theo vị trí, giờ làm việc và nhu cầu đặt hẹn của bạn."
              headingId="branches-title"
              note="Mạng lưới phục vụ"
              title="Một cơ sở gần bạn, một cuộc hẹn rõ ràng"
            />
            <div className="branch-layout">
              <div className="branch-intro">
                <div className="branch-intro__topline"><Icon name="location" size={20} /><span>TP. Hồ Chí Minh</span></div>
                <h3>Chọn nơi bạn muốn bắt đầu chăm sóc.</h3>
                <p>Địa chỉ và giờ làm việc lấy từ catalog backend. Hãy kiểm tra lại trước khi đến.</p>
                <DemoNote>Chưa kết nối bản đồ trực tiếp trong bản demo.</DemoNote>
                {contactPhone ? <a className="text-button" href={`tel:${contactPhone.replace(/\s/g, "")}`}>{emergencyBranch ? "Gọi hotline từ backend" : "Gọi cơ sở"} <Icon name="phone" size={17} /></a> : <Link className="text-button" href="/contact">Xem thông tin liên hệ <Icon name="arrow-up-right" size={17} /></Link>}
              </div>
              <div className="branch-list">
                <CatalogStatus error={catalogError} hasData={Boolean(catalog)} loading={catalogLoading} />
                {!catalogLoading && catalog && branches.map((branch, index) => (
                  <article className="branch-row" key={branch.id}>
                    <span className="branch-row__index">0{index + 1}</span>
                    <div>
                      <h3>{branch.name}</h3>
                      <p><Icon name="location" size={15} />{branch.address}</p>
                      <p><Icon name="clock" size={15} />{branch.workingHours ?? "Backend chưa cung cấp giờ làm việc."}</p>
                    </div>
                    <div className="branch-row__actions">
                      {branch.phone ? <a href={`tel:${branch.phone.replace(/\s/g, "")}`} aria-label={`Gọi ${branch.name}`}>{branch.phone}</a> : <span className="resource-muted">Backend chưa cung cấp số điện thoại.</span>}
                      <button className="outline-button outline-button--small" onClick={() => handleOpenBooking(undefined, undefined, undefined, branch.id)} type="button">Đặt lịch</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section section--content" id="articles" aria-labelledby="content-title">
          <div className="section-inner">
            <SectionHeading
              action={<Link className="section-link" href="/articles">Xem cẩm nang <Icon name="arrow-right" size={17} /></Link>}
              description="Nội dung ngắn, dễ đọc để bạn chuẩn bị câu hỏi và theo dõi hướng dẫn sau buổi khám."
              headingId="content-title"
              note="Cẩm nang sức khỏe"
              title="Kiến thức y khoa trong nhịp sống hằng ngày"
            />
            <div className="content-layout">
              <article className="video-card">
                <div className="video-card__visual">
                  <span className="video-card__label">Gợi ý đọc</span>
                  <span className="video-card__circle"><Icon name="play" size={22} /></span>
                </div>
                <div className="video-card__body">
                  <p className="content-meta">Từ cẩm nang backend</p>
                  <h3>{articles[0]?.title ?? "Cẩm nang sức khỏe đang được cập nhật"}</h3>
                  <p>{articles[0]?.summary ?? "Khi backend chưa có bài viết, danh mục sẽ hiển thị trạng thái trống rõ ràng."}</p>
                  <Link className="text-button" href="/articles">Mở danh mục bài viết <Icon name="arrow-up-right" size={17} /></Link>
                </div>
              </article>
              <div className="article-list">
                <CatalogStatus error={catalogError} hasData={Boolean(catalog)} loading={catalogLoading} />
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
              <h2 id="appointment-cta-title">Một cuộc hẹn rõ ràng bắt đầu từ hôm nay.</h2>
              <p>Chọn bác sĩ, cơ sở hoặc gói khám phù hợp. Luồng đặt lịch hiện có vẫn giữ nguyên.</p>
            </div>
            <div className="appointment-cta__actions">
              <button className="button button--amber" onClick={() => handleOpenBooking()} type="button">Đặt lịch khám <Icon name="arrow-up-right" size={18} /></button>
              {contactPhone ? <a className="button button--cta-secondary" href={`tel:${contactPhone.replace(/\s/g, "")}`}><Icon name="phone" size={18} />{contactPhone}</a> : <Link className="button button--cta-secondary" href="/contact"><Icon name="location" size={18} />Thông tin liên hệ</Link>}
            </div>
          </div>
        </section>
      </main>

      <button
        aria-label="Mở Trợ lý AI để gợi ý chuyên khoa"
        className="ai-navigator-fab"
        onClick={() => setIsAiTriageOpen(true)}
        type="button"
      >
        <span className="ai-navigator-fab__icon"><Icon name="sparkles" size={20} /></span>
        <span className="ai-navigator-fab__copy"><strong>Care Navigator</strong><small>Gợi ý chuyên khoa</small></span>
        <Icon name="arrow-up-right" size={17} />
      </button>

      <Footer branches={branches} />

      <BookingModal
        key={`${selectedBranchId ?? "default"}:${selectedDoctorId ?? "default"}:${selectedPackageId ?? "default"}:${selectedSpecialtyId ?? "default"}`}
        initialBranchId={selectedBranchId}
        initialDoctorId={selectedDoctorId}
        initialPackageId={selectedPackageId}
        initialSpecialtyId={selectedSpecialtyId}
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        branches={branches}
        doctors={catalog?.doctors ?? []}
        packages={packages}
        specialties={catalog?.specialties ?? []}
      />
      <AiTriageModal
        isOpen={isAiTriageOpen}
        onClose={() => setIsAiTriageOpen(false)}
        onSelectSpecialtyForBooking={handleAiSpecialtySelect}
      />
    </div>
  );
}
