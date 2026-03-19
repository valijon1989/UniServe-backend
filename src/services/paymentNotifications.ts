import mongoose from "mongoose";
import { Notification } from "../models/Notification";
import { NotificationEvent } from "../models/NotificationEvent";
import { sendToUser } from "../utils/websocket";
import type { AppLocale } from "../i18n";
import { formatCurrencyForLocale, formatReviewWindowSuffix, t } from "../i18n";

const toUserId = (value?: mongoose.Types.ObjectId | string | null) => {
  const raw = String(value || "").trim();
  return raw || null;
};

export const createSystemNotification = async (
  userId: mongoose.Types.ObjectId | string | null | undefined,
  message: string,
  options?: {
    eventKey?: string;
    channel?: "IN_APP" | "SMS" | "EMAIL" | "TELEGRAM";
    payload?: Record<string, unknown> | null;
  }
) => {
  const normalized = toUserId(userId);
  if (!normalized) return;
  await Notification.create({
    user: new mongoose.Types.ObjectId(normalized),
    type: "SYSTEM",
    message
  });
  await NotificationEvent.create({
    userId: new mongoose.Types.ObjectId(normalized),
    eventKey: options?.eventKey || "SYSTEM_NOTIFICATION",
    channel: options?.channel || "IN_APP",
    payload: {
      message,
      ...(options?.payload || {})
    },
    sentAt: new Date(),
    deliveryStatus: "SENT"
  });
  sendToUser(normalized, "system_notification", { message });
};

export const notifyPaymentHeld = async (params: {
  buyerId: mongoose.Types.ObjectId | string;
  sellerId?: mongoose.Types.ObjectId | string | null;
  amount: number;
  currency: string;
  trustCopy: string;
  sourceLabel: string;
  locale?: AppLocale;
  sellerLocale?: AppLocale;
}) => {
  const buyerAmount = formatCurrencyForLocale(params.amount, params.currency, params.locale);
  const buyerMessage = t(params.locale, "notifications.payments.held.buyer", {
    sourceLabel: params.sourceLabel,
    amount: buyerAmount,
    trustCopy: params.trustCopy
  });
  await createSystemNotification(params.buyerId, buyerMessage);
  if (params.sellerId) {
    const sellerMessage = t(params.sellerLocale || params.locale, "notifications.payments.held.seller", {
      sourceLabel: params.sourceLabel
    });
    await createSystemNotification(params.sellerId, sellerMessage);
  }
};

export const notifyAwaitingBuyerReview = async (params: {
  buyerId: mongoose.Types.ObjectId | string;
  sellerId?: mongoose.Types.ObjectId | string | null;
  sourceLabel: string;
  reviewWindowEndsAt?: Date | null;
  locale?: AppLocale;
  sellerLocale?: AppLocale;
}) => {
  const reviewWindow = formatReviewWindowSuffix(params.reviewWindowEndsAt, params.locale);
  await createSystemNotification(
    params.buyerId,
    t(params.locale, "notifications.payments.awaiting_review.buyer", {
      sourceLabel: params.sourceLabel,
      reviewWindow
    })
  );
  if (params.sellerId) {
    await createSystemNotification(
      params.sellerId,
      t(params.sellerLocale || params.locale, "notifications.payments.awaiting_review.seller", {
        sourceLabel: params.sourceLabel
      })
    );
  }
};

export const notifyDisputeState = async (params: {
  buyerId: mongoose.Types.ObjectId | string;
  sellerId?: mongoose.Types.ObjectId | string | null;
  buyerMessage: string;
  sellerMessage?: string;
}) => {
  await createSystemNotification(params.buyerId, params.buyerMessage);
  if (params.sellerId && params.sellerMessage) {
    await createSystemNotification(params.sellerId, params.sellerMessage);
  }
};

export const notifyFundsReleasedToSeller = async (params: {
  buyerId: mongoose.Types.ObjectId | string;
  sellerId?: mongoose.Types.ObjectId | string | null;
  amount: number;
  currency: string;
  sourceLabel: string;
  reason: string;
  locale?: AppLocale;
  sellerLocale?: AppLocale;
}) => {
  const buyerAmount = formatCurrencyForLocale(params.amount, params.currency, params.locale);
  await createSystemNotification(
    params.buyerId,
    t(params.locale, "notifications.payments.release.buyer", {
      sourceLabel: params.sourceLabel,
      amount: buyerAmount,
      reason: params.reason
    })
  );
  if (params.sellerId) {
    const sellerAmount = formatCurrencyForLocale(params.amount, params.currency, params.sellerLocale || params.locale);
    await createSystemNotification(
      params.sellerId,
      t(params.sellerLocale || params.locale, "notifications.payments.release.seller", {
        sourceLabel: params.sourceLabel,
        amount: sellerAmount,
        reason: params.reason
      })
    );
  }
};

export const notifyRefundDecision = async (params: {
  buyerId: mongoose.Types.ObjectId | string;
  sellerId?: mongoose.Types.ObjectId | string | null;
  amount: number;
  currency: string;
  sourceLabel: string;
  approved: boolean;
  reason: string;
  locale?: AppLocale;
  sellerLocale?: AppLocale;
}) => {
  const buyerAmount = formatCurrencyForLocale(params.amount, params.currency, params.locale);
  const buyerMessage = params.approved
    ? t(params.locale, "notifications.payments.refund_approved.buyer", {
        sourceLabel: params.sourceLabel,
        amount: buyerAmount,
        reason: params.reason
      })
    : t(params.locale, "notifications.payments.refund_denied.buyer", {
        sourceLabel: params.sourceLabel,
        reason: params.reason
      });
  await createSystemNotification(params.buyerId, buyerMessage);
  if (params.sellerId) {
    const sellerAmount = formatCurrencyForLocale(params.amount, params.currency, params.sellerLocale || params.locale);
    const sellerMessage = params.approved
      ? t(params.sellerLocale || params.locale, "notifications.payments.refund_approved.seller", {
          sourceLabel: params.sourceLabel,
          amount: sellerAmount,
          reason: params.reason
        })
      : t(params.sellerLocale || params.locale, "notifications.payments.refund_denied.seller", {
          sourceLabel: params.sourceLabel,
          reason: params.reason
        });
    await createSystemNotification(params.sellerId, sellerMessage);
  }
};

export const notifyPayoutStatus = async (params: {
  sellerId: mongoose.Types.ObjectId | string;
  amount: number;
  currency: string;
  status: string;
  reason?: string;
  locale?: AppLocale;
}) => {
  const amount = formatCurrencyForLocale(params.amount, params.currency, params.locale);
  await createSystemNotification(
    params.sellerId,
    t(params.locale, "notifications.payments.payout_status.text", {
      status: params.status.toLowerCase(),
      amount,
      reason: params.reason || ""
    })
  );
};
