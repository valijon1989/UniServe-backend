import type {
  MarketplaceDisputeState,
  MarketplaceFulfillmentState,
  MarketplaceLifecycleState,
  MarketplacePaymentState,
  MarketplaceSettlementState,
  PaymentCollectionStatus,
  PaymentSourceType,
  SettlementCategory,
  StateTimelineActor,
  StateTimelineGroup
} from "../types/paymentDomain";
import type { AppLocale, MessageKey } from "../i18n";
import { t } from "../i18n";

export interface MarketplaceStateSnapshot {
  lifecycleState: MarketplaceLifecycleState;
  paymentState: MarketplacePaymentState;
  fulfillmentState: MarketplaceFulfillmentState;
  settlementState: MarketplaceSettlementState;
  disputeState: MarketplaceDisputeState;
}

export interface StateTimelineEntry {
  group: StateTimelineGroup;
  from?: string | null;
  to: string;
  actorType: StateTimelineActor;
  actorId?: string | null;
  note?: string | null;
  createdAt: Date;
}

const lifecycleTransitions: Partial<Record<MarketplaceLifecycleState, MarketplaceLifecycleState[]>> = {
  draft: ["checkout_started", "awaiting_payment", "cancelled"],
  checkout_started: ["awaiting_payment", "cancelled"],
  awaiting_payment: ["payment_link_sent", "awaiting_manual_transfer", "payment_pending_verification", "cancelled", "payment_expired"],
  payment_link_sent: ["payment_pending_verification", "payment_expired", "cancelled"],
  awaiting_manual_transfer: ["payment_pending_verification", "payment_expired", "cancelled"],
  payment_pending_verification: ["paid", "payment_failed", "payment_expired"],
  paid: ["held_in_escrow"],
  held_in_escrow: ["fulfillment_started", "dispute_opened", "refund_approved"],
  fulfillment_started: ["delivered_or_completed", "dispute_opened", "remediation_required"],
  delivered_or_completed: ["awaiting_buyer_confirmation", "dispute_opened", "refund_approved", "release_approved"],
  awaiting_buyer_confirmation: ["released_to_seller_pending_payout", "dispute_opened", "refund_approved", "release_approved"],
  released_to_seller_pending_payout: ["payout_processing", "refund_approved"],
  payout_processing: ["payout_completed"],
  dispute_opened: ["under_admin_review"],
  under_admin_review: ["refund_approved", "release_approved", "remediation_required"],
  refund_approved: ["refunded"],
  release_approved: ["released_to_seller_pending_payout"],
  remediation_required: ["fulfillment_started", "delivered_or_completed"],
  payment_failed: ["awaiting_payment", "cancelled"],
  payment_expired: ["awaiting_payment", "cancelled"]
};

const fulfillmentModeByCategory: Record<SettlementCategory, string> = {
  shopping: "delivery_based",
  services: "service_completion",
  translation: "file_delivery",
  legal: "consultation_or_document_review",
  psychology: "privacy_safe_session_completion",
  education: "access_or_milestone",
  consulting: "session_package_or_retainer",
  sport: "session_package_or_coaching_milestone",
  human_services: "trust_sensitive_service_completion",
  transport: "route_or_delivery_completion",
  other: "generic_completion"
};

const buyerStatusKeys: Partial<Record<MarketplaceLifecycleState, MessageKey>> = {
  awaiting_payment: "payments.status.awaiting_payment.buyer",
  payment_link_sent: "payments.status.payment_link_sent.buyer",
  awaiting_manual_transfer: "payments.status.awaiting_manual_transfer.buyer",
  payment_pending_verification: "payments.status.payment_pending_verification.buyer",
  paid: "payments.status.paid.buyer",
  held_in_escrow: "payments.status.held_in_escrow.buyer",
  fulfillment_started: "payments.status.fulfillment_started.buyer",
  delivered_or_completed: "payments.status.delivered_or_completed.buyer",
  awaiting_buyer_confirmation: "payments.status.awaiting_buyer_confirmation.buyer",
  dispute_opened: "payments.status.dispute_opened.buyer",
  refund_approved: "payments.status.refund_approved.buyer",
  release_approved: "payments.status.release_approved.buyer",
  released_to_seller_pending_payout: "payments.status.released_to_seller_pending_payout.buyer",
  payout_completed: "payments.status.payout_completed.buyer",
  payment_failed: "payments.status.payment_failed.buyer",
  payment_expired: "payments.status.payment_expired.buyer",
  cancelled: "payments.status.cancelled.buyer"
};

