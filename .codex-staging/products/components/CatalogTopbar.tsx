"use client";

import { ActiveFilterChips, type ActiveFilterChip } from "@/components/ActiveFilterChips";
import { useI18n } from "@/context/i18n";

interface SortOption<T extends string> {
  value: T;
  label: string;
}

export function CatalogTopbar<T extends string>({
  resultCount,
  resultLabel,
  resultCountText,
  sortValue,
  sortOptions,
  onSortChange,
  activeFilters,
  onClearFilters,
  sortLabel,
  emptyFiltersLabel,
  clearFiltersLabel
}: {
  resultCount: number;
  resultLabel?: string;
  resultCountText?: string;
  sortValue: T;
  sortOptions: SortOption<T>[];
  onSortChange: (value: T) => void;
  activeFilters: ActiveFilterChip[];
  onClearFilters?: () => void;
  sortLabel?: string;
  emptyFiltersLabel?: string;
  clearFiltersLabel?: string;
}) {
  const { t } = useI18n();
  const resolve = (key: string, fallback: string) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };

  return (
    <section className="rounded-[1.9rem] border border-slate-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-4 shadow-[0_24px_50px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-950 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
              {resultLabel || resolve("products.topbar.catalog", "Catalog")}
            </span>
            <span className="text-sm font-semibold text-slate-900">
              {resultCountText || `${resultCount} ${resolve("products.topbar.results", "results")}`}
            </span>
          </div>
          <ActiveFilterChips
            chips={activeFilters}
            onClearAll={onClearFilters}
            emptyLabel={emptyFiltersLabel}
            clearLabel={clearFiltersLabel}
          />
        </div>

        <div className="flex items-center gap-3 self-start rounded-[1.2rem] border border-slate-200 bg-white/90 px-3 py-3 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {sortLabel || resolve("products.filters.sort", "Sort")}
          </span>
          <select
            value={sortValue}
            onChange={(event) => onSortChange(event.target.value as T)}
            className="min-w-[190px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
