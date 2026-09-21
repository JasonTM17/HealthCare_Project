"use client";

import NotificationCenter from "../../../components/NotificationCenter";
import PortalChrome from "../../../components/PortalChrome";
import { ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import { useAuthSession, useAuthSessionStatus } from "../../../components/useAuthSession";
import { hasRole } from "../../../lib/api-client";

/**
 * Full-screen doctor inbox. The notifications API scopes rows to the caller, so
 * this route mounts the same `NotificationCenter` the patient route uses — the
 * doctor dashboard has no notifications section to anchor, which is why the
 * dedicated surface exists at all.
 */
export default function DoctorNotificationsPage() {
  const session = useAuthSession();
  const authStatus = useAuthSessionStatus();

  if (authStatus !== "settled") {
    return <main className="portal-entry"><LoadingState label="Đang kiểm tra phiên đăng nhập..." /></main>;
  }

  if (!session?.user) {
    return <main className="portal-entry"><LoginRequiredState nextPath="/doctor/notifications" /></main>;
  }

  if (!hasRole(session.user, "DOCTOR")) {
    return (
      <main className="portal-entry">
        <ForbiddenState
          description="Hộp thư này chỉ hiển thị với tài khoản bác sĩ của hệ thống."
          title="Không thể mở hộp thư thông báo"
        />
      </main>
    );
  }

  return (
    <PortalChrome role="DOCTOR" user={session.user}>
      <NotificationCenter role="DOCTOR" />
    </PortalChrome>
  );
}
