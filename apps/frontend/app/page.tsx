// Placeholder data — will be replaced by API calls once backend is connected
const carePaths = [
  { label: "Đặt lịch khám", icon: "📅" },
  { label: "Tìm chuyên khoa", icon: "🔍" },
  { label: "Chọn gói chăm sóc", icon: "📦" },
  { label: "Liên hệ tư vấn", icon: "💬" },
];

const specialties = [
  { name: "Tim mạch", icon: "❤️", desc: "Chẩn đoán và điều trị các bệnh lý về tim và mạch máu." },
  { name: "Sản phụ khoa", icon: "🌸", desc: "Chăm sóc sức khỏe sinh sản cho phụ nữ ở mọi độ tuổi." },
  { name: "Nhi khoa", icon: "🧒", desc: "Theo dõi và điều trị bệnh lý cho trẻ em từ sơ sinh đến 16 tuổi." },
  { name: "Cơ xương khớp", icon: "🦴", desc: "Điều trị các bệnh lý về xương, khớp và cơ bắp." },
  { name: "Thần kinh", icon: "🧠", desc: "Chẩn đoán và điều trị bệnh lý thần kinh trung ương và ngoại biên." },
  { name: "Tiêu hóa", icon: "🫀", desc: "Nội soi và điều trị các bệnh lý đường tiêu hóa." },
  { name: "Mắt", icon: "👁️", desc: "Phẫu thuật và điều trị bệnh lý về mắt toàn diện." },
  { name: "Tai Mũi Họng", icon: "👂", desc: "Thăm khám và điều trị toàn bộ hệ hô hấp trên." },
];

const packages = [
  {
    name: "Gói Kiểm tra Tổng quát",
    desc: "Xét nghiệm máu, tổng quát nội, ngoại, siêu âm ổ bụng và điện tim cơ bản cho người trưởng thành.",
  },
  {
    name: "Gói Sức khoẻ Tim mạch",
    desc: "Siêu âm tim, điện tâm đồ, xét nghiệm mỡ máu và tư vấn chuyên khoa tim mạch.",
  },
  {
    name: "Gói Tiền hôn nhân",
    desc: "Khám tổng quát, xét nghiệm di truyền cơ bản, sức khoẻ sinh sản cho cả nam và nữ.",
  },
];

const branches = [
  { name: "Cơ sở Quận 1", address: "Trung tâm thành phố — đang cập nhật địa chỉ", phone: "Liên hệ qua trang web" },
  { name: "Cơ sở Bình Thạnh", address: "Khu vực phía Bắc — đang cập nhật địa chỉ", phone: "Liên hệ qua trang web" },
  { name: "Cơ sở Thủ Đức", address: "Khu đô thị mới — đang cập nhật địa chỉ", phone: "Liên hệ qua trang web" },
];

