"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  adminCreateArticle,
  adminCreateFaq,
  adminCreatePackage,
  adminDeleteArticle,
  adminDeleteFaq,
  adminDeletePackage,
  adminListArticles,
  adminListFaqs,
  adminListPackages,
  adminUpdateArticle,
  adminUpdateFaq,
  adminUpdatePackage,
  type AdminArticlePayload,
  type AdminArticle,
  type Faq,
  type HealthPackage,
  fetchAllContent,
  broadcastCatalogChange,
  subscribeToCatalogChange,
} from "../../../lib/api-client";

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}
import AdminState from "../_components/AdminState";
import { describeAdminError } from "../_lib/errors";

const inputClass = "mt-1 w-full rounded-sm border border-slate-300 px-3 py-2.5 text-sm";
const buttonClass = "rounded-sm bg-teal-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50";
const secondaryButtonClass = "rounded-sm border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50";
const ADMIN_PAGE_SIZE = 100;

type Feedback = {
  tone: "success" | "error";
  title: string;
  description: string;
};

type PackageForm = {
  name: string;
  slug: string;
  description: string;
  price: string;
  active: boolean;
};

type FaqForm = {
  id: string;
  question: string;
  answer: string;
  active: boolean;
};

type ArticleForm = {
  version: number | null;
  title: string;
  slug: string;
  summary: string;
  body: string;
  contentKind: "GENERAL" | "DISEASE_GUIDE";
  category: string;
  authorName: string;
  readingMinutes: string;
  relatedSpecialtySlug: string;
  coverImageUrl: string;
  seoTitle: string;
  seoDescription: string;
  tags: string;
  scheduledPublishAt: string;
  sections: ArticleSectionForm[];
  contentLanguage: string;
  audience: string;
  topicTags: string;
  keyTakeaways: string;
  warningSigns: string;
  preventionTips: string;
  whenToSeekCare: string;
  sourceReferences: string;
  clinicalMetadata: string;
  clinicalDisclaimer: string;
  featured: boolean;
  active: boolean;
};

type ArticleSectionForm = {
  heading: string;
  body: string;
};

const emptyPackageForm: PackageForm = {
  name: "",
  slug: "",
  description: "",
  price: "",
  active: true,
};

const emptyFaqForm: FaqForm = {
  id: "",
  question: "",
  answer: "",
  active: true,
};

const emptyArticleForm: ArticleForm = {
  version: null,
  title: "",
  slug: "",
  summary: "",
  body: "",
  contentKind: "GENERAL",
  category: "",
  authorName: "",
  readingMinutes: "",
  relatedSpecialtySlug: "",
  coverImageUrl: "",
  seoTitle: "",
  seoDescription: "",
  tags: "",
  scheduledPublishAt: "",
  sections: [],
  contentLanguage: "vi-VN",
  audience: "PATIENT",
  topicTags: "",
  keyTakeaways: "",
  warningSigns: "",
  preventionTips: "",
  whenToSeekCare: "",
  sourceReferences: "",
  clinicalMetadata: "{}",
  clinicalDisclaimer: "Thông tin chỉ nhằm giáo dục sức khỏe, không thay thế chẩn đoán hoặc tư vấn trực tiếp từ bác sĩ.",
  featured: false,
  active: true,
};

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 bg-white py-5">
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      {children}
    </section>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-md px-2.5 py-1 text-xs font-bold ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      {active ? "Đang hiển thị" : "Tạm ẩn"}
    </span>
  );
}

function packageFormFrom(item: HealthPackage): PackageForm {
  return {
    name: item.name,
    slug: item.slug,
    description: item.description ?? "",
    price: String(item.price),
    active: item.active ?? true,
  };
}

function faqFormFrom(item: Faq): FaqForm {
  return {
    id: item.id,
    question: item.question,
    answer: item.answer,
    active: item.active ?? true,
  };
}

function listFieldFrom(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.filter((entry): entry is string => typeof entry === "string").join("\n");
}

