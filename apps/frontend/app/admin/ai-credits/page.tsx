"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminGrantAiCredits,
  adminListDoctorAiCredits,
  adminListPatientAiCredits,
  adminUpdatePatientTier,
  type DoctorCreditDto,
  type PatientCreditDto,
} from "../../../lib/api-client";
import AdminState from "../_components/AdminState";
import { describeAdminError } from "../_lib/errors";

type Feedback = {
  tone: "success" | "error";
  title: string;
  description: string;
};

const TIER_BADGES: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  VIP: { label: "Hạng VIP", bg: "bg-purple-100", text: "text-purple-800", icon: "👑" },
  GOLD: { label: "Hạng Vàng", bg: "bg-amber-100", text: "text-amber-800", icon: "⭐" },
  SILVER: { label: "Hạng Bạc", bg: "bg-slate-200", text: "text-slate-800", icon: "🥈" },
  STANDARD: { label: "Tiêu Chuẩn", bg: "bg-emerald-100", text: "text-emerald-800", icon: "🌱" },
};

export default function AdminAiCreditsPage() {
  const [activeTab, setActiveTab] = useState<"patients" | "doctors">("patients");
  const [patients, setPatients] = useState<PatientCreditDto[]>([]);
  const [doctors, setDoctors] = useState<DoctorCreditDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Modal / Action state
  const [grantModal, setGrantModal] = useState<{
    open: boolean;
    userId: string;
    targetRole: "PATIENT" | "DOCTOR";
    name: string;
    currentCredits: number;
  } | null>(null);
  const [customAmount, setCustomAmount] = useState<number>(25);
  const [grantReason, setGrantReason] = useState<string>("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [patientList, doctorList] = await Promise.all([
        adminListPatientAiCredits(),
        adminListDoctorAiCredits(),
      ]);
      setPatients(patientList);
      setDoctors(doctorList);
    } catch (err) {
      setLoadError(describeAdminError(err).description);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = Promise.resolve().then(loadData);
    return () => void task;
  }, [loadData]);

  const handleUpdateTier = async (patientProfileId: string, newTier: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      await adminUpdatePatientTier({ patientProfileId, tier: newTier });
      setFeedback({
        tone: "success",
        title: "Cập nhật thành công",
        description: `Đã nâng hạng thành viên lên ${newTier} và cấp thêm hạn mức AI tương ứng.`,
      });
      await loadData();
    } catch (err) {
      const copy = describeAdminError(err);
      setFeedback({ tone: "error", title: copy.title, description: copy.description });
    } finally {
      setBusy(false);
    }
  };

  const handleGrantCredits = async () => {
    if (!grantModal) return;
    setBusy(true);
    setFeedback(null);
    try {
      await adminGrantAiCredits({
        userId: grantModal.userId,
        targetRole: grantModal.targetRole,
        amount: Number(customAmount),
        description: grantReason.trim() || `Admin cấp thêm ${customAmount} credit AI`,
      });
      setFeedback({
        tone: "success",
        title: "Cấp phát thành công",
        description: `Đã cộng ${customAmount} credit AI cho ${grantModal.name}.`,
      });
      setGrantModal(null);
      setGrantReason("");
      await loadData();
    } catch (err) {
      const copy = describeAdminError(err);
      setFeedback({ tone: "error", title: copy.title, description: copy.description });
    } finally {
      setBusy(false);
    }
  };

  const totalPatientCredits = patients.reduce((acc, p) => acc + (p.credits || 0), 0);
  const totalDoctorCredits = doctors.reduce((acc, d) => acc + (d.credits || 0), 0);

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-bold text-slate-900">Quản lý AI Credits & Phân hạng Bệnh nhân</h1>
        <p className="mt-2 text-sm text-slate-600">
          Cấp phát hạn mức hỏi Trợ lý AI y khoa cho Bệnh nhân theo hạng thành viên (Standard, Bạc, Vàng, VIP) và hạn mức Bác sĩ hỗ trợ lâm sàng.
        </p>
      </header>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng Bệnh nhân</p>
          <p className="mt-2 text-3xl font-bold text-teal-800">{patients.length}</p>
          <p className="mt-1 text-xs text-slate-500">Đã kích hoạt hồ sơ điện tử</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Credits Bệnh nhân còn lại</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">{totalPatientCredits}</p>
          <p className="mt-1 text-xs text-slate-500">Hạn mức hỏi AI người bệnh</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng Bác sĩ</p>
          <p className="mt-2 text-3xl font-bold text-teal-800">{doctors.length}</p>
          <p className="mt-1 text-xs text-slate-500">Bác sĩ chuyên khoa hệ thống</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Credits Bác sĩ lâm sàng</p>
          <p className="mt-2 text-3xl font-bold text-purple-700">{totalDoctorCredits}</p>
          <p className="mt-1 text-xs text-slate-500">Hạn mức AI hỗ trợ chẩn đoán</p>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border p-4 ${
            feedback.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          <p className="font-bold">{feedback.title}</p>
          <p className="text-sm">{feedback.description}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          className={`px-6 py-3 text-sm font-bold transition-colors ${
            activeTab === "patients"
              ? "border-b-2 border-teal-700 text-teal-800"
              : "text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => setActiveTab("patients")}
          type="button"
        >
          Bệnh nhân & Hạng Thẻ ({patients.length})
        </button>
        <button
          className={`px-6 py-3 text-sm font-bold transition-colors ${
            activeTab === "doctors"
              ? "border-b-2 border-teal-700 text-teal-800"
              : "text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => setActiveTab("doctors")}
          type="button"
        >
          Bác sĩ & AI Lâm sàng ({doctors.length})
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          Đang tải dữ liệu AI Credits...
        </div>
      ) : loadError ? (
        <AdminState tone="error" title="Không thể tải dữ liệu" description={loadError} />
      ) : activeTab === "patients" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-600">
                <tr>
                  <th className="px-5 py-4">Bệnh nhân</th>
                  <th className="px-5 py-4">Liên hệ</th>
                  <th className="px-5 py-4">Hạng thẻ</th>
                  <th className="px-5 py-4">Hạn mức AI</th>
                  <th className="px-5 py-4 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patients.map((p) => {
                  const tierInfo = TIER_BADGES[p.tier?.toUpperCase()] || TIER_BADGES.STANDARD;
                  return (
                    <tr className="hover:bg-slate-50/80 transition-colors" key={p.patientId}>
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {p.fullName || "Bệnh nhân"}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <div>{p.phone || "—"}</div>
                        <div className="text-xs text-slate-400">{p.email || ""}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${tierInfo.bg} ${tierInfo.text}`}>
                          <span>{tierInfo.icon}</span>
                          <span>{tierInfo.label}</span>
                        </span>
                      </td>
                      <td className="px-5 py-4 font-bold text-emerald-700">
                        <span className="text-base">{p.credits ?? 0}</span> <span className="text-xs font-normal text-slate-500">lượt</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <select
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-teal-600"
                            disabled={busy}
                            onChange={(e) => void handleUpdateTier(p.patientId, e.target.value)}
                            value={p.tier?.toUpperCase() || "STANDARD"}
                          >
                            <option value="STANDARD">Hạng Tiêu chuẩn (20)</option>
                            <option value="SILVER">Hạng Bạc (50)</option>
                            <option value="GOLD">Hạng Vàng (100)</option>
                            <option value="VIP">Hạng VIP (300)</option>
                          </select>
                          {p.userId && (
                            <button
                              className="rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100"
                              disabled={busy}
                              onClick={() => {
                                setGrantModal({
                                  open: true,
                                  userId: p.userId,
                                  targetRole: "PATIENT",
                                  name: p.fullName,
                                  currentCredits: p.credits,
                                });
                                setCustomAmount(25);
                              }}
                              type="button"
                            >
                              + Cấp thêm
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-600">
                <tr>
                  <th className="px-5 py-4">Bác sĩ</th>
                  <th className="px-5 py-4">Mã định danh (Slug)</th>
                  <th className="px-5 py-4">Credits Lâm sàng</th>
                  <th className="px-5 py-4 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {doctors.map((d) => (
                  <tr className="hover:bg-slate-50/80 transition-colors" key={d.doctorId}>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {d.fullName}
                    </td>
                    <td className="px-5 py-4 text-slate-600 font-mono text-xs">
                      {d.slug}
                    </td>
                    <td className="px-5 py-4 font-bold text-purple-700">
                      <span className="text-base">{d.credits ?? 0}</span> <span className="text-xs font-normal text-slate-500">lượt</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {d.userId ? (
                        <button
                          className="rounded-lg bg-purple-50 px-3.5 py-1.5 text-xs font-bold text-purple-800 hover:bg-purple-100"
                          disabled={busy}
                          onClick={() => {
                            setGrantModal({
                              open: true,
                              userId: d.userId,
                              targetRole: "DOCTOR",
                              name: d.fullName,
                              currentCredits: d.credits,
                            });
                            setCustomAmount(50);
                          }}
                          type="button"
                        >
                          + Cấp thêm lượt AI
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Chưa liên kết User</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grant Credits Modal */}
      {grantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Cấp phát Credit AI</h3>
            <p className="mt-1 text-sm text-slate-600">
              Đối tượng: <strong>{grantModal.name}</strong> ({grantModal.targetRole === "PATIENT" ? "Bệnh nhân" : "Bác sĩ"}).
              Hiện có: <strong>{grantModal.currentCredits}</strong> credit.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Số lượng credit cộng thêm
                </label>
                <div className="mt-2 flex gap-2">
                  {[10, 25, 50, 100].map((amt) => (
                    <button
                      className={`flex-1 rounded-lg border py-2 text-xs font-bold transition-all ${
                        customAmount === amt
                          ? "border-teal-700 bg-teal-50 text-teal-800"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                      key={amt}
                      onClick={() => setCustomAmount(amt)}
                      type="button"
                    >
                      +{amt}
                    </button>
                  ))}
                </div>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  min="1"
                  onChange={(e) => setCustomAmount(Math.max(1, Number(e.target.value) || 1))}
                  type="number"
                  value={customAmount}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Lý do / Ghi chú
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  onChange={(e) => setGrantReason(e.target.value)}
                  placeholder="Ví dụ: Tri ân khách hàng thân thiết, hỗ trợ nghiên cứu..."
                  type="text"
                  value={grantReason}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                disabled={busy}
                onClick={() => setGrantModal(null)}
                type="button"
              >
                Hủy
              </button>
              <button
                className="rounded-xl bg-teal-700 px-5 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
                disabled={busy}
                onClick={() => void handleGrantCredits()}
                type="button"
              >
                {busy ? "Đang xử lý..." : "Xác nhận cấp"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
