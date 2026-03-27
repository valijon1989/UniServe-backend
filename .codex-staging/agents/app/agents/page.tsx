import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AgentsClient } from "@/components/agents/AgentsClient.client";
import { getCatalogMessage } from "@/lib/i18nCatalog";
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LANGUAGE_STORAGE_KEY,
  isSupportedLocale,
  type SupportedLocale
} from "@/lib/localization";

const getAgentsLocale = (): SupportedLocale => {
  const cookieStore = cookies();
  const stored = cookieStore.get(LANGUAGE_STORAGE_KEY)?.value;
  return isSupportedLocale(stored) ? stored : DEFAULT_LOCALE;
};

const getMetadataMessage = (locale: SupportedLocale, key: string, fallback: string) =>
  getCatalogMessage(locale, key) ??
  getCatalogMessage(DEFAULT_LOCALE, key) ??
  getCatalogMessage(FALLBACK_LOCALE, key) ??
  fallback;

export function generateMetadata(): Metadata {
  const locale = getAgentsLocale();
  return {
    title: getMetadataMessage(locale, "agents.page.title", "Agents roster"),
    description: getMetadataMessage(
      locale,
      "agents.page.description",
      "Top agents first, then the full active directory."
    )
  };
}

export default function AgentsPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm">
          <div className="mx-auto max-w-sm animate-pulse space-y-3">
            <div className="h-4 rounded-full bg-slate-200/80" />
            <div className="h-4 rounded-full bg-slate-200/70" />
            <div className="h-10 rounded-2xl bg-slate-200/60" />
          </div>
        </div>
      }
    >
      <AgentsClient />
    </Suspense>
  );
}
