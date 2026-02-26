import { JwtUserPayload } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: JwtUserPayload;
      file?: any;
      files?: any;
    }
  }
}

export {};
