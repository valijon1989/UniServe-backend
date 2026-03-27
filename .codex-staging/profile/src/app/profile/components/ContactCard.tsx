"use client";

import type { MyProfile } from "@/api/profile";
import { useI18n } from "@/context/i18n";
import {
  formatProfileLanguageChips,
  resolveSafeMessage
} from "@/lib/profilePresentation";

interface ContactCardProps {
  profile: MyProfile;
}

export function ContactCard({ profile }: ContactCardProps) {
  const { t } = useI18n();
  const tx = (key: string, fallback: string) => resolveSafeMessage(t, key, fallback);
  const notProvided = tx("profile.common.notProvided", "Not provided");
  const languageChips = formatProfileLanguageChips(profile.languages || profile.language, tx);

  const rows = [
    { key: "email", label: tx("profile.contact.email", "Email"), value: profile.email || notProvided },
    { key: "phone", label: tx("profile.contact.phone", "Phone"), value: profile.phone || notProvided },
    { key: "location", label: tx("profile.contact.location", "Location"), value: profile.location || notProvided }
  ];

  return (
    <article className="rounded-[1.8rem] border border-slate-200 bg-white/92 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {tx("profile.contact.eyebrow", "Contact")}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">
            {tx("profile.contact.title", "Contact and visibility")}
          </h3>
        </div>
        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
          profile.isPrivate ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}>
          {profile.isPrivate
            ? tx("profile.contact.private", "Private profile")
            : tx("profile.contact.public", "Public profile")}
        </span>
      </div>

      <dl className="mt-5 space-y-4">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex flex-col gap-2 rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <dt className="text-sm font-medium text-slate-600">{row.label}</dt>
            <dd className="text-sm font-medium text-slate-900">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4">
        <p className="text-sm font-medium text-slate-600">{tx("profile.contact.languages", "Languages")}</p>
        {languageChips.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {languageChips.map((item) => (
              <span
                key={item}
                className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                {item}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-900">{notProvided}</p>
        )}
      </div>
    </article>
  );
}
