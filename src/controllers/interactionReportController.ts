import { Request, Response } from "express";
import mongoose from "mongoose";
import { InteractionReport } from "../models/InteractionReport";
import { findProductByIdentifier } from "../services/productLookup";
import { findServiceByIdentifier } from "../services/serviceLookup";
import { respondAuthRequired } from "../utils/controllerResponses";

const normalizeText = (value: unknown) => String(value || "").trim();

const buildReporterPayload = (req: Request) => {
  const reason = normalizeText(req.body.reason || req.body.message || "Inaccurate or inappropriate listing");
  const note = normalizeText(req.body.note);
  return {
    reason,
    note: note || null
  };
};

export const reportProductInteraction = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);

    const product = await findProductByIdentifier(req.params.id);
    if (!product?._id) return res.status(404).json({ message: "Product not found" });

    const { reason, note } = buildReporterPayload(req);
    const ownerId = String((product.createdBy as any)?._id || product.createdBy || "").trim();

    const report = await InteractionReport.create({
      targetType: "PRODUCT",
      targetId: new mongoose.Types.ObjectId(String(product._id)),
      targetIdentifier: normalizeText(req.params.id) || null,
      targetTitle: normalizeText((product as any)?.title),
      ownerId: ownerId && mongoose.Types.ObjectId.isValid(ownerId) ? ownerId : null,
      reporterId: req.user._id,
      reason,
      note
    });

    return res.status(201).json({
      reportId: String(report._id),
      status: report.status
    });
  } catch (err) {
    console.error("reportProductInteraction error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const reportServiceInteraction = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);

    const service = await findServiceByIdentifier(req.params.identifier);
    const { reason, note } = buildReporterPayload(req);
    const ownerId = String((service?.createdBy as any)?._id || service?.createdBy || "").trim();
    const fallbackTitle = normalizeText(req.body.targetTitle || req.body.title);

    const report = await InteractionReport.create({
      targetType: "SERVICE",
      targetId: service?._id ? new mongoose.Types.ObjectId(String(service._id)) : null,
      targetIdentifier: normalizeText(req.params.identifier) || null,
      targetTitle: normalizeText((service as any)?.title) || fallbackTitle || null,
      ownerId: ownerId && mongoose.Types.ObjectId.isValid(ownerId) ? ownerId : null,
      reporterId: req.user._id,
      reason,
      note
    });

    return res.status(201).json({
      reportId: String(report._id),
      status: report.status
    });
  } catch (err) {
    console.error("reportServiceInteraction error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
