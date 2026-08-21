"use client";

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
  type AdminArticle,
  type Faq,
  type HealthPackage,
} from "../../../lib/api-client";
import AdminState from "../_components/AdminState";
import { describeAdminError } from "../_lib/errors";

const inputClass = "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm";
const buttonClass = "rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50";
const secondaryButtonClass = "rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700";

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
  title: string;
  slug: string;
  summary: string;
  body: string;
  active: boolean;
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
  title: "",
  slug: "",
  summary: "",
  body: "",
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-teal-700">
        ADMIN READ CONTRACT
      </p>
      <h2 className="mt-2 text-xl font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      {children}
    </section>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      {active ? "Active" : "Inactive"}
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

function articleFormFrom(item: AdminArticle): ArticleForm {
  return {
    title: item.title,
    slug: item.slug,
    summary: item.summary ?? "",
    body: item.body ?? "",
    active: item.active ?? Boolean(item.publishedAt),
  };
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
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [packagePage, faqPage, articlePage] = await Promise.all([
        adminListPackages(0, 100),
        adminListFaqs(0, 100),
        adminListArticles(0, 100),
      ]);
      setPackages(packagePage.content);
      setFaqs(faqPage.content);
      setArticles(articlePage.content);
    } catch (error) {
      setMessage(describeAdminError(error).description);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = Promise.resolve().then(load);
    return () => void task;
  }, [load]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      await load();
      return true;
    } catch (error) {
      const copy = describeAdminError(error);
      setMessage(`${copy.title}: ${copy.description}`);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const savePackage = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      name: packageForm.name.trim(),
      slug: packageForm.slug.trim(),
      description: packageForm.description.trim() || null,
      price: Number(packageForm.price),
      active: packageForm.active,
    };
    const saved = await run(
      () => editingPackage ? adminUpdatePackage(editingPackage, payload) : adminCreatePackage(payload),
      "Đã lưu gói khám.",
    );
    if (saved) {
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
      setFaqForm(emptyFaqForm);
    }
  };

  const saveArticle = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      title: articleForm.title.trim(),
      slug: articleForm.slug.trim(),
      summary: articleForm.summary.trim() || null,
      body: articleForm.body.trim() || null,
      active: articleForm.active,
    };
    const saved = await run(
      () => editingArticle ? adminUpdateArticle(editingArticle, payload) : adminCreateArticle(payload),
      "Đã lưu bài viết.",
    );
    if (saved) {
      setArticleForm(emptyArticleForm);
      setEditingArticle(null);
    }
  };

  return (
    <div>
      <header className="border-b border-slate-200 pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">ADMIN CATALOG</p>
        <h1 className="mt-2 text-3xl font-bold">Gói khám, FAQ và bài viết</h1>
        <p className="mt-2 text-sm text-slate-600">
          Quản lý toàn bộ catalog còn lại qua API ADMIN. Inactive và unpublished vẫn hiển thị
          trong admin để không mất trạng thái khi chỉnh sửa.
        </p>
      </header>

      {message ? (
        <p className="mt-5 rounded-xl bg-slate-100 p-3 text-sm" role="status">
          {message}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-6">
          <AdminState description="Đang đọc catalog từ backend." title="Đang tải nội dung" tone="loading" />
        </div>
      ) : null}

      {!loading ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <Panel
            description="Đọc bằng adminListPackages để thấy cả gói khám inactive."
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
                Đang hiển thị public
              </label>
              <div className="flex flex-wrap gap-2">
                <button className={buttonClass} disabled={busy} type="submit">
                  Lưu gói khám
                </button>
                {editingPackage ? (
                  <button
                    className={secondaryButtonClass}
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
              {packages.map((item) => (
                <div className="rounded-xl border p-3 text-sm" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <strong>{item.name}</strong>
                    <StatusBadge active={item.active ?? true} />
                  </div>
                  <p>{item.price.toLocaleString("vi-VN")} đ</p>
                  <button
                    className="mr-3 text-teal-800 underline"
                    onClick={() => {
                      setEditingPackage(item.slug);
                      setPackageForm(packageFormFrom(item));
                    }}
                    type="button"
                  >
                    Sửa
                  </button>
                  <button
                    className="text-red-700 underline"
                    onClick={() => void run(() => adminDeletePackage(item.slug), "Đã xóa gói khám.")}
                    type="button"
                  >
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            description="Đọc bằng adminListFaqs để giữ được FAQ inactive trong màn hình quản trị."
            title={faqForm.id ? "Sửa FAQ" : "FAQ"}
          >
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
                Đang hiển thị public
              </label>
              <div className="flex flex-wrap gap-2">
                <button className={buttonClass} disabled={busy} type="submit">
                  Lưu FAQ
                </button>
                {faqForm.id ? (
                  <button className={secondaryButtonClass} onClick={() => setFaqForm(emptyFaqForm)} type="button">
                    Hủy sửa
                  </button>
                ) : null}
              </div>
            </form>
            <div className="mt-5 space-y-2">
              {faqs.map((item) => (
                <div className="rounded-xl border p-3 text-sm" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <strong>{item.question}</strong>
                    <StatusBadge active={item.active ?? true} />
                  </div>
                  <p className="line-clamp-2">{item.answer}</p>
                  <button
                    className="mr-3 text-teal-800 underline"
                    onClick={() => setFaqForm(faqFormFrom(item))}
                    type="button"
                  >
                    Sửa
                  </button>
                  <button
                    className="text-red-700 underline"
                    onClick={() => void run(() => adminDeleteFaq(item.id), "Đã xóa FAQ.")}
                    type="button"
                  >
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            description="Đọc bằng adminListArticles để bài chưa publish vẫn chỉnh được trong admin."
            title={editingArticle ? "Sửa bài viết" : "Bài viết"}
          >
            <form className="mt-4 space-y-3" onSubmit={saveArticle}>
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
                Tóm tắt
                <textarea
                  className={inputClass}
                  value={articleForm.summary}
                  onChange={(event) => setArticleForm({ ...articleForm, summary: event.target.value })}
                />
              </label>
              <label className="block text-sm font-semibold">
                Nội dung
                <textarea
                  className={inputClass}
                  rows={7}
                  value={articleForm.body}
                  onChange={(event) => setArticleForm({ ...articleForm, body: event.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  checked={articleForm.active}
                  onChange={(event) => setArticleForm({ ...articleForm, active: event.target.checked })}
                  type="checkbox"
                />
                Đang publish public
              </label>
              <div className="flex flex-wrap gap-2">
                <button className={buttonClass} disabled={busy} type="submit">
                  Lưu bài viết
                </button>
                {editingArticle ? (
                  <button
                    className={secondaryButtonClass}
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
              {articles.map((item) => {
                const active = item.active ?? Boolean(item.publishedAt);

                return (
                  <div className="rounded-xl border p-3 text-sm" key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <strong>{item.title}</strong>
                      <StatusBadge active={active} />
                    </div>
                    <p>{item.slug}</p>
                    {!active ? <p className="text-xs font-semibold text-amber-700">Unpublished</p> : null}
                    <button
                      className="mr-3 text-teal-800 underline"
                      onClick={() => {
                        setEditingArticle(item.slug);
                        setArticleForm(articleFormFrom(item));
                      }}
                      type="button"
                    >
                      Sửa
                    </button>
                    <button
                      className="text-red-700 underline"
                      onClick={() => void run(() => adminDeleteArticle(item.slug), "Đã xóa bài viết.")}
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
