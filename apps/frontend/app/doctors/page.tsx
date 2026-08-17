import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bác sĩ | HealthCare",
  description: "Danh mục bác sĩ theo chuyên khoa và cơ sở",
};

export default function DoctorsPage() {
  return (
    <main>
      <section className="section">
        <h2>Bác sĩ</h2>
        <p>Danh mục bác sĩ sẽ được cập nhật.</p>
      </section>
    </main>
  );
}