const sellerStatusKeys: Partial<Record<MarketplaceLifecycleState, MessageKey>> = {
  held_in_escrow: "payments.status.held_in_escrow.seller",
  fulfillment_started: "payments.status.fulfillment_started.seller",
  delivered_or_completed: "payments.status.delivered_or_completed.seller",
  awaiting_buyer_confirmation: "payments.status.awaiting_buyer_confirmation.seller",
  release_approved: "payments.status.release_approved.seller",
  released_to_seller_pending_payout: "payments.status.released_to_seller_pending_payout.seller",
  payout_completed: "payments.status.payout_completed.seller",
  cancelled: "payments.status.cancelled.seller"
};

export const buildInitialMarketplaceStates = (): MarketplaceStateSnapshot => ({
  lifecycleState: "awaiting_payment",
  paymentState: "awaiting_payment",
  fulfillmentState: "pending",
  settlementState: "none",
  disputeState: "none"
});

export const assertLifecycleTransition = (from: MarketplaceLifecycleState, to: MarketplaceLifecycleState) => {
  const allowed = lifecycleTransitions[from] || [];
  return allowed.includes(to) || from === to;
};

export const buildTimelineEntry = (params: {
  group: StateTimelineGroup;
  from?: string | null;
  to: string;
  actorType?: StateTimelineActor;
  actorId?: string | null;
  note?: string | null;
}): StateTimelineEntry => ({
  group: params.group,
  from: params.from || null,
  to: params.to,
  actorType: params.actorType || "system",
  actorId: params.actorId || null,
  note: params.note || null,
  createdAt: new Date()
});

export const appendTimelineEntries = (
  current: StateTimelineEntry[] | undefined,
  entries: StateTimelineEntry[]
) => [...(Array.isArray(current) ? current : []), ...entries];

export const mapCollectionStatusToStatePatch = (status: PaymentCollectionStatus, actorType: StateTimelineActor = "system") => {
  switch (status) {
    case "DRAFT":
      return {
        lifecycleState: "draft" as MarketplaceLifecycleState,
        paymentState: "awaiting_payment" as MarketplacePaymentState,
        settlementState: "none" as MarketplaceSettlementState,
        disputeState: "none" as MarketplaceDisputeState,
        timeline: [buildTimelineEntry({ group: "lifecycle", from: null, to: "draft", actorType })]
      };
    case "AWAITING_PAYMENT":
      return {
        lifecycleState: "awaiting_payment" as MarketplaceLifecycleState,
        paymentState: "awaiting_payment" as MarketplacePaymentState,
        timeline: [buildTimelineEntry({ group: "payment", from: null, to: "awaiting_payment", actorType })]
      };
    case "PAYMENT_LINK_SENT":
      return {
        lifecycleState: "payment_link_sent" as MarketplaceLifecycleState,
        paymentState: "payment_link_sent" as MarketplacePaymentState,
        timeline: [buildTimelineEntry({ group: "payment", from: null, to: "payment_link_sent", actorType })]
      };
    case "AWAITING_MANUAL_TRANSFER":
      return {
        lifecycleState: "awaiting_manual_transfer" as MarketplaceLifecycleState,
        paymentState: "awaiting_manual_transfer" as MarketplacePaymentState,
        timeline: [buildTimelineEntry({ group: "payment", from: null, to: "awaiting_manual_transfer", actorType })]
      };
    case "PAYMENT_PENDING_VERIFICATION":
      return {
        lifecycleState: "payment_pending_verification" as MarketplaceLifecycleState,
        paymentState: "payment_pending_verification" as MarketplacePaymentState,
        timeline: [buildTimelineEntry({ group: "payment", from: null, to: "payment_pending_verification", actorType })]
      };
    case "PAYMENT_FAILED":
      return {
        lifecycleState: "payment_failed" as MarketplaceLifecycleState,
        paymentState: "payment_failed" as MarketplacePaymentState,
        timeline: [buildTimelineEntry({ group: "payment", from: null, to: "payment_failed", actorType })]
      };
    case "PAYMENT_EXPIRED":
      return {
        lifecycleState: "payment_expired" as MarketplaceLifecycleState,
        paymentState: "payment_expired" as MarketplacePaymentState,
        timeline: [buildTimelineEntry({ group: "payment", from: null, to: "payment_expired", actorType })]
      };
    case "HELD_IN_ESCROW":
      return buildEscrowHeldState(actorType);
    default:
      return {
        lifecycleState: "awaiting_payment" as MarketplaceLifecycleState,
        paymentState: "awaiting_payment" as MarketplacePaymentState,
        timeline: []
      };
  }
};

