import mongoose from "mongoose";

export async function connectDb(mongoUrl: string) {
  try {
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }
    await mongoose.connect(mongoUrl);
    console.log("✅ UniServe DB connected");
    return mongoose.connection;
  } catch (err) {
    console.error("❌ Failed to connect MongoDB", err);
    throw err;
  }
}

export async function disconnectDb() {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.connection.close();
  console.log("🛑 UniServe DB disconnected");
}
