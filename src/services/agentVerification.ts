export type AgentVerificationStatus = "pending" | "approved" | "rejected";

type AgentVerificationSource = {
  verifiedByAdmin?: boolean | null;
  adminStatus?: string | null;
  verificationRejectionReason?: string | null;
};

const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;

export const resolveAgentVerificationStatus = (
  profile?: AgentVerificationSource | null
): AgentVerificationStatus => {
  if (profile?.verifiedByAdmin || String(profile?.adminStatus || "").toUpperCase() === "ACTIVE") {
    return "approved";
  }

  if (
    hasText(profile?.verificationRejectionReason) ||
    String(profile?.adminStatus || "").toUpperCase() === "SUSPENDED"
  ) {
    return "rejected";
  }

  return "pending";
};
