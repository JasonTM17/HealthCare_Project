import type { ReactNode } from "react";
import PortalAccessGate from "../../components/PortalAccessGate";

export default function DoctorLayout({ children }: { children: ReactNode }) {
  return <PortalAccessGate role="DOCTOR">{children}</PortalAccessGate>;
}
