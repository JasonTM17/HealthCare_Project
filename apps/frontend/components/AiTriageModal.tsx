"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, recommendPublicSpecialty } from "../lib/api-client";
import { safeTelephoneHref } from "../lib/phone";
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

const MAX_SYMPTOM_LENGTH = 500;

const SYMPTOM_PROMPTS = [
  "Đau hoặc khó chịu ở vị trí nào?",
  "Triệu chứng bắt đầu khi nào và kéo dài bao lâu?",
  "Có sốt, khó thở, chóng mặt hoặc đau tăng nhanh không?",
] as const;

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

function citationDetails(citation: AiTriageCitation): string {
  const sourceLabel: Record<AiTriageCitation["source_type"], string> = {
    specialty: "Chuyên khoa",
    doctor: "Bác sĩ",
    service: "Dịch vụ",
    package: "Gói khám",
    article: "Bài viết",
    faq: "FAQ",
  };
  return `${sourceLabel[citation.source_type]} · ${citation.title}`;
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

  const invalidatePendingAnalysis = () => {
    analysisRequestRef.current += 1;
  };

  const clearAnalysisState = () => {
    setLoading(false);
    setResult(null);
    setErrorKind(null);
    setLastSubmittedSymptoms("");
  };

  const closeDialog = () => {
    invalidatePendingAnalysis();
    clearAnalysisState();
    onClose();
  };

  useDialogFocus(dialogRef, isOpen, closeDialog);

  useEffect(() => {
    if (isOpen) return;
    invalidatePendingAnalysis();
    const resetTimer = window.setTimeout(clearAnalysisState, 0);
    return () => window.clearTimeout(resetTimer);
  }, [isOpen]);

  if (!isOpen) return null;

  const analyzeSymptoms = async (normalizedSymptoms: string) => {
    const requestId = ++analysisRequestRef.current;
    setLoading(true);
    setResult(null);
    setErrorKind(null);
    try {
      const triage = await recommendPublicSpecialty(normalizedSymptoms);
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

  const appendSymptomPrompt = (prompt: string): void => {
    setErrorKind(null);
    setSymptoms((current) => {
      const separator = current.trim() ? "\n" : "";
      return `${current.trimEnd()}${separator}${prompt}`.slice(0, MAX_SYMPTOM_LENGTH);
    });
  };

  const handleBookNow = () => {
    if (
      result
      && result.urgencyLevel !== "EMERGENCY"
      && result.specialtyResolution === "RESOLVED"
      && result.recommendedSpecialtyId
    ) {
      onSelectSpecialtyForBooking(result.recommendedSpecialty, result.recommendedSpecialtyId);
      closeDialog();
    }
  };

  const errorCopy = errorKind ? TRIAGE_ERROR_COPY[errorKind] : null;
  const emergencyHref = safeTelephoneHref(emergencyContact);
  const remainingCharacters = MAX_SYMPTOM_LENGTH - symptoms.length;

  return (
    <div
      className="dialog-layer ai-triage-layer fixed inset-0 flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-triage-title"
      onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}
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
            onClick={closeDialog}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-200"
            aria-label="Đóng trợ lý triệu chứng"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="ai-triage-panel__content space-y-4 p-6">
          <form onSubmit={handleAnalyze} className="space-y-3" aria-busy={loading}>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700" htmlFor="triage-symptoms">
              Mô tả cảm giác hoặc triệu chứng khó chịu của bạn:
            </label>
            <p id="triage-input-help" className="text-sm leading-relaxed text-gray-600">
              Viết như đang kể cho điều dưỡng: vị trí khó chịu, thời điểm bắt đầu, mức độ đau và dấu hiệu đi kèm.
            </p>
            <div className="flex flex-wrap gap-2" aria-label="Gợi ý mô tả triệu chứng">
              {SYMPTOM_PROMPTS.map((prompt) => (
                <button
                  className="inline-flex min-h-11 items-center rounded-full border border-brand-100 bg-brand-50 px-3 py-2 text-left text-xs font-bold text-brand-900 transition-colors hover:border-brand-300 hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-500"
                  key={prompt}
                  onClick={() => appendSymptomPrompt(prompt)}
                  type="button"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <textarea
              rows={5}
              id="triage-symptoms"
              required
              maxLength={MAX_SYMPTOM_LENGTH}
              placeholder="Ví dụ: Tôi bị đau thắt ngực trái kèm khó thở khi leo cầu thang 2 ngày nay..."
              value={symptoms}
              onChange={(event) => setSymptoms(event.target.value)}
              className="min-h-32 w-full rounded-xl border border-gray-300 bg-gray-50 p-4 text-base leading-relaxed text-gray-900 focus:ring-2 focus:ring-brand-600 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-300"
              aria-describedby="triage-input-help triage-privacy-note triage-character-count"
            />
            <div className="flex flex-wrap items-start justify-between gap-2 text-xs leading-relaxed text-gray-500">
              <p id="triage-privacy-note">
                Không nhập số CCCD, mã BHYT hoặc thông tin quá riêng tư. Nội dung chỉ được xử lý khi bạn chủ động yêu cầu gợi ý.
              </p>
              <p id="triage-character-count" aria-live="polite">
                Còn {remainingCharacters} ký tự
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || !symptoms.trim()}
                className="flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-6 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-brand-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600"
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
                  : "AI chưa xác nhận được identity trong catalog live; hãy chọn chuyên khoa trực tiếp từ danh mục."}
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
                      return (
                        <li key={`${citation.source_type}-${citation.source_id}-${index}`}>
                          {citationDetails(citation)}
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
                      onClick={closeDialog}
                    >
                      Xem cơ sở gần nhất <Icon name="arrow-right" size={16} />
                    </Link>
                  </div>
                  {!emergencyHref ? <p className="text-[11px] text-red-700">Backend chưa cung cấp số hotline cấp cứu cho các cơ sở hiện tại.</p> : null}
                </div>
              ) : (
                <div className="flex flex-col gap-3 border-t border-brand-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[11px] text-gray-500">Hãy trao đổi lại với nhân viên y tế trước khi quyết định.</span>
                  {result.specialtyResolution === "RESOLVED" && result.recommendedSpecialtyId ? (
                    <button
                      type="button"
                      onClick={handleBookNow}
                      className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-brand-700 px-5 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600"
                    >
                      <span>Đặt khám chuyên khoa này</span> <Icon name="arrow-right" size={16} />
                    </button>
                  ) : (
                    <Link
                      className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-brand-300 bg-white px-5 py-2 text-xs font-bold text-brand-800 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600"
                      href="/specialties"
                      onClick={closeDialog}
                    >
                      Chọn trong danh mục <Icon name="arrow-right" size={16} />
                    </Link>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
