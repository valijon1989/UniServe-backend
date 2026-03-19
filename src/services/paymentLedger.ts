import mongoose from "mongoose";
import { EscrowBucket } from "../models/EscrowBucket";
import { EscrowHold } from "../models/EscrowHold";
import { LedgerAccount } from "../models/LedgerAccount";
import { PaymentLedgerEntry } from "../models/PaymentLedgerEntry";
import type { IEscrowBucket } from "../models/EscrowBucket";
import type { ILedgerAccount } from "../models/LedgerAccount";
import type { IPaymentLedgerEntry } from "../models/PaymentLedgerEntry";
import type { PaymentSourceType, SettlementCategory } from "../types/paymentDomain";

const MASTER_SETTLEMENT_REF = "UNISERVE_MASTER_SETTLEMENT";

const toId = (value?: mongoose.Types.ObjectId | string | null) => {
  const raw = String(value || "").trim();
  return raw && mongoose.Types.ObjectId.isValid(raw) ? new mongoose.Types.ObjectId(raw) : null;
};

const clamp = (value: number) => (value < 0 ? 0 : Number(value.toFixed(2)));
const toMinorUnits = (value: number) => Math.max(0, Math.round(Number(value || 0) * 100));

export const getOrCreateEscrowBucket = async (bucketKey: string, categoryKey: SettlementCategory) =>
  EscrowBucket.findOneAndUpdate(
    { bucketKey },
    {
      $setOnInsert: {
        bucketKey,
        categoryKey,
        masterSettlementRef: MASTER_SETTLEMENT_REF
      }
    },
    { new: true, upsert: true }
  );

const getOrCreateLedgerAccount = async (payload: {
  accountOwnerType: ILedgerAccount["accountOwnerType"];
  accountOwnerId?: mongoose.Types.ObjectId | string | null;
  accountCode: string;
  currency: string;
  metadata?: Record<string, unknown>;
}) =>
  LedgerAccount.findOneAndUpdate(
    {
      accountOwnerType: payload.accountOwnerType,
      accountOwnerId: toId(payload.accountOwnerId),
      accountCode: payload.accountCode,
      currency: payload.currency || "USD"
    },
    {
      $setOnInsert: {
        accountOwnerType: payload.accountOwnerType,
        accountOwnerId: toId(payload.accountOwnerId),
        accountCode: payload.accountCode,
        currency: payload.currency || "USD",
        metadata: payload.metadata || null
      }
    },
    { new: true, upsert: true }
  );

const applyLedgerAccountDelta = async (
  account: ILedgerAccount,
  delta: Partial<Record<"balanceMinor" | "availableBalanceMinor" | "heldBalanceMinor" | "pendingPayoutBalanceMinor", number>>
) => {
  account.balanceMinor = Math.max(0, account.balanceMinor + (delta.balanceMinor || 0));
  account.availableBalanceMinor = Math.max(0, account.availableBalanceMinor + (delta.availableBalanceMinor || 0));
  account.heldBalanceMinor = Math.max(0, account.heldBalanceMinor + (delta.heldBalanceMinor || 0));
  account.pendingPayoutBalanceMinor = Math.max(0, account.pendingPayoutBalanceMinor + (delta.pendingPayoutBalanceMinor || 0));
  await account.save();
  return account;
};

const getPlatformAvailableAccount = (bucketKey: string, currency: string) =>
  getOrCreateLedgerAccount({
    accountOwnerType: "PLATFORM",
    accountCode: `platform_cash:${bucketKey}`,
    currency,
    metadata: { bucketKey }
  });

const getEscrowHeldAccount = (bucketKey: string, currency: string) =>
  getOrCreateLedgerAccount({
    accountOwnerType: "CATEGORY_BUCKET",
    accountCode: `${bucketKey}:escrow_held`,
    currency,
    metadata: { bucketKey }
  });

const getSellerPendingAccount = (sellerId: mongoose.Types.ObjectId | string | null | undefined, currency: string) =>
  getOrCreateLedgerAccount({
    accountOwnerType: sellerId ? "SELLER" : "PLATFORM",
    accountOwnerId: sellerId || null,
    accountCode: sellerId ? "seller_pending_payout" : "orphan_pending_payout",
    currency
  });

