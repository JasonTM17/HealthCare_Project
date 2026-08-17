import {
  Specialty,
  Doctor,
  Branch,
  HealthPackage,
  TimeSlot,
  HoldSlotPayload,
  HoldSlotResult,
  ConfirmAppointmentPayload,
  AppointmentDetails,
} from "../types/hospital";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api/v1";

// ── Baseline Reference Data (Original, Non-infringing) ─────────────────────────
export const SEED_SPECIALTIES: Specialty[] = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    name: "Tim Mạch & Can Thiệp Mạch Máu",
    slug: "tim-mach",
    description: "Chẩn đoán, can thiệp và điều trị chuyên sâu các bệnh lý van tim, động mạch vành, rối loạn nhịp.",
    icon: "❤️",
  },
  {
    id: "10000000-0000-0000-0000-000000000003",
    name: "Tiêu Hóa - Gan Mật - Tụy",
    slug: "tieu-hoa",
    description: "Nội soi không đau chuẩn quốc tế, tầm soát sớm ung thư dạ dày - đại tràng, điều trị gan mật.",
    icon: "🫀",
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    name: "Thần Kinh & Đột Quỵ",
    slug: "than-kinh",
    description: "Cấp cứu can thiệp đột quỵ não 24/7, điều trị đau đầu mạn tính, thoái hóa thần kinh.",
    icon: "🧠",
  },
  {
    id: "10000000-0000-0000-0000-000000000006",
    name: "Sản Phụ Khoa & Sơ Sinh",
    slug: "san-phu-khoa",
    description: "Chăm sóc thai kỳ toàn diện, sinh con chuẩn an toàn y khoa, tầm soát sức khỏe phụ nữ.",
    icon: "🌸",
  },
  {
    id: "10000000-0000-0000-0000-000000000005",
    name: "Nhi Khoa & Tiêm Chủng",
    slug: "nhi-khoa",
    description: "Khám và điều trị bệnh lý sơ sinh - trẻ nhỏ trong không gian thân thiện, an toàn.",
    icon: "🧒",
  },
  {
    id: "10000000-0000-0000-0000-000000000007",
    name: "Cơ Xương Khớp & Phục Hồi Chức Năng",
    slug: "co-xuong-khop",
    description: "Phẫu thuật nội soi khớp, thay khớp nhân tạo và tập vật lý trị liệu hiện đại.",
    icon: "🦴",
  },
  {
    id: "10000000-0000-0000-0000-000000000004",
    name: "Nội Tổng Hợp",
    slug: "noi-tong-hop",
    description: "Khám sàng lọc và quản lý các bệnh mạn tính như tiểu đường, mỡ máu.",
    icon: "🩺",
  },
  {
    id: "10000000-0000-0000-0000-000000000008",
    name: "Tai Mũi Họng",
    slug: "tai-mui-hong",
    description: "Khám và điều trị viêm họng, viêm xoang và các rối loạn tai mũi họng thường gặp.",
    icon: "👂",
  },
];

