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
  AiTriageResult,
} from "../types/hospital";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api/v1";

// ── Baseline Reference Data (Original, Non-infringing) ─────────────────────────
export const SEED_SPECIALTIES: Specialty[] = [
  {
    id: "sp-1",
    name: "Tim Mạch & Can Thiệp Mạch Máu",
    slug: "tim-mach",
    description: "Chẩn đoán, can thiệp và điều trị chuyên sâu các bệnh lý van tim, động mạch vành, rối loạn nhịp.",
    icon: "❤️",
  },
  {
    id: "sp-2",
    name: "Tiêu Hóa - Gan Mật - Tụy",
    slug: "tieu-hoa",
    description: "Nội soi không đau chuẩn quốc tế, tầm soát sớm ung thư dạ dày - đại tràng, điều trị gan mật.",
    icon: "🫀",
  },
  {
    id: "sp-3",
    name: "Thần Kinh & Đột Quỵ",
    slug: "than-kinh",
    description: "Cấp cứu can thiệp đột quỵ não 24/7, điều trị đau đầu mạn tính, thoái hóa thần kinh.",
    icon: "🧠",
  },
  {
    id: "sp-4",
    name: "Sản Phụ Khoa & Sơ Sinh",
    slug: "san-phu-khoa",
    description: "Chăm sóc thai kỳ toàn diện, sinh con chuẩn an toàn y khoa, tầm soát sức khỏe phụ nữ.",
    icon: "🌸",
  },
  {
    id: "sp-5",
    name: "Nhi Khoa & Tiêm Chủng",
    slug: "nhi-khoa",
    description: "Khám và điều trị bệnh lý sơ sinh - trẻ nhỏ trong không gian thân thiện, an toàn.",
    icon: "🧒",
  },
  {
    id: "sp-6",
    name: "Cơ Xương Khớp & Phục Hồi Chức Năng",
    slug: "co-xuong-khop",
    description: "Phẫu thuật nội soi khớp, thay khớp nhân tạo và tập vật lý trị liệu hiện đại.",
    icon: "🦴",
  },
  {
    id: "sp-7",
    name: "Ung Bướu & Y Học Hạt Nhân",
    slug: "ung-buou",
    description: "Tầm soát, hội chẩn đa chuyên khoa và phác đồ điều trị cá thể hóa chuẩn quốc tế.",
    icon: "🔬",
  },
  {
    id: "sp-8",
    name: "Mắt & Khúc Xạ",
    slug: "mat",
    description: "Phẫu thuật Phaco đục thủy tinh thể, điều trị tật khúc xạ và bệnh lý đáy mắt.",
    icon: "👁️",
  },
];

export const SEED_DOCTORS: Doctor[] = [
  {
    id: "doc-1",
    fullName: "PGS. TS. BS. Nguyễn Văn An",
    slug: "nguyen-van-an",
    title: "Chuyên gia Tim Mạch",
    specialtyName: "Tim Mạch",
    bio: "Hơn 22 năm kinh nghiệm trong lĩnh vực tim mạch can thiệp, nguyên trưởng khoa tim mạch bệnh viện tuyến đầu.",
    experienceYears: 22,
    photoUrl: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "doc-2",
    fullName: "BS. CKII. Trần Bích Ngọc",
    slug: "tran-bich-ngoc",
    title: "Trưởng khoa Sản Phụ Khoa",
    specialtyName: "Sản Phụ Khoa",
    bio: "Chuyên gia hàng đầu về theo dõi thai kỳ nguy cơ cao và phẫu thuật nội soi phụ khoa.",
    experienceYears: 18,
    photoUrl: "https://images.unsplash.com/photo-1594824813589-3221b369c0d3?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "doc-3",
    fullName: "TS. BS. Lê Hoàng Minh",
    slug: "le-hoang-minh",
    title: "Chuyên gia Tiêu Hóa - Gan Mật",
    specialtyName: "Tiêu Hóa",
    bio: "Tu nghiệp chuyên sâu tại Nhật Bản và Pháp về kỹ thuật nội soi can thiệp đường tiêu hóa.",
    experienceYears: 16,
    photoUrl: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "doc-4",
    fullName: "BS. CKI. Phạm Quốc Hưng",
    slug: "pham-quoc-hung",
    title: "Bác sĩ Chuyên khoa Nhi",
    specialtyName: "Nhi Khoa",
    bio: "Tận tâm, thấu hiểu tâm lý trẻ nhỏ với hơn 12 năm chăm sóc và điều trị các bệnh lý nhi khoa.",
    experienceYears: 12,
    photoUrl: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&auto=format&fit=crop&q=80",
  },
];

