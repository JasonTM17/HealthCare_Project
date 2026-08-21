import Link from "next/link";
import React from "react";
import type { Branch } from "../types/hospital";
import BrandMark from "./BrandMark";
import Icon from "./UiIcon";
import CmsLiveSlot from "./cms/CmsLiveSlot";
import { CmsContentRenderer } from "./cms/CmsRenderer";
import { safeTelephoneHref } from "../lib/phone";

interface FooterProps {
  branches?: Branch[];
  /** Public route identity for the typed footer slot; omitted on private shells. */
  cmsSlug?: string;
}

const Footer: React.FC<FooterProps> = ({ branches = [], cmsSlug }) => {
  const emergencyBranch = branches.find((branch) => Boolean(branch.emergencyHotline));
  const contactBranch = branches.find((branch) => Boolean(branch.phone));
  const contactPhone = emergencyBranch?.emergencyHotline ?? contactBranch?.phone;
  const contactHref = safeTelephoneHref(contactPhone);

  return (
  <footer className="site-footer">
    <div className="site-footer__inner">
      <div className="footer-brand">
        <Link aria-label="HealthCare, về trang chủ" className="brand-link brand-link--footer" href="/">
          <BrandMark tone="inverse" />
        </Link>
        <p>Đồng hành cùng bạn từ bước chọn chuyên khoa, đặt lịch đến theo dõi hướng dẫn sau thăm khám.</p>
        <ul className="footer-assurances" aria-label="Cam kết hỗ trợ">
          <li><Icon name="shield-check" size={14} /> Bảo mật thông tin</li>
          <li><Icon name="stethoscope" size={14} /> Hỗ trợ đúng chuyên khoa</li>
        </ul>
      </div>

      <nav aria-label="Khám phá HealthCare" className="footer-column">
        <h2>Khám phá</h2>
        <Link href="/specialties">Chuyên khoa</Link>
        <Link href="/packages">Gói khám</Link>
        <Link href="/doctors">Đội ngũ bác sĩ</Link>
        <Link href="/articles">Cẩm nang sức khỏe</Link>
        <Link href="/careers">Cơ hội nghề nghiệp</Link>
      </nav>

      <nav aria-label="Hỗ trợ người bệnh" className="footer-column">
        <h2>Hỗ trợ</h2>
        <Link href="/huong-dan">Hướng dẫn khám</Link>
        <Link href="/tra-cuu">Tra cứu lịch hẹn</Link>
        <Link href="/search">Tìm bác sĩ và dịch vụ</Link>
        <Link href="/branches">Cơ sở và giờ làm việc</Link>
        <Link href="/contact">Liên hệ bệnh viện</Link>
      </nav>

      <aside className="footer-contact">
        <p className="footer-contact__eyebrow">Kết nối trực tiếp</p>
        <h2>{emergencyBranch ? "Hotline cấp cứu" : "Liên hệ bệnh viện"}</h2>
        {contactHref ? (
          <a className="footer-hotline" href={contactHref}><Icon name="phone" size={18} />{contactPhone}</a>
        ) : (
          <p>Thông tin điện thoại đang được cập nhật.</p>
        )}
        <p>{emergencyBranch ? `Tiếp nhận hỗ trợ tại ${emergencyBranch.name}.` : "Xem địa chỉ, giờ làm việc và kênh liên hệ của từng cơ sở."}</p>
        <Link className="text-button text-button--light" href="/branches">Xem cơ sở <Icon name="arrow-up-right" size={17} /></Link>
      </aside>
    </div>

    {cmsSlug ? (
      <CmsLiveSlot
        className="site-footer__cms"
        hideWhenNotFound
        hideWhileLoading
        renderContent={(content) => <CmsContentRenderer content={content} />}
        showSourceLabel={false}
        slug={cmsSlug}
        slotKey="footer"
      />
    ) : null}

    <div className="site-footer__bottom">
      <span>© 2026 HealthCare. Bảo lưu mọi quyền.</span>
      <span>Thông tin trên website không thay thế chẩn đoán hoặc tư vấn trực tiếp từ bác sĩ.</span>
    </div>

    <nav aria-label="Lối tắt trên thiết bị nhỏ" className="mobile-care-rail">
      {contactHref ? <a href={contactHref}><Icon name="phone" size={19} /><span>Gọi ngay</span></a> : <Link href="/contact"><Icon name="phone" size={19} /><span>Liên hệ</span></Link>}
      <Link className="mobile-care-rail__primary" href="/dat-lich"><Icon name="calendar" size={19} /><span>Đặt lịch</span></Link>
      <Link href="/tra-cuu"><Icon name="search" size={19} /><span>Tra cứu</span></Link>
    </nav>
  </footer>
  );
};

export default Footer;
