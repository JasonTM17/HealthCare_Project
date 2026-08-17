export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Bảng điều khiển</h1>
      <p className="text-slate-600 mt-2">
        Chào mừng đến trang quản trị. Sử dụng menu bên trái để quản lý nội dung bệnh viện.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500">Bác sĩ</h3>
          <p className="text-3xl font-bold text-teal-700 mt-2">500</p>
        </div>
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500">Chuyên khoa</h3>
          <p className="text-3xl font-bold text-teal-700 mt-2">30</p>
        </div>
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500">Bệnh nhân</h3>
          <p className="text-3xl font-bold text-teal-700 mt-2">1000</p>
        </div>
      </div>
    </div>
  );
}
