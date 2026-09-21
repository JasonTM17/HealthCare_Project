"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminGrantAiCredits,
  adminListPatientAiCredits,
  adminSyncAiCatalog,
  adminUpdatePatientTier,
  type PatientCreditDto,
} from "../../../lib/api-client";
import UiIcon, { type IconName } from "../../../components/UiIcon";
import AdminState from "../_components/AdminState";
import ConfirmActionDialog from "../../../components/ui/ConfirmActionDialog";
import { describeAdminError } from "../_lib/errors";

type Feedback = {
  tone: "success" | "error";
  title: string;
  description: string;
};

const TIER_BADGES: Record<string, { label: string; bg: string; text: string; iconName: IconName }> = {
  VIP: { label: "Hạng VIP", bg: "bg-purple-50 border border-purple-200/80", text: "text-purple-900", iconName: "sparkles" },
  GOLD: { label: "Hạng Vàng", bg: "bg-amber-50 border border-amber-200/80", text: "text-amber-900", iconName: "star" },
  SILVER: { label: "Hạng Bạc", bg: "bg-slate-100 border border-slate-200/80", text: "text-slate-800", iconName: "award" },
  STANDARD: { label: "Tiêu Chuẩn", bg: "bg-emerald-50 border border-emerald-200/80", text: "text-emerald-900", iconName: "shield-check" },
};

