"use client";

import NotificationCenter from "../../../components/NotificationCenter";
import PortalChrome from "../../../components/PortalChrome";
import { ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import { useAuthSession, useAuthSessionStatus } from "../../../components/useAuthSession";
import { hasRole } from "../../../lib/api-client";

/**
 * Full-screen patient inbox — the bell's "Xem tất cả thông báo" destination
 * (docs/design/stitch-notification-panel.md backlog #2). The category filters,
 * pagination and empty state live in the shared `NotificationCenter`, which the
 * doctor route mounts with its own role instead of forking a second list.
 */
export default function PatientNotificationsPage() {
  const session = useAuthSession();
  const authStatus = useAuthSessionStatus();

  if (authStatus !== "settled") {
    return <main className="portal-entry"><LoadingState label="Đang kiểm tra phiên đăng nhập..." /></main>;
  }

  if (!session?.user) {
    return <main className="portal-entry"><LoginRequiredState nextPath="/patient/notifications" /></main>;
  }

  if (!hasRole(session.user, "PATIENT")) {
    return (
      <main className="portal-entry">
        <ForbiddenState
          description="Hộp thư này chỉ hiển thị với tài khoản bệnh nhân của hệ thống."
          title="Không thể mở hộp thư thông báo"
        />
      </main>
    );
  }

  return (
    <PortalChrome role="PATIENT" user={session.user}>
      <NotificationCenter role="PATIENT" />
    </PortalChrome>
  );
}
