import Link from "next/link";
import Icon from "./UiIcon";

const ROUTE_LABELS: Record<string, string> = {
  about: "Về HealthCare",
  articles: "Cẩm nang sức khỏe",
  branches: "Cơ sở",
  careers: "Tuyển dụng",
  "chinh-sach-bao-mat": "Chính sách bảo mật",
  contact: "Liên hệ",
  "dat-lich": "Đặt lịch khám",
  doctors: "Bác sĩ",
  faq: "Câu hỏi thường gặp",
  "huong-dan": "Hướng dẫn khám",
  packages: "Gói khám",
  search: "Tìm kiếm",
  services: "Dịch vụ",
  specialties: "Chuyên khoa",
  "tra-cuu": "Tra cứu lịch hẹn",
};

// These pages already render a breadcrumb within their task-specific form.
const ROUTES_WITH_LOCAL_BREADCRUMB = new Set(["/dat-lich", "/huong-dan", "/tra-cuu"]);

interface PublicRouteBreadcrumbProps {
  pathname: string;
}

export default function PublicRouteBreadcrumb({ pathname }: PublicRouteBreadcrumbProps) {
  if (pathname === "/" || ROUTES_WITH_LOCAL_BREADCRUMB.has(pathname)) return null;

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const parentSegment = segments[0];
  const parentLabel = ROUTE_LABELS[parentSegment] ?? "Khám phá";
  const isDetailPage = segments.length > 1;

  return (
    <nav aria-label="Đường dẫn trang" className="public-route-breadcrumb">
      <ol className="public-route-breadcrumb__list">
        <li>
          <Link href="/">Trang chủ</Link>
        </li>
        <li aria-hidden="true" className="public-route-breadcrumb__separator">
          <Icon name="chevron-right" size={14} />
        </li>
        {isDetailPage ? (
          <>
            <li>
              <Link href={`/${parentSegment}`}>{parentLabel}</Link>
            </li>
            <li aria-hidden="true" className="public-route-breadcrumb__separator">
              <Icon name="chevron-right" size={14} />
            </li>
            <li aria-current="page">Thông tin chi tiết</li>
          </>
        ) : (
          <li aria-current="page">{parentLabel}</li>
        )}
      </ol>
    </nav>
  );
}
