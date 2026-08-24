"use client";

import { useState, type FormEvent } from "react";
import {
  ApiError,
  submitAiContentRevision,
} from "../../../lib/api-client";
import type { AiContentReviewSummary, AiContentType } from "../../../types/hospital";

const TYPES: AiContentType[] = ["SPECIALTY", "ARTICLE", "FAQ"];

export default function AdminAiContentReviewsPage() {
  const [type, setType] = useState<AiContentType>("SPECIALTY");
  const [sourceId, setSourceId] = useState("");
  const [revision, setRevision] = useState("1");
  const [contentHash, setContentHash] = useState("");
  const [result, setResult] = useState<AiContentReviewSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const next = await submitAiContentRevision(type, sourceId.trim(), {
        revision: Number(revision),
        contentHash: contentHash.trim(),
      });
      setResult(next);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể gửi revision để review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="ai-review-admin-title" className="grid gap-6">
      <header>
        <p className="text-xs font-bold tracking-[0.18em] text-teal-700">AI CONTENT GOVERNANCE</p>
        <h1 className="mt-2 text-3xl font-black text-teal-950" id="ai-review-admin-title">Gửi nội dung cho bác sĩ duyệt</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Mỗi lần sửa nội dung tạo revision bất biến và trở về DRAFT. Admin chỉ submit đúng revision/hash hiện tại; không tự approve.</p>
      </header>

      <form className="grid max-w-3xl gap-4 rounded-2xl border border-teal-100 bg-white p-5 shadow-sm" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-1 text-sm font-bold text-slate-800">
            Loại nội dung
            <select className="min-h-11 rounded-lg border border-slate-300 px-3" onChange={(event) => setType(event.target.value as AiContentType)} value={type}>
              {TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-800 sm:col-span-2">
            Source ID
            <input className="min-h-11 rounded-lg border border-slate-300 px-3" onChange={(event) => setSourceId(event.target.value)} required value={sourceId} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold text-slate-800">
            Revision hiện tại
            <input className="min-h-11 rounded-lg border border-slate-300 px-3" min="1" onChange={(event) => setRevision(event.target.value)} required type="number" value={revision} />
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-800">
            SHA-256 content hash
            <input className="min-h-11 rounded-lg border border-slate-300 px-3 font-mono text-xs" minLength={16} onChange={(event) => setContentHash(event.target.value)} required value={contentHash} />
          </label>
        </div>
        {error ? <p aria-live="assertive" className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-800" role="alert">{error}</p> : null}
        <button className="min-h-11 w-fit rounded-lg bg-teal-800 px-4 text-sm font-bold text-white disabled:opacity-50" disabled={submitting} type="submit">
          {submitting ? "Đang gửi..." : "Submit revision"}
        </button>
      </form>

      {result ? (
        <section aria-live="polite" className="max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black text-teal-950">Đã gửi cho hàng đợi bác sĩ</h2>
            <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-amber-950">{result.state}</span>
          </div>
          <dl className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <div><dt className="font-bold">Revision</dt><dd>{result.revision}</dd></div>
            <div><dt className="font-bold">Hash</dt><dd className="break-all font-mono text-xs">{result.contentHash}</dd></div>
          </dl>
        </section>
      ) : null}
    </section>
  );
}
