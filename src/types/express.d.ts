import { JwtUserPayload } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: JwtUserPayload;
    }
  }
}

export {};