export const SEED_PACKAGES: HealthPackage[] = [
  {
    id: "pkg-1",
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
    id: "pkg-2",
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
    id: "pkg-3",
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
    id: "br-1",
    name: "Bệnh viện Đa khoa HealthCare — Trụ sở Trung tâm",
    slug: "co-so-trung-tam",
    address: "Số 120 Đường Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh",
    phone: "028 3822 1234",
    workingHours: "Thứ 2 - Thứ 7: 07:00 - 17:00 | Cấp cứu 24/7",
    emergencyHotline: "1900 1234",
  },
  {
    id: "br-2",
    name: "Phòng khám Đa khoa Quốc tế HealthCare — Bình Thạnh",
    slug: "co-so-binh-thanh",
    address: "Số 45 Đường Điện Biên Phủ, Phường 15, Quận Bình Thạnh, TP. Hồ Chí Minh",
    phone: "028 3512 5678",
    workingHours: "Thứ 2 - Thứ 7: 07:30 - 17:30",
    emergencyHotline: "1900 1234",
  },
  {
    id: "br-3",
    name: "Bệnh viện Đa khoa HealthCare — Khu Đô thị Thủ Đức",
    slug: "co-so-thu-duc",
    address: "Số 88 Đường Võ Văn Ngân, Phường Linh Chiểu, TP. Thủ Đức, TP. Hồ Chí Minh",
    phone: "028 3720 9999",
    workingHours: "Thứ 2 - Chủ Nhật: 07:00 - 17:00 | Cấp cứu 24/7",
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
  date: string
): Promise<TimeSlot[]> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/appointments/doctors/${doctorId}/slots?date=${date}`,
      { cache: "no-store" }
    );
    if (!res.ok) return generateFallbackSlots();
    return await res.json();
  } catch {
    return generateFallbackSlots();
  }
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

export async function performAiTriage(symptoms: string): Promise<AiTriageResult> {
  const lower = symptoms.toLowerCase();

  // Rule-based smart clinical triage baseline
  if (lower.includes("ngực") || lower.includes("tim") || lower.includes("hồi hộp") || lower.includes("khó thở")) {
    return {
      recommendedSpecialty: "Tim Mạch & Can Thiệp Mạch Máu",
      urgencyLevel: lower.includes("dữ dội") || lower.includes("đau nhói") ? "EMERGENCY" : "HIGH",
      advice: "Triệu chứng liên quan đến hệ tim mạch. Cần được đo điện tâm đồ và siêu âm tim sớm. Nếu đau ngực lan ra vai/hàm, vui lòng gọi cấp cứu 1900 1234 ngay.",
      suggestedQuestions: ["Có bị tăng huyết áp không?", "Cơn đau kéo dài bao lâu?"],
    };
  }

  if (lower.includes("bụng") || lower.includes("dạ dày") || lower.includes("ợ chua") || lower.includes("buồn nôn") || lower.includes("tiêu")) {
    return {
      recommendedSpecialty: "Tiêu Hóa - Gan Mật - Tụy",
      urgencyLevel: "NORMAL",
      advice: "Nghi ngờ bệnh lý đường tiêu hóa. Khuyến nghị nhịn ăn trước 6 tiếng nếu có chỉ định nội soi.",
      suggestedQuestions: ["Đau trước hay sau khi ăn?", "Có tiền sử viêm loét dạ dày không?"],
    };
  }

  if (lower.includes("đầu") || lower.includes("chóng mặt") || lower.includes("mất ngủ") || lower.includes("tê bì")) {
    return {
      recommendedSpecialty: "Thần Kinh & Đột Quỵ",
      urgencyLevel: "NORMAL",
      advice: "Khuyến nghị khám chuyên khoa Thần kinh để kiểm tra lưu huyết não và loại trừ các bệnh lý tiền đình, mạch máu não.",
      suggestedQuestions: ["Có bị hoa mắt khi thay đổi tư thế không?", "Mất ngủ kéo dài bao lâu?"],
    };
  }

  if (lower.includes("khớp") || lower.includes("lưng") || lower.includes("gối") || lower.includes("xương")) {
    return {
      recommendedSpecialty: "Cơ Xương Khớp & Phục Hồi Chức Năng",
      urgencyLevel: "NORMAL",
      advice: "Nên chụp X-Quang hoặc siêu âm khớp để đánh giá tình trạng thoái hóa hoặc viêm gân khớp.",
      suggestedQuestions: ["Khớp có bị sưng nóng đỏ không?", "Có cứng khớp vào buổi sáng không?"],
    };
  }

  return {
    recommendedSpecialty: "Gói Khám Sức Khỏe Tổng Quát Toàn Diện",
    urgencyLevel: "NORMAL",
    advice: "Dấu hiệu chưa khu trú rõ vào một cơ quan. Bác sĩ Đa khoa tổng quát sẽ thăm khám lâm sàng và chỉ định xét nghiệm phù hợp.",
    suggestedQuestions: ["Bạn đã kiểm tra sức khỏe định kỳ trong năm nay chưa?"],
  };
}

function generateFallbackSlots(): TimeSlot[] {
  const times = [
    { start: "08:00:00", end: "08:30:00" },
    { start: "08:30:00", end: "09:00:00" },
    { start: "09:00:00", end: "09:30:00" },
    { start: "09:30:00", end: "10:00:00" },
    { start: "10:00:00", end: "10:30:00" },
    { start: "10:30:00", end: "11:00:00" },
    { start: "13:30:00", end: "14:00:00" },
    { start: "14:00:00", end: "14:30:00" },
    { start: "14:30:00", end: "15:00:00" },
    { start: "15:00:00", end: "15:30:00" },
    { start: "15:30:00", end: "16:00:00" },
    { start: "16:00:00", end: "16:30:00" },
  ];

  return times.map((t, idx) => ({
    startTime: t.start,
    endTime: t.end,
    available: idx !== 2 && idx !== 5, // mock 2 slots taken
    statusNote: idx === 2 || idx === 5 ? "Đã có người đặt" : "Còn trống",
  }));
}