function dateTimeLocalFrom(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function metadataFrom(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "{}";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function articleSectionsFrom(value: unknown): ArticleSectionForm[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (section): section is ArticleSectionForm => Boolean(section)
      && typeof section.heading === "string"
      && typeof section.body === "string",
  );
}

function articleKindLabel(value: string | null | undefined): string {
  if (value === "DISEASE_GUIDE") return "Hướng dẫn bệnh lý";
  return "Nội dung chung";
}

function listLength(value: unknown): number {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string" && entry.trim()).length : 0;
}

function objectKeyCount(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  return Object.keys(value).length;
}

function articleFormFrom(item: AdminArticle): ArticleForm {
  return {
    version: item.version ?? null,
    title: item.title,
    slug: item.slug,
    summary: item.summary ?? "",
    body: item.body ?? "",
    contentKind: item.contentKind === "DISEASE_GUIDE" ? "DISEASE_GUIDE" : "GENERAL",
    category: item.category ?? "",
    authorName: item.authorName ?? "",
    readingMinutes: item.readingMinutes ? String(item.readingMinutes) : "",
    relatedSpecialtySlug: item.relatedSpecialtySlug ?? "",
    coverImageUrl: item.coverImageUrl ?? "",
    seoTitle: item.seoTitle ?? "",
    seoDescription: item.seoDescription ?? "",
    tags: listFieldFrom(item.tags),
    scheduledPublishAt: dateTimeLocalFrom(item.scheduledPublishAt),
    sections: articleSectionsFrom(item.sections),
    contentLanguage: item.contentLanguage ?? "vi-VN",
    audience: item.audience ?? "PATIENT",
    topicTags: listFieldFrom(item.topicTags),
    keyTakeaways: listFieldFrom(item.keyTakeaways),
    warningSigns: listFieldFrom(item.warningSigns),
    preventionTips: listFieldFrom(item.preventionTips),
    whenToSeekCare: item.whenToSeekCare ?? "",
    sourceReferences: listFieldFrom(item.sourceReferences),
    clinicalMetadata: metadataFrom(item.clinicalMetadata),
    clinicalDisclaimer: item.clinicalDisclaimer ?? emptyArticleForm.clinicalDisclaimer,
    featured: item.featured ?? false,
    active: item.active ?? Boolean(item.publishedAt),
  };
}

function listFieldTo(value: string): string[] {
  return value.split(/\r?\n|,/u).map((entry) => entry.trim()).filter(Boolean);
}

function scheduledDateToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function articleSectionAt(form: ArticleForm, index: number, patch: Partial<ArticleSectionForm>): ArticleForm {
  const sections = form.sections.map((section, currentIndex) => {
    if (currentIndex !== index) return section;
    return { ...section, ...patch };
  });
  return { ...form, sections };
}

export default function AdminCatalogPage() {
  const [packages, setPackages] = useState<HealthPackage[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [packageForm, setPackageForm] = useState<PackageForm>(emptyPackageForm);
  const [faqForm, setFaqForm] = useState<FaqForm>(emptyFaqForm);
  const [articleForm, setArticleForm] = useState<ArticleForm>(emptyArticleForm);
  const [editingPackage, setEditingPackage] = useState<string | null>(null);
  const [editingArticle, setEditingArticle] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [packagePage, faqPage, articlePage] = await Promise.all([
        fetchAllContent(adminListPackages, ADMIN_PAGE_SIZE),
        fetchAllContent(adminListFaqs, ADMIN_PAGE_SIZE),
        fetchAllContent(adminListArticles, ADMIN_PAGE_SIZE),
      ]);
      setPackages(packagePage);
      setFaqs(faqPage);
      setArticles(articlePage);
      return true;
    } catch (error) {
      setLoadError(describeAdminError(error).description);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = Promise.resolve().then(load);
    const unsubscribe = subscribeToCatalogChange(() => {
      void load();
    });
    return () => {
      void task;
      unsubscribe();
    };
  }, [load]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      await action();
      const refreshed = await load();
      setFeedback({
        tone: "success",
        title: success,
        description: refreshed
          ? "Danh sách đã được cập nhật để phản ánh trạng thái mới nhất."
          : "Thay đổi đã được lưu nhưng danh sách chưa thể làm mới. Vui lòng thử lại.",
      });
      return true;
    } catch (error) {
      const copy = describeAdminError(error);
      setFeedback({ tone: "error", title: copy.title, description: copy.description });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const remove = async (
    label: string,
    action: () => Promise<unknown>,
    success: string,
    broadcast?: { kind: "package" | "faq" | "article"; slug?: string }
  ) => {
    if (!window.confirm(`Xóa ${label}? Hành động này không thể hoàn tác.`)) return;
    const ok = await run(action, success);
    if (ok && broadcast) {
      broadcastCatalogChange({ kind: broadcast.kind, action: "deleted", slug: broadcast.slug });
    }
  };

  const savePackage = async (event: FormEvent) => {
    event.preventDefault();
    if (!packageForm.name.trim()) {
      setFeedback({ tone: "error", title: "Thiếu tên gói khám", description: "Vui lòng nhập tên gói khám." });
      return;
    }
    const finalSlug = packageForm.slug.trim() || toSlug(packageForm.name);
    const payload = {
      name: packageForm.name.trim(),
      slug: finalSlug,
      description: packageForm.description.trim() || null,
      price: Number(packageForm.price),
      active: packageForm.active,
    };
    const saved = await run(
      () => editingPackage ? adminUpdatePackage(editingPackage, payload) : adminCreatePackage(payload),
      "Đã lưu gói khám.",
    );
    if (saved) {
      broadcastCatalogChange({ kind: "package", action: editingPackage ? "updated" : "created", slug: finalSlug });
      setPackageForm(emptyPackageForm);
      setEditingPackage(null);
    }
  };

  const saveFaq = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      question: faqForm.question.trim(),
      answer: faqForm.answer.trim(),
      active: faqForm.active,
    };
    const saved = await run(
      () => faqForm.id ? adminUpdateFaq(faqForm.id, payload) : adminCreateFaq(payload),
      "Đã lưu FAQ.",
    );
    if (saved) {
      broadcastCatalogChange({ kind: "faq", action: faqForm.id ? "updated" : "created" });
      setFaqForm(emptyFaqForm);
    }
  };

  const saveArticle = async (event: FormEvent) => {
    event.preventDefault();
    if (!articleForm.title.trim()) {
      setFeedback({ tone: "error", title: "Thiếu tiêu đề bài viết", description: "Vui lòng nhập tiêu đề bài viết." });
      return;
    }
    if (articleForm.active && (!articleForm.summary.trim() || !articleForm.body.trim())) {
      setFeedback({
        tone: "error",
        title: "Thiếu nội dung bài viết công khai",
        description: "Bài viết ở trạng thái hiển thị công khai (Active) yêu cầu phải có cả Tóm tắt và Nội dung. Vui lòng điền đủ tóm tắt và nội dung hoặc bỏ chọn 'Đang hiển thị công khai' nếu lưu bản nháp.",
      });
      return;
    }
    const finalSlug = articleForm.slug.trim() || toSlug(articleForm.title);
    const readingMinutes = articleForm.readingMinutes.trim() ? Number(articleForm.readingMinutes) : null;
    if (readingMinutes !== null && (!Number.isInteger(readingMinutes) || readingMinutes < 1 || readingMinutes > 180)) {
      setFeedback({ tone: "error", title: "Thời lượng đọc chưa hợp lệ", description: "Nhập số phút từ 1 đến 180." });
      return;
    }

    let clinicalMetadata: Record<string, string> | null = null;
    try {
      const parsed = JSON.parse(articleForm.clinicalMetadata || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("object");
      if (Object.entries(parsed).some(([key, value]) => typeof key !== "string" || typeof value !== "string")) {
        throw new Error("string-map");
      }
      clinicalMetadata = parsed as Record<string, string>;
    } catch {
      setFeedback({ tone: "error", title: "Metadata chưa hợp lệ", description: "Clinical metadata phải là JSON object với giá trị dạng chuỗi." });
      return;
    }

    const sections = articleForm.sections
      .map((section) => ({ heading: section.heading.trim(), body: section.body.trim() }))
      .filter((section) => section.heading && section.body);
    const payload: AdminArticlePayload = {
      title: articleForm.title.trim(),
      slug: finalSlug,
      summary: articleForm.summary.trim() || null,
      body: articleForm.body.trim() || null,
      category: articleForm.category.trim() || null,
      authorName: articleForm.authorName.trim() || null,
      readingMinutes,
      relatedSpecialtySlug: articleForm.relatedSpecialtySlug.trim() || null,
      contentKind: articleForm.contentKind,
      coverImageUrl: articleForm.coverImageUrl.trim() || null,
      seoTitle: articleForm.seoTitle.trim() || null,
      seoDescription: articleForm.seoDescription.trim() || null,
      tags: listFieldTo(articleForm.tags),
      scheduledPublishAt: scheduledDateToIso(articleForm.scheduledPublishAt),
      version: articleForm.version ?? undefined,
      sections,
      contentLanguage: articleForm.contentLanguage.trim() || null,
      audience: articleForm.audience.trim() || null,
      topicTags: listFieldTo(articleForm.topicTags),
      keyTakeaways: listFieldTo(articleForm.keyTakeaways),
      warningSigns: listFieldTo(articleForm.warningSigns),
      preventionTips: listFieldTo(articleForm.preventionTips),
      whenToSeekCare: articleForm.whenToSeekCare.trim() || null,
      sourceReferences: listFieldTo(articleForm.sourceReferences),
      clinicalMetadata,
      clinicalDisclaimer: articleForm.clinicalDisclaimer.trim() || null,
      featured: articleForm.featured,
      active: articleForm.active,
    };
    const saved = await run(
      () => editingArticle ? adminUpdateArticle(editingArticle, payload) : adminCreateArticle(payload),
      "Đã lưu bài viết.",
    );
    if (saved) {
      broadcastCatalogChange({ kind: "article", action: editingArticle ? "updated" : "created", slug: finalSlug });
      setArticleForm(emptyArticleForm);
      setEditingArticle(null);
    }
  };

  return (
    <div>
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-bold">Gói khám, FAQ và bài viết</h1>
        <p className="mt-2 text-sm text-slate-600">
          Cập nhật nội dung, mức giá và trạng thái hiển thị của các danh mục truyền thông y tế.
        </p>
      </header>

      {feedback ? <div className="mt-5"><AdminState description={feedback.description} title={feedback.title} tone={feedback.tone} /></div> : null}

      {loading ? (
        <div className="mt-6">
          <AdminState description="Vui lòng chờ trong giây lát." title="Đang tải nội dung" tone="loading" />
        </div>
      ) : null}

      {!loading && loadError ? (
        <div className="mt-6">
          <AdminState
            action={<button className={secondaryButtonClass} onClick={() => void load()} type="button">Thử lại</button>}
            description={loadError}
            title="Không thể tải danh mục"
            tone="error"
          />
        </div>
      ) : null}

      {!loading && !loadError ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <Panel
            description="Quản lý nội dung, giá và trạng thái hiển thị của từng gói khám."
            title={editingPackage ? "Sửa gói khám" : "Gói khám"}
          >
            <form className="mt-4 space-y-3" onSubmit={savePackage}>
              <label className="block text-sm font-semibold">
                Tên
                <input
                  className={inputClass}
                  required
                  value={packageForm.name}
                  onChange={(event) => setPackageForm({ ...packageForm, name: event.target.value })}
                />
              </label>
              <label className="block text-sm font-semibold">
                Slug
                <input
                  className={inputClass}
                  required
                  value={packageForm.slug}
                  onChange={(event) => setPackageForm({ ...packageForm, slug: event.target.value })}
                />
              </label>
              <label className="block text-sm font-semibold">
                Mô tả
                <textarea
                  className={inputClass}
                  value={packageForm.description}
                  onChange={(event) => setPackageForm({ ...packageForm, description: event.target.value })}
                />
              </label>
              <label className="block text-sm font-semibold">
                Giá
                <input
                  className={inputClass}
                  min="1"
                  required
                  type="number"
                  value={packageForm.price}
                  onChange={(event) => setPackageForm({ ...packageForm, price: event.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  checked={packageForm.active}
                  onChange={(event) => setPackageForm({ ...packageForm, active: event.target.checked })}
                  type="checkbox"
                />
                Đang hiển thị công khai
              </label>
              <div className="flex flex-wrap gap-2">
                <button className={buttonClass} disabled={busy} type="submit">
                  Lưu gói khám
                </button>
                {editingPackage ? (
                  <button
                    className={secondaryButtonClass}
                    disabled={busy}
                    onClick={() => {
                      setPackageForm(emptyPackageForm);
                      setEditingPackage(null);
                    }}
                    type="button"
                  >
                    Hủy sửa
                  </button>
                ) : null}
              </div>
            </form>
            <div className="mt-5 space-y-2">
              {packages.length === 0 ? <AdminState description="Tạo gói khám đầu tiên để bắt đầu danh mục." title="Chưa có gói khám" tone="empty" /> : null}
              {packages.map((item) => (
                <div className="rounded-lg border p-3 text-sm" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <strong>{item.name}</strong>
                    <StatusBadge active={item.active ?? true} />
                  </div>
                  <p>{item.price.toLocaleString("vi-VN")} đ</p>
                  <button
                    aria-label={`Sửa ${item.name}`}
                    className="mr-3 text-teal-800 underline"
                    disabled={busy}
                    onClick={() => {
                      setEditingPackage(item.slug);
                      setPackageForm(packageFormFrom(item));
                    }}
                    type="button"
                  >
                    Sửa
                  </button>
                  <button
                    aria-label={`Xóa ${item.name}`}
                    className="text-red-700 underline"
                    disabled={busy}
                    onClick={() => void remove(`gói khám "${item.name}"`, () => adminDeletePackage(item.slug), "Đã xóa gói khám", { kind: "package", slug: item.slug })}
                    type="button"
                  >
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            description="Duy trì câu hỏi thường gặp và kiểm soát nội dung đang hiển thị."
            title={faqForm.id ? "Sửa FAQ" : "FAQ"}
          >
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
              FAQ đang hiển thị công khai chưa đồng nghĩa với nguồn đã đủ điều kiện cho chatbot. Sau khi cập nhật, hãy gửi đúng revision/hash để bác sĩ độc lập review.
              <Link className="mt-2 inline-flex min-h-11 items-center font-bold text-teal-800 underline" href="/admin/ai-content-reviews">Mở luồng AI review →</Link>
            </p>
            <form className="mt-4 space-y-3" onSubmit={saveFaq}>
              <label className="block text-sm font-semibold">
                Câu hỏi
                <textarea
                  className={inputClass}
                  required
                  value={faqForm.question}
                  onChange={(event) => setFaqForm({ ...faqForm, question: event.target.value })}
                />
              </label>
              <label className="block text-sm font-semibold">
                Trả lời
                <textarea
                  className={inputClass}
                  required
                  rows={5}
                  value={faqForm.answer}
                  onChange={(event) => setFaqForm({ ...faqForm, answer: event.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  checked={faqForm.active}
                  onChange={(event) => setFaqForm({ ...faqForm, active: event.target.checked })}
                  type="checkbox"
                />
                Đang hiển thị công khai
              </label>
              <div className="flex flex-wrap gap-2">
                <button className={buttonClass} disabled={busy} type="submit">
                  Lưu FAQ
                </button>
                {faqForm.id ? (
                  <button className={secondaryButtonClass} disabled={busy} onClick={() => setFaqForm(emptyFaqForm)} type="button">
                    Hủy sửa
                  </button>
                ) : null}
              </div>
            </form>
            <div className="mt-5 space-y-2">
              {faqs.length === 0 ? <AdminState description="Tạo câu hỏi đầu tiên để hỗ trợ người bệnh." title="Chưa có câu hỏi thường gặp" tone="empty" /> : null}
              {faqs.map((item) => (
                <div className="rounded-lg border p-3 text-sm" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <strong>{item.question}</strong>
                    <StatusBadge active={item.active ?? true} />
                  </div>
                  <p className="line-clamp-2">{item.answer}</p>
                  <button
                    aria-label={`Sửa câu hỏi: ${item.question}`}
                    className="mr-3 text-teal-800 underline"
                    disabled={busy}
                    onClick={() => setFaqForm(faqFormFrom(item))}
                    type="button"
                  >
                    Sửa
                  </button>
                  <button
                    aria-label={`Xóa câu hỏi: ${item.question}`}
                    className="text-red-700 underline"
                    disabled={busy}
                    onClick={() => void remove(`câu hỏi "${item.question}"`, () => adminDeleteFaq(item.id), "Đã xóa câu hỏi", { kind: "faq" })}
                    type="button"
                  >
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            description="Biên tập bài viết và kiểm soát trạng thái xuất bản công khai."
            title={editingArticle ? "Sửa bài viết" : "Bài viết"}
          >
            <form className="mt-4 space-y-6" onSubmit={saveArticle}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-semibold">
                  Tiêu đề
                  <input
                    className={inputClass}
                    required
                    value={articleForm.title}
                    onChange={(event) => setArticleForm({ ...articleForm, title: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Slug
                  <input
                    className={inputClass}
                    required
                    value={articleForm.slug}
                    onChange={(event) => setArticleForm({ ...articleForm, slug: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Loại nội dung
                  <select
                    className={inputClass}
                    value={articleForm.contentKind}
                    onChange={(event) => setArticleForm({ ...articleForm, contentKind: event.target.value as ArticleForm["contentKind"] })}
                  >
                    <option value="GENERAL">Nội dung chung</option>
                    <option value="DISEASE_GUIDE">Hướng dẫn bệnh lý</option>
                  </select>
                </label>
                <label className="block text-sm font-semibold">
                  Chuyên khoa liên quan
                  <input
                    className={inputClass}
                    value={articleForm.relatedSpecialtySlug}
                    onChange={(event) => setArticleForm({ ...articleForm, relatedSpecialtySlug: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Danh mục
                  <input
                    className={inputClass}
                    value={articleForm.category}
                    onChange={(event) => setArticleForm({ ...articleForm, category: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Tác giả
                  <input
                    className={inputClass}
                    value={articleForm.authorName}
                    onChange={(event) => setArticleForm({ ...articleForm, authorName: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Thời lượng đọc (phút)
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    max="180"
                    min="1"
                    type="number"
                    value={articleForm.readingMinutes}
                    onChange={(event) => setArticleForm({ ...articleForm, readingMinutes: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Phiên bản optimistic
                  <input
                    className={inputClass}
                    readOnly
                    value={articleForm.version ?? "mới"}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Ảnh bìa
                  <input
                    className={inputClass}
                    value={articleForm.coverImageUrl}
                    onChange={(event) => setArticleForm({ ...articleForm, coverImageUrl: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Tiêu đề SEO
                  <input
                    className={inputClass}
                    value={articleForm.seoTitle}
                    onChange={(event) => setArticleForm({ ...articleForm, seoTitle: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Mô tả SEO
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={articleForm.seoDescription}
                    onChange={(event) => setArticleForm({ ...articleForm, seoDescription: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Lịch xuất bản
                  <input
                    className={inputClass}
                    type="datetime-local"
                    value={articleForm.scheduledPublishAt}
                    onChange={(event) => setArticleForm({ ...articleForm, scheduledPublishAt: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Ngôn ngữ nội dung
                  <input
                    className={inputClass}
                    placeholder="vi-VN"
                    value={articleForm.contentLanguage}
                    onChange={(event) => setArticleForm({ ...articleForm, contentLanguage: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold md:col-span-2">
                  Đối tượng độc giả
                  <input
                    className={inputClass}
                    placeholder="PATIENT"
                    value={articleForm.audience}
                    onChange={(event) => setArticleForm({ ...articleForm, audience: event.target.value })}
                  />
                </label>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Nội dung biên tập</h3>
                <label className="block text-sm font-semibold">
                  Tóm tắt
                  <textarea
                    className={inputClass}
                    rows={4}
                    value={articleForm.summary}
                    onChange={(event) => setArticleForm({ ...articleForm, summary: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Nội dung
                  <textarea
                    className={inputClass}
                    rows={8}
                    value={articleForm.body}
                    onChange={(event) => setArticleForm({ ...articleForm, body: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Tags
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={articleForm.tags}
                    onChange={(event) => setArticleForm({ ...articleForm, tags: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Topic tags
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={articleForm.topicTags}
                    onChange={(event) => setArticleForm({ ...articleForm, topicTags: event.target.value })}
                  />
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-slate-900">Cấu trúc bài viết</h3>
                  <button
                    className={secondaryButtonClass}
                    disabled={busy}
                    onClick={() =>
                      setArticleForm((current) => ({
                        ...current,
                        sections: [...current.sections, { heading: "", body: "" }],
                      }))
                    }
                    type="button"
                  >
                    Thêm section
                  </button>
                </div>
                {articleForm.sections.length === 0 ? (
                  <p className="text-sm text-slate-500">Chưa có section nào.</p>
                ) : null}
                {articleForm.sections.map((section, index) => (
                  <div className="space-y-3 border-t border-slate-200 pt-3" key={`${section.heading}-${index}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">Section {index + 1}</p>
                      <button
                        className="text-sm font-semibold text-red-700 underline"
                        disabled={busy}
                        onClick={() =>
                          setArticleForm((current) => ({
                            ...current,
                            sections: current.sections.filter((_, currentIndex) => currentIndex !== index),
                          }))
                        }
                        type="button"
                      >
                        Xóa section
                      </button>
                    </div>
                    <label className="block text-sm font-semibold">
                      Tiêu đề section
                      <input
                        className={inputClass}
                        value={section.heading}
                        onChange={(event) =>
                          setArticleForm((current) =>
                            articleSectionAt(current, index, { heading: event.target.value }),
                          )
                        }
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      Nội dung section
                      <textarea
                        className={inputClass}
                        rows={4}
                        value={section.body}
                        onChange={(event) =>
                          setArticleForm((current) =>
                            articleSectionAt(current, index, { body: event.target.value }),
                          )
                        }
                      />
                    </label>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-semibold">
                  Điểm nổi bật
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={articleForm.keyTakeaways}
                    onChange={(event) => setArticleForm({ ...articleForm, keyTakeaways: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Dấu hiệu cảnh báo
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={articleForm.warningSigns}
                    onChange={(event) => setArticleForm({ ...articleForm, warningSigns: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Phòng ngừa
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={articleForm.preventionTips}
                    onChange={(event) => setArticleForm({ ...articleForm, preventionTips: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Nguồn tham khảo
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={articleForm.sourceReferences}
                    onChange={(event) => setArticleForm({ ...articleForm, sourceReferences: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold md:col-span-2">
                  Khi nào cần đi khám
                  <textarea
                    className={inputClass}
                    rows={4}
                    value={articleForm.whenToSeekCare}
                    onChange={(event) => setArticleForm({ ...articleForm, whenToSeekCare: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold md:col-span-2">
                  Clinical disclaimer
                  <textarea
                    className={inputClass}
                    rows={4}
                    value={articleForm.clinicalDisclaimer}
                    onChange={(event) => setArticleForm({ ...articleForm, clinicalDisclaimer: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold md:col-span-2">
                  Clinical metadata (JSON object)
                  <textarea
                    className={inputClass}
                    rows={5}
                    value={articleForm.clinicalMetadata}
                    onChange={(event) => setArticleForm({ ...articleForm, clinicalMetadata: event.target.value })}
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    checked={articleForm.featured}
                    onChange={(event) => setArticleForm({ ...articleForm, featured: event.target.checked })}
                    type="checkbox"
                  />
                  Bài viết nổi bật
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    checked={articleForm.active}
                    onChange={(event) => setArticleForm({ ...articleForm, active: event.target.checked })}
                    type="checkbox"
                  />
                  Đang xuất bản công khai
                </label>
                <p className="text-xs text-slate-500">
                  Phiên bản optimistic hiện tại: {articleForm.version ?? "mới"}.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className={buttonClass} disabled={busy} type="submit">
                  Lưu bài viết
                </button>
                {editingArticle ? (
                  <button
                    className={secondaryButtonClass}
                    disabled={busy}
                    onClick={() => {
                      setArticleForm(emptyArticleForm);
                      setEditingArticle(null);
                    }}
                    type="button"
                  >
                    Hủy sửa
                  </button>
                ) : null}
              </div>
            </form>
            <div className="mt-5 space-y-2">
              {articles.length === 0 ? <AdminState description="Tạo bài viết đầu tiên để bắt đầu thư viện nội dung." title="Chưa có bài viết" tone="empty" /> : null}
              {articles.map((item) => {
                const active = item.active ?? Boolean(item.publishedAt);
                const metaChips = [
                  articleKindLabel(item.contentKind),
                  item.category,
                  item.authorName,
                  item.relatedSpecialtySlug ? `Chuyên khoa: ${item.relatedSpecialtySlug}` : null,
                  item.contentLanguage ? `Ngôn ngữ: ${item.contentLanguage}` : null,
                  item.audience ? `Đối tượng: ${item.audience}` : null,
                  typeof item.readingMinutes === "number" ? `${item.readingMinutes} phút đọc` : null,
                  item.featured ? "Nổi bật" : null,
                  item.version != null ? `v${item.version}` : null,
                ].filter((value): value is string => Boolean(value));
                const sectionCount = Array.isArray(item.sections) ? item.sections.length : 0;
                const tagCount = listLength(item.tags);
                const topicCount = listLength(item.topicTags);
                const metadataCount = objectKeyCount(item.clinicalMetadata);

                return (
                  <div className="rounded-lg border p-3 text-sm" key={item.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <strong className="block break-words">{item.title}</strong>
                        <p className="mt-1 text-xs text-slate-600">{item.slug}</p>
                      </div>
                      <StatusBadge active={active} />
                    </div>
                    <p className="mt-2 text-sm text-slate-700 line-clamp-2">{item.summary?.trim() || "Chưa có tóm tắt."}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {metaChips.map((chip, index) => (
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700" key={`${chip}-${index}`}>
                          {chip}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                      <p>Xuất bản: {formatDateTime(item.publishedAt)}</p>
                      <p>Lên lịch: {formatDateTime(item.scheduledPublishAt)}</p>
                      <p>Cập nhật: {formatDateTime(item.updatedAt)}</p>
                      <p>Sections: {sectionCount}</p>
                      <p>Tags: {tagCount}</p>
                      <p>Topic tags: {topicCount}</p>
                      <p>Clinical metadata: {metadataCount}</p>
                    </div>
                    {!active ? <p className="mt-2 text-xs font-semibold text-amber-700">Chưa xuất bản</p> : null}
                    <button
                      aria-label={`Sửa ${item.title}`}
                      className="mr-3 text-teal-800 underline"
                      disabled={busy}
                      onClick={() => {
                        setEditingArticle(item.slug);
                        setArticleForm(articleFormFrom(item));
                      }}
                      type="button"
                    >
                      Sửa
                    </button>
                    <button
                      aria-label={`Xóa ${item.title}`}
                      className="text-red-700 underline"
                      disabled={busy}
                      onClick={() => void remove(`bài viết "${item.title}"`, () => adminDeleteArticle(item.slug), "Đã xóa bài viết", { kind: "article", slug: item.slug })}
                      type="button"
                    >
                      Xóa
                    </button>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
