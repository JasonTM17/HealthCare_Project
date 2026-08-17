import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hỏi đáp | HealthCare",
  description: "Câu hỏi thường gặp",
};

export default function FaqPage() {
  return (
    <main>
      <section className="section">
        <h2>Hỏi đáp</h2>
        <p>Câu hỏi thường gặp sẽ được cập nhật.</p>
      </section>
    </main>
  );
}