export const SEED_DOCTORS: Doctor[] = [
  {
    id: "30000000-0000-0000-0000-000000000001",
    fullName: "PGS. TS. BS. Nguyễn Văn An",
    slug: "nguyen-van-an",
    title: "Chuyên gia Tim Mạch",
    specialtyName: "Tim Mạch",
    bio: "Hơn 22 năm kinh nghiệm trong lĩnh vực tim mạch can thiệp, nguyên trưởng khoa tim mạch bệnh viện tuyến đầu.",
    experienceYears: 22,
    branchId: "20000000-0000-0000-0000-000000000001",
    photoUrl: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "30000000-0000-0000-0000-000000000005",
    fullName: "BS. CKII. Trần Bích Ngọc",
    slug: "tran-bich-ngoc",
    title: "Trưởng khoa Sản Phụ Khoa",
    specialtyName: "Sản Phụ Khoa",
    bio: "Chuyên gia hàng đầu về theo dõi thai kỳ nguy cơ cao và phẫu thuật nội soi phụ khoa.",
    experienceYears: 18,
    branchId: "20000000-0000-0000-0000-000000000001",
    photoUrl: "https://images.unsplash.com/photo-1594824813589-3221b369c0d3?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "30000000-0000-0000-0000-000000000003",
    fullName: "TS. BS. Lê Hoàng Minh",
    slug: "le-hoang-minh",
    title: "Chuyên gia Tiêu Hóa - Gan Mật",
    specialtyName: "Tiêu Hóa",
    bio: "Tu nghiệp chuyên sâu tại Nhật Bản và Pháp về kỹ thuật nội soi can thiệp đường tiêu hóa.",
    experienceYears: 16,
    branchId: "20000000-0000-0000-0000-000000000002",
    photoUrl: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "30000000-0000-0000-0000-000000000004",
    fullName: "BS. CKI. Phạm Quốc Hưng",
    slug: "pham-quoc-hung",
    title: "Bác sĩ Chuyên khoa Nhi",
    specialtyName: "Nhi Khoa",
    bio: "Tận tâm, thấu hiểu tâm lý trẻ nhỏ với hơn 12 năm chăm sóc và điều trị các bệnh lý nhi khoa.",
    experienceYears: 12,
    branchId: "20000000-0000-0000-0000-000000000002",
    photoUrl: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&auto=format&fit=crop&q=80",
  },
];

export const SEED_PACKAGES: HealthPackage[] = [
  {
    id: "50000000-0000-0000-0000-000000000001",
    name: "Gói Khám Sức Khỏe Tổng Quát Toàn Diện",
    slug: "tong-quat-toan-dien",
    description: "Kiểm tra 32 danh mục xét nghiệm máu, men gan, chức năng thận, siêu âm tim, chụp X-quang và khám chuyên khoa.",
    price: 3200000,
    featured: true,
    checklist: [
      "Khám Nội, Ngoại, Mắt, Tai Mũi Họng, Răng Hàm Mặt",
      "Xét nghiệm công thức máu 24 chỉ số",
      "Đánh giá đường huyết, mỡ máu, chức năng gan thận",
      "Siêu âm ổ bụng tổng quát & Siêu âm tuyến giáp",
      "Điện tâm đồ (ECG) & Chụp X-Quang phổi kỹ thuật số",
    ],
  },
  {
    id: "50000000-0000-0000-0000-000000000002",
    name: "Gói Tầm Soát Tim Mạch & Đột Quỵ Sớm",
    slug: "tam-soat-tim-mach",
    description: "Đánh giá nguy cơ xơ vữa động mạch, siêu âm tim Doppler màu, Holter điện tâm đồ 24h và tư vấn chuyên gia.",
    price: 4500000,
    featured: true,
    checklist: [
      "Siêu âm Doppler tim & Siêu âm mạch máu cảnh",
      "Xét nghiệm chỉ dấu sinh học tim mạch (Troponin, hs-CRP)",
      "Điện tâm đồ gắng sức hoặc Holter 24h",
      "Chụp cộng hưởng từ MRI não - mạch máu não (tùy chọn)",
      "Bác sĩ chuyên gia tim mạch tư vấn phòng ngừa đột quỵ",
    ],
  },
  {
    id: "50000000-0000-0000-0000-000000000003",
    name: "Gói Khám & Tầm Soát Tiêu Hóa Không Đau",
    slug: "tam-soat-tieu-hoa",
    description: "Nội soi dạ dày & đại tràng tiền mê không đau, sinh thiết tìm vi khuẩn HP và tầm soát polyp đại tràng.",
    price: 5200000,
    featured: false,
    checklist: [
      "Nội soi dạ dày - tá tràng gây mê không đau",
      "Nội soi toàn bộ đại trực tràng độ nét cao",
      "Test nhanh vi khuẩn HP dạ dày",
      "Tầm soát dấu ấn ung thư tiêu hóa CEA, CA 19-9",
      "Bác sĩ chuyên khoa tiêu hóa đọc kết quả & kê đơn",
    ],
  },
];

