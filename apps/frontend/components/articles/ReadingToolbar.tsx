"use client";

import { useEffect, useState } from "react";

interface ReadingToolbarProps {
  slug: string;
  title: string;
  fontSize: "sm" | "base" | "lg";
  onFontSizeChange: (size: "sm" | "base" | "lg") => void;
  onToastMessage?: (message: string) => void;
}

export function ReadingToolbar({
  slug,
  title,
  fontSize,
  onFontSizeChange,
  onToastMessage,
}: ReadingToolbarProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    try {
      const stored = localStorage.getItem("healthcare_bookmarks");
      if (stored) {
        const bookmarks = JSON.parse(stored) as string[];
        const hasBookmark = bookmarks.includes(slug);
        queueMicrotask(() => {
          if (active) setIsBookmarked(hasBookmark);
        });
      }
    } catch {
      // Ignore localStorage errors in private browsing
    }
    return () => {
      active = false;
    };
  }, [slug]);

  const toggleBookmark = () => {
    try {
      const stored = localStorage.getItem("healthcare_bookmarks");
      let bookmarks: string[] = stored ? JSON.parse(stored) : [];
      let nextState = false;
      if (bookmarks.includes(slug)) {
        bookmarks = bookmarks.filter((s) => s !== slug);
        nextState = false;
      } else {
        bookmarks.push(slug);
        nextState = true;
      }
      localStorage.setItem("healthcare_bookmarks", JSON.stringify(bookmarks));
      setIsBookmarked(nextState);
      if (onToastMessage) {
        onToastMessage(nextState ? "Đã lưu bài viết vào danh sách quan tâm" : "Đã bỏ lưu bài viết");
      }
    } catch {
      if (onToastMessage) {
        onToastMessage("Không thể lưu trạng thái bài viết trên trình duyệt này.");
      }
    }
  };

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title,
          text: `Cẩm nang sức khỏe y khoa: ${title}`,
          url,
        });
        return;
      } catch {
        // User dismissed share dialog or unsupported, fall back to copy
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        if (onToastMessage) {
          onToastMessage("Đã sao chép liên kết bài viết vào bộ nhớ tạm");
        }
      } catch {
        if (onToastMessage) {
          onToastMessage("Chưa thể sao chép liên kết.");
        }
      }
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div aria-label="Công cụ hỗ trợ đọc bài viết" className="reading-toolbar">
      <div className="reading-toolbar__group">
        <span className="reading-toolbar__label">Cỡ chữ:</span>
        <button
          type="button"
          onClick={() => onFontSizeChange("sm")}
          className={`reading-toolbar__btn ${fontSize === "sm" ? "reading-toolbar__btn--active" : ""}`}
          title="Cỡ chữ nhỏ (15px)"
          aria-label="Cỡ chữ nhỏ"
        >
          A-
        </button>
        <button
          type="button"
          onClick={() => onFontSizeChange("base")}
          className={`reading-toolbar__btn ${fontSize === "base" ? "reading-toolbar__btn--active" : ""}`}
          title="Cỡ chữ chuẩn (17px)"
          aria-label="Cỡ chữ chuẩn"
        >
          A
        </button>
        <button
          type="button"
          onClick={() => onFontSizeChange("lg")}
          className={`reading-toolbar__btn ${fontSize === "lg" ? "reading-toolbar__btn--active" : ""}`}
          title="Cỡ chữ lớn (19.5px)"
          aria-label="Cỡ chữ lớn cho người cao tuổi"
        >
          A+
        </button>
      </div>

      <div className="reading-toolbar__divider" aria-hidden="true" />

      <div className="reading-toolbar__group">
        <button
          type="button"
          onClick={toggleBookmark}
          className={`reading-toolbar__action-btn ${isBookmarked ? "reading-toolbar__action-btn--saved" : ""}`}
          title={isBookmarked ? "Bỏ lưu bài viết" : "Lưu bài viết để đọc lại"}
          aria-label={isBookmarked ? "Đã lưu bài viết" : "Lưu bài viết"}
        >
          <span>{isBookmarked ? "★" : "☆"}</span>
          <span>{isBookmarked ? "Đã lưu" : "Lưu bài"}</span>
        </button>

        <button
          type="button"
          onClick={handleShare}
          className="reading-toolbar__action-btn"
          title="Chia sẻ bài viết hoặc sao chép link"
          aria-label="Chia sẻ bài viết"
        >
          <span>{copied ? "✓" : "↗"}</span>
          <span>{copied ? "Đã chép link" : "Chia sẻ"}</span>
        </button>

        <button
          type="button"
          onClick={handlePrint}
          className="reading-toolbar__action-btn"
          title="In hoặc lưu phác đồ PDF"
          aria-label="In bản hướng dẫn y khoa"
        >
          <span>🖨</span>
          <span>In bản đọc</span>
        </button>
      </div>
    </div>
  );
}
