"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useI18n } from "@/context/i18n";
import { resolveSafeMessage } from "@/lib/profilePresentation";

interface SecurityFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface SecurityPanelProps {
  onChangePassword: (payload: { currentPassword: string; newPassword: string }) => Promise<void>;
  onSoftDelete: () => Promise<void>;
}

export function SecurityPanel({ onChangePassword, onSoftDelete }: SecurityPanelProps) {
  const { t } = useI18n();
  const tx = (key: string, fallback: string) => resolveSafeMessage(t, key, fallback);
  const [deleting, setDeleting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<SecurityFormValues>({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    },
    mode: "onChange"
  });

  const newPassword = watch("newPassword");

  const onSubmit = handleSubmit(async (values) => {
    await onChangePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword
    });
    reset();
  });

  const handleSoftDelete = async () => {
    setDeleting(true);
    try {
      await onSoftDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="space-y-6 rounded-[2rem] border border-slate-200 bg-white/92 p-6 shadow-[0_24px_48px_rgba(15,23,42,0.08)]">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          {tx("profile.security.eyebrow", "Security")}
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          {tx("profile.security.title", "Security and access")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {tx("profile.security.subtitle", "Update your password and review account safety actions from one place.")}
        </p>
      </header>

      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              {tx("profile.security.currentPassword", "Current password")}
            </span>
            <input
              type="password"
              {...register("currentPassword", {
                required: tx("profile.validation.currentPasswordRequired", "Enter your current password")
              })}
              className="min-h-11 w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />
            {errors.currentPassword && <span className="text-xs text-rose-600">{errors.currentPassword.message}</span>}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              {tx("profile.security.newPassword", "New password")}
            </span>
            <input
              type="password"
              {...register("newPassword", {
                required: tx("profile.validation.newPasswordRequired", "Enter a new password"),
                minLength: {
                  value: 8,
                  message: tx("profile.validation.passwordMin", "Use at least 8 characters")
                }
              })}
              className="min-h-11 w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />
            {errors.newPassword && <span className="text-xs text-rose-600">{errors.newPassword.message}</span>}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              {tx("profile.security.confirmPassword", "Confirm password")}
            </span>
            <input
              type="password"
              {...register("confirmPassword", {
                required: tx("profile.validation.confirmPasswordRequired", "Confirm the new password"),
                validate: (value) => value === newPassword || tx("profile.validation.passwordMismatch", "Passwords do not match")
              })}
              className="min-h-11 w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />
            {errors.confirmPassword && <span className="text-xs text-rose-600">{errors.confirmPassword.message}</span>}
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[1rem] bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {tx("profile.security.updatePassword", "Update password")}
          </button>
        </div>
      </form>

      <section className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-900">{tx("profile.security.sessionsTitle", "Sessions")}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {tx("profile.security.sessionsPlaceholder", "Session management controls are reserved for the next account-security release.")}
        </p>
      </section>

      <section className="rounded-[1.4rem] border border-rose-200 bg-rose-50 px-5 py-4">
        <h3 className="text-sm font-semibold text-rose-700">{tx("profile.security.deleteTitle", "Delete account")}</h3>
        <p className="mt-2 text-sm leading-6 text-rose-700/90">
          {tx("profile.security.deleteDescription", "Request a soft delete if you want to temporarily disable this account and sign out safely.")}
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleSoftDelete}
            disabled={deleting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[1rem] border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {deleting && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-rose-300/50 border-t-rose-700" />
            )}
            {tx("profile.security.deleteAction", "Send soft delete request")}
          </button>
        </div>
      </section>
    </section>
  );
}
