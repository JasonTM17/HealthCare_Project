const carePaths = [
  "Đặt lịch khám",
  "Tìm chuyên khoa",
  "Chọn gói chăm sóc",
  "Liên hệ tư vấn",
];

const specialties = ["Tim mạch", "Sản phụ khoa", "Nhi khoa", "Cơ xương khớp"];

export default function Home() {
  return (
    <main>
      <section className="hero" aria-labelledby="hero-title">
        <nav className="nav" aria-label="Điều hướng chính">
          <a className="brand" href="#hero-title">HealthCare</a>
          <div className="navLinks">
            <a href="#specialties">Chuyên khoa</a>
            <a href="#packages">Gói khám</a>
            <a href="#network">Cơ sở</a>
          </div>
          <a className="navCta" href="#contact">Đặt lịch</a>
        </nav>

        <div className="heroGrid">
          <div className="heroCopy">
            <p className="kicker">Nền tảng chăm sóc sức khỏe</p>
            <h1 id="hero-title">Chăm sóc rõ ràng, đặt lịch dễ dàng.</h1>
            <p>
              Một nền tảng y tế số đang được xây dựng cho trải nghiệm bệnh nhân an toàn,
              dễ hiểu và thân thiện trên mọi thiết bị.
            </p>
            <div className="actions">
              <a className="primaryButton" href="#contact">Bắt đầu</a>
              <a className="secondaryButton" href="#specialties">Xem chuyên khoa</a>
            </div>
          </div>

          <aside className="careRail" aria-label="Lối tắt chăm sóc">
            {carePaths.map((path, index) => (
              <a href="#contact" key={path}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {path}
              </a>
            ))}
          </aside>
        </div>
      </section>

      <section className="section split" id="specialties">
        <div>
          <h2>Chuyên khoa nền tảng</h2>
          <p>Danh mục mẫu dùng để kiểm tra cấu trúc UI. Nội dung y khoa thật sẽ được bổ sung ở phase sau.</p>
        </div>
        <div className="specialtyGrid">
          {specialties.map((item) => <article key={item}>{item}</article>)}
        </div>
      </section>

      <section className="section packageBand" id="packages">
        <h2>Gói chăm sóc mẫu</h2>
        <p>Các thẻ dịch vụ hiện là placeholder an toàn, không sao chép tên gói hoặc mô tả từ bệnh viện khác.</p>
      </section>

      <section className="section contact" id="network">
        <h2>Mạng lưới cơ sở</h2>
        <p>Không gian dành cho danh sách cơ sở, giờ làm việc và kênh liên hệ khi backend domain sẵn sàng.</p>
      </section>
    </main>
  );
}
