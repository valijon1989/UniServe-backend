import type { Request, Response } from "express";
import { t } from "../i18n";

type MessageField = "message" | "error";

export const respondLocalizedMessage = (
  req: Request,
  res: Response,
  status: number,
  key: string,
  field: MessageField = "message"
) => res.status(status).json({ [field]: t(req, key) });

export const respondAuthRequired = (req: Request, res: Response) =>
  respondLocalizedMessage(req, res, 401, "auth.session.required.message");

export const respondForbidden = (req: Request, res: Response) =>
  respondLocalizedMessage(req, res, 403, "common.errors.forbidden.message");

export const respondServerError = (req: Request, res: Response, field: MessageField = "message") =>
  respondLocalizedMessage(req, res, 500, "common.errors.server.message", field);

export const respondRateLimited = (req: Request, res: Response, key = "common.errors.rate_limited.message") =>
  respondLocalizedMessage(req, res, 429, key);

export const respondAdminContextMissing = (req: Request, res: Response) =>
  respondLocalizedMessage(req, res, 500, "admin.governance.context_missing.message");

export const respondPrimaryAdminRequired = (req: Request, res: Response) =>
  respondLocalizedMessage(req, res, 403, "admin.governance.primary_required.message");

export const respondProtectedAdminTarget = (req: Request, res: Response) =>
  respondLocalizedMessage(req, res, 403, "admin.governance.target_protected.message");
