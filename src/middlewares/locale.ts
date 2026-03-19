import type { NextFunction, Request, Response } from "express";
import { DEFAULT_LOCALE, resolveLocale } from "../i18n";

const pickLocaleHint = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) {
    const first = value.find((entry) => typeof entry === "string" && entry.trim());
    return typeof first === "string" ? first : undefined;
  }
  return undefined;
};

export const localeMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const explicitLocale =
    pickLocaleHint(req.query?.locale) ||
    pickLocaleHint(req.query?.lang) ||
    pickLocaleHint(req.headers["x-locale"]) ||
    pickLocaleHint(req.cookies?.locale) ||
    pickLocaleHint(req.cookies?.lang) ||
    pickLocaleHint(req.headers["accept-language"]);
  req.locale = resolveLocale(explicitLocale || DEFAULT_LOCALE);
  next();
};
