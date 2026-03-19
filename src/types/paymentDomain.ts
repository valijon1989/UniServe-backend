export const SETTLEMENT_CATEGORY_VALUES = [
  "shopping",
  "services",
  "translation",
  "legal",
  "psychology",
  "education",
  "consulting",
  "sport",
  "human_services",
  "transport",
  "other"
] as const;
export type SettlementCategory = (typeof SETTLEMENT_CATEGORY_VALUES)[number];

export const PAYMENT_SOURCE_TYPE_VALUES = [
  "PRODUCT_ORDER",
  "SERVICE_ORDER",
  "COURSE_ENROLLMENT",
  "SESSION_PACKAGE",
  "CONSULTING_REQUEST",
  "OTHER"
] as const;
export type PaymentSourceType = (typeof PAYMENT_SOURCE_TYPE_VALUES)[number];

export const PAYMENT_WORKFLOW_STATUS_VALUES = [
  "INITIATED",
  "AUTHORIZED",
  "PAID",
  "HELD_IN_ESCROW",
  "IN_PROGRESS",
  "DELIVERED",
  "AWAITING_BUYER_CONFIRMATION",
  "RELEASED_TO_AGENT",
  "DISPUTE_OPENED",
  "UNDER_REVIEW",
  "REFUND_APPROVED",
  "REFUNDED",
  "RELEASE_APPROVED",
  "CANCELLED",
  "CHARGEBACK_FLAGGED"
] as const;
export type PaymentWorkflowStatus = (typeof PAYMENT_WORKFLOW_STATUS_VALUES)[number];

export const PAYMENT_COLLECTION_STATUS_VALUES = [
  "DRAFT",
  "AWAITING_PAYMENT",
  "PAYMENT_LINK_SENT",
  "AWAITING_MANUAL_TRANSFER",
  "PAYMENT_PENDING_VERIFICATION",
  "PAID",
  "HELD_IN_ESCROW",
  "PAYMENT_FAILED",
  "PAYMENT_EXPIRED",
  "CANCELLED"
] as const;
export type PaymentCollectionStatus = (typeof PAYMENT_COLLECTION_STATUS_VALUES)[number];

export const PAYMENT_METHOD_GROUP_VALUES = [
  "INSTANT_ONLINE",
  "PLATFORM_LINKED",
  "SMS_LINK",
  "SMS_INVOICE",
  "MANUAL_BANK_TRANSFER",
  "FUTURE_MODERN"
] as const;
export type PaymentMethodGroup = (typeof PAYMENT_METHOD_GROUP_VALUES)[number];

export const PAYMENT_METHOD_CODE_VALUES = [
  "CARD",
  "PAYME",
  "CLICK",
  "KAKAOPAY",
  "SMS_PAYMENT_LINK",
  "SMS_INVOICE",
  "MANUAL_BANK_TRANSFER",
  "FUTURE_PSP"
] as const;
export type PaymentMethodCode = (typeof PAYMENT_METHOD_CODE_VALUES)[number];

export const PAYMENT_NEXT_ACTION_TYPE_VALUES = [
  "NONE",
  "REDIRECT",
  "OPEN_MODAL",
  "SMS_SENT",
  "SHOW_INVOICE",
  "SHOW_BANK_DETAILS",
  "WAIT_FOR_VERIFICATION"
] as const;
export type PaymentNextActionType = (typeof PAYMENT_NEXT_ACTION_TYPE_VALUES)[number];

export const PAYMENT_INTENT_STATUS_VALUES = [...PAYMENT_COLLECTION_STATUS_VALUES] as const;
export type PaymentIntentStatus = (typeof PAYMENT_INTENT_STATUS_VALUES)[number];

export const INVOICE_KIND_VALUES = ["PAYMENT_LINK", "SMS_INVOICE", "MANUAL_BANK_TRANSFER"] as const;
export type InvoiceKind = (typeof INVOICE_KIND_VALUES)[number];

export const INVOICE_STATUS_VALUES = [
  "OPEN",
  "SENT",
  "AWAITING_TRANSFER",
  "PAID",
  "EXPIRED",
  "CANCELLED"
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUS_VALUES)[number];

export const SMS_PAYMENT_TYPE_VALUES = ["PAYMENT_LINK", "INVOICE"] as const;
export type SmsPaymentType = (typeof SMS_PAYMENT_TYPE_VALUES)[number];

export const SMS_VERIFICATION_STATE_VALUES = ["VERIFIED", "OTP_READY", "OTP_REQUIRED"] as const;
export type SmsVerificationState = (typeof SMS_VERIFICATION_STATE_VALUES)[number];

