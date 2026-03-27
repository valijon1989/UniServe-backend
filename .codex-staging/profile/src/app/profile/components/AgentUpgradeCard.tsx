"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AgentKind, AgentMeProfile, AgentTypesResponse, BecomeAgentInput } from "@/api/profile";
import { useI18n } from "@/context/i18n";
import {
  getAgentCategoryLabel,
  getAgentKindLabel,
  humanizeSlug,
  resolveSafeMessage
} from "@/lib/profilePresentation";

interface AgentUpgradeCardProps {
  isAgent: boolean;
  loading: boolean;
  agentProfile: AgentMeProfile | null;
  agentTypes?: AgentTypesResponse;
  onBecomeAgent: (payload: BecomeAgentInput) => Promise<void>;
}

const normalizeServices = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeStatusKey = (value: string | undefined) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "approved") return "profile.agent.status.approved";
  if (normalized === "rejected") return "profile.agent.status.rejected";
  if (normalized === "pending") return "profile.agent.status.pending";
  return "profile.agent.status.active";
};

export function AgentUpgradeCard({
  isAgent,
  loading,
  agentProfile,
  agentTypes,
  onBecomeAgent
}: AgentUpgradeCardProps) {
  const { t } = useI18n();
  const tx = (key: string, fallback: string) => resolveSafeMessage(t, key, fallback);
  const [kind, setKind] = useState<AgentKind>("SERVICE");
  const [category, setCategory] = useState("consulting");
  const [servicesRaw, setServicesRaw] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [qualification, setQualification] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    if (isAgent) return;
    const fallbackKind = agentTypes?.defaults?.kind || agentTypes?.kinds?.[0]?.value || "SERVICE";
    const fallbackCategory = agentTypes?.categoryOptions?.[0]?.value || agentTypes?.categories?.[0] || "consulting";
    setKind(fallbackKind);
    setCategory(fallbackCategory);
  }, [agentTypes, isAgent]);

  const categoryOptions = useMemo(() => {
    if (agentTypes?.categoryOptions?.length) {
      return agentTypes.categoryOptions.map((item) => ({
        value: item.value,
        label: item.label || getAgentCategoryLabel(item.value, tx)
      }));
    }

    return (agentTypes?.categories || ["consulting", "translation", "legal", "delivery", "education", "products"]).map(
      (item) => ({
        value: item,
        label: getAgentCategoryLabel(item, tx)
      })
    );
  }, [agentTypes, tx]);

  const agentServices = isAgent
    ? agentProfile?.kind === "SELLER"
      ? agentProfile?.materialServices || []
      : agentProfile?.socialServices || []
    : [];

  const handleSubmit = async () => {
    const normalizedCategory = category.trim().toLowerCase();
    const normalizedServices = normalizeServices(servicesRaw);

    if (!normalizedCategory) {
      setErrorKey("profile.validation.agentCategoryRequired");
      return;
    }

    if (normalizedServices.length === 0) {
      setErrorKey("profile.validation.agentServicesRequired");
      return;
    }

    setErrorKey(null);
    await onBecomeAgent({
      kind,
      serviceCategory: normalizedCategory,
      serviceOfficeAddress: officeAddress.trim() || undefined,
      serviceQualification: qualification.trim() || undefined,
      ...(kind === "SELLER"
        ? { materialServices: normalizedServices }
        : { socialServices: normalizedServices })
    });
  };

  const statusKey = normalizeStatusKey(agentProfile?.verificationStatus);
  const statusText = tx(
    statusKey,
    humanizeSlug(String(agentProfile?.verificationStatus || "active"))
  );

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white/92 p-6 shadow-[0_24px_48px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {tx("profile.agent.eyebrow", "Account type")}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            {isAgent
              ? tx("profile.agent.currentTitle", "Agent account")
              : tx("profile.agent.upgradeTitle", "Become an agent")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {isAgent
              ? tx("profile.agent.currentDescription", "Your account is already upgraded. Review the current status and continue to the full agent profile editor when needed.")
              : tx("profile.agent.upgradeDescription", "Upgrade this account to service or seller mode with a clear category and public specialization.")}
          </p>
        </div>
        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
          isAgent ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-sky-200 bg-sky-50 text-sky-700"
        }`}>
          {isAgent ? tx("profile.roles.agent", "Agent") : tx("profile.roles.user", "User")}
        </span>
      </div>

      {isAgent ? (
        <div className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {tx("profile.agent.currentStatus", "Current status")}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">{statusText}</p>
            </div>
            <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {tx("profile.agent.currentKind", "Agent kind")}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {getAgentKindLabel(agentProfile?.kind, tx)}
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {tx("profile.agent.currentCategory", "Service category")}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {getAgentCategoryLabel(agentProfile?.serviceCategory, tx)}
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {tx("profile.agent.currentServices", "Service focus")}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {agentServices.length
                  ? agentServices.map((item) => humanizeSlug(item)).join(", ")
                  : tx("profile.agent.noServices", "Not provided")}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {tx("profile.agent.officeAddress", "Office address")}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {agentProfile?.serviceOfficeAddress || tx("profile.common.notProvided", "Not provided")}
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {tx("profile.agent.qualification", "Qualification")}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {agentProfile?.serviceQualification || tx("profile.common.notProvided", "Not provided")}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Link
              href="/become-agent"
              className="inline-flex min-h-11 items-center justify-center rounded-[1rem] bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {tx("profile.agent.manageAction", "Edit agent profile")}
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">{tx("profile.agent.kind", "Agent kind")}</span>
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value as AgentKind)}
                className="min-h-11 w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              >
                {(agentTypes?.kinds || [{ value: "SERVICE" as AgentKind }, { value: "SELLER" as AgentKind }]).map((item) => (
                  <option key={item.value} value={item.value}>
                    {getAgentKindLabel(item.value, tx)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                {tx("profile.agent.serviceCategory", "Service category")}
              </span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="min-h-11 w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              >
                {categoryOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 lg:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                {kind === "SELLER"
                  ? tx("profile.agent.materialServices", "Material services")
                  : tx("profile.agent.socialServices", "Social services")}
              </span>
              <input
                value={servicesRaw}
                onChange={(event) => setServicesRaw(event.target.value)}
                className="min-h-11 w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                placeholder={
                  kind === "SELLER"
                    ? tx("profile.agent.placeholder.materialServices", "delivery, logistics, products")
                    : tx("profile.agent.placeholder.socialServices", "consulting, legal, translation")
                }
              />
              <p className="text-xs text-slate-500">
                {tx("profile.agent.servicesHelper", "Separate services with commas.")}
              </p>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                {tx("profile.agent.officeAddress", "Office address")}
              </span>
              <input
                value={officeAddress}
                onChange={(event) => setOfficeAddress(event.target.value)}
                className="min-h-11 w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                placeholder={tx("profile.agent.placeholder.officeAddress", "Office or service location")}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                {tx("profile.agent.qualification", "Qualification")}
              </span>
              <input
                value={qualification}
                onChange={(event) => setQualification(event.target.value)}
                className="min-h-11 w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                placeholder={tx("profile.agent.placeholder.qualification", "Certificates, experience, or public proof")}
              />
            </label>
          </div>

          {errorKey && <p className="text-sm text-rose-600">{tx(errorKey, "Complete the required fields.")}</p>}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={loading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[1rem] bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {tx("profile.agent.submit", "Become agent")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
