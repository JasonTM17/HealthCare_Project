"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { useEffect } from "react";
import { fetchBranches } from "../lib/api-client";
import AiTriageModal from "./AiTriageModal";
import BookingModal, { type BookingSelection } from "./BookingModal";
import Footer from "./Footer";
import Navbar from "./Navbar";
import PublicRouteBreadcrumb from "./PublicRouteBreadcrumb";
import { routeCmsSlug, RouteCmsSlots } from "./cms";
import type { Branch, Doctor, HealthPackage, Specialty } from "../types/hospital";

interface PublicPageShellProps {
  children: ReactNode;
  doctors?: Doctor[];
  specialties?: Specialty[];
  branches?: Branch[];
  packages?: HealthPackage[];
  bookingInitiallyOpen?: boolean;
  onBookingRequest?: (selection?: BookingSelection) => void;
}

interface PublicPageActions {
  openBooking: (selection?: BookingSelection) => void;
  openAi: () => void;
}

const PublicPageActionsContext = createContext<PublicPageActions | null>(null);
const EMPTY_BRANCHES: Branch[] = [];
const PUBLIC_ASSISTANT_OPEN_EVENT = "healthcare:open-assistant";

export function requestPublicAssistantOpen(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PUBLIC_ASSISTANT_OPEN_EVENT, {
    detail: { mode: "SYMPTOM_TRIAGE" },
  }));
}

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

export function PublicAiButton({ children = "Trợ lý triệu chứng", className = "outline-button" }: { children?: ReactNode; className?: string }) {
  const { openAi } = usePublicPageActions();
  return <button className={className} onClick={openAi} type="button">{children}</button>;
}

export function PublicBackLink({ href = "/", children = "← Về trang chính" }: { href?: string; children?: ReactNode }) {
  return <Link className="text-button" href={href}>{children}</Link>;
}

export function PublicPageShell({
  children,
  doctors = [],
  specialties = [],
  branches = EMPTY_BRANCHES,
  packages = [],
  bookingInitiallyOpen = false,
  onBookingRequest,
}: PublicPageShellProps) {
  const pathname = usePathname();
  const [bookingOpen, setBookingOpen] = useState(bookingInitiallyOpen && !onBookingRequest);
  const [triageOpen, setTriageOpen] = useState(false);
  const [selection, setSelection] = useState<Parameters<PublicPageActions["openBooking"]>[0]>();
  const [shellBranches, setShellBranches] = useState<Branch[]>(EMPTY_BRANCHES);

  useEffect(() => {
    if (branches.length > 0) {
      return;
    }

    let cancelled = false;
    void fetchBranches(0, 100)
      .then((page) => {
        if (!cancelled) setShellBranches(page.content);
      })
      .catch(() => {
        // The page keeps its existing shell when the optional contact catalog is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [branches]);

  const effectiveBranches = branches.length > 0 ? branches : shellBranches;
  const cmsSlug = routeCmsSlug(pathname);

  const actions: PublicPageActions = {
    openBooking: (nextSelection) => {
      if (onBookingRequest) {
        onBookingRequest(nextSelection);
        return;
      }
      setSelection(nextSelection);
      setBookingOpen(true);
    },
    openAi: () => setTriageOpen(true),
  };

  return (
    <PublicPageActionsContext.Provider value={actions}>
      <div className="site-shell site-shell--public-route">
        <Navbar branches={effectiveBranches} onOpenBooking={() => actions.openBooking()} />
        <PublicRouteBreadcrumb pathname={pathname} />
        <main id="main-content" tabIndex={-1}><RouteCmsSlots>{children}</RouteCmsSlots></main>
        <Footer branches={effectiveBranches} cmsSlug={cmsSlug ?? undefined} />
        <AiTriageModal
          emergencyContact={effectiveBranches.find((branch) => branch.emergencyHotline || branch.phone)?.emergencyHotline
            ?? effectiveBranches.find((branch) => branch.phone)?.phone
            ?? undefined}
          isOpen={triageOpen}
          onClose={() => setTriageOpen(false)}
          onSelectSpecialtyForBooking={(_name, specialtyId) => {
            setTriageOpen(false);
            actions.openBooking({ specialtyId });
          }}
        />
        {!onBookingRequest && bookingOpen ? (
          <BookingModal
            branches={effectiveBranches}
            doctors={doctors}
            initialBranchId={selection?.branchId}
            initialDoctorId={selection?.doctorId}
            initialPackageId={selection?.packageId}
            initialSpecialtyId={selection?.specialtyId}
            isOpen
            onClose={() => setBookingOpen(false)}
            packages={packages}
            specialties={specialties}
          />
        ) : null}
      </div>
    </PublicPageActionsContext.Provider>
  );
}

export default PublicPageShell;
