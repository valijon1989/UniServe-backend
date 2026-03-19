import { CategoryPaymentPolicy, type ICategoryPaymentPolicy } from "../models/CategoryPaymentPolicy";
import {
  PAYMENT_SOURCE_TYPE_VALUES,
  SETTLEMENT_CATEGORY_VALUES,
  toEscrowBucketKey,
  type PaymentSourceType,
  type SettlementCategory
} from "../types/paymentDomain";

type PolicySeed = Pick<
  ICategoryPaymentPolicy,
  | "categoryKey"
  | "displayName"
  | "workflowKind"
  | "reviewWindowHours"
  | "autoReleaseHours"
  | "autoReleaseEnabled"
  | "disputeWindowHours"
  | "refundPolicyMode"
  | "privacySafeCompletion"
  | "trustCopy"
  | "proofRequirements"
> & { bucketKey: string };

const DEFAULT_POLICY_SEEDS: Record<SettlementCategory, PolicySeed> = {
  shopping: {
    categoryKey: "shopping",
    displayName: "Shopping / products",
    bucketKey: toEscrowBucketKey("shopping"),
    workflowKind: "PRODUCT_DELIVERY",
    reviewWindowHours: 72,
    autoReleaseHours: 72,
    autoReleaseEnabled: true,
    disputeWindowHours: 72,
    refundPolicyMode: "DISPUTE_ONLY",
    privacySafeCompletion: false,
    trustCopy: "Funds are held securely in escrow until delivery is confirmed or the review window ends.",
    proofRequirements: ["delivery_proof", "shipment_or_dropoff_reference"]
  },
  services: {
    categoryKey: "services",
    displayName: "General services",
    bucketKey: toEscrowBucketKey("services"),
    workflowKind: "SERVICE_COMPLETION",
    reviewWindowHours: 48,
    autoReleaseHours: 48,
    autoReleaseEnabled: true,
    disputeWindowHours: 48,
    refundPolicyMode: "DISPUTE_ONLY",
    privacySafeCompletion: false,
    trustCopy: "Funds remain in escrow until the service is marked complete and the buyer review window ends.",
    proofRequirements: ["completion_note", "service_proof"]
  },
  translation: {
    categoryKey: "translation",
    displayName: "Translation",
    bucketKey: toEscrowBucketKey("translation"),
    workflowKind: "FILE_DELIVERY",
    reviewWindowHours: 72,
    autoReleaseHours: 72,
    autoReleaseEnabled: true,
    disputeWindowHours: 72,
    refundPolicyMode: "POLICY_AWARE",
    privacySafeCompletion: false,
    trustCopy: "Uploaded files and final delivery stay protected in escrow until the translation review window closes.",
    proofRequirements: ["final_files", "delivery_note"]
  },
  legal: {
    categoryKey: "legal",
    displayName: "Legal",
    bucketKey: toEscrowBucketKey("legal"),
    workflowKind: "SERVICE_COMPLETION",
    reviewWindowHours: 72,
    autoReleaseHours: 72,
    autoReleaseEnabled: true,
    disputeWindowHours: 72,
    refundPolicyMode: "POLICY_AWARE",
    privacySafeCompletion: true,
    trustCopy: "Legal payments are held in escrow and released only after confidential completion markers and review rules are satisfied.",
    proofRequirements: ["consultation_marker", "document_review_marker"]
  },
  psychology: {
    categoryKey: "psychology",
    displayName: "Psychology",
    bucketKey: toEscrowBucketKey("psychology"),
    workflowKind: "SESSION_COMPLETION",
    reviewWindowHours: 24,
    autoReleaseHours: 24,
    autoReleaseEnabled: true,
    disputeWindowHours: 24,
    refundPolicyMode: "POLICY_AWARE",
    privacySafeCompletion: true,
    trustCopy: "Private session payments are held safely until the secure completion marker and short review window are complete.",
    proofRequirements: ["privacy_safe_session_marker"]
  },
  education: {
    categoryKey: "education",
    displayName: "Education / courses",
    bucketKey: toEscrowBucketKey("education"),
    workflowKind: "ENROLLMENT",
    reviewWindowHours: 168,
    autoReleaseHours: 168,
    autoReleaseEnabled: true,
    disputeWindowHours: 168,
    refundPolicyMode: "POLICY_AWARE",
    privacySafeCompletion: false,
    trustCopy: "Course and education payments stay protected in escrow until access or milestone rules are satisfied.",
    proofRequirements: ["enrollment_or_access_log", "module_access_marker"]
  },
  consulting: {
    categoryKey: "consulting",
    displayName: "Consulting",
    bucketKey: toEscrowBucketKey("consulting"),
    workflowKind: "SESSION_COMPLETION",
    reviewWindowHours: 72,
    autoReleaseHours: 72,
    autoReleaseEnabled: true,
    disputeWindowHours: 72,
    refundPolicyMode: "POLICY_AWARE",
    privacySafeCompletion: false,
    trustCopy: "Consulting payments are escrow-held until the agreed session or delivery milestone is completed and reviewed.",
    proofRequirements: ["session_marker", "deliverable_or_summary"]
  },
  sport: {
    categoryKey: "sport",
    displayName: "Sport / training",
    bucketKey: toEscrowBucketKey("sport"),
    workflowKind: "SESSION_COMPLETION",
    reviewWindowHours: 48,
    autoReleaseHours: 48,
    autoReleaseEnabled: true,
    disputeWindowHours: 48,
    refundPolicyMode: "POLICY_AWARE",
    privacySafeCompletion: false,
    trustCopy: "Training funds are held in escrow until the session or coaching package milestone is completed.",
    proofRequirements: ["session_completion", "plan_or_progress_note"]
  },
  human_services: {
    categoryKey: "human_services",
    displayName: "Trust-heavy human services",
    bucketKey: toEscrowBucketKey("human_services"),
    workflowKind: "SERVICE_COMPLETION",
    reviewWindowHours: 48,
    autoReleaseHours: 48,
    autoReleaseEnabled: true,
    disputeWindowHours: 48,
    refundPolicyMode: "POLICY_AWARE",
    privacySafeCompletion: true,
    trustCopy: "Sensitive human-service payments remain in escrow until safe completion and buyer review requirements are met.",
    proofRequirements: ["privacy_safe_completion_note", "schedule_marker"]
  },
  transport: {
    categoryKey: "transport",
    displayName: "Transport / delivery",
    bucketKey: toEscrowBucketKey("transport"),
    workflowKind: "PRODUCT_DELIVERY",
    reviewWindowHours: 24,
    autoReleaseHours: 24,
    autoReleaseEnabled: true,
    disputeWindowHours: 24,
    refundPolicyMode: "DISPUTE_ONLY",
    privacySafeCompletion: false,
    trustCopy: "Transport funds stay escrow-held until drop-off or completion proof is recorded.",
    proofRequirements: ["route_completion", "dropoff_confirmation"]
  },
  other: {
    categoryKey: "other",
    displayName: "Other",
    bucketKey: toEscrowBucketKey("other"),
    workflowKind: "SERVICE_COMPLETION",
    reviewWindowHours: 48,
    autoReleaseHours: 48,
    autoReleaseEnabled: true,
    disputeWindowHours: 48,
    refundPolicyMode: "DISPUTE_ONLY",
    privacySafeCompletion: false,
    trustCopy: "Funds are held securely until the UniServe completion and review process is finished.",
    proofRequirements: ["completion_note"]
  }
};

