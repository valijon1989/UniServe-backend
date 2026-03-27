"use client";

import type { MyProfile } from "@/api/profile";
import { useI18n } from "@/context/i18n";
import { getProfileRoleLabel, resolveSafeMessage } from "@/lib/profilePresentation";

interface ProfileSummaryCardProps {
  profile: MyProfile;
  role: string;
}

export function ProfileSummaryCard({ profile, role }: ProfileSummaryCardProps) {
  const { t } = useI18n();
  const tx = (key: string, fallback: string) => resolveSafeMessage(t, key, fallback);
  const notProvided = tx("profile.common.notProvided", "Not provided");

  return (
    <article className="rounded-[1.8rem] border border-slate-200 bg-white/92 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {tx("profile.summary.eyebrow", "Profile summary")}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">
            {tx("profile.summary.title", "Public account snapshot")}
          </h3>
        </div>
        {profile.isPrivate ? (
          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            {tx("profile.summary.privateBadge", "Private")}
          </span>
        ) : (
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            {tx("profile.summary.publicBadge", "Public")}
          </span>
        )}
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4">
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {tx("profile.summary.displayName", "Display name")}
          </dt>
          <dd className="mt-2 text-sm font-medium text-slate-900">{profile.name || notProvided}</dd>
        </div>
        <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4">
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {tx("profile.summary.username", "Username")}
          </dt>
          <dd className="mt-2 text-sm font-medium text-slate-900">
            {profile.username ? `@${profile.username}` : notProvided}
          </dd>
        </div>
        <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4">
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {tx("profile.summary.role", "Account type")}
          </dt>
          <dd className="mt-2 text-sm font-medium text-slate-900">{getProfileRoleLabel(role, tx)}</dd>
        </div>
        <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4">
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {tx("profile.summary.privacy", "Privacy")}
          </dt>
          <dd className="mt-2 text-sm font-medium text-slate-900">
            {profile.isPrivate
              ? tx("profile.contact.private", "Private profile")
              : tx("profile.contact.public", "Public profile")}
          </dd>
        </div>
      </dl>

      <div className="mt-5 rounded-[1.3rem] border border-slate-200 bg-slate-50 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {tx("profile.summary.about", "About")}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {profile.bio || profile.about || tx("profile.summary.aboutEmpty", "No profile summary added yet.")}
        </p>
      </div>
    </article>
  );
}
