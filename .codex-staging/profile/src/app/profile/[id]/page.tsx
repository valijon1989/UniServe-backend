"use client";

import { useParams } from "next/navigation";
import { useI18n } from "@/context/i18n";
import { resolveSafeMessage } from "@/lib/profilePresentation";

export default function PublicProfilePage() {
  const params = useParams();
  const id = params?.id as string;
  const { t } = useI18n();
  const tx = (key: string, fallback: string) => resolveSafeMessage(t, key, fallback);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white/92 p-6 shadow-[0_24px_48px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          {tx("profile.public.eyebrow", "Public profile")}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          {tx("profile.public.title", "Public profile view")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {tx("profile.public.description", "A public-facing profile layout will be connected here soon.")}
        </p>
        <p className="mt-4 text-sm font-medium text-slate-900">ID: {id}</p>
      </section>
    </div>
  );
}