const CATEGORY_ALIASES: Record<string, SettlementCategory> = {
  translation: "translation",
  tarjima: "translation",
  legal: "legal",
  law: "legal",
  psychology: "psychology",
  therapist: "psychology",
  therapy: "psychology",
  counseling: "psychology",
  sport: "sport",
  fitness: "sport",
  training: "sport",
  coach: "sport",
  consulting: "consulting",
  consultingg: "consulting",
  consultant: "consulting",
  education: "education",
  course: "education",
  courses: "education",
  school: "education",
  nanny: "human_services",
  caregiver: "human_services",
  homecare: "human_services",
  human: "human_services",
  transport: "transport",
  taxi: "transport",
  limousine: "transport",
  moving: "transport",
  delivery: "transport",
  shopping: "shopping",
  product: "shopping",
  products: "shopping",
  services: "services",
  service: "services"
};

const normalizeText = (value: unknown) => String(value || "").trim().toLowerCase();

export const inferSettlementCategory = (
  sourceType: PaymentSourceType,
  rawCategory?: string | null
): SettlementCategory => {
  if (!PAYMENT_SOURCE_TYPE_VALUES.includes(sourceType)) return "other";
  if (sourceType === "PRODUCT_ORDER") return "shopping";

  const normalized = normalizeText(rawCategory).replace(/[_-]/g, " ");
  for (const [key, category] of Object.entries(CATEGORY_ALIASES)) {
    if (normalized.includes(key)) return category;
  }

  if (sourceType === "COURSE_ENROLLMENT") return "education";
  if (sourceType === "CONSULTING_REQUEST") return "consulting";
  return "services";
};

export const ensureCategoryPaymentPolicy = async (categoryKey: SettlementCategory) => {
  const seed = DEFAULT_POLICY_SEEDS[categoryKey] || DEFAULT_POLICY_SEEDS.other;
  const policy = await CategoryPaymentPolicy.findOneAndUpdate(
    { categoryKey: seed.categoryKey },
    { $setOnInsert: seed },
    { new: true, upsert: true }
  );
  return policy;
};

export const resolveCategoryPaymentPolicy = async ({
  sourceType,
  rawCategory
}: {
  sourceType: PaymentSourceType;
  rawCategory?: string | null;
}) => {
  const categoryKey = inferSettlementCategory(sourceType, rawCategory);
  const policy = await ensureCategoryPaymentPolicy(categoryKey);
  return { categoryKey, policy };
};

export const listDefaultCategoryPaymentPolicies = () =>
  SETTLEMENT_CATEGORY_VALUES.map((categoryKey) => DEFAULT_POLICY_SEEDS[categoryKey]);

