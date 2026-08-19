"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { ApiError, recommendSpecialty } from "../lib/api-client";
import type {
  AiTriageCitation,
  AiTriageResult,
} from "../types/hospital";
import Icon from "./UiIcon";
import useDialogFocus from "./useDialogFocus";

interface AiTriageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSpecialtyForBooking: (specialtyName: string, specialtyId?: string) => void;
  emergencyContact?: string;
}

type TriageErrorKind = "login" | "forbidden" | "unavailable" | "error";

const TRIAGE_ERROR_COPY: Record<
  TriageErrorKind,
  { title: string; description: string }
> = {
  login: {
    title: "Vui lòng đăng nhập",
    description: "Đăng nhập để sử dụng công cụ hỗ trợ chọn chuyên khoa.",
  },
  forbidden: {
    title: "Chưa thể sử dụng tính năng này",
    description: "Tài khoản hiện tại chưa được cấp quyền sử dụng công cụ hỗ trợ.",
  },
  unavailable: {
    title: "Tạm thời chưa thể xử lý",
    description: "Vui lòng thử lại sau hoặc chọn chuyên khoa trực tiếp từ danh mục.",
  },
  error: {
    title: "Chưa thể đưa ra gợi ý",
    description: "Vui lòng kiểm tra nội dung mô tả và thử lại.",
  },
};

function classifyTriageError(error: unknown): TriageErrorKind {
  if (error instanceof ApiError) {
    if (error.status === 401) return "login";
    if (error.status === 403) return "forbidden";
    if (error.status >= 500 || error.status === 408 || error.status === 429) {
      return "unavailable";
    }
    return "error";
  }
  return "unavailable";
}

function scalarLabel(value: Record<string, unknown>): string {
  const preferredKeys = ["title", "label", "name", "source", "citation", "text"];
  for (const key of preferredKeys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }

  const scalarEntries = Object.entries(value).filter(
    ([key, candidate]) =>
      key !== "url" &&
      (typeof candidate === "string" ||
        typeof candidate === "number" ||
        typeof candidate === "boolean"),
  );
  return scalarEntries.length > 0
    ? scalarEntries.map(([key, candidate]) => `${key}: ${String(candidate)}`).join(" · ")
    : "Nguồn tham khảo";
}

function citationDetails(citation: AiTriageCitation): { label: string; href?: string } {
  if (typeof citation === "string") return { label: citation };

  const href = typeof citation.url === "string" && /^https?:\/\//i.test(citation.url)
    ? citation.url
    : undefined;
  return { label: scalarLabel(citation), href };
}

function safeTelephoneHref(value?: string): string | null {
  const normalized = value?.trim().replace(/[^\d+]/g, "") ?? "";
  return /^\+?\d{6,15}$/.test(normalized) ? `tel:${normalized}` : null;
}