export const buildEscrowHeldState = (actorType: StateTimelineActor = "system") => ({
  lifecycleState: "held_in_escrow" as MarketplaceLifecycleState,
  paymentState: "held_in_escrow" as MarketplacePaymentState,
  settlementState: "held" as MarketplaceSettlementState,
  timeline: [
    buildTimelineEntry({ group: "payment", from: "paid", to: "held_in_escrow", actorType }),
    buildTimelineEntry({ group: "settlement", from: "none", to: "held", actorType })
  ]
});

export const buildFulfillmentStartedState = (actorType: StateTimelineActor = "seller", note?: string | null) => ({
  lifecycleState: "fulfillment_started" as MarketplaceLifecycleState,
  fulfillmentState: "in_progress" as MarketplaceFulfillmentState,
  timeline: [
    buildTimelineEntry({ group: "lifecycle", from: "held_in_escrow", to: "fulfillment_started", actorType, note }),
    buildTimelineEntry({ group: "fulfillment", from: "pending", to: "in_progress", actorType, note })
  ]
});

export const buildDeliveredState = (options?: {
  awaitingBuyerConfirmation?: boolean;
  actorType?: StateTimelineActor;
  note?: string | null;
}) => {
  const actorType = options?.actorType || "seller";
  const lifecycleState = options?.awaitingBuyerConfirmation ? "awaiting_buyer_confirmation" : "delivered_or_completed";
  const fulfillmentState = options?.awaitingBuyerConfirmation ? "awaiting_buyer_confirmation" : "delivered_or_completed";
  return {
    lifecycleState: lifecycleState as MarketplaceLifecycleState,
    fulfillmentState: fulfillmentState as MarketplaceFulfillmentState,
    settlementState: "release_pending" as MarketplaceSettlementState,
    timeline: [
      buildTimelineEntry({ group: "lifecycle", from: "fulfillment_started", to: lifecycleState, actorType, note: options?.note }),
      buildTimelineEntry({ group: "fulfillment", from: "in_progress", to: fulfillmentState, actorType, note: options?.note }),
      buildTimelineEntry({ group: "settlement", from: "held", to: "release_pending", actorType, note: options?.note })
    ]
  };
};

export const buildReleasePendingPayoutState = (actorType: StateTimelineActor = "system", note?: string | null) => ({
  lifecycleState: "released_to_seller_pending_payout" as MarketplaceLifecycleState,
  settlementState: "released_to_seller_pending_payout" as MarketplaceSettlementState,
  disputeState: "resolved_seller" as MarketplaceDisputeState,
  timeline: [
    buildTimelineEntry({ group: "lifecycle", from: "awaiting_buyer_confirmation", to: "released_to_seller_pending_payout", actorType, note }),
    buildTimelineEntry({ group: "settlement", from: "release_pending", to: "released_to_seller_pending_payout", actorType, note })
  ]
});

