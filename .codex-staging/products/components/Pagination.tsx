"use client";

import { useI18n } from "@/context/i18n";
import type { SupportedLocale } from "@/lib/localization";
import { formatProductNumber, formatProductPaginationSummary } from "@/lib/productsPresentation";

interface PaginationProps {
  page: number;
  total?: number;
  limit?: number;
  onPageChange: (page: number) => void;
  labels?: {
    previous?: string;
    next?: string;
    summary?: (info: { page: number; total: number; totalPages: number; limit: number }) => string;
  };
}

export default function Pagination({ page, total = 0, limit = 12, onPageChange, labels }: PaginationProps) {
  const { t, language } = useI18n();
  const locale = language as SupportedLocale;
  const resolve = (key: string, fallback: string) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };
  const pageLabel = resolve("products.pagination.page", "Page");
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const canPrev = page > 1;
  const canNext = page < totalPages;
  const windowSize = 6;
  const startPage = Math.max(1, Math.min(page - 2, totalPages - windowSize + 1));
  const endPage = Math.min(totalPages, startPage + windowSize - 1);
  const pagesToShow = Array.from({ length: endPage - startPage + 1 }, (_, idx) => startPage + idx);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-slate-200/90 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-[0_16px_32px_rgba(15,23,42,0.05)]">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => canPrev && onPageChange(page - 1)}
          disabled={!canPrev}
          aria-label={labels?.previous || resolve("products.pagination.previous", "Previous")}
          title={labels?.previous || resolve("products.pagination.previous", "Previous")}
          className="rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {labels?.previous || resolve("products.pagination.previous", "Previous")}
        </button>

        <div className="flex items-center gap-1">
          {startPage > 1 ? (
            <>
              <button
                type="button"
                onClick={() => onPageChange(1)}
                aria-label={`${pageLabel} ${formatProductNumber(1, locale)}`}
                title={`${pageLabel} ${formatProductNumber(1, locale)}`}
                className="h-9 w-9 rounded-full border border-slate-200 bg-white text-center text-sm font-semibold text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700"
              >
                {formatProductNumber(1, locale)}
              </button>
              {startPage > 2 ? <span className="px-1 text-slate-400">…</span> : null}
            </>
          ) : null}
          {pagesToShow.map((num) => (
            <button
              type="button"
              key={num}
              onClick={() => onPageChange(num)}
              aria-label={`${pageLabel} ${formatProductNumber(num, locale)}`}
              title={`${pageLabel} ${formatProductNumber(num, locale)}`}
              className={`h-9 w-9 rounded-full text-center text-sm font-semibold transition ${
                num === page
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
              }`}
            >
              {formatProductNumber(num, locale)}
            </button>
          ))}
          {endPage < totalPages ? (
            <>
              {endPage < totalPages - 1 ? <span className="px-1 text-slate-400">…</span> : null}
              <button
                type="button"
                onClick={() => onPageChange(totalPages)}
                aria-label={`${pageLabel} ${formatProductNumber(totalPages, locale)}`}
                title={`${pageLabel} ${formatProductNumber(totalPages, locale)}`}
                className="h-9 w-9 rounded-full border border-slate-200 bg-white text-center text-sm font-semibold text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700"
              >
                {formatProductNumber(totalPages, locale)}
              </button>
            </>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => canNext && onPageChange(page + 1)}
          disabled={!canNext}
          aria-label={labels?.next || resolve("products.pagination.next", "Next")}
          title={labels?.next || resolve("products.pagination.next", "Next")}
          className="rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {labels?.next || resolve("products.pagination.next", "Next")}
        </button>
      </div>

      <p className="text-xs text-slate-500">
        {labels?.summary
          ? labels.summary({ page, total, totalPages, limit })
          : formatProductPaginationSummary(total, totalPages, locale)}
      </p>
    </div>
  );
}
