import { connectDb } from "../config/db";
import { ENV } from "../config/env";

export const connectDB = async () => {
  const uri = ENV.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI/MONGO_URL is not set in environment");
  }
  return connectDb(uri);
};
