import { Request, Response } from "express";
import { buildRecommendationModules, recordRecommendationSignal } from "../services/recommendationEngine";
import { t } from "../i18n";

const normalizeText = (value: unknown) => String(value ?? "").trim();

export const getHomeRecommendations = async (req: Request, res: Response) => {
  try {
    const modules = await buildRecommendationModules({
      surface: "HOME",
      locale: req.locale,
      userId: req.user?._id || null,
      sessionId: normalizeText(req.query.sessionId) || null,
      region: normalizeText(req.query.region) || null,
      location: normalizeText(req.query.location) || null,
      categoryKey: normalizeText(req.query.categoryKey || req.query.category) || null,
      limitPerModule: Number(req.query.limit || 6)
    });
    return res.json({ modules });
  } catch (error) {
    console.error("getHomeRecommendations error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const getDetailRecommendations = async (req: Request, res: Response) => {
  try {
    const entityType = normalizeText(req.params.entityType || req.query.entityType).toUpperCase();
    const allowed = new Set(["PRODUCT", "SERVICE", "AGENT", "COURSE", "COMMUNITY_GROUP", "NEWS"]);
    if (!allowed.has(entityType)) {
      return res.status(400).json({ message: t(req, "recommendations.validation.entity_type_invalid.message") });
    }

    const modules = await buildRecommendationModules({
      surface: "DETAIL",
      locale: req.locale,
      userId: req.user?._id || null,
      sessionId: normalizeText(req.query.sessionId) || null,
      region: normalizeText(req.query.region) || null,
      location: normalizeText(req.query.location) || null,
      categoryKey: normalizeText(req.query.categoryKey || req.query.category) || null,
      entityType: entityType as any,
      entityId: normalizeText(req.params.identifier || req.query.entityId) || null,
      entityIdentifier: normalizeText(req.params.identifier || req.query.slug) || null,
      limitPerModule: Number(req.query.limit || 6)
    });

    return res.json({ modules });
  } catch (error) {
    console.error("getDetailRecommendations error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const getCartRecommendations = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const cartProductIds = Array.isArray(req.query.productIds)
      ? req.query.productIds.map((value) => normalizeText(value)).filter(Boolean)
      : normalizeText(req.query.productIds)
        .split(",")
        .map((value) => normalizeText(value))
        .filter(Boolean);

    const modules = await buildRecommendationModules({
      surface: "CART",
      locale: req.locale,
      userId: req.user._id,
      cartProductIds,
      region: normalizeText(req.query.region) || null,
      location: normalizeText(req.query.location) || null,
      limitPerModule: Number(req.query.limit || 6)
    });

    return res.json({ modules });
  } catch (error) {
    console.error("getCartRecommendations error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const getOrderSuccessRecommendations = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });

    const modules = await buildRecommendationModules({
      surface: "ORDER_SUCCESS",
      locale: req.locale,
      userId: req.user._id,
      categoryKey: normalizeText(req.query.categoryKey || req.query.category) || null,
      limitPerModule: Number(req.query.limit || 6)
    });

    return res.json({
      orderId: normalizeText(req.params.orderId || req.params.id),
      modules
    });
  } catch (error) {
    console.error("getOrderSuccessRecommendations error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const createRecommendationSignal = async (req: Request, res: Response) => {
  try {
    const entityType = normalizeText(req.body.entityType).toUpperCase();
    const action = normalizeText(req.body.action).toUpperCase();
    if (!entityType || !action) {
      return res.status(400).json({ message: t(req, "recommendations.validation.signal_required.message") });
    }

    const signal = await recordRecommendationSignal({
      userId: req.user?._id || null,
      sessionId: normalizeText(req.body.sessionId || req.query.sessionId) || null,
      entityType: entityType as any,
      entityId: normalizeText(req.body.entityId) || null,
      entityIdentifier: normalizeText(req.body.entityIdentifier || req.body.slug) || null,
      action: action as any,
      queryText: normalizeText(req.body.queryText || req.body.query) || null,
      categoryKey: normalizeText(req.body.categoryKey || req.body.category) || null,
      subcategoryKey: normalizeText(req.body.subcategoryKey || req.body.subcategory) || null,
      locale: req.locale,
      languagePreference: normalizeText(req.body.languagePreference) || null,
      region: normalizeText(req.body.region) || null,
      location: normalizeText(req.body.location) || null,
      weight: Number.isFinite(Number(req.body.weight)) ? Number(req.body.weight) : undefined,
      metadata: req.body.metadata || null
    });

    return res.status(201).json({ signalId: String(signal._id) });
  } catch (error) {
    console.error("createRecommendationSignal error", error);
    return res.status(500).json({ message: (error as Error)?.message || t(req, "common.errors.server.message") });
  }
};