const getTransferredAccount = (sellerId: mongoose.Types.ObjectId | string | null | undefined, currency: string) =>
  getOrCreateLedgerAccount({
    accountOwnerType: sellerId ? "SELLER" : "PLATFORM",
    accountOwnerId: sellerId || null,
    accountCode: sellerId ? "payout_transferred" : "platform_payout_transferred",
    currency
  });

const saveBucketDelta = async (
  bucketKey: string,
  categoryKey: SettlementCategory,
  delta: Partial<Record<keyof Pick<IEscrowBucket, "availableBalance" | "heldBalance" | "pendingPayoutBalance" | "transferredBalance" | "refundedBalance" | "chargebackBalance">, number>>
) => {
  const bucket = await getOrCreateEscrowBucket(bucketKey, categoryKey);
  bucket.availableBalance = clamp(bucket.availableBalance + (delta.availableBalance || 0));
  bucket.heldBalance = clamp(bucket.heldBalance + (delta.heldBalance || 0));
  bucket.pendingPayoutBalance = clamp(bucket.pendingPayoutBalance + (delta.pendingPayoutBalance || 0));
  bucket.transferredBalance = clamp(bucket.transferredBalance + (delta.transferredBalance || 0));
  bucket.refundedBalance = clamp(bucket.refundedBalance + (delta.refundedBalance || 0));
  bucket.chargebackBalance = clamp(bucket.chargebackBalance + (delta.chargebackBalance || 0));
  await bucket.save();
  return bucket;
};

export const appendLedgerEntry = async (payload: {
  paymentId?: mongoose.Types.ObjectId | string | null;
  paymentIntentId?: mongoose.Types.ObjectId | string | null;
  orderId?: mongoose.Types.ObjectId | string | null;
  disputeId?: mongoose.Types.ObjectId | string | null;
  payoutRequestId?: mongoose.Types.ObjectId | string | null;
  refundRequestId?: mongoose.Types.ObjectId | string | null;
  sourceType: PaymentSourceType;
  sourceId?: mongoose.Types.ObjectId | string | null;
  sellerId?: mongoose.Types.ObjectId | string | null;
  buyerId?: mongoose.Types.ObjectId | string | null;
  bucketKey: string;
  debitAccountId?: mongoose.Types.ObjectId | string | null;
  creditAccountId?: mongoose.Types.ObjectId | string | null;
  accountType: IPaymentLedgerEntry["accountType"];
  direction: IPaymentLedgerEntry["direction"];
  entryType: IPaymentLedgerEntry["entryType"];
  amount: number;
  currency: string;
  description?: string;
  note?: string;
  metadata?: Record<string, unknown>;
}) =>
  PaymentLedgerEntry.create({
    paymentId: toId(payload.paymentId),
    paymentIntentId: toId(payload.paymentIntentId),
    orderId: toId(payload.orderId),
    disputeId: toId(payload.disputeId),
    payoutRequestId: toId(payload.payoutRequestId),
    refundRequestId: toId(payload.refundRequestId),
    sourceType: payload.sourceType,
    sourceId: toId(payload.sourceId),
    sellerId: toId(payload.sellerId),
    buyerId: toId(payload.buyerId),
    bucketKey: payload.bucketKey,
    debitAccountId: toId(payload.debitAccountId),
    creditAccountId: toId(payload.creditAccountId),
    accountType: payload.accountType,
    direction: payload.direction,
    entryType: payload.entryType,
    amount: Math.max(0, payload.amount),
    amountMinor: toMinorUnits(payload.amount),
    currency: payload.currency || "USD",
    description: payload.description,
    note: payload.note,
    metadata: payload.metadata || null
  });

