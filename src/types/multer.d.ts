declare module "multer" {
  import { RequestHandler } from "express";

  interface DiskStorageOptions {
    destination?: any;
    filename?: any;
  }

  interface Limits {
    files?: number;
    fileSize?: number;
  }

  interface MulterOptions {
    storage?: any;
    fileFilter?: any;
    limits?: Limits;
  }

  interface MulterInstance {
    array(field: string, maxCount?: number): RequestHandler;
    single(field: string): RequestHandler;
  }

  interface MulterStatic {
    (options?: MulterOptions): MulterInstance;
    diskStorage(opts: DiskStorageOptions): any;
  }

  const multer: MulterStatic;
  export default multer;
}
