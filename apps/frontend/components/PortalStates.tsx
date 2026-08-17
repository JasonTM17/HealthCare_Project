import Link from "next/link";
import type { ReactNode } from "react";

interface StateAction {
  href: string;
  label: string;
}

export function LoadingState({ label = "Đang tải dữ liệu..." }: { label?: string }) {
  return (
    <div aria-live="polite" className="portal-state portal-state--loading" role="status">
      <span aria-hidden="true" className="portal-state__spinner" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: StateAction;
}) {
  return (
    <div className="portal-state portal-state--empty">
      <span aria-hidden="true" className="portal-state__mark">—</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
        {action ? <Link className="outline-button outline-button--small" href={action.href}>{action.label}</Link> : null}
      </div>
    </div>
  );
}

export function ErrorState({
  message,
  status,
  onRetry,
}: {
  message: string;
  status?: number;
  onRetry?: () => void;
}) {
  const isUnauthorized = status === 401;
  const isForbidden = status === 403;
  const isUnavailable = status === undefined || status >= 500;
  const title = isUnauthorized
    ? "Phiên đăng nhập không còn hiệu lực"
    : isForbidden
      ? "Bạn không có quyền xem dữ liệu này"
      : isUnavailable
        ? "Dịch vụ tạm thời không khả dụng"
        : "Không thể tải dữ liệu";
  const description = isUnauthorized
    ? "Máy chủ yêu cầu đăng nhập lại trước khi tải dữ liệu được bảo vệ."
    : isForbidden
      ? "Quyền truy cập được kiểm tra ở phía máy chủ. Hãy dùng đúng tài khoản được liên kết."
      : isUnavailable
        ? "Backend chưa sẵn sàng hoặc kết nối bị gián đoạn. Không có dữ liệu thay thế được tạo trên trình duyệt."
        : message;

  return (
    <div aria-live="assertive" className="portal-state portal-state--error" role="alert">
      <span aria-hidden="true" className="portal-state__mark">!</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
        {isUnauthorized ? <Link className="button button--primary" href="/auth/login?next=%2F">Đăng nhập lại</Link> : null}
        {onRetry ? <button className="outline-button outline-button--small" onClick={onRetry} type="button">Thử lại</button> : null}
      </div>
    </div>
  );
}

export function LoginRequiredState({ nextPath }: { nextPath: string }) {
  return (
    <div className="portal-state portal-state--auth">
      <span aria-hidden="true" className="portal-state__mark">↗</span>
      <div>
        <h2>Đăng nhập để mở cổng thông tin</h2>
        <p>Thông tin sức khỏe chỉ được tải sau khi máy chủ xác thực tài khoản của bạn.</p>
        <Link className="button button--primary" href={`/auth/login?next=${encodeURIComponent(nextPath)}`}>
          Đăng nhập
        </Link>
      </div>
    </div>
  );
}

export function ForbiddenState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="portal-state portal-state--error" role="alert">
      <span aria-hidden="true" className="portal-state__mark">!</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
      </div>
    </div>
  );
}
