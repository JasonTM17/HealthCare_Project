"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  AUTH_SESSION_INDETERMINATE_MESSAGE,
  hasRole,
  hydrateAuthSession,
} from "../lib/api-client";
import { useAuthSession, useAuthSessionStatus } from "./useAuthSession";
import { ForbiddenState, LoadingState, LoginRequiredState } from "./PortalStates";

interface PortalAccessGateProps {
  children: ReactNode;
  role: "PATIENT" | "DOCTOR";
}

const MAX_RETURN_PATH_LENGTH = 2_048;
const RETURN_PATH_CONTROL_PATTERN = /[\\\u0000-\u001f\u007f]/u;

function safePortalReturnPath(pathname: string | null, role: PortalAccessGateProps["role"]): string {
  const roleFallback = `/${role.toLowerCase()}`;
  const pathnameFallback = pathname?.startsWith("/") && !pathname.startsWith("//")
    ? pathname
    : roleFallback;
  if (typeof window === "undefined") return pathnameFallback;

  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (
    currentPath.length === 0
    || currentPath.length > MAX_RETURN_PATH_LENGTH
    || !currentPath.startsWith("/")
    || currentPath.startsWith("//")
    || RETURN_PATH_CONTROL_PATTERN.test(currentPath)
  ) {
    return pathnameFallback;
  }
  return currentPath;
}

export default function PortalAccessGate({ children, role }: PortalAccessGateProps) {
  const pathname = usePathname();
  const session = useAuthSession();
  const hydrationStatus = useAuthSessionStatus();

  if (hydrationStatus === "indeterminate") {
    return (
      <main className="portal-entry">
        <section aria-live="assertive" className="portal-panel max-w-xl" role="alert">
          <h1>Không thể xác định trạng thái phiên đăng nhập</h1>
          <p>{AUTH_SESSION_INDETERMINATE_MESSAGE}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="primary-button min-h-11" onClick={() => void hydrateAuthSession(true)} type="button">
              Thử xác minh lại
            </button>
            <button className="outline-button min-h-11" onClick={() => window.location.reload()} type="button">
              Tải lại trang
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (hydrationStatus !== "settled") {
    return (
      <main className="portal-entry">
        <LoadingState label="Đang xác minh phiên đăng nhập an toàn..." />
      </main>
    );
  }

  if (!session) {
    const nextPath = safePortalReturnPath(pathname, role);
    return (
      <main className="portal-entry">
        <LoginRequiredState nextPath={nextPath} />
      </main>
    );
  }

  if (!hasRole(session.user, role)) {
    return (
      <main className="portal-entry">
        <ForbiddenState
          title="Tài khoản không có quyền mở cổng thông tin này"
          description={role === "PATIENT"
            ? "Khu vực này chỉ dành cho tài khoản bệnh nhân."
            : "Khu vực này chỉ dành cho tài khoản bác sĩ."}
        />
      </main>
    );
  }

  return children;
}
