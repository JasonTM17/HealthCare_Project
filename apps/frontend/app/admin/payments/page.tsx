"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminListPayments, adminRefundPayment, adminReviewPayment, type BankTransferPayment } from "../../../lib/api-client";
import { formatBusinessDate, formatBusinessDateTime } from "../../../lib/business-time";
import ConfirmActionDialog from "../../../components/ui/ConfirmActionDialog";
import AdminState from "../_components/AdminState";
import { describeAdminError } from "../_lib/errors";

const PAYMENT_STATUSES = [
  ["UNPAID", "Chưa thanh toán"],
  ["PENDING_VERIFICATION", "Chờ đối soát"],
  ["PAID", "Đã thanh toán"],
  ["REJECTED", "Cần kiểm tra lại"],
  ["REFUND_PENDING", "Chờ hoàn tiền"],
  ["REFUNDED", "Đã hoàn tiền"],
] as const;

type PaymentDecisionKind = "VERIFY" | "REJECT" | "REFUND";

interface PaymentDecision {
  kind: PaymentDecisionKind;
  item: BankTransferPayment;
}

function statusLabel(status: string): string {
  return PAYMENT_STATUSES.find(([value]) => value === status)?.[1] ?? status.replaceAll("_", " ");
}

function money(amount: number): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
}

