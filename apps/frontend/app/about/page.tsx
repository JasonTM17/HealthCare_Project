import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Về chúng tôi | HealthCare",
  description: "Tìm hiểu về nền tảng y tế số của chúng tôi",
};

export default function AboutPage() {
  return (
    <main>
      <section className="section">
        <h2>Về chúng tôi</h2>
        <p>
          Nền tảng y tế số kết nối bệnh nhân với đội ngũ bác sĩ và cơ sở y tế tin
          cậy. Chúng tôi xây dựng trải nghiệm đặt lịch khám minh bạch, chăm sóc rõ
          ràng và dễ tiếp cận.
        </p>
      </section>
    </main>
  );
}
