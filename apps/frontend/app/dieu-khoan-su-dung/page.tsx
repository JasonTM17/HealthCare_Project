import Link from "next/link";
import { PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import Icon from "../../components/UiIcon";
import { CmsNativeSection, CmsNativeText } from "../../components/cms/cms-page-layout-provider";

const TERMS_POINTS = [
  {
    title: "Phạm vi dịch vụ",
    body:
      "HealthCare cung cấp thông tin về chuyên khoa, bác sĩ, gói khám và công cụ giữ chỗ lịch hẹn trực tuyến. Website không cung cấp dịch vụ chẩn đoán, kê đơn hay cấp cứu từ xa.",
  },
  {
    title: "Không thay thế tư vấn y khoa",
    body:
      "Nội dung trên website và câu trả lời của trợ lý AI chỉ mang tính tham khảo. Mọi quyết định khám, chữa bệnh thuộc về nhân viên y tế trực tiếp thăm khám. Trường hợp khẩn cấp, gọi cấp cứu 115.",
  },
  {
    title: "Trách nhiệm khi đặt lịch",
    body:
      "Bạn cam kết cung cấp thông tin liên hệ chính xác, đến đúng giờ đã xác nhận và chủ động hủy hoặc đổi lịch khi không thể tham dự để nhường khung giờ cho người bệnh khác.",
  },
  {
    title: "Tài khoản và bảo mật",
    body:
      "Bạn chịu trách nhiệm giữ kín thông tin đăng nhập và mã tra cứu lịch hẹn. HealthCare có thể tạm khóa tài khoản khi phát hiện truy cập bất thường hoặc sử dụng sai mục đích.",
  },
  {
    title: "Giới hạn trách nhiệm",
    body:
      "HealthCare nỗ lực giữ thông tin chính xác và dịch vụ ổn định nhưng không cam kết website luôn liên tục hoặc không có lỗi. Chúng tôi không chịu trách nhiệm cho thiệt hại phát sinh từ việc tự ý áp dụng thông tin tham khảo thay cho thăm khám trực tiếp.",
  },
];

export default function TermsOfUsePage() {
  return (
    <PublicPageShell>
      <div className="section-inner py-12 md:py-16">
        <CmsNativeSection sectionId="intro">
          <section className="max-w-3xl" aria-labelledby="terms-title">
            <CmsNativeText fieldId="intro.eyebrow" as="p" value={"Điều khoản sử dụng"} className="section-note">Điều khoản sử dụng</CmsNativeText>
            <CmsNativeText fieldId="intro.title" as="h1" value={"Điều kiện khi sử dụng website HealthCare"} id="terms-title" className="mt-3 text-3xl font-bold text-ink md:text-5xl">
              Điều kiện khi sử dụng website HealthCare
            </CmsNativeText>
            <CmsNativeText fieldId="intro.body" as="p" value={"Khi truy cập và sử dụng website HealthCare, bạn đồng ý với các điều khoản dưới đây. Nếu không đồng ý, vui lòng ngừng sử dụng và liên hệ bệnh viện qua kênh trực tiếp."} className="mt-5 text-base leading-8 text-ink-muted">
              Khi truy cập và sử dụng website HealthCare, bạn đồng ý với các điều khoản
              dưới đây. Nếu không đồng ý, vui lòng ngừng sử dụng và liên hệ bệnh viện
              qua kênh trực tiếp.
            </CmsNativeText>
            <div className="resource-actions mt-7">
              <PublicBookingButton className="button button--primary">Đặt lịch khám</PublicBookingButton>
              <Link className="outline-button" href="/chinh-sach-bao-mat">Chính sách bảo mật</Link>
            </div>
          </section>
        </CmsNativeSection>

        <CmsNativeSection sectionId="terms">
          <section className="mt-10 grid gap-4 md:grid-cols-2" aria-label="Các điều khoản chính">
            {TERMS_POINTS.map((item, cmsItemIndex) => (
              <article className="rounded-[4px] border border-slate-200 bg-white p-5 shadow-xs" key={item.title}>
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-[4px] bg-teal-50 text-teal-800 border border-teal-100">
                  <Icon name="book-open" size={20} />
                </div>
                <CmsNativeText fieldId={`terms.item${cmsItemIndex + 1}.title`} as="h2" value={item.title} className="text-lg font-bold text-ink">{item.title}</CmsNativeText>
                <CmsNativeText fieldId={`terms.item${cmsItemIndex + 1}.body`} as="p" value={item.body} className="mt-2 text-sm leading-7 text-ink-muted">{item.body}</CmsNativeText>
              </article>
            ))}
          </section>
        </CmsNativeSection>

        <CmsNativeSection sectionId="version">
          <section className="mt-10 rounded-[4px] border border-amber-200 bg-amber-50/80 p-5 text-sm leading-7 text-amber-950" aria-labelledby="terms-version-title">
            <h2 id="terms-version-title" className="text-base font-bold text-amber-950">
              Phiên bản điều khoản
            </h2>
            <p className="mt-2">
              Điều khoản áp dụng từ phiên bản <span className="font-mono font-semibold">terms-of-use-v1</span>.
              HealthCare có thể cập nhật nội dung khi dịch vụ thay đổi; phiên bản mới
              được công bố tại trang này trước khi áp dụng.
            </p>
          </section>
        </CmsNativeSection>
      </div>
    </PublicPageShell>
  );
}
