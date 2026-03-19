import mongoose from "mongoose";
import { Request, Response } from "express";
import { Dispute } from "../models/Dispute";
import { Order } from "../models/Order";
import { RefundRequest } from "../models/RefundRequest";
import { t } from "../i18n";
import { respondAuthRequired } from "../utils/controllerResponses";

const normalizeText = (value: unknown) => String(value || "").trim();

const parseObjectId = (value: unknown): mongoose.Types.ObjectId | null => {
  const raw = normalizeText(value);
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
};

const toRefundDto = (item: any) => ({
  id: String(item._id),
  disputeId: item.disputeId ? String(item.disputeId) : null,
  orderId: String(item.orderId),
  paymentIntentId: item.paymentIntentId ? String(item.paymentIntentId) : null,
  requestedByUserId: String(item.requestedByUserId),
  refundType: item.refundType,
  requestedAmountMinor: Number(item.requestedAmountMinor || 0),
  currency: item.currency || "USD",
  reasonText: item.reasonText,
  status: item.status,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

export const createRefundRequestResource = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const disputeId = parseObjectId(req.body.disputeId || req.body.dispute_id);
    if (!disputeId) return res.status(400).json({ message: t(req, "refunds.validation.dispute_id_required.message") });
    const dispute = await Dispute.findById(disputeId).lean();
    if (!dispute) return res.status(404).json({ message: t(req, "refunds.lookup.dispute_not_found.message") });
    if (String(dispute.buyerId) !== req.user._id && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: t(req, "refunds.access.buyer_only.message") });
    }

    const requestedAmountMinor = Math.max(0, Number(req.body.amountMinor || req.body.requestedAmountMinor || 0));
    const refund = await RefundRequest.create({
      disputeId,
      orderId: dispute.orderId,
      paymentIntentId: null,
      requestedByUserId: new mongoose.Types.ObjectId(req.user._id),
      refundType: normalizeText(req.body.refundType || "FULL").toUpperCase(),
      requestedAmountMinor,
      currency: normalizeText(req.body.currency || "USD") || "USD",
      reasonText: normalizeText(req.body.reason || req.body.reasonText || dispute.explanation),
      status: "REQUESTED"
    });
    return res.status(201).json({ refund: toRefundDto(refund) });
  } catch (error) {
    console.error("createRefundRequestResource error", error);
    return res.status(500).json({ message: (error as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const getRefundRequestResource = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const refundId = parseObjectId(req.params.id);
    if (!refundId) return res.status(400).json({ message: t(req, "refunds.validation.invalid_id.message") });
    const refund = await RefundRequest.findById(refundId).lean();
    if (!refund) return res.status(404).json({ message: t(req, "refunds.lookup.not_found.message") });

    const order = await Order.findById(refund.orderId).lean();
    const canAccess =
      req.user.role === "ADMIN" ||
      String(refund.requestedByUserId) === req.user._id ||
      (order && Array.isArray(order.items) && order.items.some((item: any) => String(item.sellerId || "") === req.user!._id));
    if (!canAccess) return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });

    return res.json({ refund: toRefundDto(refund) });
  } catch (error) {
    console.error("getRefundRequestResource error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};
