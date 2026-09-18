"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import PortalChrome from "../../../components/PortalChrome";
import {
  ApiError,
  createDoctorThesis,
  fetchDoctorFacultyProfile,
  fetchDoctorTheses,
  fetchSpecialties,
  gradeDoctorThesis,
  hasRole,
  updateDoctorThesis,
  type AcademicThesis,
  type CreateAcademicThesisPayload,
  type FacultyLecturerProfile,
  type GradeAcademicThesisPayload,
  type Specialty,
  type UpdateAcademicThesisPayload,
} from "../../../lib/api-client";
import { presentApiError } from "../../../lib/present-api-error";
import { ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import { useAuthSession, useAuthSessionStatus } from "../../../components/useAuthSession";
import UiIcon from "../../../components/UiIcon";

const TRAINING_LEVEL_LABELS: Record<string, { label: string; badgeClass: string }> = {
  GRADUATION_THESIS: {
    label: "Khóa luận tốt nghiệp Bác sĩ Y khoa",
    badgeClass: "bg-blue-50 text-blue-900 border-blue-200",
  },
  RESIDENCY_DISSERTATION: {
    label: "Luận văn Bác sĩ Nội trú (BSNT)",
    badgeClass: "bg-purple-50 text-purple-900 border-purple-200",
  },
  MASTER_THESIS: {
    label: "Luận văn Thạc sĩ Y học",
    badgeClass: "bg-teal-50 text-teal-900 border-teal-200",
  },
};

const STATUS_LABELS: Record<string, { label: string; pillClass: string; dotClass: string }> = {
  PROPOSED: {
    label: "Chờ duyệt đề cương",
    pillClass: "bg-slate-100 text-slate-700 border-slate-300",
    dotClass: "bg-slate-500",
  },
  APPROVED: {
    label: "Đã duyệt đề cương",
    pillClass: "bg-sky-50 text-sky-800 border-sky-200",
    dotClass: "bg-sky-500",
  },
  IN_PROGRESS: {
    label: "Đang nghiên cứu",
    pillClass: "bg-amber-50 text-amber-800 border-amber-200",
    dotClass: "bg-amber-500",
  },
  DEFENSE_SCHEDULED: {
    label: "Đã lên lịch bảo vệ",
    pillClass: "bg-indigo-50 text-indigo-800 border-indigo-200",
    dotClass: "bg-indigo-600",
  },
  DEFENDED: {
    label: "Đã bảo vệ thành công",
    pillClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dotClass: "bg-emerald-600",
  },
  REJECTED: {
    label: "Yêu cầu chỉnh sửa lại",
    pillClass: "bg-rose-50 text-rose-800 border-rose-200",
    dotClass: "bg-rose-600",
  },
};

export default function DoctorAcademicPage() {
  const session = useAuthSession();
  const status = useAuthSessionStatus();

  // Data states
  const [profile, setProfile] = useState<FacultyLecturerProfile | null>(null);
  const [theses, setTheses] = useState<AcademicThesis[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedYear, setSelectedYear] = useState<string>("ALL");

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGradeModal, setShowGradeModal] = useState<AcademicThesis | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<AcademicThesis | null>(null);
  const [editingThesis, setEditingThesis] = useState<AcademicThesis | null>(null);

  // Create form fields
  const [formTopicCode, setFormTopicCode] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formTrainingLevel, setFormTrainingLevel] = useState("GRADUATION_THESIS");
  const [formAcademicYear, setFormAcademicYear] = useState("2025-2026");
  const [formSpecialtyId, setFormSpecialtyId] = useState("");
  const [formStudentName, setFormStudentName] = useState("");
  const [formStudentCode, setFormStudentCode] = useState("");
  const [formAbstract, setFormAbstract] = useState("");
  const [formDocumentUrl, setFormDocumentUrl] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Grade form fields
  const [gradeScore, setGradeScore] = useState("9.0");
  const [gradeLocation, setGradeLocation] = useState("Hội trường Đại giảng đường Y khoa");
  const [gradeNotes, setGradeNotes] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [facProfile, thesesPage, specList] = await Promise.all([
        fetchDoctorFacultyProfile(),
        fetchDoctorTheses(
          selectedStatus === "ALL" ? undefined : selectedStatus,
          selectedYear === "ALL" ? undefined : selectedYear
        ),
        fetchSpecialties(),
      ]);
      setProfile(facProfile);
      setTheses(thesesPage.content);
      setSpecialties(specList.content);
      if (specList.content.length > 0 && !formSpecialtyId) {
        setFormSpecialtyId(specList.content[0].id);
      }
    } catch {
      setError("Không thể tải danh mục đề tài khóa luận và hồ sơ giảng viên.");
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, selectedYear, formSpecialtyId]);

  useEffect(() => {
    if (!session?.user || !hasRole(session.user, "DOCTOR")) return;
    void loadData();
  }, [session, loadData]);

  if (status === "loading") {
    return (
      <main className="portal-shell">
        <LoadingState />
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="portal-shell">
        <LoginRequiredState nextPath="/doctor/academic" />
      </main>
    );
  }

  if (!hasRole(session.user, "DOCTOR")) {
    return (
      <main className="portal-shell">
        <ForbiddenState
          description="Khu vực này chỉ dành cho Bác sĩ & Giảng viên lâm sàng phụ trách đào tạo."
          title="Không có quyền truy cập"
        />
      </main>
    );
  }

  const handleOpenCreateModal = () => {
    setFormTopicCode(`KL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormTitle("");
    setFormTrainingLevel("GRADUATION_THESIS");
    setFormAcademicYear("2025-2026");
    setFormStudentName("");
    setFormStudentCode("");
    setFormAbstract("");
    setFormDocumentUrl("");
    setFormNotes("");
    setShowCreateModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleCreateThesis = async (e: FormEvent) => {
    e.preventDefault();
    if (!formTopicCode.trim()) {
      setError("Vui lòng nhập mã đề tài nghiên cứu.");
      return;
    }
    if (!formTitle.trim()) {
      setError("Vui lòng nhập tên đề tài khóa luận y khoa.");
      return;
    }
    if (!formStudentName.trim() || !formStudentCode.trim()) {
      setError("Vui lòng nhập đầy đủ thông tin sinh viên / học viên nội trú.");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    const payload: CreateAcademicThesisPayload = {
      topicCode: formTopicCode.trim().toUpperCase(),
      title: formTitle.trim(),
      abstractText: formAbstract.trim() || undefined,
      academicYear: formAcademicYear.trim(),
      trainingLevel: formTrainingLevel,
      specialtyId: formSpecialtyId || undefined,
      studentName: formStudentName.trim(),
      studentCode: formStudentCode.trim().toUpperCase(),
      thesisDocumentUrl: formDocumentUrl.trim() || undefined,
      submissionNotes: formNotes.trim() || undefined,
    };

    try {
      await createDoctorThesis(payload);
      setSuccess("Đã đăng ký đề tài nghiên cứu / khóa luận y khoa mới thành công!");
      setShowCreateModal(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? presentApiError(err.code, err.status) : "Lỗi khi tạo đề tài.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleGradeThesis = async (e: FormEvent) => {
    e.preventDefault();
    if (!showGradeModal) return;
    const scoreNum = parseFloat(gradeScore);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 10) {
      setError("Điểm bảo vệ phải nằm trong thang điểm từ 0.00 đến 10.00.");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    const payload: GradeAcademicThesisPayload = {
      defenseScore: scoreNum,
      defenseLocation: gradeLocation.trim(),
      defenseDate: new Date().toISOString(),
      submissionNotes: gradeNotes.trim() || undefined,
    };

    try {
      await gradeDoctorThesis(showGradeModal.id, payload);
      setSuccess(`Đã ghi nhận điểm bảo vệ (${scoreNum}/10) cho đề tài ${showGradeModal.topicCode}!`);
      setShowGradeModal(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? presentApiError(err.code, err.status) : "Lỗi khi nhập điểm.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateStatus = async (thesisId: string, newStatus: string) => {
    setBusy(true);
    try {
      const current = theses.find((t) => t.id === thesisId);
      if (!current) return;
      const payload: UpdateAcademicThesisPayload = {
        title: current.title,
        status: newStatus,
      };
      await updateDoctorThesis(thesisId, payload);
      setSuccess("Đã cập nhật trạng thái đề tài thành công!");
      await loadData();
    } catch {
      setError("Không thể cập nhật trạng thái đề tài.");
    } finally {
      setBusy(false);
    }
  };

  const activeThesesCount = profile?.currentThesesCount ?? 0;
  const maxThesesQuota = profile?.maxTheses ?? 5;
  const isQuotaReached = activeThesesCount >= maxThesesQuota;

  return (
    <PortalChrome role="DOCTOR" user={session.user}>
      <div className="w-full max-w-[1240px] mx-auto pb-12 space-y-6">
        {/* Header Title with Faculty Summary */}
        <header className="rounded-sm border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs font-bold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200/60 font-mono">
                Đào tạo Viện - Trường & Nghiên cứu Khoa học
              </span>
              <h1 className="text-2xl font-black text-teal-950 tracking-tight mt-2">
                Quản lý Khóa luận & Đề tài Nghiên cứu Y khoa
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                Cổng quản lý đề tài khóa luận tốt nghiệp Bác sĩ Y khoa, luận văn Bác sĩ Nội trú và đề tài nghiên cứu lâm sàng do Giảng viên trực tiếp hướng dẫn và bảo vệ trước Hội đồng.
              </p>
            </div>
            <button
              className={`inline-flex items-center gap-2 rounded-[4px] px-5 py-2.5 text-sm font-bold shadow-xs transition-all min-h-11 ${
                isQuotaReached
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                  : "bg-teal-900 text-white hover:bg-teal-800 cursor-pointer"
              }`}
              disabled={isQuotaReached}
              onClick={handleOpenCreateModal}
              title={isQuotaReached ? "Đã đạt giới hạn số lượng đề tài hướng dẫn tối đa" : "Thêm đề tài mới"}
              type="button"
            >
              <UiIcon name="plus" size={16} />
              <span>Thêm đề tài mới</span>
            </button>
          </div>

          {/* Lecturer Faculty Profile Card */}
          {profile && (
            <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50/80 rounded-[4px] p-4 border border-slate-200/70">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-teal-800 text-white font-bold flex items-center justify-center shadow-2xs">
                  <UiIcon name="stethoscope" size={20} />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-semibold">Giảng viên hướng dẫn</div>
                  <div className="text-sm font-bold text-teal-950">{profile.doctorName}</div>
                  <div className="text-xs text-teal-800 font-medium">{profile.academicRank} • {profile.academicTitle}</div>
                </div>
              </div>

              <div className="border-l border-slate-200/80 pl-4">
                <div className="text-xs text-slate-500 font-semibold">Bộ môn Lâm sàng</div>
                <div className="text-sm font-bold text-slate-800 mt-1">{profile.department}</div>
                <div className="text-xs text-emerald-700 font-medium mt-0.5">● Đang công tác giảng dạy</div>
              </div>

              <div className="border-l border-slate-200/80 pl-4">
                <div className="text-xs text-slate-500 font-semibold">Chỉ tiêu đề tài hướng dẫn</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-black text-teal-950">{activeThesesCount}</span>
                  <span className="text-xs text-slate-500">/ tối đa {maxThesesQuota} đề tài</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className={`h-full ${isQuotaReached ? "bg-rose-600" : "bg-teal-700"}`}
                    style={{ width: `${Math.min(100, (activeThesesCount / maxThesesQuota) * 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="border-l border-slate-200/80 pl-4 flex flex-col justify-center">
                <span className="text-xs text-slate-500 font-semibold">Quy chuẩn học thuật</span>
                <span className="text-xs text-slate-700 mt-1 leading-snug">
                  Đánh giá độc lập hội đồng 3–5 thành viên, thang điểm 0–10 theo chuẩn Viện - Trường.
                </span>
              </div>
            </div>
          )}
        </header>

        {/* Notices */}
        {success && (
          <div className="rounded-[4px] border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900 flex items-center gap-2 shadow-2xs">
            <UiIcon name="shield-check" size={18} />
            <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="portal-inline-error mb-4" role="alert">
            {error}
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-[4px] border border-slate-200 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 mr-1">Trạng thái:</span>
            {[
              { id: "ALL", label: "Tất cả" },
              { id: "PROPOSED", label: "Chờ duyệt" },
              { id: "APPROVED", label: "Đã duyệt" },
              { id: "IN_PROGRESS", label: "Đang nghiên cứu" },
              { id: "DEFENSE_SCHEDULED", label: "Lịch bảo vệ" },
              { id: "DEFENDED", label: "Đã bảo vệ" },
            ].map((st) => (
              <button
                className={`rounded-[4px] px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  selectedStatus === st.id
                    ? "bg-teal-900 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                key={st.id}
                onClick={() => setSelectedStatus(st.id)}
                type="button"
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700" htmlFor="year-select">
              Năm học:
            </label>
            <select
              className="rounded-[4px] border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-teal-700 focus:outline-hidden"
              id="year-select"
              onChange={(e) => setSelectedYear(e.target.value)}
              value={selectedYear}
            >
              <option value="ALL">Tất cả năm học</option>
              <option value="2025-2026">2025 - 2026</option>
              <option value="2024-2025">2024 - 2025</option>
            </select>
          </div>
        </div>

        {/* Theses List */}
        {loading ? (
          <div className="rounded-sm border border-slate-200 bg-white p-12 text-center text-slate-500">
            Đang tải danh sách đề tài khóa luận y khoa...
          </div>
        ) : theses.length === 0 ? (
          <div className="rounded-sm border border-dashed border-slate-300 bg-white p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <UiIcon name="book-open" size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-800">Chưa có đề tài nào</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Không tìm thấy đề tài nghiên cứu nào phù hợp với bộ lọc. Bác sĩ có thể thêm đề tài khóa luận hoặc luận văn nội trú mới.
            </p>
            <button
              className="inline-flex items-center gap-2 rounded-[4px] bg-teal-900 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800 cursor-pointer"
              disabled={isQuotaReached}
              onClick={handleOpenCreateModal}
              type="button"
            >
              <UiIcon name="plus" size={14} />
              <span>Thêm đề tài đầu tiên</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {theses.map((t) => {
              const level = TRAINING_LEVEL_LABELS[t.trainingLevel] ?? {
                label: t.trainingLevel,
                badgeClass: "bg-slate-50 text-slate-800 border-slate-200",
              };
              const statusCfg = STATUS_LABELS[t.status] ?? {
                label: t.status,
                pillClass: "bg-slate-100 text-slate-700 border-slate-300",
                dotClass: "bg-slate-500",
              };

              return (
                <div
                  className="rounded-sm border border-slate-200 bg-white p-5 shadow-xs hover:border-teal-600 transition-all space-y-4"
                  key={t.id}
                >
                  {/* Top Bar: Code, Level, Status */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-[4px] bg-slate-100 text-slate-800 border border-slate-300">
                        {t.topicCode}
                      </span>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-[4px] border ${level.badgeClass}`}>
                        {level.label}
                      </span>
                      {t.specialtyName && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-[4px] bg-teal-50 text-teal-800 border border-teal-200">
                          {t.specialtyName}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">Năm học: {t.academicYear}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusCfg.pillClass}`}>
                        <span className={`w-2 h-2 rounded-full ${statusCfg.dotClass}`}></span>
                        <span>{statusCfg.label}</span>
                      </span>
                    </div>
                  </div>

                  {/* Title and Abstract */}
                  <div>
                    <h3 className="text-base font-bold text-teal-950 leading-snug">
                      {t.title}
                    </h3>
                    {t.abstractText && (
                      <p className="mt-2 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                        {t.abstractText}
                      </p>
                    )}
                  </div>

                  {/* Student & Score Badges */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/70 p-3 rounded-[4px] border border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold">Sinh viên / Học viên:</span>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {t.studentName} <span className="text-slate-500 font-normal font-mono">({t.studentCode})</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 font-semibold">Giảng viên hướng dẫn:</span>
                      <div className="font-bold text-teal-900 mt-0.5">
                        {t.supervisorName} <span className="text-slate-500 font-normal">({t.supervisorRank})</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 font-semibold">Kết quả bảo vệ:</span>
                      <div className="mt-0.5">
                        {t.defenseScore !== null && t.defenseScore !== undefined ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-800 text-sm">
                            <UiIcon name="shield-check" size={14} />
                            <span>{t.defenseScore.toFixed(2)} / 10</span>
                            <span className="text-xs font-normal text-slate-500">(Xuất sắc)</span>
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Chưa chấm điểm</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Committee info if scheduled or defended */}
                  {t.committeeMembers && t.committeeMembers.length > 0 && (
                    <div className="border-t border-slate-100 pt-3">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Hội đồng chấm khóa luận ({t.committeeMembers.length} thành viên):
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {t.committeeMembers.map((m) => (
                          <div
                            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[4px] bg-white border border-slate-200 text-xs"
                            key={m.id}
                          >
                            <span className="font-bold text-slate-800">{m.lecturerName}</span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-sm bg-slate-100 text-slate-600 uppercase">
                              {m.committeeRole === "CHAIR" ? "Chủ tịch" : m.committeeRole === "SECRETARY" ? "Thư ký" : m.committeeRole === "REVIEWER" ? "Phản biện" : "Ủy viên"}
                            </span>
                            {m.score !== null && m.score !== undefined && (
                              <span className="font-bold text-emerald-700 text-[11px]">{m.score.toFixed(1)} đ</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
                    <div className="flex items-center gap-2">
                      {t.status === "PROPOSED" && (
                        <button
                          className="px-3 py-1.5 rounded-[4px] font-bold bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200 cursor-pointer"
                          onClick={() => handleUpdateStatus(t.id, "APPROVED")}
                          type="button"
                        >
                          Phê duyệt đề cương
                        </button>
                      )}
                      {t.status === "APPROVED" && (
                        <button
                          className="px-3 py-1.5 rounded-[4px] font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 cursor-pointer"
                          onClick={() => handleUpdateStatus(t.id, "IN_PROGRESS")}
                          type="button"
                        >
                          Bắt đầu nghiên cứu
                        </button>
                      )}
                      {t.status === "IN_PROGRESS" && (
                        <button
                          className="px-3 py-1.5 rounded-[4px] font-bold bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200 cursor-pointer"
                          onClick={() => handleUpdateStatus(t.id, "DEFENSE_SCHEDULED")}
                          type="button"
                        >
                          Lên lịch bảo vệ
                        </button>
                      )}
                      {t.status === "DEFENSE_SCHEDULED" && (
                        <button
                          className="px-3 py-1.5 rounded-[4px] font-bold bg-emerald-700 text-white hover:bg-emerald-800 shadow-2xs cursor-pointer flex items-center gap-1.5"
                          onClick={() => {
                            setShowGradeModal(t);
                            setGradeScore(t.defenseScore ? String(t.defenseScore) : "9.25");
                            setGradeLocation(t.defenseLocation || "Hội trường Đại giảng đường Y khoa");
                            setGradeNotes(t.submissionNotes || "");
                          }}
                          type="button"
                        >
                          <UiIcon name="shield-check" size={14} />
                          <span>Nhập điểm bảo vệ</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className="px-3 py-1.5 rounded-[4px] font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 cursor-pointer flex items-center gap-1"
                        onClick={() => setShowDetailModal(t)}
                        type="button"
                      >
                        <UiIcon name="book-open" size={14} />
                        <span>Xem chi tiết</span>
                      </button>
                      {t.status !== "DEFENDED" && (
                        <button
                          className="px-3 py-1.5 rounded-[4px] font-semibold text-teal-800 hover:bg-teal-50 border border-teal-200 cursor-pointer flex items-center gap-1"
                          onClick={() => {
                            setShowGradeModal(t);
                            setGradeScore(t.defenseScore ? String(t.defenseScore) : "9.0");
                            setGradeLocation(t.defenseLocation || "Hội trường Đại giảng đường Y khoa");
                            setGradeNotes(t.submissionNotes || "");
                          }}
                          type="button"
                        >
                          <UiIcon name="sparkles" size={14} />
                          <span>Đánh giá điểm</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── MODAL: THÊM ĐỀ TÀI KHÓA LUẬN MỚI ── */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto backdrop-blur-xs">
            <div className="my-8 w-full max-w-2xl rounded-[4px] bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
                <div className="flex items-center gap-2">
                  <UiIcon name="book-open" size={20} />
                  <h2 className="text-lg font-bold text-teal-950">Đăng ký Đề tài Khóa luận / Luận văn Mới</h2>
                </div>
                <button
                  className="rounded-[4px] p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer"
                  onClick={() => setShowCreateModal(false)}
                  type="button"
                >
                  <UiIcon name="x" size={20} />
                </button>
              </div>

              <form className="flex-1 overflow-y-auto p-6 space-y-4 text-xs" onSubmit={handleCreateThesis}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1" htmlFor="m-topic-code">
                      Mã đề tài <span className="text-red-600">*</span>
                    </label>
                    <input
                      className="w-full rounded-[4px] border border-slate-300 p-2.5 font-mono uppercase text-xs focus:border-teal-800 focus:outline-hidden"
                      id="m-topic-code"
                      onChange={(e) => setFormTopicCode(e.target.value)}
                      required
                      value={formTopicCode}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1" htmlFor="m-training-level">
                      Bậc đào tạo <span className="text-red-600">*</span>
                    </label>
                    <select
                      className="w-full rounded-[4px] border border-slate-300 p-2.5 text-xs focus:border-teal-800 focus:outline-hidden bg-white"
                      id="m-training-level"
                      onChange={(e) => setFormTrainingLevel(e.target.value)}
                      value={formTrainingLevel}
                    >
                      <option value="GRADUATION_THESIS">Khóa luận tốt nghiệp Bác sĩ Y khoa</option>
                      <option value="RESIDENCY_DISSERTATION">Luận văn Bác sĩ Nội trú (BSNT)</option>
                      <option value="MASTER_THESIS">Luận văn Thạc sĩ Y học</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1" htmlFor="m-title">
                    Tên đề tài nghiên cứu y khoa <span className="text-red-600">*</span>
                  </label>
                  <input
                    className="w-full rounded-[4px] border border-slate-300 p-2.5 text-xs focus:border-teal-800 focus:outline-hidden font-medium"
                    id="m-title"
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="VD: Đánh giá hiệu quả phác đồ can thiệp mạch vành qua da..."
                    required
                    value={formTitle}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1" htmlFor="m-specialty">
                      Chuyên khoa liên quan
                    </label>
                    <select
                      className="w-full rounded-[4px] border border-slate-300 p-2.5 text-xs focus:border-teal-800 focus:outline-hidden bg-white"
                      id="m-specialty"
                      onChange={(e) => setFormSpecialtyId(e.target.value)}
                      value={formSpecialtyId}
                    >
                      <option value="">-- Chọn chuyên khoa --</option>
                      {specialties.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1" htmlFor="m-year">
                      Năm học <span className="text-red-600">*</span>
                    </label>
                    <input
                      className="w-full rounded-[4px] border border-slate-300 p-2.5 text-xs focus:border-teal-800 focus:outline-hidden"
                      id="m-year"
                      onChange={(e) => setFormAcademicYear(e.target.value)}
                      required
                      value={formAcademicYear}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1" htmlFor="m-student-name">
                      Họ tên sinh viên / học viên <span className="text-red-600">*</span>
                    </label>
                    <input
                      className="w-full rounded-[4px] border border-slate-300 p-2.5 text-xs focus:border-teal-800 focus:outline-hidden"
                      id="m-student-name"
                      onChange={(e) => setFormStudentName(e.target.value)}
                      placeholder="VD: BS. Nguyễn Văn A"
                      required
                      value={formStudentName}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1" htmlFor="m-student-code">
                      Mã số sinh viên / học viên <span className="text-red-600">*</span>
                    </label>
                    <input
                      className="w-full rounded-[4px] border border-slate-300 p-2.5 font-mono uppercase text-xs focus:border-teal-800 focus:outline-hidden"
                      id="m-student-code"
                      onChange={(e) => setFormStudentCode(e.target.value)}
                      placeholder="VD: Y2020-0012"
                      required
                      value={formStudentCode}
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1" htmlFor="m-abstract">
                    Tóm tắt đề cương nghiên cứu lâm sàng
                  </label>
                  <textarea
                    className="w-full rounded-[4px] border border-slate-300 p-2.5 text-xs focus:border-teal-800 focus:outline-hidden leading-relaxed"
                    id="m-abstract"
                    onChange={(e) => setFormAbstract(e.target.value)}
                    placeholder="Mục tiêu nghiên cứu, đối tượng nghiên cứu, phương pháp chọn mẫu..."
                    rows={4}
                    value={formAbstract}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1" htmlFor="m-notes">
                    Ghi chú / Kế hoạch triển khai
                  </label>
                  <input
                    className="w-full rounded-[4px] border border-slate-300 p-2.5 text-xs focus:border-teal-800 focus:outline-hidden"
                    id="m-notes"
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="VD: Đã duyệt đề cương cấp cơ sở, đang chờ thẩm định y đức..."
                    value={formNotes}
                  />
                </div>

                <div className="border-t border-slate-100 pt-4 flex items-center justify-end gap-3">
                  <button
                    className="rounded-[4px] px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                    onClick={() => setShowCreateModal(false)}
                    type="button"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    className="rounded-[4px] bg-teal-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-teal-800 cursor-pointer disabled:opacity-50"
                    disabled={busy}
                    type="submit"
                  >
                    {busy ? "Đang lưu..." : "Xác nhận đăng ký đề tài"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL: NHẬP ĐIỂM BẢO VỆ KHÓA LUẬN ── */}
        {showGradeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto backdrop-blur-xs">
            <div className="my-8 w-full max-w-lg rounded-[4px] bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
                <div className="flex items-center gap-2">
                  <UiIcon name="shield-check" size={20} />
                  <h2 className="text-base font-bold text-teal-950">Nhập Điểm Bảo Vệ & Đánh Giá Hội Đồng</h2>
                </div>
                <button
                  className="rounded-[4px] p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer"
                  onClick={() => setShowGradeModal(null)}
                  type="button"
                >
                  <UiIcon name="x" size={20} />
                </button>
              </div>

              <form className="p-6 space-y-4 text-xs" onSubmit={handleGradeThesis}>
                <div className="rounded-[4px] bg-slate-50 p-3 border border-slate-200">
                  <div className="font-mono text-[11px] font-bold text-slate-500">{showGradeModal.topicCode}</div>
                  <div className="font-bold text-teal-950 mt-1">{showGradeModal.title}</div>
                  <div className="text-slate-600 mt-1">Học viên: {showGradeModal.studentName} ({showGradeModal.studentCode})</div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1" htmlFor="g-score">
                    Điểm bảo vệ độc lập của Hội đồng (Thang điểm 0 - 10) <span className="text-red-600">*</span>
                  </label>
                  <input
                    className="w-full rounded-[4px] border border-slate-300 p-2.5 font-mono text-base font-bold text-teal-900 focus:border-teal-800 focus:outline-hidden"
                    id="g-score"
                    max="10.0"
                    min="0.0"
                    onChange={(e) => setGradeScore(e.target.value)}
                    required
                    step="0.01"
                    type="number"
                    value={gradeScore}
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Điểm trung bình cộng độc lập từ 3 đến 5 thành viên hội đồng.</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1" htmlFor="g-loc">
                    Địa điểm tổ chức bảo vệ
                  </label>
                  <input
                    className="w-full rounded-[4px] border border-slate-300 p-2.5 text-xs focus:border-teal-800 focus:outline-hidden"
                    id="g-loc"
                    onChange={(e) => setGradeLocation(e.target.value)}
                    value={gradeLocation}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1" htmlFor="g-notes">
                    Nhận xét & Đánh giá của Hội đồng chấm
                  </label>
                  <textarea
                    className="w-full rounded-[4px] border border-slate-300 p-2.5 text-xs focus:border-teal-800 focus:outline-hidden leading-relaxed"
                    id="g-notes"
                    onChange={(e) => setGradeNotes(e.target.value)}
                    placeholder="VD: Học viên nắm vững lý thuyết, số liệu minh bạch, trả lời tốt câu hỏi phản biện..."
                    rows={3}
                    value={gradeNotes}
                  />
                </div>

                <div className="border-t border-slate-100 pt-4 flex items-center justify-end gap-3">
                  <button
                    className="rounded-[4px] px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                    onClick={() => setShowGradeModal(null)}
                    type="button"
                  >
                    Hủy
                  </button>
                  <button
                    className="rounded-[4px] bg-teal-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-teal-800 cursor-pointer disabled:opacity-50"
                    disabled={busy}
                    type="submit"
                  >
                    {busy ? "Đang lưu..." : "Xác nhận hoàn tất bảo vệ"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL: XEM CHI TIẾT ĐỀ TÀI & HỘI ĐỒNG ── */}
        {showDetailModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto backdrop-blur-xs">
            <div className="my-8 w-full max-w-2xl rounded-[4px] bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-[4px] bg-teal-50 text-teal-900 border border-teal-200">
                  {showDetailModal.topicCode}
                </span>
                <button
                  className="rounded-[4px] p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer"
                  onClick={() => setShowDetailModal(null)}
                  type="button"
                >
                  <UiIcon name="x" size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
                <div>
                  <h2 className="text-lg font-bold text-teal-950 leading-snug">{showDetailModal.title}</h2>
                  <div className="mt-2 flex flex-wrap gap-2 text-slate-600">
                    <span className="font-semibold">Học viên: {showDetailModal.studentName} ({showDetailModal.studentCode})</span>
                    <span>•</span>
                    <span className="font-semibold">Năm học: {showDetailModal.academicYear}</span>
                    <span>•</span>
                    <span className="font-semibold text-teal-800">Chuyên khoa: {showDetailModal.specialtyName || "Y khoa chung"}</span>
                  </div>
                </div>

                {showDetailModal.abstractText && (
                  <div className="bg-slate-50 p-4 rounded-[4px] border border-slate-200">
                    <h4 className="font-bold text-slate-800 mb-1.5 uppercase tracking-wider text-[11px]">Tóm tắt đề cương nghiên cứu:</h4>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{showDetailModal.abstractText}</p>
                  </div>
                )}

                {showDetailModal.defenseScore !== null && showDetailModal.defenseScore !== undefined && (
                  <div className="bg-emerald-50/70 p-4 rounded-[4px] border border-emerald-200 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-emerald-900 uppercase">Điểm số bảo vệ chính thức:</div>
                      <div className="text-2xl font-black text-emerald-950 mt-1">{showDetailModal.defenseScore.toFixed(2)} / 10</div>
                      <div className="text-xs text-emerald-800 mt-0.5">Địa điểm: {showDetailModal.defenseLocation || "Hội trường Viện - Trường"}</div>
                    </div>
                    <div className="rounded-full bg-emerald-800 text-white p-3">
                      <UiIcon name="shield-check" size={24} />
                    </div>
                  </div>
                )}

                {showDetailModal.committeeMembers && showDetailModal.committeeMembers.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-800 mb-2 uppercase tracking-wider text-[11px]">
                      Thành viên Hội đồng phản biện độc lập:
                    </h4>
                    <div className="space-y-2">
                      {showDetailModal.committeeMembers.map((m) => (
                        <div className="flex items-center justify-between p-3 rounded-[4px] border border-slate-200 bg-white" key={m.id}>
                          <div>
                            <div className="font-bold text-slate-900 text-xs">{m.lecturerName}</div>
                            <div className="text-[11px] text-slate-500">{m.academicRank} • {m.department}</div>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700 uppercase">
                              {m.committeeRole === "CHAIR" ? "Chủ tịch" : m.committeeRole === "SECRETARY" ? "Thư ký" : m.committeeRole === "REVIEWER" ? "Phản biện" : "Ủy viên"}
                            </span>
                            {m.score !== null && m.score !== undefined && (
                              <div className="font-bold text-emerald-700 text-xs mt-1">{m.score.toFixed(2)} đ</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {showDetailModal.submissionNotes && (
                  <div className="text-xs text-slate-600 italic border-t border-slate-100 pt-3">
                    Ghi chú: {showDetailModal.submissionNotes}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PortalChrome>
  );
}
