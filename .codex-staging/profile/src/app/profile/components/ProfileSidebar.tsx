"use client";

import { Avatar } from "@/components/ui/Avatar";
import { useI18n } from "@/context/i18n";
import { getProfileRoleLabel, resolveSafeMessage } from "@/lib/profilePresentation";

export type ProfileSectionKey =
  | "overview"
  | "security"
  | "listings"
  | "reviews"
  | "wallet"
  | "notifications";

export interface SidebarUserSummary {
  name: string;
  username: string;
  role: string;
  avatarUrl?: string;
  verified?: boolean;
}

interface ProfileSidebarProps {
  user: SidebarUserSummary;
  activeSection: ProfileSectionKey;
  isAgent: boolean;
  onSectionChange: (key: ProfileSectionKey) => void;
  onEditProfile: () => void;
  onLogout: () => void;
}

const roleTone: Record<string, string> = {
  ADMIN: "border-rose-200 bg-rose-50 text-rose-700",
  AGENT: "border-emerald-200 bg-emerald-50 text-emerald-700",
  USER: "border-sky-200 bg-sky-50 text-sky-700"
};

export function ProfileSidebar({
  user,
  activeSection,
  isAgent,
  onSectionChange,
  onEditProfile,
  onLogout
}: ProfileSidebarProps) {
  const { t } = useI18n();
  const tx = (key: string, fallback: string) => resolveSafeMessage(t, key, fallback);
  const items: Array<{ key: ProfileSectionKey; label: string; show: boolean }> = [
    { key: "overview", label: tx("profile.sidebar.profile", "Profile"), show: true },
    { key: "security", label: tx("profile.sidebar.security", "Security"), show: true },
    { key: "listings", label: tx("profile.sidebar.listings", "My listings"), show: true },
    { key: "reviews", label: tx("profile.sidebar.reviews", "Reviews"), show: isAgent },
    { key: "wallet", label: tx("profile.sidebar.wallet", "Wallet / payments"), show: true },
    { key: "notifications", label: tx("profile.sidebar.notifications", "Notifications"), show: true }
  ];

  const normalizedRole = String(user.role || "USER").toUpperCase();
  const tone = roleTone[normalizedRole] || "border-slate-200 bg-slate-100 text-slate-700";
  const roleLabel = getProfileRoleLabel(normalizedRole, tx);

  return (
    <aside className="w-full xl:sticky xl:top-24">
      <div className="flex h-full flex-col rounded-[2rem] border border-slate-200 bg-white/92 p-5 shadow-[0_24px_48px_rgba(15,23,42,0.08)]">
        <div className="flex items-start gap-4">
          <Avatar
            src={user.avatarUrl}
            alt={user.name}
            fallbackText={user.name}
            size={72}
            className="border border-slate-200 bg-slate-100"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold text-slate-900">{user.name}</h1>
            <p className="truncate text-sm text-slate-500">@{user.username}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase ${tone}`}>
                {roleLabel}
              </span>
              {user.verified && (
                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] uppercase text-emerald-700">
                  {tx("common.verified", "Verified")}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onEditProfile}
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[1.1rem] bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          {tx("profile.sidebar.editProfile", "Edit profile")}
        </button>

        <nav className="mt-5 space-y-2" aria-label={tx("profile.sidebar.navigation", "Profile navigation")}>
          {items
            .filter((item) => item.show)
            .map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onSectionChange(item.key)}
                aria-current={activeSection === item.key ? "page" : undefined}
                className={`flex min-h-11 w-full items-center rounded-[1.1rem] border px-4 py-3 text-left text-sm font-medium transition ${
                  activeSection === item.key
                    ? "border-slate-900 bg-slate-950 text-white shadow-[0_14px_28px_rgba(15,23,42,0.14)]"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                }`}
              >
                {item.label}
              </button>
            ))}
        </nav>

        <div className="mt-6 border-t border-slate-200 pt-5">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-[1.1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          >
            {tx("profile.sidebar.logout", "Logout")}
          </button>
        </div>
      </div>
    </aside>
  );
}