export const SMS_DELIVERY_STATUS_VALUES = [
  "QUEUED",
  "SENT",
  "DELIVERED",
  "FAILED",
  "EXPIRED",
  "CANCELLED"
] as const;
export type SmsDeliveryStatus = (typeof SMS_DELIVERY_STATUS_VALUES)[number];

export const BANK_TRANSFER_STATUS_VALUES = [
  "AWAITING_TRANSFER",
  "RECEIPT_UPLOADED",
  "UNDER_VERIFICATION",
  "CONFIRMED",
  "FAILED",
  "EXPIRED",
  "CANCELLED"
] as const;
export type BankTransferStatus = (typeof BANK_TRANSFER_STATUS_VALUES)[number];

export const PROVIDER_EVENT_STATUS_VALUES = ["RECEIVED", "PROCESSED", "FAILED", "IGNORED"] as const;
export type ProviderEventStatus = (typeof PROVIDER_EVENT_STATUS_VALUES)[number];

export const MARKETPLACE_LIFECYCLE_STATE_VALUES = [
  "draft",
  "checkout_started",
  "awaiting_payment",
  "payment_link_sent",
  "awaiting_manual_transfer",
  "payment_pending_verification",
  "paid",
  "held_in_escrow",
  "fulfillment_started",
  "delivered_or_completed",
  "awaiting_buyer_confirmation",
  "released_to_seller_pending_payout",
  "payout_processing",
  "payout_completed",
  "dispute_opened",
  "under_admin_review",
  "refund_approved",
  "refunded",
  "release_approved",
  "cancelled",
  "payment_failed",
  "payment_expired",
  "remediation_required"
] as const;
export type MarketplaceLifecycleState = (typeof MARKETPLACE_LIFECYCLE_STATE_VALUES)[number];

export const MARKETPLACE_PAYMENT_STATE_VALUES = [
  "awaiting_payment",
  "payment_link_sent",
  "awaiting_manual_transfer",
  "payment_pending_verification",
  "paid",
  "held_in_escrow",
  "payment_failed",
  "payment_expired",
  "refunded"
] as const;
export type MarketplacePaymentState = (typeof MARKETPLACE_PAYMENT_STATE_VALUES)[number];

export const MARKETPLACE_FULFILLMENT_STATE_VALUES = [
  "pending",
  "in_progress",
  "delivered_or_completed",
  "awaiting_buyer_confirmation",
  "cancelled"
] as const;
export type MarketplaceFulfillmentState = (typeof MARKETPLACE_FULFILLMENT_STATE_VALUES)[number];

export const MARKETPLACE_SETTLEMENT_STATE_VALUES = [
  "none",
  "held",
  "release_pending",
  "released_to_seller_pending_payout",
  "payout_processing",
  "payout_completed",
  "refund_pending",
  "refunded"
] as const;
export type MarketplaceSettlementState = (typeof MARKETPLACE_SETTLEMENT_STATE_VALUES)[number];

export const MARKETPLACE_DISPUTE_STATE_VALUES = [
  "none",
  "open",
  "under_review",
  "resolved_buyer",
  "resolved_seller",
  "resolved_partial"
] as const;
export type MarketplaceDisputeState = (typeof MARKETPLACE_DISPUTE_STATE_VALUES)[number];

export const STATE_TIMELINE_GROUP_VALUES = [
  "lifecycle",
  "payment",
  "fulfillment",
  "settlement",
  "dispute"
] as const;
export type StateTimelineGroup = (typeof STATE_TIMELINE_GROUP_VALUES)[number];

export const STATE_TIMELINE_ACTOR_VALUES = ["system", "buyer", "seller", "admin"] as const;
export type StateTimelineActor = (typeof STATE_TIMELINE_ACTOR_VALUES)[number];

export const ESCROW_BUCKET_ACCOUNT_TYPES = [
  "PLATFORM_AVAILABLE",
  "ESCROW_HELD",
  "SELLER_PENDING_PAYOUT",
  "PAYOUT_TRANSFERRED",
  "REFUND_RESERVE",
  "CHARGEBACK_BUFFER"
] as const;
export type EscrowBucketAccountType = (typeof ESCROW_BUCKET_ACCOUNT_TYPES)[number];

export const LEDGER_DIRECTION_VALUES = ["DEBIT", "CREDIT"] as const;
export type LedgerDirection = (typeof LEDGER_DIRECTION_VALUES)[number];

