"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import useSWR from "swr";
import toast from "react-hot-toast";
import {
  uploadAvatar,
  becomeAgent,
  changeMyPassword,
  checkUsernameAvailability,
  getAgentTypes,
  updateMyProfile,
  getMyAgentProfile,
  getMyProfile,
  requestSoftDelete,
  type AgentMeProfile,
  type AgentTypesResponse,
  type BecomeAgentInput,
  type MyProfile,
  type UpdateMyProfileInput,
  type UserStats
} from "@/api/profile";
import { useI18n } from "@/context/i18n";
import { useLogout } from "@/hooks/useLogout";
import {
  normalizeProfileLanguages,
  resolveSafeMessage
} from "@/lib/profilePresentation";
import { useAuthStore } from "@/store/auth";
import { AgentUpgradeCard } from "./components/AgentUpgradeCard";
import { ContactCard } from "./components/ContactCard";
import { EditProfileForm } from "./components/EditProfileForm";
import { ProfileSidebar, type ProfileSectionKey } from "./components/ProfileSidebar";
import { ProfileStats } from "./components/ProfileStats";
import { ProfileSummaryCard } from "./components/ProfileSummaryCard";
import { SecurityPanel } from "./components/SecurityPanel";

const defaultStats: UserStats = {
  followers: 0,
  following: 0,
  posts: 0,
  listings: 0
};

const PROFILE_NOTIFICATIONS_KEY = "profile-notification-settings";
const MAX_LOCAL_AVATAR_DATA_URL_LENGTH = 120_000;
const MAX_LOCAL_AVATAR_PREVIEW_EDGE = 256;

const isStatusError = (error: unknown, statuses: number[]) =>
  error instanceof AxiosError && Boolean(error.response?.status && statuses.includes(error.response.status));

const isAvatarUploadUnavailableError = (error: unknown) =>
  error instanceof Error && error.message === "avatar-upload-unavailable";

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Avatar file read error"));
    reader.readAsDataURL(file);
  });

const shrinkAvatarDataUrl = (dataUrl: string) =>
  new Promise<string>((resolve) => {
    const image = new Image();

    image.onload = () => {
      const naturalWidth = image.naturalWidth;
      const naturalHeight = image.naturalHeight;
      if (!naturalWidth || !naturalHeight) {
        resolve(dataUrl);
        return;
      }

      const longestEdge = Math.max(naturalWidth, naturalHeight);
      const ratio = Math.min(1, MAX_LOCAL_AVATAR_PREVIEW_EDGE / longestEdge);
      const targetWidth = Math.max(1, Math.round(naturalWidth * ratio));
      const targetHeight = Math.max(1, Math.round(naturalHeight * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };

    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });

const fileToDataUrl = async (file: File) => {
  const rawDataUrl = await readFileAsDataUrl(file);
  if (rawDataUrl.length <= MAX_LOCAL_AVATAR_DATA_URL_LENGTH) {
    return rawDataUrl;
  }
  return shrinkAvatarDataUrl(rawDataUrl);
};

const formatUsername = (profile: MyProfile | undefined, fallbackEmail?: string | null) => {
  const fromProfile = profile?.username?.trim();
  if (fromProfile) return fromProfile;
  const local = fallbackEmail?.split("@")[0]?.trim();
  return local || "user";
};

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-6 xl:grid-cols-[300px,minmax(0,1fr)]">
        <div className="h-[520px] animate-pulse rounded-[2rem] border border-slate-200 bg-white/80" />
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-[1.6rem] border border-slate-200 bg-white/80" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-64 animate-pulse rounded-[1.8rem] border border-slate-200 bg-white/80" />
            <div className="h-64 animate-pulse rounded-[1.8rem] border border-slate-200 bg-white/80" />
          </div>
          <div className="h-80 animate-pulse rounded-[2rem] border border-slate-200 bg-white/80" />
        </div>
      </div>
    </div>
  );
}