export const recordEscrowCapture = async (payload: {
  paymentId?: mongoose.Types.ObjectId | string | null;
  paymentIntentId?: mongoose.Types.ObjectId | string | null;
  orderId?: mongoose.Types.ObjectId | string | null;
  sourceType: PaymentSourceType;
  sourceId?: mongoose.Types.ObjectId | string | null;
  categoryKey: SettlementCategory;
  bucketKey: string;
  sellerId?: mongoose.Types.ObjectId | string | null;
  buyerId?: mongoose.Types.ObjectId | string | null;
  amount: number;
  currency: string;
  note?: string;
}) => {
  await saveBucketDelta(payload.bucketKey, payload.categoryKey, {
    availableBalance: payload.amount,
    heldBalance: payload.amount
  });
  const [platformAvailableAccount, escrowHeldAccount] = await Promise.all([
    getPlatformAvailableAccount(payload.bucketKey, payload.currency),
    getEscrowHeldAccount(payload.bucketKey, payload.currency)
  ]);
  const amountMinor = toMinorUnits(payload.amount);
  await Promise.all([
    applyLedgerAccountDelta(platformAvailableAccount, {
      balanceMinor: amountMinor,
      availableBalanceMinor: amountMinor
    }),
    applyLedgerAccountDelta(escrowHeldAccount, {
      balanceMinor: amountMinor,
      heldBalanceMinor: amountMinor
    })
  ]);
  const holdFilter = {
    orderId: toId(payload.orderId),
    paymentIntentId: toId(payload.paymentIntentId)
  };
  if (holdFilter.orderId && holdFilter.paymentIntentId) {
    await EscrowHold.findOneAndUpdate(
      holdFilter,
      {
        $set: {
          paymentId: toId(payload.paymentId),
          bucketAccountId: escrowHeldAccount._id,
          currency: payload.currency || "USD",
          grossAmountMinor: amountMinor,
          platformFeeAmountMinor: 0,
          netHeldAmountMinor: amountMinor,
          holdStatus: "ACTIVE",
          heldAt: new Date()
        }
      },
      { new: true, upsert: true }
    );
  }
  await appendLedgerEntry({
    ...payload,
    creditAccountId: platformAvailableAccount._id,
    accountType: "PLATFORM_AVAILABLE",
    direction: "CREDIT",
    entryType: "PAYMENT_CAPTURED",
    description: "Buyer payment captured into UniServe settlement flow."
  });
  await appendLedgerEntry({
    ...payload,
    creditAccountId: escrowHeldAccount._id,
    accountType: "ESCROW_HELD",
    direction: "CREDIT",
    entryType: "ESCROW_HOLD",
    description: "Payment amount moved into escrow hold."
  });
};

export const recordLifecycleMarker = async (payload: {
  paymentId?: mongoose.Types.ObjectId | string | null;
  paymentIntentId?: mongoose.Types.ObjectId | string | null;
  orderId?: mongoose.Types.ObjectId | string | null;
  sourceType: PaymentSourceType;
  sourceId?: mongoose.Types.ObjectId | string | null;
  bucketKey: string;
  sellerId?: mongoose.Types.ObjectId | string | null;
  buyerId?: mongoose.Types.ObjectId | string | null;
  currency: string;
  entryType: IPaymentLedgerEntry["entryType"];
  note?: string;
  metadata?: Record<string, unknown>;
}) => {
  const escrowHeldAccount = await getEscrowHeldAccount(payload.bucketKey, payload.currency);
  return appendLedgerEntry({
    ...payload,
    creditAccountId: escrowHeldAccount._id,
    accountType: "ESCROW_HELD",
    direction: "CREDIT",
    amount: 0,
    entryType: payload.entryType,
    description: payload.note || "Lifecycle marker recorded."
  });
};

