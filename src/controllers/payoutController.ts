import mongoose from "mongoose";
import { Request, Response } from "express";
import { Payment } from "../models/Payment";
import { PayoutRequest } from "../models/PayoutRequest";
import { SellerPayoutAccount } from "../models/SellerPayoutAccount";
import { requestSellerPayout } from "../services/paymentEngine";
import { t } from "../i18n";
import { respondAuthRequired } from "../utils/controllerResponses";

const normalizeText = (value: unknown) => String(value || "").trim();

const toPayoutDto = (item: any) => ({
  id: String(item._id),
  sellerId: String(item.sellerId),
  paymentIds: Array.isArray(item.paymentIds) ? item.paymentIds.map((id: any) => String(id)) : [],
  bucketKey: item.bucketKey,
  categoryKey: item.categoryKey,
  amount: Number(item.amount || 0),
  currency: item.currency || "USD",
  status: item.status,
  payoutMethod: item.payoutMethod,
  payoutAccountSnapshot: item.payoutAccountSnapshot || null,
  requestedAt: item.requestedAt,
  reviewedAt: item.reviewedAt || null,
  transferredAt: item.transferredAt || null,
  holdReason: item.holdReason || null,
  failureReason: item.failureReason || null,
  adminNote: item.adminNote || null,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

const toPayoutAccountDto = (item: any) => ({
  id: String(item._id),
  userId: String(item.userId),
  accountType: item.accountType,
  holderName: item.holderName,
  bankName: item.bankName || null,
  accountNumberMasked: item.accountNumberMasked,
  routingOrBankCode: item.routingOrBankCode || null,
  country: item.country || null,
  currency: item.currency || "USD",
  isVerified: Boolean(item.isVerified),
  isDefault: Boolean(item.isDefault),
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

export const listPayoutAccounts = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const items = await SellerPayoutAccount.find({ userId: new mongoose.Types.ObjectId(req.user._id) }).sort({ isDefault: -1, createdAt: -1 }).lean();
    return res.json({ items: items.map((item) => toPayoutAccountDto(item)) });
  } catch (error) {
    console.error("listPayoutAccounts error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const createPayoutAccount = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const holderName = normalizeText(req.body.holderName);
    const accountNumberMasked = normalizeText(req.body.accountNumberMasked || req.body.accountMask);
    if (!holderName || !accountNumberMasked) {
      return res.status(400).json({ message: t(req, "payouts.accounts.validation.required.message") });
    }
    if (req.body.isDefault) {
      await SellerPayoutAccount.updateMany({ userId: req.user._id }, { $set: { isDefault: false } });
    }
    const account = await SellerPayoutAccount.create({
      userId: req.user._id,
      accountType: normalizeText(req.body.accountType || "BANK_ACCOUNT").toUpperCase(),
      holderName,
      bankName: normalizeText(req.body.bankName) || null,
      accountNumberMasked,
      routingOrBankCode: normalizeText(req.body.routingOrBankCode || req.body.bankCode) || null,
      country: normalizeText(req.body.country) || null,
      currency: normalizeText(req.body.currency || "USD") || "USD",
      isVerified: false,
      isDefault: Boolean(req.body.isDefault),
      encryptedPayload: normalizeText(req.body.encryptedPayload) || null
    });
    return res.status(201).json({ account: toPayoutAccountDto(account) });
  } catch (error) {
    console.error("createPayoutAccount error", error);
    return res.status(500).json({ message: (error as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const updatePayoutAccount = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const accountId = String(req.params.accountId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(accountId)) {
      return res.status(400).json({ message: t(req, "payouts.accounts.validation.invalid_id.message") });
    }
    const account = await SellerPayoutAccount.findOne({ _id: accountId, userId: req.user._id });
    if (!account) return res.status(404).json({ message: t(req, "payouts.accounts.lookup.not_found.message") });
    if (req.body.isDefault) {
      await SellerPayoutAccount.updateMany({ userId: req.user._id }, { $set: { isDefault: false } });
    }
    if (typeof req.body.holderName !== "undefined") account.holderName = normalizeText(req.body.holderName) || account.holderName;
    if (typeof req.body.bankName !== "undefined") account.bankName = normalizeText(req.body.bankName) || null;
    if (typeof req.body.accountNumberMasked !== "undefined") account.accountNumberMasked = normalizeText(req.body.accountNumberMasked) || account.accountNumberMasked;
    if (typeof req.body.routingOrBankCode !== "undefined") account.routingOrBankCode = normalizeText(req.body.routingOrBankCode) || null;
    if (typeof req.body.country !== "undefined") account.country = normalizeText(req.body.country) || null;
    if (typeof req.body.currency !== "undefined") account.currency = normalizeText(req.body.currency) || account.currency;
    if (typeof req.body.isDefault !== "undefined") account.isDefault = Boolean(req.body.isDefault);
    if (typeof req.body.encryptedPayload !== "undefined") account.encryptedPayload = normalizeText(req.body.encryptedPayload) || null;
    await account.save();
    return res.json({ account: toPayoutAccountDto(account) });
  } catch (error) {
    console.error("updatePayoutAccount error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const getPayoutBalance = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const sellerId = new mongoose.Types.ObjectId(req.user._id);
    const [payments, requests] = await Promise.all([
      Payment.find({ sellerId }).select("sellerPendingPayoutAmount workflowStatus").lean(),
      PayoutRequest.find({ sellerId, status: { $in: ["PENDING", "ON_HOLD", "UNDER_REVIEW", "APPROVED", "PROCESSING"] } })
        .select("amount status currency")
        .lean()
    ]);
    const available = payments
      .filter((item) => item.workflowStatus === "RELEASED_TO_AGENT")
      .reduce((sum, item) => sum + Number(item.sellerPendingPayoutAmount || 0), 0);
    const requested = requests
      .filter((item) => ["PENDING", "APPROVED", "PROCESSING"].includes(String(item.status)))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const held = requests
      .filter((item) => ["ON_HOLD", "UNDER_REVIEW"].includes(String(item.status)))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return res.json({
      sellerId: req.user._id,
      available,
      held,
      requested,
      currency: requests[0]?.currency || "USD"
    });
  } catch (error) {
    console.error("getPayoutBalance error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const requestPayout = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const payoutAccountId = String(req.body.payoutAccountId || req.body.payout_account_id || "").trim();
    if (payoutAccountId && !mongoose.Types.ObjectId.isValid(payoutAccountId)) {
      return res.status(400).json({ message: t(req, "payouts.accounts.validation.invalid_id.message") });
    }
    if (payoutAccountId) {
      const account = await SellerPayoutAccount.findOne({ _id: payoutAccountId, userId: req.user._id }).lean();
      if (!account) return res.status(404).json({ message: t(req, "payouts.accounts.lookup.not_found.message") });
    }
    const request = await requestSellerPayout({
      sellerId: req.user._id,
      categoryKey: normalizeText(req.body.categoryKey) || undefined,
      payoutMethod: normalizeText(req.body.payoutMethod) || undefined,
      payoutAccountId: payoutAccountId || undefined
    });
    return res.status(201).json({ payoutRequest: toPayoutDto(request) });
  } catch (error) {
    console.error("requestPayout error", error);
    return res.status(500).json({ message: (error as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const listMyPayoutRequests = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const items = await PayoutRequest.find({ sellerId: new mongoose.Types.ObjectId(req.user._id) })
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ items: items.map((item) => toPayoutDto(item)) });
  } catch (error) {
    console.error("listMyPayoutRequests error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const getPayoutRequestDetail = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const requestId = String(req.params.requestId || req.params.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ message: t(req, "payouts.validation.request_id.message") });
    }
    const item = await PayoutRequest.findOne({ _id: requestId, sellerId: req.user._id }).lean();
    if (!item) return res.status(404).json({ message: t(req, "payouts.lookup.not_found.message") });
    return res.json({ payoutRequest: toPayoutDto(item) });
  } catch (error) {
    console.error("getPayoutRequestDetail error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const listSettlementHistory = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const sellerId = new mongoose.Types.ObjectId(req.user._id);
    const items = await Payment.find({ sellerId, $or: [{ releasedAmount: { $gt: 0 } }, { payoutTransferredAt: { $ne: null } }] })
      .sort({ updatedAt: -1 })
      .lean();
    return res.json({
      items: items.map((item) => ({
        paymentId: String(item._id),
        orderId: String(item.orderId),
        categoryKey: item.categoryKey,
        releasedAmount: Number(item.releasedAmount || 0),
        sellerPendingPayoutAmount: Number(item.sellerPendingPayoutAmount || 0),
        payoutTransferredAt: item.payoutTransferredAt || null,
        workflowStatus: item.workflowStatus,
        currency: item.currency || "USD",
        updatedAt: item.updatedAt
      }))
    });
  } catch (error) {
    console.error("listSettlementHistory error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};
