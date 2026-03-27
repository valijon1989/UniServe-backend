"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import type { MyProfile, UpdateMyProfileInput } from "@/api/profile";
import { Avatar } from "@/components/ui/Avatar";
import { useI18n } from "@/context/i18n";
import {
  normalizeProfileLanguages,
  resolveSafeMessage
} from "@/lib/profilePresentation";

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "unknown";

type ProfileFormValues = {
  name: string;
  username: string;
  bio: string;
  phone: string;
  location: string;
  languages: string;
  avatarUrl: string;
  isPrivate: boolean;
};

interface EditProfileFormProps {
  profile: MyProfile;
  saving: boolean;
  onSaveProfile: (payload: UpdateMyProfileInput) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<string>;
  onCheckUsername: (username: string) => Promise<boolean | null>;
}

export function EditProfileForm({
  profile,
  saving,
  onSaveProfile,
  onUploadAvatar,
  onCheckUsername
}: EditProfileFormProps) {
  const { t } = useI18n();
  const tx = (key: string, fallback: string) => resolveSafeMessage(t, key, fallback);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");

  const defaults = useMemo<ProfileFormValues>(
    () => ({
      name: profile.name || "",
      username: profile.username || "",
      bio: profile.bio || profile.about || "",
      phone: profile.phone || "",
      location: profile.location || "",
      languages: normalizeProfileLanguages(profile.languages || profile.language).join(", "),
      avatarUrl: profile.avatarUrl || "",
      isPrivate: Boolean(profile.isPrivate)
    }),
    [profile]
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty }
  } = useForm<ProfileFormValues>({
    defaultValues: defaults,
    mode: "onChange"
  });

  useEffect(() => {
    reset(defaults);
    setUsernameStatus("idle");
  }, [defaults, reset]);

  const username = watch("username");
  const avatarUrl = watch("avatarUrl");
  const normalizedUsername = username.trim();
  const baseUsername = (profile.username || "").trim();

  useEffect(() => {
    let canceled = false;

    if (!normalizedUsername || normalizedUsername.length < 3 || normalizedUsername === baseUsername) {
      setUsernameStatus("idle");
      return () => {
        canceled = true;
      };
    }

    setUsernameStatus("checking");

    const timer = window.setTimeout(async () => {
      try {
        const available = await onCheckUsername(normalizedUsername);
        if (canceled) return;
        if (available === true) setUsernameStatus("available");
        else if (available === false) setUsernameStatus("taken");
        else setUsernameStatus("unknown");
      } catch {
        if (!canceled) setUsernameStatus("unknown");
      }
    }, 400);

    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [baseUsername, normalizedUsername, onCheckUsername]);

  const usernameStatusText: Record<UsernameStatus, string> = {
    idle: "",
    checking: tx("profile.validation.usernameChecking", "Checking username..."),
    available: tx("profile.validation.usernameAvailable", "Username is available"),
    taken: tx("profile.validation.usernameTaken", "This username is already taken"),
    unknown: tx("profile.validation.usernameUnavailable", "Username check is unavailable")
  };

  const usernameStatusTone: Record<UsernameStatus, string> = {
    idle: "text-slate-500",
    checking: "text-slate-500",
    available: "text-emerald-600",
    taken: "text-rose-600",
    unknown: "text-amber-600"
  };

  const handleAvatarFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setAvatarUploading(true);
    try {
      const url = await onUploadAvatar(file);
      setValue("avatarUrl", url, { shouldDirty: true, shouldTouch: true });
    } catch {
      // Parent toast handles the error state.
    } finally {
      setAvatarUploading(false);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await onSaveProfile({
        name: values.name.trim(),
        username: values.username.trim(),
        bio: values.bio.trim(),
        about: values.bio.trim(),
        phone: values.phone.trim(),
        location: values.location.trim(),
        language: values.languages.trim(),
        languages: normalizeProfileLanguages(values.languages),
        avatarUrl: values.avatarUrl.trim(),
        isPrivate: Boolean(values.isPrivate)
      });
    } catch {
      // Parent toast handles the error state.
    }
  });

  const disableSubmit =
    !isDirty || saving || avatarUploading || usernameStatus === "checking" || usernameStatus === "taken";

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white/92 p-6 shadow-[0_24px_48px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {tx("profile.form.eyebrow", "Editable profile")}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            {tx("profile.form.title", "Update your profile")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {tx("profile.form.subtitle", "Keep your account details accurate, readable, and easy to trust.")}
          </p>
        </div>

        <div className="flex items-center gap-4 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-3">
          <Avatar
            src={avatarUrl}
            alt={profile.name || tx("profile.roles.user", "User")}
            fallbackText={profile.name || profile.username || tx("profile.roles.user", "User")}
            size={64}
            className="border border-slate-200 bg-white"
          />
          <div className="space-y-2">
            <label className="inline-flex cursor-pointer items-center rounded-[1rem] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
              {tx("profile.form.avatarUpload", "Upload avatar")}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
            </label>
            <p className="text-xs text-slate-500">
              {avatarUploading
                ? tx("profile.form.avatarUploading", "Uploading avatar...")
                : tx("profile.form.avatarHelper", "Use a clear square photo for better trust.")}
            </p>
          </div>
        </div>
      </div>

      <form className="mt-6 space-y-5" onSubmit={onSubmit}>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">{tx("profile.form.name", "Name")}</span>
            <input
              {...register("name", {
                required: tx("profile.validation.nameRequired", "Name is required"),
                minLength: {
                  value: 2,
                  message: tx("profile.validation.nameMin", "Use at least 2 characters")
                },
                maxLength: {
                  value: 80,
                  message: tx("profile.validation.nameMax", "Use 80 characters or fewer")
                }
              })}
              className="min-h-11 w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder={tx("profile.form.placeholder.name", "Your display name")}
            />
            {errors.name && <span className="text-xs text-rose-600">{errors.name.message}</span>}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">{tx("profile.form.username", "Username")}</span>
            <input
              {...register("username", {
                required: tx("profile.validation.usernameRequired", "Username is required"),
                minLength: {
                  value: 3,
                  message: tx("profile.validation.usernameMin", "Use at least 3 characters")
                },
                maxLength: {
                  value: 30,
                  message: tx("profile.validation.usernameMax", "Use 30 characters or fewer")
                },
                pattern: {
                  value: /^[a-zA-Z0-9._-]+$/,
                  message: tx("profile.validation.usernamePattern", "Only letters, numbers, dots, underscores, and dashes are allowed")
                }
              })}
              autoComplete="off"
              className="min-h-11 w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder={tx("profile.form.placeholder.username", "username")}
            />
            {errors.username ? (
              <span className="text-xs text-rose-600">{errors.username.message}</span>
            ) : (
              usernameStatus !== "idle" && (
                <span className={`text-xs ${usernameStatusTone[usernameStatus]}`}>{usernameStatusText[usernameStatus]}</span>
              )
            )}
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">{tx("profile.form.bio", "About")}</span>
          <textarea
            {...register("bio", {
              maxLength: {
                value: 280,
                message: tx("profile.validation.bioMax", "Keep your bio within 280 characters")
              }
            })}
            className="min-h-[132px] w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            placeholder={tx("profile.form.placeholder.bio", "Tell people what you do and what makes your account trustworthy.")}
          />
          {errors.bio && <span className="text-xs text-rose-600">{errors.bio.message}</span>}
        </label>

        <div className="grid gap-4 lg:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">{tx("profile.form.phone", "Phone")}</span>
            <input
              type="tel"
              {...register("phone", {
                pattern: {
                  value: /^[0-9+\-\s()]*$/,
                  message: tx("profile.validation.phoneInvalid", "Use a valid phone number format")
                },
                maxLength: {
                  value: 32,
                  message: tx("profile.validation.phoneMax", "Use 32 characters or fewer")
                }
              })}
              className="min-h-11 w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder={tx("profile.form.placeholder.phone", "+82 10 1234 5678")}
            />
            {errors.phone && <span className="text-xs text-rose-600">{errors.phone.message}</span>}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">{tx("profile.form.location", "Location")}</span>
            <input
              {...register("location", {
                maxLength: {
                  value: 80,
                  message: tx("profile.validation.locationMax", "Use 80 characters or fewer")
                }
              })}
              className="min-h-11 w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder={tx("profile.form.placeholder.location", "Seoul, South Korea")}
            />
            {errors.location && <span className="text-xs text-rose-600">{errors.location.message}</span>}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">{tx("profile.form.languages", "Languages")}</span>
            <input
              {...register("languages", {
                maxLength: {
                  value: 120,
                  message: tx("profile.validation.languagesMax", "Use 120 characters or fewer")
                }
              })}
              className="min-h-11 w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder={tx("profile.form.placeholder.languages", "uz, en, ko")}
            />
            <p className="text-xs text-slate-500">
              {tx("profile.form.languagesHelper", "Separate multiple languages with commas.")}
            </p>
            {errors.languages && <span className="text-xs text-rose-600">{errors.languages.message}</span>}
          </label>
        </div>

        <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4">
          <label className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-800">
                {tx("profile.form.privateLabel", "Private profile")}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {tx("profile.form.privateHelper", "Hide your profile details from public visitors until you are ready.")}
              </p>
            </div>
            <input
              type="checkbox"
              {...register("isPrivate")}
              aria-label={tx("profile.form.privateLabel", "Private profile")}
              className="h-5 w-5 rounded border-slate-300 accent-slate-900"
            />
          </label>
        </div>

        <input type="hidden" {...register("avatarUrl")} />

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={disableSubmit}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[1rem] bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {(saving || avatarUploading) && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {saving
              ? tx("profile.form.saving", "Saving changes...")
              : tx("profile.form.save", "Save changes")}
          </button>
        </div>
      </form>
    </section>
  );
}
