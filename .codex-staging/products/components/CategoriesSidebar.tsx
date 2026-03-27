"use client";

import { getShopCategoryMeta, SHOP_CATEGORY_TAXONOMY } from "@/data/shopTaxonomy";
import { useI18n } from "@/context/i18n";
import { resolveLocalizedText } from "@/lib/localization";

interface CategoriesSidebarProps {
  selected?: string;
  onSelect: (slug: string) => void;
}

export default function CategoriesSidebar({ selected, onSelect }: CategoriesSidebarProps) {
  const { language } = useI18n();
  const items = SHOP_CATEGORY_TAXONOMY.filter((item) => item.slug !== "all");

  return (
    <aside className="space-y-2">
      {items.map((cat) => {
        const active = selected === cat.slug;
        const meta = getShopCategoryMeta(cat.slug);
        const label = resolveLocalizedText(meta.label, language) || cat.slug;
        const description = resolveLocalizedText(meta.description, language);
        return (
          <div
            key={cat.slug}
            className={`cursor-pointer rounded-[1.3rem] border px-4 py-3 transition ${
              active
                ? "border-emerald-300 bg-emerald-50 shadow-sm"
                : "border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white"
            }`}
            onClick={() => onSelect(cat.slug)}
            role="button"
            tabIndex={0}
            aria-label={label}
            title={label}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(cat.slug);
              }
            }}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-lg shadow-sm">
                {meta.icon}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{label}</p>
                <p className="truncate text-[11px] leading-5 text-slate-500">{description}</p>
              </div>
            </div>
          </div>
        );
      })}
    </aside>
  );
}