export const recordReleaseToSellerPending = async (payload: {
  paymentId?: mongoose.Types.ObjectId | string | null;
  paymentIntentId?: mongoose.Types.ObjectId | string | null;
  orderId?: mongoose.Types.ObjectId | string | null;
  sourceType: PaymentSourceType;
  sourceId?: mongoose.Types.ObjectId | string | null;
  categoryKey: SettlementCategory;
  bucketKey: string;
  sellerId?: mongoose.Types.ObjectId | string | null;
  buyerId?: mongoose.Types.ObjectId | string | null;
  amount: number;
  currency: string;
  note?: string;
}) => {
  await saveBucketDelta(payload.bucketKey, payload.categoryKey, {
    heldBalance: -payload.amount,
    pendingPayoutBalance: payload.amount
  });
  const [escrowHeldAccount, sellerPendingAccount] = await Promise.all([
    getEscrowHeldAccount(payload.bucketKey, payload.currency),
    getSellerPendingAccount(payload.sellerId, payload.currency)
  ]);
  const amountMinor = toMinorUnits(payload.amount);
  await Promise.all([
    applyLedgerAccountDelta(escrowHeldAccount, {
      balanceMinor: -amountMinor,
      heldBalanceMinor: -amountMinor
    }),
    applyLedgerAccountDelta(sellerPendingAccount, {
      balanceMinor: amountMinor,
      pendingPayoutBalanceMinor: amountMinor
    })
  ]);
  await EscrowHold.updateMany(
    {
      orderId: toId(payload.orderId),
      ...(payload.paymentIntentId ? { paymentIntentId: toId(payload.paymentIntentId) } : {})
    },
    {
      $set: {
        holdStatus: "RELEASED",
        releasedAt: new Date()
      }
    }
  );
  await appendLedgerEntry({
    ...payload,
    debitAccountId: escrowHeldAccount._id,
    accountType: "ESCROW_HELD",
    direction: "DEBIT",
    entryType: "RELEASE_TO_SELLER_PENDING",
    description: "Escrow hold reduced for seller pending payout."
  });
  await appendLedgerEntry({
    ...payload,
    creditAccountId: sellerPendingAccount._id,
    accountType: "SELLER_PENDING_PAYOUT",
    direction: "CREDIT",
    entryType: "RELEASE_TO_SELLER_PENDING",
    description: "Funds released into seller pending payout balance."
  });
};

export const recordRefundFromEscrow = async (payload: {
  paymentId?: mongoose.Types.ObjectId | string | null;
  paymentIntentId?: mongoose.Types.ObjectId | string | null;
  orderId?: mongoose.Types.ObjectId | string | null;
  sourceType: PaymentSourceType;
  sourceId?: mongoose.Types.ObjectId | string | null;
  categoryKey: SettlementCategory;
  bucketKey: string;
  sellerId?: mongoose.Types.ObjectId | string | null;
  buyerId?: mongoose.Types.ObjectId | string | null;
  amount: number;
  currency: string;
  note?: string;
}) => {
  await saveBucketDelta(payload.bucketKey, payload.categoryKey, {
    availableBalance: -payload.amount,
    heldBalance: -payload.amount,
    refundedBalance: payload.amount
  });
  const [platformAvailableAccount, escrowHeldAccount] = await Promise.all([
    getPlatformAvailableAccount(payload.bucketKey, payload.currency),
    getEscrowHeldAccount(payload.bucketKey, payload.currency)
  ]);
  const amountMinor = toMinorUnits(payload.amount);
  await Promise.all([
    applyLedgerAccountDelta(platformAvailableAccount, {
      balanceMinor: -amountMinor,
      availableBalanceMinor: -amountMinor
    }),
    applyLedgerAccountDelta(escrowHeldAccount, {
      balanceMinor: -amountMinor,
      heldBalanceMinor: -amountMinor
    })
  ]);
  await EscrowHold.updateMany(
    {
      orderId: toId(payload.orderId),
      ...(payload.paymentIntentId ? { paymentIntentId: toId(payload.paymentIntentId) } : {})
    },
    {
      $set: {
        holdStatus: "REFUNDED",
        refundedAt: new Date()
      }
    }
  );
  await appendLedgerEntry({
    ...payload,
    debitAccountId: escrowHeldAccount._id,
    accountType: "ESCROW_HELD",
    direction: "DEBIT",
    entryType: "REFUND_COMPLETED",
    description: "Refund amount debited from escrow hold."
  });
  await appendLedgerEntry({
    ...payload,
    debitAccountId: platformAvailableAccount._id,
    accountType: "PLATFORM_AVAILABLE",
    direction: "DEBIT",
    entryType: "REFUND_COMPLETED",
    description: "Platform settlement balance reduced for refund."
  });
};