export default function Home() {
  return (
    <>
      {/* ── Navigation ─────────────────────────────────── */}
      <header>
        <nav className="nav" aria-label="Điều hướng chính">
          <div className="navInner">
            <a className="brand" href="#hero-title" aria-label="Trang chủ HealthCare">
              <span className="brandDot" aria-hidden="true" />
              HealthCare
            </a>
            <div className="navLinks" role="list">
              <a href="#specialties" role="listitem">Chuyên khoa</a>
              <a href="#packages" role="listitem">Gói khám</a>
              <a href="#branches" role="listitem">Cơ sở</a>
            </div>
            <a className="navCta" href="#branches" id="nav-cta">
              Đặt lịch khám
            </a>
          </div>
        </nav>
      </header>

      <main>
        {/* ── Hero ───────────────────────────────────────── */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="heroGrid">
            <div className="heroCopy">
              <p className="kicker">
                <span className="kickerLine" aria-hidden="true" />
                Nền tảng chăm sóc sức khỏe
              </p>
              <h1 id="hero-title">
                Chăm sóc rõ ràng, đặt lịch dễ dàng.
              </h1>
              <p className="heroDesc">
                Một nền tảng y tế số đang được xây dựng cho trải nghiệm bệnh nhân
                an toàn, dễ hiểu và thân thiện trên mọi thiết bị.
              </p>
              <div className="actions">
                <a className="primaryButton" href="#branches" id="hero-cta-primary">
                  Đặt lịch ngay
                  <span aria-hidden="true">→</span>
                </a>
                <a className="secondaryButton" href="#specialties" id="hero-cta-secondary">
                  Xem chuyên khoa
                </a>
              </div>
            </div>

            <aside className="careRail" aria-label="Lối tắt chăm sóc">
              {carePaths.map((path, i) => (
                <a
                  href="#branches"
                  key={path.label}
                  className="careRailItem"
                  id={`care-path-${i + 1}`}
                >
                  <span className="careRailNum" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="careRailLabel">{path.label}</span>
                </a>
              ))}
            </aside>
          </div>
        </section>

        {/* ── Specialties ────────────────────────────────── */}
        <div className="specialtyStrip" id="specialties">
          <section className="section" aria-labelledby="specialties-heading">
            <div className="sectionHeader">
              <p className="sectionLabel">Chuyên khoa</p>
              <h2 id="specialties-heading">Các chuyên khoa nền tảng</h2>
              <p>
                Danh mục mẫu dùng để kiểm tra cấu trúc UI. Nội dung y khoa thật
                sẽ được bổ sung khi backend domain hoàn thiện.
              </p>
            </div>
            <div
              className="specialtyGrid"
              role="list"
              aria-label="Danh sách chuyên khoa"
            >
              {specialties.map((sp) => (
                <article
                  key={sp.name}
                  className="specialtyCard"
                  role="listitem"
                  id={`specialty-${sp.name.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <div className="specialtyIcon" aria-hidden="true">{sp.icon}</div>
                  <h3>{sp.name}</h3>
                  <p>{sp.desc}</p>
                </article>
              ))}
            </div>
          </section>
        </div>

        {/* ── Packages ───────────────────────────────────── */}
        <div className="packageBand" id="packages">
          <section className="section" aria-labelledby="packages-heading">
            <div className="sectionHeader">
              <p className="sectionLabel">Gói chăm sóc</p>
              <h2 id="packages-heading">Gói chăm sóc mẫu</h2>
              <p>
                Các thẻ dịch vụ hiện là placeholder an toàn — không sao chép tên gói
                hoặc mô tả từ bất kỳ bệnh viện nào. Nội dung thật sẽ được cấu hình
                qua CMS admin.
              </p>
            </div>
            <div
              className="packageGrid"
              role="list"
              aria-label="Gói khám sức khoẻ"
            >
              {packages.map((pkg) => (
                <article
                  key={pkg.name}
                  className="packageCard"
                  role="listitem"
                >
                  <p className="packageName">{pkg.name}</p>
                  <p className="packageDesc">{pkg.desc}</p>
                  <a href="#branches" className="packageLink">
                    Tìm hiểu thêm <span aria-hidden="true">→</span>
                  </a>
                </article>
              ))}
            </div>
          </section>
        </div>

        {/* ── Branches / Contact ─────────────────────────── */}
        <div className="contactBand" id="branches">
          <section
            className="section"
            aria-labelledby="branches-heading"
            id="contact"
          >
            <div className="sectionHeader">
              <p className="sectionLabel">Mạng lưới cơ sở</p>
              <h2 id="branches-heading">Tìm cơ sở gần bạn</h2>
              <p>
                Không gian dành cho danh sách cơ sở, giờ làm việc và kênh liên hệ
                khi backend domain sẵn sàng.
              </p>
            </div>
            <div
              className="contactGrid"
              role="list"
              aria-label="Danh sách cơ sở y tế"
            >
              {branches.map((br) => (
                <article
                  key={br.name}
                  className="contactCard"
                  role="listitem"
                  id={`branch-${br.name.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <h3>{br.name}</h3>
                  <p>{br.address}</p>
                  <p>{br.phone}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="footer">
        <div className="footerInner">
          <span className="footerNote">
            © 2026 HealthCare. Nền tảng y tế số đang trong giai đoạn phát triển.
          </span>
          <span className="footerNote">
            Dữ liệu hiển thị là mẫu — chưa phải thông tin y tế thực tế.
          </span>
        </div>
      </footer>
    </>
  );
}
