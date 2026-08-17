import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cơ sở | HealthCare",
  description: "Mạng lưới cơ sở y tế",
};

export default function BranchesPage() {
  return (
    <main>
      <section className="section">
        <h2>Cơ sở</h2>
        <p>Danh mục cơ sở sẽ được cập nhật.</p>
      </section>
    </main>
  );
}
