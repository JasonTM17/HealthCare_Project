import AdminState from "../_components/AdminState";

export default function AdminServicesPage() {
  return (
    <div>
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">DANH MỤC DỊCH VỤ</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Quản lý dịch vụ</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Màn hình giữ nguyên trạng thái trung thực cho tới khi frontend có typed contract đọc và ghi dịch vụ.</p></div>
        <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Bản demo local</span>
      </header>

      <section aria-labelledby="service-contract-title" className="mt-6">
        <AdminState titleId="service-contract-title" tone="unavailable" title="Chưa thể tải hoặc chỉnh sửa dịch vụ" description="Backend có public /hospital/services và admin POST/PUT/DELETE /admin/services, nhưng shared frontend API client hiện chưa expose type hoặc helper cho service. Không gọi endpoint trực tiếp và không tạo số liệu giả trong phạm vi worker này." />
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Handoff contract</h2><p className="mt-2 text-sm leading-6 text-slate-600">Cần bổ sung typed service response/list và authenticated admin request helper ở shared API boundary trước khi bật bảng, form, empty state và mutation success path cho dịch vụ.</p></section>
    </div>
  );
}
