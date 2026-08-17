import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Liên hệ | HealthCare",
  description: "Thông tin liên hệ và hỗ trợ",
};

export default function ContactPage() {
  return (
    <main>
      <section className="section">
        <h2>Liên hệ</h2>
        <p>Thông tin liên hệ sẽ được cập nhật.</p>
      </section>
    </main>
  );
}