export default function AdminPaymentsPage() {
  const [items, setItems] = useState<BankTransferPayment[]>([]);
  const [status, setStatus] = useState("PENDING_VERIFICATION");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<PaymentDecision | null>(null);
  const [decisionPending, setDecisionPending] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const loadRequestRef = useRef(0);
  const decisionPendingRef = useRef(false);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true); setError(null);
    try {
      const result = await adminListPayments({ status: status || undefined, page, size: 20 });
      if (requestId !== loadRequestRef.current) return;
      setItems(result.content); setTotal(result.totalElements); setTotalPages(result.totalPages);
    } catch (reason) {
      if (requestId !== loadRequestRef.current) return;
      setError(describeAdminError(reason).description);
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
    return () => { loadRequestRef.current += 1; };
  }, [load]);

  const openDecision = (kind: PaymentDecisionKind, item: BankTransferPayment): void => {
    setDecisionError(null);
    setDecision({ kind, item });
  };

  const closeDecision = (): void => {
    if (decisionPendingRef.current) return;
    setDecision(null);
    setDecisionError(null);
  };

  // Single-submit guard: the ref blocks re-entry even if the handler is invoked twice.
  const submitDecision = async (values: Record<string, string>): Promise<void> => {
    const current = decision;
    if (!current || decisionPendingRef.current) return;
    decisionPendingRef.current = true;
    setDecisionPending(true);
    setDecisionError(null);
    try {
      if (current.kind === "REFUND") {
        await adminRefundPayment(current.item.id, values.reference ?? "");
      } else {
        await adminReviewPayment(current.item.id, current.kind, current.kind === "REJECT" ? values.reason ?? "" : undefined);
      }
      setDecision(null);
      await load();
    } catch (cause) {
      setDecisionError(describeAdminError(cause).description);
    } finally {
      decisionPendingRef.current = false;
      setDecisionPending(false);
    }
  };

  const decisionItem = decision?.item ?? null;

  return (
    <div>
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-bold text-slate-950">Đối soát chuyển khoản</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Chỉ xác nhận sau khi giao dịch xuất hiện trên sao kê tài khoản bệnh viện. Mã người dùng nhập không tự động chứng minh đã thanh toán.</p>
      </header>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm font-semibold">Trạng thái<select className="mt-1 block min-h-11 rounded-lg border border-slate-300 px-3" onChange={(event) => { setStatus(event.target.value); setPage(0); }} value={status}><option value="">Tất cả</option>{PAYMENT_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="flex items-center gap-4"><span className="text-sm text-slate-600">Tổng cộng <strong>{total.toLocaleString("vi-VN")}</strong></span><button className="text-sm font-bold text-teal-800 underline" disabled={loading} onClick={() => void load()} type="button">Làm mới</button></div>
      </div>
      {error ? <div className="mt-4"><AdminState tone="error" title="Không thể xử lý thanh toán" description={error} /></div> : null}
      {loading ? <div className="mt-4"><AdminState tone="loading" title="Đang tải giao dịch" description="Đang lấy dữ liệu đối soát mới nhất." /></div> : null}
      {!loading && !error && items.length === 0 ? <div className="mt-4"><AdminState tone="empty" title="Không có giao dịch" description="Không có thanh toán phù hợp với trạng thái đã chọn." /></div> : null}
      {!loading && items.length > 0 ? (
        <div aria-label="Bảng đối soát thanh toán, có thể cuộn ngang trên màn hình nhỏ" className="mt-4 max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-white" role="region" tabIndex={0}>
          <table className="w-full min-w-[1050px] text-left text-sm">
            <caption className="sr-only">Danh sách giao dịch chờ bệnh viện đối soát và phê duyệt</caption>
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Lịch hẹn</th><th className="px-4 py-3">Bệnh nhân</th><th className="px-4 py-3">Số tiền</th><th className="px-4 py-3">Nội dung / mã giao dịch</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Thao tác</th></tr></thead>
            <tbody>{items.map((item) => <tr className="border-b border-slate-100 align-top last:border-0" key={item.id}>
              <td className="px-4 py-4"><strong className="font-mono text-xs">{item.bookingCode}</strong><br /><span className="text-xs text-slate-500">{formatBusinessDate(item.appointmentDate)} · {item.doctorName}</span></td>
              <td className="px-4 py-4">{item.patientName}</td>
              <td className="px-4 py-4 font-bold text-teal-900">{money(item.amount)}</td>
              <td className="px-4 py-4"><span className="font-mono text-xs">{item.transferContent}</span><br /><strong className="font-mono text-xs">{item.transactionReference || "Chưa khai báo"}</strong>{item.submittedAt ? <><br /><span className="text-xs text-slate-500">Gửi {formatBusinessDateTime(item.submittedAt)}</span></> : null}</td>
              <td className="px-4 py-4"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold">{statusLabel(item.status)}</span>{item.rejectionReason ? <p className="mt-2 max-w-xs text-xs text-red-700">{item.rejectionReason}</p> : null}</td>
              <td className="px-4 py-4">{item.status === "PENDING_VERIFICATION" ? <div className="flex gap-2"><button className="min-h-11 rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={decisionPending} onClick={() => openDecision("VERIFY", item)} type="button">Duyệt thanh toán</button><button className="min-h-11 rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50" disabled={decisionPending} onClick={() => openDecision("REJECT", item)} type="button">Từ chối</button></div> : item.status === "REFUND_PENDING" ? <button className="min-h-11 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={decisionPending} onClick={() => openDecision("REFUND", item)} type="button">Xác nhận đã hoàn</button> : item.refundReference ? <span className="font-mono text-xs">{item.refundReference}</span> : "—"}</td>
            </tr>)}</tbody>
          </table>
        </div>
      ) : null}
      <nav aria-label="Phân trang thanh toán" className="mt-5 flex justify-end gap-2"><button className="rounded-lg border px-3 text-sm disabled:opacity-40" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)} type="button">Trang trước</button><span className="inline-flex min-h-11 items-center px-3 text-sm">{totalPages === 0 ? 0 : page + 1}/{totalPages}</span><button className="rounded-lg border px-3 text-sm disabled:opacity-40" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((value) => value + 1)} type="button">Trang sau</button></nav>

      <ConfirmActionDialog
        cancelLabel="Đóng"
        confirmLabel={decision?.kind === "VERIFY" ? "Phê duyệt thanh toán" : decision?.kind === "REJECT" ? "Từ chối giao dịch" : "Xác nhận đã hoàn tiền"}
        confirmingLabel="Đang ghi nhận quyết định…"
        description={decision?.kind === "VERIFY"
          ? "Chỉ phê duyệt sau khi đối chiếu giao dịch với sao kê tài khoản bệnh viện. Thao tác này chuyển giao dịch sang “Đã thanh toán”."
          : decision?.kind === "REJECT"
            ? "Giao dịch sẽ chuyển sang “Cần kiểm tra lại” và lý do hiển thị cho bộ phận hỗ trợ. Hãy mô tả rõ vì sao không đối soát được."
            : "Giao dịch sẽ chuyển sang “Đã hoàn tiền”. Hãy đối chiếu số tiền, người thụ hưởng và mã giao dịch hoàn tiền trên sao kê ngân hàng trước khi xác nhận."}
        destructive={decision?.kind !== "VERIFY"}
        dismissOnBackdrop={false}
        entity={decisionItem ?? undefined}
        error={decisionError}
        fields={decision?.kind === "REJECT" ? [{
          name: "reason",
          label: "Lý do không đối soát được",
          description: "Tối thiểu 10 ký tự. Lý do được lưu vào hồ sơ đối soát; không ghi chẩn đoán hay thông tin sức khỏe nhạy cảm.",
          maxLength: 500,
          minLength: 10,
          multiline: true,
          placeholder: "Ví dụ: Sao kê ngày … không có giao dịch khớp số tiền và nội dung chuyển khoản.",
          required: true,
        }] : decision?.kind === "REFUND" ? [{
          label: "Mã giao dịch hoàn tiền từ ngân hàng",
          name: "reference",
          pattern: "[A-Za-z0-9][A-Za-z0-9._-]{3,59}",
          patternHint: "Chỉ nhập mã in trên sao kê hoàn tiền của ngân hàng (4–60 ký tự: chữ, số, dấu chấm, gạch ngang).",
          placeholder: "Ví dụ: FT2609090001",
          required: true,
        }] : []}
        onCancel={closeDecision}
        onConfirm={(values) => void submitDecision(values)}
        open={decision !== null}
        pending={decisionPending}
        summaryItems={decisionItem ? [
          { label: "Bệnh nhân", value: decisionItem.patientName },
          { label: "Số tiền", value: money(decisionItem.amount) },
          { label: "Lịch hẹn", value: `${decisionItem.bookingCode} · ${formatBusinessDate(decisionItem.appointmentDate)} · ${decisionItem.doctorName}` },
          { label: "Nội dung chuyển khoản", value: decisionItem.transferContent, mono: true },
          { label: "Mã giao dịch ngân hàng", value: decisionItem.transactionReference || "Chưa khai báo", mono: true },
          { label: "Trạng thái hiện tại", value: statusLabel(decisionItem.status) },
          { label: "Mã hồ sơ đối soát", value: decisionItem.id, mono: true },
        ] : []}
        summaryLabel="Giao dịch đang xét duyệt"
        title={decision?.kind === "VERIFY" ? "Phê duyệt thanh toán" : decision?.kind === "REJECT" ? "Từ chối đối soát giao dịch" : "Xác nhận hoàn tiền cho bệnh nhân"}
      />
    </div>
  );
}
