import { JwtUserPayload } from "../utils/jwt";
import type { AdminPermissionKey } from "../services/adminBlueprint";
import type { AppLocale } from "../i18n";

type AdminLevel = "PRIMARY" | "MANAGER" | "STAFF" | undefined;

interface AdminScopeShape {
  module: string;
  region?: string;
  countryCode?: string;
  categoryId?: string;
  subcategoryId?: string;
}

declare global {
  namespace Express {
    interface Request {
      locale?: AppLocale;
      user?: JwtUserPayload;
      adminContext?: {
        userId: string;
        adminLevel?: AdminLevel;
        permissions: AdminPermissionKey[];
        scopes: AdminScopeShape[];
        mfaEnabled: boolean;
      };
      adminSession?: {
        sessionId: string;
        adminModeUntil: Date;
      };
      file?: any;
      files?: any;
    }
  }
}

export {};
