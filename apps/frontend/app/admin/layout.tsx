"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import AdminState from "./_components/AdminState";

const AUTH_STORAGE_KEY = "healthcare.auth.session";

const NAV = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin/doctors", label: "Bác sĩ" },
  { href: "/admin/specialties", label: "Chuyên khoa" },
  { href: "/admin/branches", label: "Cơ sở" },
  { href: "/admin/services", label: "Dịch vụ" },
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
  const [gate, setGate] = useState<GateState>({ status: "checking" });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setGate(readGateState()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (gate.status === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg">
          <AdminState tone="loading" title="Đang kiểm tra quyền truy cập" description="Chỉ tài khoản có role ADMIN mới được mở CMS." />
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
            title="Cần đăng nhập để mở CMS"
            description="Trang quản trị không tải dữ liệu khi chưa có phiên bearer được xác thực. Hãy đăng nhập bằng tài khoản có role ADMIN."
            action={<Link className="text-sm font-bold text-teal-800 underline underline-offset-4" href="/">Về trang chủ</Link>}
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
            title="Tài khoản không có quyền ADMIN"
            description="Bạn đã đăng nhập nhưng phiên hiện tại không có role ADMIN. Backend vẫn là nguồn quyết định cuối cùng cho mọi thao tác CMS."
            action={<Link className="text-sm font-bold text-teal-800 underline underline-offset-4" href="/">Về trang chủ</Link>}
          />
        </div>
      </main>
    );
  }

  return <AdminShell displayName={gate.displayName}>{children}</AdminShell>;
}

function AdminShell({ children, displayName }: { children: ReactNode; displayName?: string }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="border-b border-slate-200 bg-slate-900 text-white lg:fixed lg:inset-y-0 lg:w-64 lg:border-b-0 lg:border-r lg:border-slate-800">
        <div className="flex h-full flex-col p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-200">HealthCare CMS</p>
            <h1 className="mt-2 text-xl font-bold">Quản trị nội dung</h1>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {displayName ? `Xin chào, ${displayName}.` : "Phiên ADMIN đã được nhận diện."}
            </p>
          </div>

          <nav aria-label="Điều hướng quản trị" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:block lg:space-y-2">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-xl px-3 py-2 text-sm transition-colors ${
                    active ? "bg-teal-700 font-bold text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 border-t border-slate-800 pt-5 lg:mt-auto">
            <p className="mb-3 text-xs leading-5 text-slate-500">
              Bản demo local. Backend kiểm tra quyền ADMIN trên từng request.
            </p>
            <Link className="text-xs font-semibold text-slate-400 hover:text-white" href="/">
              ← Về trang chủ
            </Link>
          </div>
        </div>
      </aside>

      <main className="min-w-0 p-4 sm:p-6 lg:ml-64 lg:p-10" id="main-content">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-950">
            <strong>Ranh giới dữ liệu:</strong> các bảng công khai chỉ hiển thị bản ghi active. Không có số liệu CMS giả; các contract chưa được expose sẽ được đánh dấu rõ.
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
