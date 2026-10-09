import Link from "next/link";
import { PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import Icon from "../../components/UiIcon";
import { CmsNativeSection, CmsNativeText } from "../../components/cms/cms-page-layout-provider";

const PRIVACY_POINTS = [
  {
    title: "Thông tin chúng tôi thu thập",
    body:
      "Thông tin đặt lịch gồm họ tên, số điện thoại, email nếu bạn cung cấp, chuyên khoa, bác sĩ, cơ sở, thời gian khám, lý do khám tóm tắt và lựa chọn hỗ trợ BHYT.",
  },
  {
    title: "Mục đích sử dụng",
    body:
      "Dữ liệu được dùng để giữ chỗ, xác nhận lịch hẹn, hỗ trợ tiếp đón, tra cứu lịch khám, gửi nhắc hẹn và xử lý các yêu cầu liên quan đến cuộc hẹn.",
  },
  {
    title: "Nguyên tắc bảo vệ",
    body:
      "Hệ thống giới hạn quyền truy cập theo vai trò, không đưa thông tin đặt lịch vào URL và không yêu cầu bạn nhập dữ liệu nhạy cảm không cần thiết trong bước đặt lịch.",
  },
  {
    title: "Quyền của người bệnh",
    body:
      "Bạn có thể tra cứu, yêu cầu hủy lịch hẹn hoặc liên hệ bệnh viện để cập nhật thông tin liên hệ và các yêu cầu liên quan đến dữ liệu đặt lịch.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <PublicPageShell>
      <div className="section-inner py-12 md:py-16">
        <CmsNativeSection sectionId="intro">
          <section className="max-w-3xl" aria-labelledby="privacy-title">
            <CmsNativeText fieldId="intro.eyebrow" as="p" value={"Chính sách bảo mật"} className="section-note">Chính sách bảo mật</CmsNativeText>
            <CmsNativeText fieldId="intro.title" as="h1" value={"Cách HealthCare xử lý thông tin đặt lịch"} id="privacy-title" className="mt-3 text-3xl font-bold text-ink md:text-5xl">
              Cách HealthCare xử lý thông tin đặt lịch
            </CmsNativeText>
            <CmsNativeText fieldId="intro.body" as="p" value={"Trang này mô tả cách HealthCare thu thập, sử dụng và bảo vệ thông tin bạn cung cấp khi đặt lịch khám trực tuyến, cùng quyền của bạn đối với thông tin đó."} className="mt-5 text-base leading-8 text-ink-muted">
              Trang này mô tả cách HealthCare thu thập, sử dụng và bảo vệ thông tin bạn
              cung cấp khi đặt lịch khám trực tuyến, cùng quyền của bạn đối với thông tin đó.
            </CmsNativeText>
            <div className="resource-actions mt-7">
              <PublicBookingButton className="button button--primary">Đặt lịch khám</PublicBookingButton>
              <Link className="outline-button" href="/contact">Liên hệ bệnh viện</Link>
            </div>
          </section>
        </CmsNativeSection>

        <CmsNativeSection sectionId="policies">
          <section className="mt-10 grid gap-4 md:grid-cols-2" aria-label="Các nội dung chính">
            {PRIVACY_POINTS.map((item, cmsItemIndex) => (
              <article className="rounded-[4px] border border-slate-200 bg-white p-5 shadow-xs" key={item.title}>
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-[4px] bg-teal-50 text-teal-800 border border-teal-100">
                  <Icon name="shield-check" size={20} />
                </div>
                <CmsNativeText fieldId={`policies.item${cmsItemIndex + 1}.title`} as="h2" value={item.title} className="text-lg font-bold text-ink">{item.title}</CmsNativeText>
                <CmsNativeText fieldId={`policies.item${cmsItemIndex + 1}.body`} as="p" value={item.body} className="mt-2 text-sm leading-7 text-ink-muted">{item.body}</CmsNativeText>
              </article>
            ))}
          </section>
        </CmsNativeSection>

        <CmsNativeSection sectionId="version">
          <section className="mt-10 rounded-[4px] border border-amber-200 bg-amber-50/80 p-5 text-sm leading-7 text-amber-950" aria-labelledby="privacy-version-title">
            <h2 id="privacy-version-title" className="text-base font-bold text-amber-950">
              Phiên bản áp dụng cho đặt lịch
            </h2>
            <p className="mt-2">
              Các lịch hẹn mới ghi nhận phiên bản đồng ý <span className="font-mono font-semibold">booking-privacy-v1</span>
              {" "}cùng thời điểm bạn bấm giữ chỗ. Lịch hẹn cũ có thể chưa có dấu thời gian đồng ý này.
            </p>
          </section>
        </CmsNativeSection>
      </div>
    </PublicPageShell>
  );
}
