import type { ReactNode } from "react";
import PortalAccessGate from "../../components/PortalAccessGate";

export default function PatientLayout({ children }: { children: ReactNode }) {
  return <PortalAccessGate role="PATIENT">{children}</PortalAccessGate>;
}
