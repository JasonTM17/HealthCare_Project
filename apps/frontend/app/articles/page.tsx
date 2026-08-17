"use client";

import { useEffect, useState } from "react";
import { fetchArticles, type Page } from "../../lib/api-client";
import type { Article } from "../../types/hospital";

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Page<Article> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchArticles(0, 50)
      .then((data) => {
        if (!cancelled) setArticles(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="section">
      <h2>Bài Viết Y Khoa</h2>
      <p className="text-slate-600">
        Cập nhật kiến thức và thông tin sức khỏe mới nhất.
      </p>

      {loading && <p className="text-slate-500">Đang tải...</p>}
      {error && <p className="text-red-600">Lỗi: {error}</p>}

      {articles && (
        <>
          {articles.empty ? (
            <p className="text-slate-500">Chưa có bài viết.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {articles.content.map((article) => (
                <div
                  key={article.id}
                  className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm"
                >
                  <span className="text-2xl block mb-3">🩺</span>
                  <h3 className="text-base font-bold text-slate-900">{article.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed mt-1">
                    {article.summary}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