export const SEED_BRANCHES: Branch[] = [
  {
    id: "20000000-0000-0000-0000-000000000001",
    name: "Bệnh viện Đa khoa HealthCare, Trụ sở Trung tâm",
    slug: "co-so-trung-tam",
    address: "Số 120 Đường Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh",
    phone: "028 3822 1234",
    workingHours: "Thứ 2 - Thứ 7: 07:00 - 17:00 | Cấp cứu 24/7",
    emergencyHotline: "1900 1234",
  },
  {
    id: "20000000-0000-0000-0000-000000000002",
    name: "Phòng khám Đa khoa Quốc tế HealthCare, Bình Thạnh",
    slug: "co-so-binh-thanh",
    address: "Số 45 Đường Điện Biên Phủ, Phường 15, Quận Bình Thạnh, TP. Hồ Chí Minh",
    phone: "028 3512 5678",
    workingHours: "Thứ 2 - Thứ 7: 07:30 - 17:30",
    emergencyHotline: "1900 1234",
  },
];

// ── API Fetchers ──────────────────────────────────────────────────────────────

export async function fetchSpecialties(): Promise<Specialty[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/hospital/specialties?size=50`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return SEED_SPECIALTIES;
    const data = await res.json();
    return data.content && data.content.length > 0 ? data.content : SEED_SPECIALTIES;
  } catch {
    return SEED_SPECIALTIES;
  }
}

export async function fetchDoctors(): Promise<Doctor[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/hospital/doctors?size=50`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return SEED_DOCTORS;
    const data = await res.json();
    return data.content && data.content.length > 0 ? data.content : SEED_DOCTORS;
  } catch {
    return SEED_DOCTORS;
  }
}

export async function fetchDoctorSlots(
  doctorId: string,
  branchId: string,
  date: string
): Promise<TimeSlot[]> {
  const query = new URLSearchParams({ date, branchId });
  const res = await fetch(
    `${API_BASE_URL}/appointments/doctors/${encodeURIComponent(doctorId)}/slots?${query.toString()}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || "Không thể tải lịch khám cho cơ sở đã chọn. Vui lòng thử lại."
    );
  }

  const data: unknown = await res.json();
  if (!Array.isArray(data)) {
    throw new Error("Dữ liệu lịch khám không đúng định dạng.");
  }
  if (data.length === 0) return [];

  const slots = data as Partial<TimeSlot>[];
  if (slots.some((slot) => (
    typeof slot.branchId !== "string" ||
    typeof slot.startTime !== "string" ||
    typeof slot.endTime !== "string" ||
    typeof slot.available !== "boolean" ||
    typeof slot.statusNote !== "string"
  ))) {
    throw new Error("API lịch khám chưa trả về branchId; không thể xác nhận đúng cơ sở.");
  }
  if (slots.some((slot) => slot.branchId !== branchId)) {
    throw new Error("Lịch khám trả về không thuộc cơ sở đang chọn. Vui lòng tải lại.");
  }
  return slots as TimeSlot[];
}

export async function holdAppointmentSlot(
  payload: HoldSlotPayload
): Promise<HoldSlotResult> {
  const res = await fetch(`${API_BASE_URL}/appointments/hold`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        "Khung giờ khám này vừa có người đặt hoặc đang được giữ chỗ. Vui lòng chọn khung giờ khác."
    );
  }

  return await res.json();
}

export async function confirmAppointment(
  payload: ConfirmAppointmentPayload
): Promise<AppointmentDetails> {
  const res = await fetch(`${API_BASE_URL}/appointments/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Mã OTP không chính xác hoặc đã hết hạn.");
  }

  return await res.json();
}
