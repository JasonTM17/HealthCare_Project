"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import AiTriageModal from "./AiTriageModal";
import BookingModal from "./BookingModal";
import Footer from "./Footer";
import Navbar from "./Navbar";
import PublicMotion from "./PublicMotion";
import { RouteCmsSlots } from "./cms";
import type { Branch, Doctor, HealthPackage, Specialty } from "../types/hospital";
import { fetchBranches } from "../lib/api-client";

interface PublicPageShellProps {
  children: ReactNode;
  doctors?: Doctor[];
  specialties?: Specialty[];
  branches?: Branch[];
  packages?: HealthPackage[];
}

const EMPTY_BRANCHES: Branch[] = [];

interface PublicPageActions {
  openBooking: (selection?: {
    doctorId?: string;
    specialtyId?: string;
    packageId?: string;
    branchId?: string;
  }) => void;
  openAi: () => void;
}

const PublicPageActionsContext = createContext<PublicPageActions | null>(null);

export function usePublicPageActions(): PublicPageActions {
  const actions = useContext(PublicPageActionsContext);
  if (!actions) throw new Error("usePublicPageActions must be used inside PublicPageShell");
  return actions;
}

export function PublicBookingButton({
  children = "Đặt lịch khám",
  className = "button button--amber",
  selection,
}: {
  children?: ReactNode;
  className?: string;
  selection?: Parameters<PublicPageActions["openBooking"]>[0];
}) {
  const { openBooking } = usePublicPageActions();
  return <button className={className} onClick={() => openBooking(selection)} type="button">{children}</button>;
}

export function PublicAiButton({ children = "Hỗ trợ chọn chuyên khoa", className = "outline-button" }: { children?: ReactNode; className?: string }) {
  const { openAi } = usePublicPageActions();
  return <button className={className} onClick={openAi} type="button">{children}</button>;
}

export function PublicBackLink({ href = "/", children = "← Về trang chính" }: { href?: string; children?: ReactNode }) {
  return <Link className="text-button" href={href}>{children}</Link>;
}

export function PublicPageShell({ children, doctors = [], specialties = [], branches = EMPTY_BRANCHES, packages = [] }: PublicPageShellProps) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [selection, setSelection] = useState<Parameters<PublicPageActions["openBooking"]>[0]>();
  const [chromeBranches, setChromeBranches] = useState<Branch[]>([]);

  useEffect(() => {
    if (branches.length > 0) {
      return;
    }

    let cancelled = false;
    void fetchBranches(0, 50)
      .then((page) => {
        if (!cancelled) setChromeBranches(page.content);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [branches]);

  const effectiveBranches = branches.length > 0 ? branches : chromeBranches;

  const actions: PublicPageActions = {
    openBooking: (nextSelection) => {
      setSelection(nextSelection);
      setBookingOpen(true);
    },
    openAi: () => setAiOpen(true),
  };

  return (
    <PublicPageActionsContext.Provider value={actions}>
      <div className="site-shell">
        <PublicMotion />
        <Navbar branches={effectiveBranches} onOpenAiTriage={() => setAiOpen(true)} onOpenBooking={() => actions.openBooking()} />
        <main id="main-content"><RouteCmsSlots />{children}</main>
        <Footer branches={effectiveBranches} />
        <BookingModal
          branches={effectiveBranches}
          doctors={doctors}
          initialBranchId={selection?.branchId}
          initialDoctorId={selection?.doctorId}
          initialPackageId={selection?.packageId}
          initialSpecialtyId={selection?.specialtyId}
          isOpen={bookingOpen}
          onClose={() => setBookingOpen(false)}
          packages={packages}
          specialties={specialties}
        />
        <AiTriageModal
          isOpen={aiOpen}
          onClose={() => setAiOpen(false)}
          onSelectSpecialtyForBooking={(_specialtyName, specialtyId) => {
            const specialty = specialtyId ? specialties.find((item) => item.id === specialtyId) : undefined;
            actions.openBooking(specialty ? { specialtyId: specialty.id } : undefined);
            setAiOpen(false);
          }}
        />
      </div>
    </PublicPageActionsContext.Provider>
  );
}

export default PublicPageShell;
