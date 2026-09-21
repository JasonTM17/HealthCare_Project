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
  nextPath,
}: {
  message: string;
  status?: number;
  onRetry?: () => void;
  nextPath?: string;
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
  // A caller-supplied message has already been translated by `presentApiError`,
  // which knows whether the failure is permanent (a disabled feature) or
  // transient. Replacing it with generic connection copy told patients a flaky
  // link was at fault for a gate that retrying can never clear.
  const supplied = message.trim();
  const description = supplied
    ? supplied
    : isUnauthorized
      ? "Vui lòng đăng nhập lại để tiếp tục xem thông tin của bạn."
      : isForbidden
        ? "Tài khoản hiện tại chưa được phép xem nội dung này."
        : isUnavailable
          ? "Kết nối đang bị gián đoạn. Vui lòng thử lại sau ít phút."
          : "Dữ liệu tạm thời chưa thể hiển thị. Vui lòng thử lại.";
  const loginHref = nextPath
    ? `/auth/login?next=${encodeURIComponent(nextPath)}`
    : "/auth/login?next=%2F";

  return (
    <div aria-live="assertive" className="portal-state portal-state--error" role="alert">
      <span aria-hidden="true" className="portal-state__mark">!</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
        {isUnauthorized ? <Link className="button button--primary" href={loginHref}>Đăng nhập lại</Link> : null}
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
        <p>Thông tin sức khỏe chỉ hiển thị sau khi bạn đăng nhập bằng tài khoản phù hợp.</p>
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
