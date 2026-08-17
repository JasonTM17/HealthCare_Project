import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bài viết | HealthCare",
  description: "Thông tin sức khỏe và kiến thức y khoa",
};

export default function ArticlesPage() {
  return (
    <main>
      <section className="section">
        <h2>Bài viết</h2>
        <p>Danh mục bài viết sẽ được cập nhật.</p>
      </section>
    </main>
  );
}
