"use client";

import Link from "next/link";

/**
 * Last-resort boundary for failures that occur above a route segment. Keep
 * this file dependency-light: when the root layout fails, application styles
 * and providers may not be available yet.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="vi">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f7fbfa", color: "#123b3a" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" }}>
          <section aria-labelledby="global-error-title" style={{ maxWidth: 640, border: "1px solid #b9d9d4", borderRadius: 20, padding: "2rem", background: "#fff", boxShadow: "0 12px 40px rgba(15, 76, 72, .12)" }}>
            <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".12em" }}>HEALTHCARE</p>
            <h1 id="global-error-title" style={{ margin: "0.5rem 0", fontSize: "clamp(1.7rem, 4vw, 2.4rem)" }}>Hệ thống đang tạm gián đoạn</h1>
            <p style={{ lineHeight: 1.7 }}>Dữ liệu của bạn vẫn được bảo vệ. Hãy thử tải lại trang hoặc quay về trang chủ để tiếp tục.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: ".75rem", marginTop: "1.25rem" }}>
              <button onClick={reset} style={{ minHeight: 44, border: 0, borderRadius: 10, padding: "0 1rem", background: "#087b78", color: "#fff", fontWeight: 700 }} type="button">Thử tải lại</button>
              <Link href="/" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", border: "1px solid #087b78", borderRadius: 10, padding: "0 1rem", color: "#075e5b", fontWeight: 700, textDecoration: "none" }}>Về trang chủ</Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
