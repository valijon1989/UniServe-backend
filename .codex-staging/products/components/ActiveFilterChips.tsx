"use client";

import { useI18n } from "@/context/i18n";

export interface ActiveFilterChip {
  key: string;
  label: string;
}

export function ActiveFilterChips({
  chips,
  onClearAll,
  emptyLabel,
  clearLabel
}: {
  chips: ActiveFilterChip[];
  onClearAll?: () => void;
  emptyLabel?: string;
  clearLabel?: string;
}) {
  const { t } = useI18n();
  const resolve = (key: string, fallback: string) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };

  if (chips.length === 0) {
    return (
      <p className="text-xs leading-5 text-slate-500">
        {emptyLabel ||
          resolve(
            "products.filters.emptyState",
            "Refine the catalog with search, category, price, or delivery filters."
          )}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm"
        >
          {chip.label}
        </span>
      ))}
      {onClearAll ? (
        <button
          type="button"
          onClick={onClearAll}
          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          {clearLabel || resolve("products.filters.clear", "Clear filters")}
        </button>
      ) : null}
    </div>
  );
}