export const LEDGER_ENTRY_TYPE_VALUES = [
  "PAYMENT_CAPTURED",
  "ESCROW_HOLD",
  "ORDER_MARKED_IN_PROGRESS",
  "DELIVERY_CONFIRMED",
  "SERVICE_COMPLETED",
  "RELEASE_TO_SELLER_PENDING",
  "REFUND_RESERVED",
  "REFUND_COMPLETED",
  "PAYOUT_REQUESTED",
  "PAYOUT_APPROVED",
  "PAYOUT_TRANSFERRED",
  "PAYOUT_FAILED",
  "DISPUTE_HOLD",
  "DISPUTE_EXTENSION",
  "CHARGEBACK_RECORDED",
  "RISK_REVIEW_HOLD"
] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPE_VALUES)[number];

export const PAYOUT_STATUS_VALUES = [
  "REQUESTED",
  "PENDING",
  "UNDER_REVIEW",
  "ON_HOLD",
  "HELD",
  "APPROVED",
  "PROCESSING",
  "TRANSFERRED",
  "COMPLETED",
  "FAILED",
  "CANCELLED"
] as const;
export type PayoutStatus = (typeof PAYOUT_STATUS_VALUES)[number];

export const DISPUTE_STATUS_VALUES = [
  "OPEN",
  "UNDER_REVIEW",
  "WAITING_SELLER_RESPONSE",
  "WAITING_BUYER_RESPONSE",
  "HOLD_EXTENDED",
  "RESOLVED_BUYER",
  "RESOLVED_SELLER",
  "RESOLVED_PARTIAL",
  "DECIDED",
  "CLOSED"
] as const;
export type DisputeStatus = (typeof DISPUTE_STATUS_VALUES)[number];

export const DISPUTE_DESIRED_RESOLUTION_VALUES = [
  "FULL_REFUND",
  "PARTIAL_REFUND",
  "REWORK",
  "REDELIVERY",
  "RELEASE_TO_SELLER",
  "HOLD_EXTENSION"
] as const;
export type DisputeDesiredResolution = (typeof DISPUTE_DESIRED_RESOLUTION_VALUES)[number];

export const DISPUTE_OUTCOME_VALUES = [
  "FULL_REFUND",
  "PARTIAL_REFUND",
  "RELEASE_TO_SELLER",
  "SPLIT_DECISION",
  "REWORK",
  "REDELIVERY",
  "HOLD_EXTENSION",
  "NO_ACTION"
] as const;
export type DisputeOutcome = (typeof DISPUTE_OUTCOME_VALUES)[number];

export const RISK_TARGET_TYPE_VALUES = ["BUYER", "SELLER", "PAYMENT", "DISPUTE", "PAYOUT"] as const;
export type RiskTargetType = (typeof RISK_TARGET_TYPE_VALUES)[number];

export const RISK_SEVERITY_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type RiskSeverity = (typeof RISK_SEVERITY_VALUES)[number];

export const RISK_STATUS_VALUES = ["OPEN", "REVIEWED", "RESOLVED", "DISMISSED"] as const;
export type RiskStatus = (typeof RISK_STATUS_VALUES)[number];

export const ADMIN_DECISION_MODULE_VALUES = ["PAYMENT", "DISPUTE", "PAYOUT", "RISK"] as const;
export type AdminDecisionModule = (typeof ADMIN_DECISION_MODULE_VALUES)[number];

export const ADMIN_DECISION_ACTION_VALUES = [
  "APPROVE_REFUND",
  "DENY_REFUND",
  "APPROVE_RELEASE",
  "APPROVE_PAYOUT",
  "VERIFY_MANUAL_PAYMENT",
  "HOLD_PAYOUT",
  "FLAG_FRAUD",
  "EXTEND_HOLD",
  "REQUEST_REWORK",
  "PARTIAL_SETTLEMENT"
] as const;
export type AdminDecisionAction = (typeof ADMIN_DECISION_ACTION_VALUES)[number];

export const REFUND_REQUEST_STATUS_VALUES = [
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "PROCESSED"
] as const;
export type RefundRequestStatus = (typeof REFUND_REQUEST_STATUS_VALUES)[number];

export const NOTIFICATION_CHANNEL_VALUES = ["IN_APP", "SMS", "EMAIL", "TELEGRAM"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNEL_VALUES)[number];

export const NOTIFICATION_DELIVERY_STATUS_VALUES = ["PENDING", "SENT", "DELIVERED", "FAILED"] as const;
export type NotificationDeliveryStatus = (typeof NOTIFICATION_DELIVERY_STATUS_VALUES)[number];

export const LEDGER_ACCOUNT_OWNER_TYPE_VALUES = ["PLATFORM", "SELLER", "AGENT", "BUYER", "CATEGORY_BUCKET"] as const;
export type LedgerAccountOwnerType = (typeof LEDGER_ACCOUNT_OWNER_TYPE_VALUES)[number];

export const toEscrowBucketKey = (category: SettlementCategory) => `${category}_held`;
