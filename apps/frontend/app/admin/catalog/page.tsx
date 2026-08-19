"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  adminCreateArticle, adminCreateFaq, adminCreatePackage,
  adminDeleteArticle, adminDeleteFaq, adminDeletePackage,
  adminUpdateArticle, adminUpdateFaq, adminUpdatePackage,
  fetchArticles, fetchFaqs, fetchPackages,
  type Article, type Faq, type HealthPackage,
} from "../../../lib/api-client";
import AdminState from "../_components/AdminState";
import { describeAdminError } from "../_lib/errors";

const inputClass = "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm";
const buttonClass = "rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50";

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-bold text-slate-900">{title}</h2>{children}</section>;
}

export default function AdminCatalogPage() {
  const [packages, setPackages] = useState<HealthPackage[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [packageForm, setPackageForm] = useState({ name: "", slug: "", description: "", price: "", active: true });
  const [faqForm, setFaqForm] = useState({ id: "", question: "", answer: "", active: true });
  const [articleForm, setArticleForm] = useState({ title: "", slug: "", summary: "", body: "", active: true });
  const [editingPackage, setEditingPackage] = useState<string | null>(null);
  const [editingArticle, setEditingArticle] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setMessage(null);
    try {
      const [packagePage, faqPage, articlePage] = await Promise.all([fetchPackages(0, 100), fetchFaqs(0, 100), fetchArticles(0, 100)]);
      setPackages(packagePage.content); setFaqs(faqPage.content); setArticles(articlePage.content);
    } catch (error) { setMessage(describeAdminError(error).description); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const task = Promise.resolve().then(load); return () => void task; }, [load]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setMessage(null);
    try { await action(); setMessage(success); await load(); return true; }
    catch (error) { const copy = describeAdminError(error); setMessage(`${copy.title}: ${copy.description}`); return false; }
    finally { setBusy(false); }
  };

  const savePackage = async (event: FormEvent) => {
    event.preventDefault();
    const payload = { name: packageForm.name.trim(), slug: packageForm.slug.trim(), description: packageForm.description.trim() || null, price: Number(packageForm.price), active: packageForm.active };
    if (await run(() => editingPackage ? adminUpdatePackage(editingPackage, payload) : adminCreatePackage(payload), "Đã lưu gói khám.")) {
      setPackageForm({ name: "", slug: "", description: "", price: "", active: true }); setEditingPackage(null);
    }
  };
  const saveFaq = async (event: FormEvent) => {
    event.preventDefault(); const payload = { question: faqForm.question.trim(), answer: faqForm.answer.trim(), active: faqForm.active };
    if (await run(() => faqForm.id ? adminUpdateFaq(faqForm.id, payload) : adminCreateFaq(payload), "Đã lưu FAQ.")) {
      setFaqForm({ id: "", question: "", answer: "", active: true });
    }
  };
  const saveArticle = async (event: FormEvent) => {
    event.preventDefault(); const payload = { title: articleForm.title.trim(), slug: articleForm.slug.trim(), summary: articleForm.summary.trim() || null, body: articleForm.body.trim() || null, active: articleForm.active };
    if (await run(() => editingArticle ? adminUpdateArticle(editingArticle, payload) : adminCreateArticle(payload), "Đã lưu bài viết.")) {
      setArticleForm({ title: "", slug: "", summary: "", body: "", active: true }); setEditingArticle(null);
    }
  };

  return <div><header className="border-b border-slate-200 pb-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">ADMIN CATALOG</p><h1 className="mt-2 text-3xl font-bold">Gói khám, FAQ và bài viết</h1><p className="mt-2 text-sm text-slate-600">Quản lý toàn bộ nội dung catalog còn lại qua API ADMIN.</p></header>
    {message ? <p className="mt-5 rounded-xl bg-slate-100 p-3 text-sm" role="status">{message}</p> : null}
    {loading ? <div className="mt-6"><AdminState description="Đang đọc catalog từ backend." title="Đang tải nội dung" tone="loading" /></div> : null}
    {!loading ? <div className="mt-6 grid gap-6 xl:grid-cols-3">
      <Panel title={editingPackage ? "Sửa gói khám" : "Gói khám"}><form className="mt-4 space-y-3" onSubmit={savePackage}><label className="block text-sm font-semibold">Tên<input className={inputClass} required value={packageForm.name} onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })} /></label><label className="block text-sm font-semibold">Slug<input className={inputClass} required value={packageForm.slug} onChange={(e) => setPackageForm({ ...packageForm, slug: e.target.value })} /></label><label className="block text-sm font-semibold">Mô tả<textarea className={inputClass} value={packageForm.description} onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })} /></label><label className="block text-sm font-semibold">Giá<input className={inputClass} min="1" required type="number" value={packageForm.price} onChange={(e) => setPackageForm({ ...packageForm, price: e.target.value })} /></label><button className={buttonClass} disabled={busy}>Lưu gói khám</button></form><div className="mt-5 space-y-2">{packages.map((item) => <div className="rounded-xl border p-3 text-sm" key={item.id}><strong>{item.name}</strong><p>{item.price.toLocaleString("vi-VN")} đ</p><button className="mr-3 text-teal-800 underline" onClick={() => { setEditingPackage(item.slug); setPackageForm({ name: item.name, slug: item.slug, description: item.description ?? "", price: String(item.price), active: true }); }}>Sửa</button><button className="text-red-700 underline" onClick={() => void run(() => adminDeletePackage(item.slug), "Đã xóa gói khám.")}>Xóa</button></div>)}</div></Panel>
      <Panel title={faqForm.id ? "Sửa FAQ" : "FAQ"}><form className="mt-4 space-y-3" onSubmit={saveFaq}><label className="block text-sm font-semibold">Câu hỏi<textarea className={inputClass} required value={faqForm.question} onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })} /></label><label className="block text-sm font-semibold">Trả lời<textarea className={inputClass} required rows={5} value={faqForm.answer} onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })} /></label><button className={buttonClass} disabled={busy}>Lưu FAQ</button></form><div className="mt-5 space-y-2">{faqs.map((item) => <div className="rounded-xl border p-3 text-sm" key={item.id}><strong>{item.question}</strong><p className="line-clamp-2">{item.answer}</p><button className="mr-3 text-teal-800 underline" onClick={() => setFaqForm({ id: item.id, question: item.question, answer: item.answer, active: true })}>Sửa</button><button className="text-red-700 underline" onClick={() => void run(() => adminDeleteFaq(item.id), "Đã xóa FAQ.")}>Xóa</button></div>)}</div></Panel>
      <Panel title={editingArticle ? "Sửa bài viết" : "Bài viết"}><form className="mt-4 space-y-3" onSubmit={saveArticle}><label className="block text-sm font-semibold">Tiêu đề<input className={inputClass} required value={articleForm.title} onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })} /></label><label className="block text-sm font-semibold">Slug<input className={inputClass} required value={articleForm.slug} onChange={(e) => setArticleForm({ ...articleForm, slug: e.target.value })} /></label><label className="block text-sm font-semibold">Tóm tắt<textarea className={inputClass} value={articleForm.summary} onChange={(e) => setArticleForm({ ...articleForm, summary: e.target.value })} /></label><label className="block text-sm font-semibold">Nội dung<textarea className={inputClass} rows={7} value={articleForm.body} onChange={(e) => setArticleForm({ ...articleForm, body: e.target.value })} /></label><button className={buttonClass} disabled={busy}>Lưu bài viết</button></form><div className="mt-5 space-y-2">{articles.map((item) => <div className="rounded-xl border p-3 text-sm" key={item.id}><strong>{item.title}</strong><p>{item.slug}</p><button className="mr-3 text-teal-800 underline" onClick={() => { setEditingArticle(item.slug); setArticleForm({ title: item.title, slug: item.slug, summary: item.summary ?? "", body: item.body ?? "", active: true }); }}>Sửa</button><button className="text-red-700 underline" onClick={() => void run(() => adminDeleteArticle(item.slug), "Đã xóa bài viết.")}>Xóa</button></div>)}</div></Panel>
    </div> : null}</div>;
}
