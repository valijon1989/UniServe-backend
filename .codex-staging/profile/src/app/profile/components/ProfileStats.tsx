"use client";

import { useI18n } from "@/context/i18n";
import { formatProfileCount, resolveSafeMessage } from "@/lib/profilePresentation";

interface ProfileStatsProps {
  stats: {
    followers: number;
    following: number;
    posts: number;
    listings: number;
  };
}

const statTone = [
  "from-sky-50 to-white",
  "from-emerald-50 to-white",
  "from-amber-50 to-white",
  "from-rose-50 to-white"
] as const;

export function ProfileStats({ stats }: ProfileStatsProps) {
  const { language, t } = useI18n();
  const tx = (key: string, fallback: string) => resolveSafeMessage(t, key, fallback);

  const items = [
    {
      key: "followers",
      label: tx("profile.stats.followers", "Followers"),
      value: stats.followers
    },
    {
      key: "following",
      label: tx("profile.stats.following", "Following"),
      value: stats.following
    },
    {
      key: "posts",
      label: tx("profile.stats.posts", "Posts"),
      value: stats.posts
    },
    {
      key: "listings",
      label: tx("profile.stats.listings", "Listings"),
      value: stats.listings
    }
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => (
        <article
          key={item.key}
          className={`rounded-[1.6rem] border border-slate-200 bg-gradient-to-br ${statTone[index]} p-4 shadow-[0_20px_40px_rgba(15,23,42,0.06)]`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {formatProfileCount(item.value, language)}
          </p>
          <p className="mt-2 text-sm text-slate-600">{tx("profile.stats.helper", "Always visible across your account view.")}</p>
        </article>
      ))}
    </section>
  );
}
