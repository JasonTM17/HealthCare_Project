import Link from "next/link";
import React from "react";
import Icon from "./UiIcon";

const Footer: React.FC = () => (
  <footer className="site-footer">
    <div className="site-footer__inner">
      <div className="footer-brand">
        <Link className="brand-link brand-link--footer" href="/">
          <span className="brand-mark"><Icon name="plus" size={24} /></span>
          <span className="brand-copy">
            <strong>HealthCare</strong>
            <small>Hệ thống y tế đa khoa</small>
          </span>
        </Link>
        <p>Chăm sóc có định hướng, thông tin rõ ràng và một điểm bắt đầu dễ tiếp cận cho mỗi người bệnh.</p>
        <p className="footer-demo-note">Bản demo giáo dục. Nội dung liên hệ, giấy phép và dữ liệu y tế đang được hoàn thiện.</p>
      </div>

      <div className="footer-column">
        <h2>Khám phá</h2>
        <Link href="/#specialties">Chuyên khoa</Link>
        <Link href="/#packages">Gói khám</Link>
        <Link href="/#doctors">Đội ngũ bác sĩ</Link>
        <Link href="/articles">Cẩm nang sức khỏe</Link>
      </div>

      <div className="footer-column">
        <h2>Hỗ trợ</h2>
        <Link href="/huong-dan">Hướng dẫn khám</Link>
        <Link href="/tra-cuu">Tra cứu lịch hẹn</Link>
        <Link href="/#branches">Cơ sở và giờ làm việc</Link>
        <a href="mailto:contact@healthcare.vn">contact@healthcare.vn</a>
      </div>

      <div className="footer-contact">
        <h2>Liên hệ khẩn cấp</h2>
        <a className="footer-hotline" href="tel:19001234"><Icon name="phone" size={18} />1900 1234</a>
        <p>Trực 24/7 cho tình huống cần hỗ trợ khẩn cấp.</p>
        <Link className="text-button text-button--light" href="/#branches">Xem cơ sở <Icon name="arrow-up-right" size={17} /></Link>
      </div>
    </div>

    <div className="site-footer__bottom">
      <span>© 2026 HealthCare Project</span>
      <span>Bản demo local, chưa phải sản phẩm y tế chính thức.</span>
    </div>

    <nav aria-label="Lối tắt trên thiết bị nhỏ" className="mobile-care-rail">
      <Link href="/#packages"><Icon name="layers" size={19} /><span>Gói khám</span></Link>
      <Link href="/#specialties"><Icon name="stethoscope" size={19} /><span>Chuyên khoa</span></Link>
      <a href="tel:19001234"><Icon name="phone" size={19} /><span>Gọi ngay</span></a>
    </nav>
  </footer>
);

export default Footer;