export default function AdminAiCreditsPage() {
  const [patients, setPatients] = useState<PatientCreditDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Modal / Action state. The target is narrowed to PATIENT on purpose: the
  // backend no longer meters clinical AI per doctor and rejects a DOCTOR grant,
  // so the operator is never offered an action that cannot take effect.
  const [grantModal, setGrantModal] = useState<{
    open: boolean;
    userId: string;
    targetRole: "PATIENT";
    name: string;
    currentCredits: number;
  } | null>(null);
  const [customAmount, setCustomAmount] = useState<number>(25);
  const [grantReason, setGrantReason] = useState<string>("");
  // Tier changes are staged: the select shows a preview, the write happens only
  // after the operator confirms in a dialog (it also resets the credit balance).
  const [tierPending, setTierPending] = useState<{ patient: PatientCreditDto; next: string } | null>(null);
  const [tierError, setTierError] = useState<string | null>(null);
  // Grant failures must render inside the modal — the page-level feedback
  // banner sits behind the fixed overlay and would be invisible.
  const [grantError, setGrantError] = useState<string | null>(null);
  // Operational-catalog AI index sync: staged behind a confirm dialog because
  // it rewrites the protected vector index from live catalog rows.
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Patient balances are the only AI credit listing the backend still
      // exposes; clinical (doctor) credits were retired along with the doctor
      // deduction path, so nothing here fetches them.
      const patientList = await adminListPatientAiCredits();
      setPatients(patientList);
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

  const submitTierUpdate = async () => {
    if (!tierPending || busy) return;
    setBusy(true);
    setTierError(null);
    setFeedback(null);
    try {
      await adminUpdatePatientTier({ patientProfileId: tierPending.patient.patientId, tier: tierPending.next });
      setFeedback({
        tone: "success",
        title: "Cập nhật thành công",
        description: `Đã chuyển ${tierPending.patient.fullName || "bệnh nhân"} sang hạng ${tierPending.next}; hạn mức AI được đặt lại theo hạng mới.`,
      });
      setTierPending(null);
      await loadData();
    } catch (err) {
      const copy = describeAdminError(err);
      setTierError(copy.description);
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
      setGrantError(null);
      await loadData();
    } catch (err) {
      // The grant endpoint answers a rejected request with its own Vietnamese
      // reason (an out-of-range amount, a target the backend no longer
      // supports). Opting into the server copy keeps that reason in front of
      // the operator instead of the generic "check the required fields"
      // sentence.
      const copy = describeAdminError(err, { preferServerMessage: true });
      setGrantError(copy.description);
    } finally {
      setBusy(false);
    }
  };

  const handleSyncCatalog = async () => {
    if (busy) return;
    setBusy(true);
    setSyncError(null);
    setFeedback(null);
    try {
      const result = await adminSyncAiCatalog();
      setFeedback({
        tone: "success",
        title: "Đồng bộ index AI thành công",
        description: `Đã xử lý ${result.processedDocuments} tài liệu danh mục (cơ sở, chuyên khoa, bác sĩ, dịch vụ, gói khám) vào kho dữ liệu vector AI.`,
      });
      setSyncDialogOpen(false);
    } catch (err) {
      const copy = describeAdminError(err);
      setSyncError(copy.description);
    } finally {
      setBusy(false);
    }
  };

  const totalPatientCredits = patients.reduce((acc, p) => acc + (p.credits || 0), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Quản lý AI Credits & Phân hạng Bệnh nhân</h1>
          <p className="mt-2 text-sm text-slate-600">
            Cấp phát hạn mức hỏi Trợ lý AI y khoa cho Bệnh nhân theo hạng thành viên (Standard, Bạc, Vàng, VIP).
          </p>
        </div>
        <button
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
          disabled={busy}
          onClick={() => { setSyncError(null); setSyncDialogOpen(true); }}
          type="button"
        >
          <UiIcon name="brain" size={16} className="shrink-0" />
          Đồng bộ index AI
        </button>
      </header>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-sm border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng Bệnh nhân</p>
          <p className="mt-2 text-3xl font-bold text-teal-800">{patients.length}</p>
          <p className="mt-1 text-xs text-slate-500">Đã kích hoạt hồ sơ điện tử</p>
        </div>
        <div className="rounded-sm border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Credits Bệnh nhân còn lại</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">{totalPatientCredits}</p>
          <p className="mt-1 text-xs text-slate-500">Hạn mức hỏi AI người bệnh</p>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-sm border p-4 ${
            feedback.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          <p className="font-bold">{feedback.title}</p>
          <p className="text-sm">{feedback.description}</p>
        </div>
      )}

      {loading ? (
        <div className="rounded-sm border border-slate-200 bg-white p-12 text-center text-slate-500">
          Đang tải dữ liệu AI Credits...
        </div>
      ) : loadError ? (
        <AdminState tone="error" title="Không thể tải dữ liệu" description={loadError} />
      ) : (
        <div className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-600">
                <tr>
                  <th scope="col" className="px-5 py-4">Bệnh nhân</th>
                  <th scope="col" className="px-5 py-4">Liên hệ</th>
                  <th scope="col" className="px-5 py-4">Hạng thẻ</th>
                  <th scope="col" className="px-5 py-4">Hạn mức AI</th>
                  <th scope="col" className="px-5 py-4 text-right">Hành động</th>
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
                        <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold shadow-xs ${tierInfo.bg} ${tierInfo.text}`}>
                          <UiIcon name={tierInfo.iconName} size={14} className="shrink-0" />
                          <span>{tierInfo.label}</span>
                        </span>
                      </td>
                      <td className="px-5 py-4 font-bold text-emerald-700">
                        <span className="text-base">{p.credits ?? 0}</span> <span className="text-xs font-normal text-slate-500">lượt</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <select
                            aria-label={`Chuyển hạng thẻ cho ${p.fullName || "bệnh nhân"}`}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-teal-600"
                            disabled={busy}
                            onChange={(e) => { setTierError(null); setTierPending({ patient: p, next: e.target.value }); }}
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
                                setGrantError(null);
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
      )}

      {/* Where the retired "Bác sĩ & AI Lâm sàng" tab used to be: the copy stays
          visible so an admin who remembers it learns why there is no clinical
          credit surface anymore. */}
      {!loading && !loadError ? (
        <div className="rounded-sm border border-slate-200 bg-slate-50 p-4" role="note">
          <p className="text-sm font-bold text-slate-900">AI lâm sàng không còn định mức theo từng bác sĩ</p>
          <p className="mt-1 text-sm text-slate-600">
            Hệ thống đã ngừng trừ lượt AI khi bác sĩ làm việc, nên trang này không còn bảng tín dụng AI cho Bác sĩ
            và quản trị viên cũng không cấp thêm lượt cho tài khoản bác sĩ — thao tác đó sẽ bị hệ thống từ chối.
            Số dư cũ vẫn còn lưu trong dữ liệu nhưng không bác sĩ nào tiêu được. Muốn bổ sung hạn mức hỏi Trợ lý
            AI, hãy cấp cho bệnh nhân ở bảng trên.
          </p>
        </div>
      ) : null}

      {/* Grant Credits Modal */}
      {grantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-sm bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Cấp phát Credit AI</h3>
            <p className="mt-1 text-sm text-slate-600">
              Đối tượng: <strong>{grantModal.name}</strong> (Bệnh nhân).
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
                  className="mt-2 w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
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
                  className="mt-1 w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
                  onChange={(e) => setGrantReason(e.target.value)}
                  placeholder="Ví dụ: Tri ân khách hàng thân thiết, hỗ trợ nghiên cứu..."
                  type="text"
                  value={grantReason}
                />
              </div>
            </div>

            {grantError && (
              <div aria-live="assertive" className="mt-4 rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">
                {grantError}
              </div>
            )}

            <div aria-hidden="true" className="mt-4 text-xs text-slate-500">
              Thao tác này ghi nhận một dòng giao dịch credit và không thể hoàn tác tự động.
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-sm border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                disabled={busy}
                onClick={() => setGrantModal(null)}
                type="button"
              >
                Hủy
              </button>
              <button
                className="rounded-sm bg-teal-700 px-5 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
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

      <ConfirmActionDialog
        confirmLabel="Chuyển hạng & đặt lại hạn mức"
        confirmingLabel="Đang cập nhật hạng…"
        description="Chuyển hạng sẽ đặt lại hạn mức AI của bệnh nhân theo hạn mức mặc định của hạng mới. Thay đổi được ghi vào lịch sử giao dịch credit."
        dismissOnBackdrop={false}
        error={busy ? null : tierError}
        onCancel={() => { if (!busy) { setTierPending(null); setTierError(null); } }}
        onConfirm={() => void submitTierUpdate()}
        open={tierPending !== null}
        pending={busy}
        summaryItems={tierPending ? [
          { label: "Bệnh nhân", value: tierPending.patient.fullName || "Bệnh nhân" },
          { label: "Liên hệ", value: tierPending.patient.email || tierPending.patient.phone || "—" },
          { label: "Hạng hiện tại", value: tierPending.patient.tier?.toUpperCase() || "STANDARD" },
          { label: "Chuyển sang", value: tierPending.next },
        ] : []}
        summaryLabel="Bệnh nhân đang xét"
        title="Chuyển hạng thành viên?"
      />

      <ConfirmActionDialog
        confirmLabel="Đồng bộ ngay"
        confirmingLabel="Đang đồng bộ…"
        description="Quét lại toàn bộ cơ sở, chuyên khoa, bác sĩ, dịch vụ và gói khám đang hoạt động rồi ghi vào kho dữ liệu vector AI. Hệ thống cũng tự động đồng bộ định kỳ mỗi 30 phút; thao tác này dành cho lúc cần cập nhật ngay sau khi sửa danh mục."
        dismissOnBackdrop={false}
        error={busy ? null : syncError}
        onCancel={() => { if (!busy) { setSyncDialogOpen(false); setSyncError(null); } }}
        onConfirm={() => void handleSyncCatalog()}
        open={syncDialogOpen}
        pending={busy}
        summaryItems={[
          { label: "Phạm vi", value: "Cơ sở · Chuyên khoa · Bác sĩ · Dịch vụ · Gói khám" },
          { label: "Bài viết & FAQ", value: "Không đổi (đồng bộ qua luồng kiểm duyệt nội dung)" },
        ]}
        summaryLabel="Tác động"
        title="Đồng bộ index AI?"
      />
    </div>
  );
}