export const buildPayoutState = (
  next: "payout_processing" | "payout_completed",
  actorType: StateTimelineActor = "system",
  note?: string | null
) => ({
  lifecycleState: next as MarketplaceLifecycleState,
  settlementState: next as MarketplaceSettlementState,
  timeline: [
    buildTimelineEntry({
      group: "settlement",
      from: next === "payout_processing" ? "released_to_seller_pending_payout" : "payout_processing",
      to: next,
      actorType,
      note
    }),
    buildTimelineEntry({
      group: "lifecycle",
      from: next === "payout_processing" ? "released_to_seller_pending_payout" : "payout_processing",
      to: next,
      actorType,
      note
    })
  ]
});

export const buildDisputeOpenState = (actorType: StateTimelineActor = "buyer", note?: string | null) => ({
  lifecycleState: "dispute_opened" as MarketplaceLifecycleState,
  disputeState: "open" as MarketplaceDisputeState,
  timeline: [
    buildTimelineEntry({ group: "lifecycle", from: null, to: "dispute_opened", actorType, note }),
    buildTimelineEntry({ group: "dispute", from: "none", to: "open", actorType, note })
  ]
});

export const buildDisputeReviewState = (actorType: StateTimelineActor = "admin", note?: string | null) => ({
  lifecycleState: "under_admin_review" as MarketplaceLifecycleState,
  disputeState: "under_review" as MarketplaceDisputeState,
  timeline: [
    buildTimelineEntry({ group: "lifecycle", from: "dispute_opened", to: "under_admin_review", actorType, note }),
    buildTimelineEntry({ group: "dispute", from: "open", to: "under_review", actorType, note })
  ]
});

export const buildRefundState = (actorType: StateTimelineActor = "admin", note?: string | null) => ({
  lifecycleState: "refunded" as MarketplaceLifecycleState,
  paymentState: "refunded" as MarketplacePaymentState,
  settlementState: "refunded" as MarketplaceSettlementState,
  disputeState: "resolved_buyer" as MarketplaceDisputeState,
  timeline: [
    buildTimelineEntry({ group: "lifecycle", from: "under_admin_review", to: "refund_approved", actorType, note }),
    buildTimelineEntry({ group: "lifecycle", from: "refund_approved", to: "refunded", actorType, note }),
    buildTimelineEntry({ group: "payment", from: "held_in_escrow", to: "refunded", actorType, note }),
    buildTimelineEntry({ group: "settlement", from: "refund_pending", to: "refunded", actorType, note }),
    buildTimelineEntry({ group: "dispute", from: "under_review", to: "resolved_buyer", actorType, note })
  ]
});

export const buildReleaseApprovedState = (actorType: StateTimelineActor = "admin", note?: string | null) => ({
  lifecycleState: "release_approved" as MarketplaceLifecycleState,
  disputeState: "resolved_seller" as MarketplaceDisputeState,
  timeline: [
    buildTimelineEntry({ group: "lifecycle", from: "under_admin_review", to: "release_approved", actorType, note }),
    buildTimelineEntry({ group: "dispute", from: "under_review", to: "resolved_seller", actorType, note })
  ]
});

export const buildRemediationRequiredState = (actorType: StateTimelineActor = "admin", note?: string | null) => ({
  lifecycleState: "remediation_required" as MarketplaceLifecycleState,
  disputeState: "resolved_partial" as MarketplaceDisputeState,
  timeline: [
    buildTimelineEntry({ group: "lifecycle", from: "under_admin_review", to: "remediation_required", actorType, note }),
    buildTimelineEntry({ group: "dispute", from: "under_review", to: "resolved_partial", actorType, note })
  ]
});

export const resolveCompletionMode = (sourceType: PaymentSourceType, categoryKey: SettlementCategory) => {
  if (sourceType === "PRODUCT_ORDER") return "delivery_based";
  return fulfillmentModeByCategory[categoryKey] || "generic_completion";
};

export const getBuyerLifecycleLabel = (state: MarketplaceLifecycleState, locale?: AppLocale) =>
  buyerStatusKeys[state] ? t(locale, buyerStatusKeys[state] as MessageKey) : state.replace(/_/g, " ");

export const getSellerLifecycleLabel = (state: MarketplaceLifecycleState, locale?: AppLocale) =>
  sellerStatusKeys[state] ? t(locale, sellerStatusKeys[state] as MessageKey) : state.replace(/_/g, " ");
