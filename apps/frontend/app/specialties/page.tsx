import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chuyên khoa | HealthCare",
  description: "Danh mục chuyên khoa khám chữa bệnh",
};

export default function SpecialtiesPage() {
  return (
    <main>
      <section className="section">
        <h2>Chuyên khoa</h2>
        <p>Danh mục chuyên khoa sẽ được cập nhật.</p>
      </section>
    </main>
  );
}
