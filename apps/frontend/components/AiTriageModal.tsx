"use client";

import React, { useState } from "react";
import { performAiTriage } from "../lib/api";
import { AiTriageResult } from "../types/hospital";
import Icon from "./UiIcon";

interface AiTriageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSpecialtyForBooking: (specialtyName: string) => void;
}

export default function AiTriageModal({
  isOpen,
  onClose,
  onSelectSpecialtyForBooking,
}: AiTriageModalProps) {
  const [symptoms, setSymptoms] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AiTriageResult | null>(null);

  if (!isOpen) return null;

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptoms.trim()) return;

    setLoading(true);
    try {
      const triage = await performAiTriage(symptoms);
      setResult(triage);
    } catch {
      // Fallback
      setResult({
        recommendedSpecialty: "Gói Khám Sức Khỏe Tổng Quát Toàn Diện",
        urgencyLevel: "NORMAL",
        advice: "Khuyến nghị đến khám đa khoa tổng quát để bác sĩ kiểm tra lâm sàng trực tiếp.",
        suggestedQuestions: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBookNow = () => {
    if (result) {
      onSelectSpecialtyForBooking(result.recommendedSpecialty);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-triage-title"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-brand-100 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-900 via-brand-800 to-brand-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Icon name="sparkles" size={24} />
            <div>
              <h3 id="ai-triage-title" className="text-lg font-bold text-white">
                Trợ Lý Y Tế AI: Phân Luồng Triệu Chứng
              </h3>
              <p className="text-xs text-brand-200">Bản demo local · gợi ý tham khảo, không thay thế chẩn đoán của bác sĩ</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            aria-label="Đóng trợ lý triệu chứng"
          >
            <Icon name="x" size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <form onSubmit={handleAnalyze} className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700" htmlFor="triage-symptoms">
              Mô tả cảm giác hoặc triệu chứng khó chịu của bạn:
            </label>
            <textarea
              rows={3}
              id="triage-symptoms"
              required
              placeholder="Ví dụ: Tôi bị đau thắt ngực trái kèm khó thở khi leo cầu thang 2 ngày nay..."
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-600 focus:outline-none text-sm text-gray-900"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || !symptoms.trim()}
                className="px-6 py-2.5 bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-bold rounded-full text-xs shadow-md transition-colors flex items-center gap-2"
              >
                {loading ? "⏳ Đang phân tích triệu chứng..." : "✨ Phân tích & Gợi ý chuyên khoa"}
              </button>
            </div>
          </form>

          {/* Result Box */}
          {result && (
            <div className="p-4 bg-brand-50 border border-brand-200 rounded-xl space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-brand-900 uppercase tracking-wider">
                  Chuyên khoa khuyến nghị
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                    result.urgencyLevel === "EMERGENCY"
                      ? "bg-red-100 text-red-700 border border-red-300"
                      : result.urgencyLevel === "HIGH"
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  }`}
                >
                  {result.urgencyLevel === "EMERGENCY"
                    ? "CẦN KHÁM GẤP"
                    : result.urgencyLevel === "HIGH"
                    ? "ƯU TIÊN KHÁM SỚM"
                    : "MỨC ĐỘ THƯỜNG"}
                </span>
              </div>

              <h4 className="text-base font-extrabold text-brand-950">
                <Icon name="stethoscope" size={18} /> {result.recommendedSpecialty}
              </h4>

              <p className="text-xs text-gray-700 leading-relaxed bg-white/80 p-3 rounded-lg border border-brand-100">
                💡 <span className="font-semibold">Lời khuyên y khoa:</span> {result.advice}
              </p>

              <div className="pt-2 flex items-center justify-between border-t border-brand-100">
                <span className="text-[11px] text-gray-500">
                  *Kết quả mang tính tham khảo sơ bộ.
                </span>
                <button
                  type="button"
                  onClick={handleBookNow}
                  className="px-5 py-2 bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold rounded-full shadow-md transition-colors flex items-center gap-1.5"
                >
                  <span>Đặt khám chuyên khoa này</span> <Icon name="arrow-right" size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



