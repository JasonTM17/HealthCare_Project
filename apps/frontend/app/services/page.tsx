import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dịch vụ | HealthCare",
  description: "Danh mục dịch vụ y tế",
};

export default function ServicesPage() {
  return (
    <main>
      <section className="section">
        <h2>Dịch vụ</h2>
        <p>Danh mục dịch vụ sẽ được cập nhật.</p>
      </section>
    </main>
  );
}
