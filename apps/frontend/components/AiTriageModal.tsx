"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ApiError, recommendSpecialty } from "../lib/api-client";
import type {
  AiTriageCitation,
  AiTriageProvenance,
  AiTriageResult,
} from "../types/hospital";
import Icon from "./UiIcon";

interface AiTriageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSpecialtyForBooking: (specialtyName: string, specialtyId?: string) => void;
}

type TriageErrorKind = "login" | "forbidden" | "unavailable" | "error";

const TRIAGE_ERROR_COPY: Record<
  TriageErrorKind,
  { title: string; description: string }
> = {
  login: {
    title: "Cần đăng nhập (401)",
    description: "Đăng nhập để gửi mô tả triệu chứng tới dịch vụ AI của hệ thống.",
  },
  forbidden: {
    title: "Không có quyền truy cập (403)",
    description: "Tài khoản hiện tại chưa được phép sử dụng trợ lý triệu chứng.",
  },
  unavailable: {
    title: "Dịch vụ AI tạm thời không khả dụng",
    description: "Chưa thể nhận kết quả từ backend. Không có kết quả thay thế được tạo trên trình duyệt.",
  },
  error: {
    title: "Không thể nhận kết quả AI",
    description: "Phản hồi từ dịch vụ AI chưa hợp lệ. Vui lòng thử lại sau.",
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
    : "Thông tin nguồn từ backend";
}

function citationDetails(citation: AiTriageCitation): { label: string; href?: string } {
  if (typeof citation === "string") return { label: citation };

  const href = typeof citation.url === "string" && /^https?:\/\//i.test(citation.url)
    ? citation.url
    : undefined;
  return { label: scalarLabel(citation), href };
}

function provenanceLabel(provenance: AiTriageProvenance): string {
  return typeof provenance === "string" ? provenance : scalarLabel(provenance);
}

export default function AiTriageModal({
  isOpen,
  onClose,
  onSelectSpecialtyForBooking,
}: AiTriageModalProps) {
  const [symptoms, setSymptoms] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AiTriageResult | null>(null);
  const [errorKind, setErrorKind] = useState<TriageErrorKind | null>(null);

  if (!isOpen) return null;

  const handleAnalyze = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedSymptoms = symptoms.trim();
    if (!normalizedSymptoms) {
      setErrorKind("error");
      setResult(null);
      return;
    }

    setLoading(true);
    setResult(null);
    setErrorKind(null);
    try {
      const triage = await recommendSpecialty(normalizedSymptoms);
      setResult(triage);
    } catch (error) {
      setResult(null);
      setErrorKind(classifyTriageError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleBookNow = () => {
    if (result) {
      onSelectSpecialtyForBooking(result.recommendedSpecialty, result.recommendedSpecialtyId);
      onClose();
    }
  };

  const errorCopy = errorKind ? TRIAGE_ERROR_COPY[errorKind] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-triage-title"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl border border-brand-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-brand-900 px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <Icon name="sparkles" size={24} />
            <div>
              <h3 id="ai-triage-title" className="text-lg font-bold text-white">
                Trợ Lý Y Tế AI: Phân Luồng Triệu Chứng
              </h3>
              <p className="text-xs text-brand-200">
                Bản demo · kết quả từ dịch vụ AI, không thay thế chẩn đoán của bác sĩ
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

        <div className="space-y-4 p-6">
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
              Nội dung chỉ được gửi tới backend khi bạn bấm phân tích; không đưa triệu chứng vào URL hoặc log của giao diện.
            </p>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || !symptoms.trim()}
                className="flex items-center gap-2 rounded-full bg-brand-700 px-6 py-2.5 text-xs font-bold text-white shadow-md transition-colors hover:bg-brand-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                {loading ? <><Icon name="clock" size={15} /> Đang gửi tới dịch vụ AI...</> : <><Icon name="sparkles" size={15} /> Phân tích & Gợi ý chuyên khoa</>}
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
            </div>
          ) : null}

          {result ? (
            <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50 p-4 animate-fadeIn">
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
                  ? "Đề xuất đã được backend đối chiếu với chuyên khoa active."
                  : "Đề xuất chưa được đối chiếu với catalog active; nút đặt lịch sẽ mở luồng chung để bạn tự chọn."}
              </p>

              <p className="flex items-start gap-2 rounded-lg border border-brand-100 bg-white/80 p-3 text-xs leading-relaxed text-gray-700">
                <Icon name="sparkles" size={15} /> <span><span className="font-semibold">Lời khuyên từ dịch vụ AI:</span> {result.advice}</span>
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
                  <p className="font-bold text-brand-900">Nguồn tham khảo từ backend</p>
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

              {result.provenance ? (
                <p className="text-[11px] text-gray-500">
                  <span className="font-semibold text-gray-700">Provenance:</span> {provenanceLabel(result.provenance)}
                </p>
              ) : null}

              <p className="flex items-start gap-2 rounded-lg bg-white/70 p-3 text-[11px] leading-relaxed text-gray-600">
                <Icon name="alert-triangle" size={14} /> <span>{result.disclaimer ?? "Kết quả chỉ mang tính tham khảo và không thay thế thăm khám trực tiếp."}</span>
              </p>

              <div className="flex flex-col gap-3 border-t border-brand-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[11px] text-gray-500">Hãy trao đổi lại với nhân viên y tế trước khi quyết định.</span>
                <button
                  type="button"
                  onClick={handleBookNow}
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-brand-700 px-5 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600"
                >
                  <span>Đặt khám chuyên khoa này</span> <Icon name="arrow-right" size={16} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