function RatingRow({ label, value }: { label: string; value: number }) {
  const width = Math.min(100, Math.max(0, value));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-medium text-slate-600">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-slate-900" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { t, language } = useI18n();
  const tx = (key: string, fallback: string) => resolveSafeMessage(t, key, fallback);
  const {
    isHydrated,
    isAuthenticated,
    userId,
    role,
    profile: sessionProfile,
    hydrateFromStorage,
    setRole,
    updateProfile
  } = useAuthStore();
  const { logout } = useLogout();

  const [activeSection, setActiveSection] = useState<ProfileSectionKey>("overview");
  const [savingProfile, setSavingProfile] = useState(false);
  const [upgradingAgent, setUpgradingAgent] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    marketing: false
  });

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(PROFILE_NOTIFICATIONS_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setNotifications({
          email: Boolean((parsed as Record<string, unknown>).email),
          push: Boolean((parsed as Record<string, unknown>).push),
          marketing: Boolean((parsed as Record<string, unknown>).marketing)
        });
      }
    } catch {
      // ignore malformed local data
    }
  }, []);

  const shouldFetchProfile = isHydrated && isAuthenticated;

  const {
    data: myProfile,
    error: profileError,
    isLoading: profileLoading,
    mutate: mutateProfile
  } = useSWR<MyProfile>(shouldFetchProfile ? "profile-me" : null, getMyProfile, {
    revalidateOnFocus: false
  });

  const profileRole = myProfile?.role ? String(myProfile.role).toUpperCase() : "";
  const sessionRole = role ? String(role).toUpperCase() : "";
  const activeRole = profileRole || sessionRole || "USER";
  const isAgent = activeRole === "AGENT";

  const {
    data: myAgent,
    mutate: mutateAgent
  } = useSWR<AgentMeProfile | null>(shouldFetchProfile && isAgent ? "profile-agent-me" : null, getMyAgentProfile, {
    revalidateOnFocus: false
  });

  const { data: agentTypes } = useSWR<AgentTypesResponse>(
    shouldFetchProfile ? `profile-agent-types-${language}` : null,
    getAgentTypes,
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (!isAgent && activeSection === "reviews") {
      setActiveSection("overview");
    }
  }, [activeSection, isAgent]);

  const displayProfile = useMemo<MyProfile>(() => {
    const languages = normalizeProfileLanguages(myProfile?.languages || myProfile?.language);
    return {
      ...myProfile,
      name: myProfile?.name || sessionProfile?.name || tx("profile.roles.user", "User"),
      username: myProfile?.username || sessionProfile?.username || formatUsername(myProfile, myProfile?.email || null),
      avatarUrl: myProfile?.avatarUrl || sessionProfile?.avatarUrl,
      bio: myProfile?.bio ?? myProfile?.about ?? "",
      about: myProfile?.about ?? myProfile?.bio ?? "",
      phone: myProfile?.phone || "",
      location: myProfile?.location || "",
      language: languages.join(", "),
      languages,
      isPrivate: Boolean(myProfile?.isPrivate),
      role: activeRole,
      stats: myProfile?.stats || defaultStats
    };
  }, [activeRole, myProfile, sessionProfile?.avatarUrl, sessionProfile?.name, sessionProfile?.username, tx]);

  const stats = displayProfile.stats || defaultStats;
  const rating = myAgent?.ratingAvg || 0;
  const ratingCount = myAgent?.ratingCount || 0;

  const handleLogout = () => {
    void logout({
      audience: role === "ADMIN" || role === "AGENT" || role === "USER" ? role : "USER",
      redirectTo: role === "ADMIN" ? "/admin/login" : "/login",
      reason: "manual"
    });
  };

  const handleSaveProfile = async (payload: UpdateMyProfileInput) => {
    setSavingProfile(true);
    try {
      const updated = await updateMyProfile(payload);

      updateProfile({
        name: (updated.name || displayProfile.name || "").trim() || undefined,
        username: (updated.username || displayProfile.username || "").trim() || undefined,
        avatarUrl: (updated.avatarUrl || displayProfile.avatarUrl || "").trim() || undefined
      });

      await mutateProfile(
        (prev) => ({
          ...(prev || {}),
          ...updated,
          stats: updated.stats || prev?.stats || defaultStats
        }),
        { revalidate: false }
      );

      toast.success(tx("profile.toast.profileSaved", "Profile saved."));
    } catch (error) {
      const message =
        error instanceof AxiosError && error.response?.status === 409
          ? tx("profile.validation.usernameTaken", "This username is already taken")
          : tx("profile.toast.profileSaveError", "Could not save the profile.");
      toast.error(message);
      throw error;
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    try {
      const url = await uploadAvatar(file);
      const cleanUrl = String(url || "").trim();
      if (cleanUrl) {
        updateProfile({
          avatarUrl: cleanUrl,
          name: (displayProfile.name || "").trim() || undefined,
          username: (displayProfile.username || "").trim() || undefined
        });
        await mutateProfile((prev) => ({ ...(prev || {}), avatarUrl: cleanUrl }), { revalidate: false });
      }
      toast.success(tx("profile.toast.avatarUploaded", "Avatar updated."));
      return url;
    } catch (error) {
      if (isStatusError(error, [404, 405]) || isAvatarUploadUnavailableError(error)) {
        const localDataUrl = await fileToDataUrl(file);
        await mutateProfile((prev) => ({ ...(prev || {}), avatarUrl: localDataUrl }), { revalidate: false });
        updateProfile({
          avatarUrl: localDataUrl,
          name: (displayProfile.name || "").trim() || undefined,
          username: (displayProfile.username || "").trim() || undefined
        });
        toast(tx("profile.toast.avatarFallback", "Avatar upload is unavailable, so a local preview was applied."));
        return localDataUrl;
      }

      toast.error(tx("profile.toast.avatarUploadError", "Could not update the avatar."));
      throw error;
    }
  };

  const handleCheckUsername = async (username: string) => {
    try {
      return await checkUsernameAvailability(username);
    } catch {
      return null;
    }
  };

  const handlePasswordChange = async (payload: { currentPassword: string; newPassword: string }) => {
    try {
      await changeMyPassword(payload);
      toast.success(tx("profile.toast.passwordUpdated", "Password updated."));
    } catch (error) {
      if (isStatusError(error, [404, 405])) {
        toast.error(tx("profile.toast.passwordEndpointMissing", "Password update is not available yet."));
        return;
      }
      toast.error(tx("profile.toast.passwordError", "Could not update the password."));
      throw error;
    }
  };

  const handleSoftDelete = async () => {
    try {
      await requestSoftDelete();
      toast.success(tx("profile.toast.softDeleteSuccess", "Soft delete request sent."));
      handleLogout();
    } catch (error) {
      if (isStatusError(error, [404, 405])) {
        toast.error(tx("profile.toast.softDeleteEndpointMissing", "Soft delete is not available yet."));
        return;
      }
      toast.error(tx("profile.toast.softDeleteError", "Could not send the soft delete request."));
      throw error;
    }
  };

  const handleBecomeAgent = async (payload: BecomeAgentInput) => {
    setUpgradingAgent(true);
    try {
      await becomeAgent(payload);
      setRole("AGENT");
      await mutateProfile((prev) => ({ ...(prev || {}), role: "AGENT" }), { revalidate: false });
      await mutateProfile();
      await mutateAgent();
      toast.success(tx("profile.toast.agentEnabled", "Agent account enabled."));
    } catch (error) {
      toast.error(tx("profile.toast.agentError", "Could not upgrade this account to agent."));
      throw error;
    } finally {
      setUpgradingAgent(false);
    }
  };

  const saveNotificationSettings = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PROFILE_NOTIFICATIONS_KEY, JSON.stringify(notifications));
    }
    toast.success(tx("profile.toast.notificationsSaved", "Notification settings saved."));
  };

  if (!isHydrated || (shouldFetchProfile && (profileLoading || !myProfile))) {
    return <ProfileSkeleton />;
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white/92 p-8 text-center shadow-[0_24px_48px_rgba(15,23,42,0.08)]">
          <h1 className="text-2xl font-semibold text-slate-900">
            {tx("profile.state.loginRequired", "Login required")}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {tx("profile.state.loginDescription", "Sign in first to access your account page.")}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="inline-flex min-h-11 items-center justify-center rounded-[1rem] bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {tx("profile.state.loginAction", "Go to login")}
            </button>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-[1rem] border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {tx("profile.state.homeAction", "Back home")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-[2rem] border border-rose-200 bg-white/92 p-8 text-center shadow-[0_24px_48px_rgba(15,23,42,0.08)]">
          <h1 className="text-2xl font-semibold text-slate-900">
            {tx("profile.state.loadFailed", "Could not load the profile")}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {tx("profile.state.loadFailedDescription", "Try again or sign in again if the session expired.")}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => mutateProfile()}
              className="inline-flex min-h-11 items-center justify-center rounded-[1rem] bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {tx("profile.state.retry", "Retry")}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-11 items-center justify-center rounded-[1rem] border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {tx("profile.state.loginAgain", "Login again")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderSection = () => {
    if (activeSection === "security") {
      return <SecurityPanel onChangePassword={handlePasswordChange} onSoftDelete={handleSoftDelete} />;
    }

    if (activeSection === "listings") {
      return (
        <section className="space-y-4 rounded-[2rem] border border-slate-200 bg-white/92 p-6 shadow-[0_24px_48px_rgba(15,23,42,0.08)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {tx("profile.listings.eyebrow", "Listings")}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              {tx("profile.listings.title", "My listings")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {tx("profile.listings.subtitle", "Jump to product and service publishing areas from one place.")}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Link
              href="/products"
              className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-5 transition hover:border-slate-300 hover:bg-white"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {tx("profile.listings.productsLabel", "Products")}
              </p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{stats.listings}</p>
              <p className="mt-2 text-sm text-slate-600">
                {tx("profile.listings.productsDescription", "Manage your product catalog entries.")}
              </p>
            </Link>
            <Link
              href="/services"
              className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-5 transition hover:border-slate-300 hover:bg-white"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {tx("profile.listings.servicesLabel", "Services")}
              </p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{isAgent ? stats.listings : 0}</p>
              <p className="mt-2 text-sm text-slate-600">
                {tx("profile.listings.servicesDescription", "Open your service listings and related publishing tools.")}
              </p>
            </Link>
          </div>
        </section>
      );
    }

    if (activeSection === "reviews") {
      if (!isAgent) {
        return (
          <section className="rounded-[2rem] border border-slate-200 bg-white/92 p-6 text-sm leading-6 text-slate-600 shadow-[0_24px_48px_rgba(15,23,42,0.08)]">
            {tx("profile.reviews.agentOnly", "Reviews and ratings are available only for agent accounts.")}
          </section>
        );
      }

      const breakdown = myAgent?.ratingBreakdown || {
        five: 0,
        four: 0,
        three: 0,
        two: 0,
        one: 0
      };

      return (
        <section className="space-y-5 rounded-[2rem] border border-slate-200 bg-white/92 p-6 shadow-[0_24px_48px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {tx("profile.reviews.eyebrow", "Reputation")}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                {tx("profile.reviews.title", "Reviews and ratings")}
              </h2>
            </div>
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
              {rating.toFixed(1)} / 5 ({ratingCount})
            </span>
          </div>

          <div className="space-y-4">
            <RatingRow label="5 ★" value={breakdown.five} />
            <RatingRow label="4 ★" value={breakdown.four} />
            <RatingRow label="3 ★" value={breakdown.three} />
            <RatingRow label="2 ★" value={breakdown.two} />
            <RatingRow label="1 ★" value={breakdown.one} />
          </div>
        </section>
      );
    }

    if (activeSection === "wallet") {
      return (
        <section className="rounded-[2rem] border border-slate-200 bg-white/92 p-6 shadow-[0_24px_48px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {tx("profile.wallet.eyebrow", "Wallet")}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            {tx("profile.wallet.title", "Wallet and payments")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {tx("profile.wallet.subtitle", "Payment history, payout settings, and balance tools will be connected here in the next release.")}
          </p>
        </section>
      );
    }

    if (activeSection === "notifications") {
      return (
        <section className="space-y-5 rounded-[2rem] border border-slate-200 bg-white/92 p-6 shadow-[0_24px_48px_rgba(15,23,42,0.08)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {tx("profile.notifications.eyebrow", "Notifications")}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              {tx("profile.notifications.title", "Notification preferences")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {tx("profile.notifications.subtitle", "Choose which updates should reach you while more advanced delivery rules are still being built.")}
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                key: "email" as const,
                title: tx("profile.notifications.email", "Email notifications"),
                description: tx("profile.notifications.emailHelper", "Receive account and order updates in your inbox.")
              },
              {
                key: "push" as const,
                title: tx("profile.notifications.push", "Push notifications"),
                description: tx("profile.notifications.pushHelper", "Allow instant alerts for urgent activity.")
              },
              {
                key: "marketing" as const,
                title: tx("profile.notifications.marketing", "Marketing messages"),
                description: tx("profile.notifications.marketingHelper", "Receive product, service, and marketplace updates.")
              }
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-start justify-between gap-4 rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications[item.key]}
                  onChange={(event) =>
                    setNotifications((prev) => ({
                      ...prev,
                      [item.key]: event.target.checked
                    }))
                  }
                  aria-label={item.title}
                  className="mt-1 h-5 w-5 rounded border-slate-300 accent-slate-900"
                />
              </label>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={saveNotificationSettings}
              className="inline-flex min-h-11 items-center justify-center rounded-[1rem] bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {tx("profile.notifications.save", "Save notification settings")}
            </button>
          </div>
        </section>
      );
    }

    return (
      <div className="space-y-6">
        <ProfileStats stats={stats} />
        <div className="grid gap-4 lg:grid-cols-2">
          <ProfileSummaryCard profile={displayProfile} role={activeRole} />
          <ContactCard profile={displayProfile} />
        </div>
        <AgentUpgradeCard
          isAgent={isAgent}
          loading={upgradingAgent}
          agentProfile={myAgent || null}
          agentTypes={agentTypes}
          onBecomeAgent={handleBecomeAgent}
        />
        <EditProfileForm
          profile={displayProfile}
          saving={savingProfile}
          onSaveProfile={handleSaveProfile}
          onUploadAvatar={handleAvatarUpload}
          onCheckUsername={handleCheckUsername}
        />
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-6 xl:grid-cols-[300px,minmax(0,1fr)]">
        <ProfileSidebar
          user={{
            name: displayProfile.name || tx("profile.roles.user", "User"),
            username: formatUsername(displayProfile, displayProfile.email),
            role: activeRole,
            avatarUrl: displayProfile.avatarUrl,
            verified: Boolean(displayProfile.isVerified || activeRole === "ADMIN" || activeRole === "AGENT")
          }}
          activeSection={activeSection}
          isAgent={isAgent}
          onSectionChange={setActiveSection}
          onEditProfile={() => setActiveSection("overview")}
          onLogout={handleLogout}
        />
        <main className="min-w-0">{renderSection()}</main>
      </div>
    </div>
  );
}
