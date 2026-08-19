import type { Page } from "../lib/api-client";
import type { ReactElement } from "react";

interface CatalogPaginationProps<T> {
  page: Page<T>;
  onPageChange: (page: number) => void;
  label: string;
}

export function CatalogPagination<T>({
  page,
  onPageChange,
  label,
}: CatalogPaginationProps<T>): ReactElement | null {
  if (page.totalPages <= 1) return null;

  return (
    <nav aria-label={label} className="catalog-pagination">
      <button
        className="catalog-pagination__button"
        disabled={page.first}
        onClick={() => onPageChange(Math.max(0, page.number - 1))}
        type="button"
      >
        ← Trước
      </button>
      <span aria-live="polite" className="catalog-pagination__status">
        Trang {page.number + 1} / {page.totalPages} · {page.totalElements} mục
      </span>
      <button
        className="catalog-pagination__button"
        disabled={page.last}
        onClick={() => onPageChange(Math.min(page.totalPages - 1, page.number + 1))}
        type="button"
      >
        Sau →
      </button>
    </nav>
  );
}

export default CatalogPagination;
