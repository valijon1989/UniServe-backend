import * as assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { resolveRequestLocale } from "../src/i18n";
import { localeMiddleware } from "../src/middlewares/locale";

const buildRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    headers: {},
    query: {},
    cookies: {},
    ...overrides
  }) as Request;

test("locale middleware prefers explicit query locale over browser language", () => {
  const req = buildRequest({
    query: { lang: "ko" },
    headers: { "accept-language": "en-US,en;q=0.9" }
  });
  let nextCalled = false;

  localeMiddleware(req, {} as Response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.locale, "ko");
});

test("resolveRequestLocale falls back to locale cookie before accept-language", () => {
  const locale = resolveRequestLocale({
    headers: { "accept-language": "ru-RU,ru;q=0.9" },
    query: {},
    cookies: { locale: "en" }
  } as Request);

  assert.equal(locale, "en");
});
