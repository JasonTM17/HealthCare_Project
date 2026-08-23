"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import AdminState from "./_components/AdminState";
import { logoutCurrentUser } from "../../lib/api-client";
import UiIcon from "../../components/UiIcon";

const AUTH_STORAGE_KEY = "healthcare.auth.session";

const NAV = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin/appointments", label: "Lịch hẹn" },
  { href: "/admin/payments", label: "Thanh toán" },
  { href: "/admin/doctors", label: "Bác sĩ" },
  { href: "/admin/specialties", label: "Chuyên khoa" },
  { href: "/admin/branches", label: "Cơ sở" },
  { href: "/admin/services", label: "Dịch vụ" },
  { href: "/admin/catalog", label: "Gói & bài viết" },
  { href: "/admin/schedules", label: "Lịch bác sĩ" },
  { href: "/admin/content", label: "CMS live" },
];

type GateState =
  | { status: "checking" }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "ready"; displayName?: string };

function hasAdminRole(roles: unknown): boolean {
  return Array.isArray(roles) && roles.some(
    (role) => typeof role === "string" && role.replace(/^ROLE_/, "").toUpperCase() === "ADMIN",
  );
}

function readGateState(): GateState {
  try {
    const raw = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { status: "unauthenticated" };

    const parsed = JSON.parse(raw) as {
      accessToken?: unknown;
      user?: { displayName?: unknown; roles?: unknown };
    };

    if (typeof parsed.accessToken !== "string" || !parsed.accessToken || !parsed.user) {
      return { status: "unauthenticated" };
    }

    if (!hasAdminRole(parsed.user.roles)) return { status: "forbidden" };

    return {
      status: "ready",
      displayName: typeof parsed.user.displayName === "string" ? parsed.user.displayName : undefined,
    };
  } catch {
    return { status: "unauthenticated" };
  }
}

function AdminAccessGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [gate, setGate] = useState<GateState>({ status: "checking" });
  const [switchingAccount, setSwitchingAccount] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setGate(readGateState()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const handleSwitchAccount = async (): Promise<void> => {
    if (switchingAccount) return;
    setSwitchingAccount(true);
    try {
      await logoutCurrentUser();
    } catch {
      // Browser session is cleared even when remote sign-out is unavailable.
    } finally {
      router.replace("/auth/login?next=%2Fadmin");
    }
  };

  if (gate.status === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg">
          <AdminState tone="loading" title="Đang kiểm tra quyền truy cập" description="Chỉ tài khoản quản trị mới được mở khu vực vận hành." />
        </div>
      </main>
    );
  }

  if (gate.status === "unauthenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg">
          <AdminState
            tone="forbidden"
            title="Cần đăng nhập để mở khu vực quản trị"
            description="Hãy đăng nhập bằng tài khoản quản trị để tiếp tục. Dữ liệu bệnh viện không được tải khi chưa xác thực."
            action={<div className="flex flex-wrap gap-3"><Link className="inline-flex min-h-11 items-center rounded-lg bg-teal-800 px-4 text-sm font-bold text-white" href="/auth/login?next=%2Fadmin">Đăng nhập</Link><Link className="inline-flex min-h-11 items-center px-2 text-sm font-bold text-teal-800 underline underline-offset-4" href="/">Về trang chính</Link></div>}
          />
        </div>
      </main>
    );
  }

  if (gate.status === "forbidden") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg">
          <AdminState
            tone="forbidden"
            title="Tài khoản không có quyền quản trị"
            description="Phiên hiện tại thuộc một vai trò khác. Bạn có thể đổi tài khoản hoặc quay về trang chính."
            action={<div className="flex flex-wrap gap-3"><button className="min-h-11 rounded-lg bg-teal-800 px-4 text-sm font-bold text-white disabled:opacity-50" disabled={switchingAccount} onClick={() => void handleSwitchAccount()} type="button">{switchingAccount ? "Đang chuyển..." : "Đổi tài khoản"}</button><Link className="inline-flex min-h-11 items-center px-2 text-sm font-bold text-teal-800 underline underline-offset-4" href="/">Về trang chính</Link></div>}
          />
        </div>
      </main>
    );
  }

  return <AdminShell displayName={gate.displayName}>{children}</AdminShell>;
}

function AdminShell({ children, displayName }: { children: ReactNode; displayName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async (): Promise<void> => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutCurrentUser();
    } catch {
      // Browser session is cleared even when remote sign-out is unavailable.
    } finally {
      router.replace("/auth/login");
    }
  };

  return (
    <div className="admin-shell min-h-screen bg-slate-50 text-slate-900">
      <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
      <aside className="border-b border-teal-900 bg-teal-950 text-white lg:fixed lg:inset-y-0 lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col p-5">
          <div>
            <div className="flex items-center gap-3 text-teal-100"><UiIcon name="shield-check" size={24} /><strong className="text-lg">HealthCare</strong></div>
            <p className="mt-2 text-base font-bold">Điều hành bệnh viện</p>
            <p className="mt-2 text-xs leading-5 text-teal-100/75">
              {displayName ? `Xin chào, ${displayName}.` : "Tài khoản quản trị đã được xác thực."}
            </p>
          </div>

          <nav aria-label="Điều hướng quản trị" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:block lg:space-y-1">
            {NAV.map((item) => {
              const active = item.href === "/admin"
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                    active ? "bg-teal-700 font-bold text-white" : "text-teal-100/80 hover:bg-teal-900 hover:text-white"
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 grid gap-2 border-t border-teal-900 pt-5 lg:mt-auto">
            <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-100/75 hover:text-white" href="/">Về trang chính</Link>
            <button className="min-h-11 w-fit text-left text-sm font-semibold text-amber-200 hover:text-amber-100 disabled:opacity-50" disabled={loggingOut} onClick={() => void handleLogout()} type="button">
              {loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 p-4 sm:p-6 lg:ml-64 lg:p-8" id="main-content" tabIndex={-1}>
        <div className="mx-auto max-w-7xl">
          <div className="admin-scope-note mb-6 border-b border-teal-200 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-950">
            <strong>Phạm vi quản trị:</strong> nội dung công khai, lịch làm việc và dữ liệu vận hành chỉ hiển thị theo quyền của tài khoản hiện tại.
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminAccessGate>{children}</AdminAccessGate>;
}
