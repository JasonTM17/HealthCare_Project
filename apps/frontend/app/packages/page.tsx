import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gói khám | HealthCare",
  description: "Các gói khám sức khỏe",
};

export default function PackagesPage() {
  return (
    <main>
      <section className="section">
        <h2>Gói khám</h2>
        <p>Danh mục gói khám sẽ được cập nhật.</p>
      </section>
    </main>
  );
}
