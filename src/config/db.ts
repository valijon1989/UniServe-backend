import mongoose from "mongoose";

export async function connectDb(mongoUrl: string) {
  try {
    await mongoose.connect(mongoUrl);
    console.log("✅ UniServe DB connected");
  } catch (err) {
    console.error("❌ Failed to connect MongoDB", err);
    throw err;
  }
}