export const recordPayoutRequested = async (payload: {
  paymentId?: mongoose.Types.ObjectId | string | null;
  paymentIntentId?: mongoose.Types.ObjectId | string | null;
  orderId?: mongoose.Types.ObjectId | string | null;
  sourceType: PaymentSourceType;
  sourceId?: mongoose.Types.ObjectId | string | null;
  bucketKey: string;
  sellerId?: mongoose.Types.ObjectId | string | null;
  buyerId?: mongoose.Types.ObjectId | string | null;
  currency: string;
  note?: string;
}) => {
  const sellerPendingAccount = await getSellerPendingAccount(payload.sellerId, payload.currency);
  return appendLedgerEntry({
    ...payload,
    creditAccountId: sellerPendingAccount._id,
    accountType: "SELLER_PENDING_PAYOUT",
    direction: "CREDIT",
    entryType: "PAYOUT_REQUESTED",
    amount: 0,
    description: payload.note || "Payout request logged."
  });
};

export const recordPayoutTransferred = async (payload: {
  paymentId?: mongoose.Types.ObjectId | string | null;
  paymentIntentId?: mongoose.Types.ObjectId | string | null;
  orderId?: mongoose.Types.ObjectId | string | null;
  sourceType: PaymentSourceType;
  sourceId?: mongoose.Types.ObjectId | string | null;
  categoryKey: SettlementCategory;
  bucketKey: string;
  sellerId?: mongoose.Types.ObjectId | string | null;
  buyerId?: mongoose.Types.ObjectId | string | null;
  amount: number;
  currency: string;
  note?: string;
}) => {
  await saveBucketDelta(payload.bucketKey, payload.categoryKey, {
    availableBalance: -payload.amount,
    pendingPayoutBalance: -payload.amount,
    transferredBalance: payload.amount
  });
  const [sellerPendingAccount, payoutTransferredAccount] = await Promise.all([
    getSellerPendingAccount(payload.sellerId, payload.currency),
    getTransferredAccount(payload.sellerId, payload.currency)
  ]);
  const amountMinor = toMinorUnits(payload.amount);
  await Promise.all([
    applyLedgerAccountDelta(sellerPendingAccount, {
      balanceMinor: -amountMinor,
      pendingPayoutBalanceMinor: -amountMinor
    }),
    applyLedgerAccountDelta(payoutTransferredAccount, {
      balanceMinor: amountMinor,
      availableBalanceMinor: amountMinor
    })
  ]);
  await appendLedgerEntry({
    ...payload,
    debitAccountId: sellerPendingAccount._id,
    accountType: "SELLER_PENDING_PAYOUT",
    direction: "DEBIT",
    entryType: "PAYOUT_TRANSFERRED",
    description: "Seller pending payout balance moved to transfer processing."
  });
  await appendLedgerEntry({
    ...payload,
    creditAccountId: payoutTransferredAccount._id,
    accountType: "PAYOUT_TRANSFERRED",
    direction: "CREDIT",
    entryType: "PAYOUT_TRANSFERRED",
    description: "Payout transferred to seller external settlement route."
  });
};

export const recordChargeback = async (payload: {
  paymentId?: mongoose.Types.ObjectId | string | null;
  paymentIntentId?: mongoose.Types.ObjectId | string | null;
  orderId?: mongoose.Types.ObjectId | string | null;
  sourceType: PaymentSourceType;
  sourceId?: mongoose.Types.ObjectId | string | null;
  categoryKey: SettlementCategory;
  bucketKey: string;
  sellerId?: mongoose.Types.ObjectId | string | null;
  buyerId?: mongoose.Types.ObjectId | string | null;
  amount: number;
  currency: string;
  note?: string;
}) => {
  await saveBucketDelta(payload.bucketKey, payload.categoryKey, {
    availableBalance: -payload.amount,
    chargebackBalance: payload.amount
  });
  const platformAvailableAccount = await getPlatformAvailableAccount(payload.bucketKey, payload.currency);
  const amountMinor = toMinorUnits(payload.amount);
  await applyLedgerAccountDelta(platformAvailableAccount, {
    balanceMinor: -amountMinor,
    availableBalanceMinor: -amountMinor
  });
  await appendLedgerEntry({
    ...payload,
    debitAccountId: platformAvailableAccount._id,
    accountType: "CHARGEBACK_BUFFER",
    direction: "CREDIT",
    entryType: "CHARGEBACK_RECORDED",
    description: "Chargeback amount flagged against platform settlement balance."
  });
};