export default function AiTriageModal({
  isOpen,
  onClose,
  onSelectSpecialtyForBooking,
  emergencyContact,
}: AiTriageModalProps) {
  const [symptoms, setSymptoms] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AiTriageResult | null>(null);
  const [errorKind, setErrorKind] = useState<TriageErrorKind | null>(null);
  const [lastSubmittedSymptoms, setLastSubmittedSymptoms] = useState<string>("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const analysisRequestRef = useRef(0);

  useDialogFocus(dialogRef, isOpen, onClose);

  if (!isOpen) return null;

  const analyzeSymptoms = async (normalizedSymptoms: string) => {
    const requestId = ++analysisRequestRef.current;
    setLoading(true);
    setResult(null);
    setErrorKind(null);
    try {
      const triage = await recommendSpecialty(normalizedSymptoms);
      if (requestId !== analysisRequestRef.current) return;
      setResult(triage);
    } catch (error) {
      if (requestId !== analysisRequestRef.current) return;
      setResult(null);
      setErrorKind(classifyTriageError(error));
    } finally {
      if (requestId === analysisRequestRef.current) setLoading(false);
    }
  };

  const handleAnalyze = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedSymptoms = symptoms.trim();
    if (!normalizedSymptoms) {
      setErrorKind("error");
      setResult(null);
      return;
    }
    setLastSubmittedSymptoms(normalizedSymptoms);
    await analyzeSymptoms(normalizedSymptoms);
  };

  const handleRetry = async () => {
    if (!lastSubmittedSymptoms) return;
    await analyzeSymptoms(lastSubmittedSymptoms);
  };

  const handleBookNow = () => {
    if (result && result.urgencyLevel !== "EMERGENCY") {
      onSelectSpecialtyForBooking(result.recommendedSpecialty, result.recommendedSpecialtyId);
      onClose();
    }
  };

  const errorCopy = errorKind ? TRIAGE_ERROR_COPY[errorKind] : null;
  const emergencyHref = safeTelephoneHref(emergencyContact);

  return (
    <div
      className="dialog-layer ai-triage-layer fixed inset-0 flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-triage-title"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="ai-triage-panel relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl border border-brand-100 bg-white shadow-2xl" ref={dialogRef}>
        <div className="ai-triage-panel__header flex items-center justify-between bg-brand-900 px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <Icon name="stethoscope" size={24} />
            <div>
              <h3 id="ai-triage-title" className="text-lg font-bold text-white">
                Hỗ trợ chọn chuyên khoa
              </h3>
              <p className="text-xs text-brand-200">
                Gợi ý chỉ mang tính tham khảo, không thay thế chẩn đoán của bác sĩ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-200"
            aria-label="Đóng trợ lý triệu chứng"
          >
            <Icon name="x" size={17} />
          </button>
        </div>

        <div className="ai-triage-panel__content space-y-4 p-6">
          <form onSubmit={handleAnalyze} className="space-y-3" aria-busy={loading}>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700" htmlFor="triage-symptoms">
              Mô tả cảm giác hoặc triệu chứng khó chịu của bạn:
            </label>
            <textarea
              rows={3}
              id="triage-symptoms"
              required
              maxLength={10000}
              placeholder="Ví dụ: Tôi bị đau thắt ngực trái kèm khó thở khi leo cầu thang 2 ngày nay..."
              value={symptoms}
              onChange={(event) => setSymptoms(event.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-gray-50 p-3 text-sm text-gray-900 focus:ring-2 focus:ring-brand-600 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-300"
              aria-describedby="triage-privacy-note"
            />
            <p id="triage-privacy-note" className="text-[11px] leading-relaxed text-gray-500">
              Nội dung chỉ được xử lý khi bạn chủ động yêu cầu gợi ý và không xuất hiện trong đường dẫn trang.
            </p>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || !symptoms.trim()}
                className="flex items-center gap-2 rounded-lg bg-brand-700 px-6 py-2.5 text-xs font-bold text-white shadow-md transition-colors hover:bg-brand-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                {loading ? <><Icon name="clock" size={15} /> Đang xem xét thông tin...</> : <><Icon name="stethoscope" size={15} /> Xem gợi ý chuyên khoa</>}
              </button>
            </div>
          </form>

          {errorCopy ? (
            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert" aria-live="assertive">
              <p className="font-bold">{errorCopy.title}</p>
              <p>{errorCopy.description}</p>
              {errorKind === "login" ? (
                <Link
                  className="inline-flex min-h-11 items-center font-bold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
                  href="/auth/login?next=%2F"
                >
                  Đăng nhập để tiếp tục
                </Link>
              ) : null}
              {errorKind === "unavailable" || errorKind === "error" ? (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={loading || !lastSubmittedSymptoms}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-800 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <Icon name="activity" size={15} /> Thử lại với mô tả vừa gửi
                </button>
              ) : null}
            </div>
          ) : null}

          {result ? (
            <div
              aria-atomic="true"
              aria-live={result.urgencyLevel === "EMERGENCY" ? "assertive" : "polite"}
              className="space-y-3 rounded-xl border border-brand-200 bg-brand-50 p-4 animate-fadeIn"
              role={result.urgencyLevel === "EMERGENCY" ? "alert" : "status"}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-900">
                  Chuyên khoa khuyến nghị
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${
                    result.urgencyLevel === "EMERGENCY"
                      ? "border-red-300 bg-red-100 text-red-700"
                      : result.urgencyLevel === "HIGH"
                        ? "border-amber-300 bg-amber-100 text-amber-800"
                        : "border-emerald-300 bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {result.urgencyLevel === "EMERGENCY"
                    ? "CẦN KHÁM GẤP"
                    : result.urgencyLevel === "HIGH"
                      ? "ƯU TIÊN KHÁM SỚM"
                      : "MỨC ĐỘ THƯỜNG"}
                </span>
              </div>

              <h4 className="flex items-center gap-2 text-base font-extrabold text-brand-950">
                <Icon name="stethoscope" size={18} /> {result.recommendedSpecialty}
              </h4>

              <p className="text-[11px] text-gray-600">
                {result.recommendedSpecialtyId && result.specialtyResolution === "RESOLVED"
                  ? "Chuyên khoa này hiện có trong danh mục đặt lịch."
                  : "Bạn có thể mở biểu mẫu đặt lịch và tự chọn chuyên khoa phù hợp."}
              </p>

              <p className="flex items-start gap-2 rounded-lg border border-brand-100 bg-white/80 p-3 text-xs leading-relaxed text-gray-700">
                <Icon name="stethoscope" size={15} /> <span><span className="font-semibold">Thông tin tham khảo:</span> {result.advice}</span>
              </p>

              {result.suggestedQuestions.length > 0 ? (
                <div className="rounded-lg border border-brand-100 bg-white/60 p-3 text-xs text-gray-700">
                  <p className="font-semibold text-brand-900">Câu hỏi nên trao đổi với bác sĩ</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {result.suggestedQuestions.map((question) => <li key={question}>{question}</li>)}
                  </ul>
                </div>
              ) : null}

              {result.citations?.length ? (
                <div className="border-t border-brand-100 pt-3 text-[11px] text-gray-600">
                  <p className="font-bold text-brand-900">Nguồn tham khảo</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {result.citations.map((citation, index) => {
                      const details = citationDetails(citation);
                      return (
                        <li key={`${details.label}-${index}`}>
                          {details.href ? (
                            <a className="underline underline-offset-2" href={details.href} rel="noreferrer" target="_blank">
                              {details.label}
                            </a>
                          ) : details.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              <p className="flex items-start gap-2 rounded-lg bg-white/70 p-3 text-[11px] leading-relaxed text-gray-600">
                <Icon name="alert-triangle" size={14} /> <span>{result.disclaimer ?? "Kết quả chỉ mang tính tham khảo và không thay thế thăm khám trực tiếp."}</span>
              </p>

              {result.urgencyLevel === "EMERGENCY" ? (
                <div className="space-y-3 border-t border-red-200 pt-3">
                  <p className="text-xs font-bold leading-relaxed text-red-800">
                    Dấu hiệu được mô tả cần được đánh giá y tế khẩn cấp. Không chờ lịch hẹn trực tuyến; hãy đến cơ sở cấp cứu gần nhất.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {emergencyHref ? (
                      <a
                        className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-red-700 px-5 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300 focus-visible:ring-2 focus-visible:ring-red-600"
                        href={emergencyHref}
                      >
                        <Icon name="phone" size={16} /> Gọi hotline cấp cứu · {emergencyContact}
                      </a>
                    ) : null}
                    <Link
                      className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-white px-5 py-2 text-xs font-bold text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300 focus-visible:ring-2 focus-visible:ring-red-500"
                      href="/branches"
                      onClick={onClose}
                    >
                      Xem cơ sở gần nhất <Icon name="arrow-right" size={16} />
                    </Link>
                  </div>
                  {!emergencyHref ? <p className="text-[11px] text-red-700">Backend chưa cung cấp số hotline cấp cứu cho các cơ sở hiện tại.</p> : null}
                </div>
              ) : (
                <div className="flex flex-col gap-3 border-t border-brand-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[11px] text-gray-500">Hãy trao đổi lại với nhân viên y tế trước khi quyết định.</span>
                  <button
                    type="button"
                    onClick={handleBookNow}
                    className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-brand-700 px-5 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600"
                  >
                    <span>Đặt khám chuyên khoa này</span> <Icon name="arrow-right" size={16} />
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
