import dotenv from "dotenv";

dotenv.config();

export const ENV = {
  PORT: process.env.PORT || "5001",
  MONGO_URI: process.env.MONGO_URL || process.env.MONGO_URI || "",
  JWT_KEY: process.env.JWT_SECRET || process.env.JWT_KEY || ""
};
