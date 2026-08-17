import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "HealthCare Project",
  description: "Healthcare foundation frontend baseline",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
