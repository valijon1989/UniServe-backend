import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import "dotenv/config";
import path from "path";
import fs from "fs";
import { createServer } from "http";
import { connectDb } from "./config/db";
import authRoutes from "./routes/auth.routes";
import agentRoutes from "./routes/agentRoutes";
import listingRoutes from "./routes/listingRoutes";
import homeRoutes from "./routes/homeRoutes";
import productRoutes from "./routes/productRoutes";
import serviceRoutes from "./routes/serviceRoutes";
import postRoutes from "./routes/posts.routes";
import adminRoutes from "./routes/adminRoutes";
import feedRoutes from "./routes/feedRoutes";
import agentListingsRoutes from "./routes/agentListingsRoutes";
import userRoutes from "./routes/userRoutes";
import usersRoutes from "./routes/users.routes";
import searchRoutes from "./routes/searchRoutes";
import taxiRoutes from "./routes/taxiRoutes";
import educationRoutes from "./routes/educationRoutes";
import constructionRoutes from "./routes/constructionRoutes";
import mediaRoutes from "./routes/mediaRoutes";
import serviceCategoryRoutes from "./routes/serviceCategoryRoutes";
import communityRoutes from "./routes/communityRoutes";
import newsRoutes from "./routes/newsRoutes";
import { initWebsocket } from "./utils/websocket";
import { seedIfEmpty } from "./seed";
import { categoriesHandler } from "./stubs/categories";
import { securityHeaders } from "./middlewares/securityHeaders";

const app = express();

// Normalize double /api/api prefixes from upstream clients
app.use((req, _res, next) => {
  if (req.url.startsWith("/api/api")) {
    req.url = req.url.replace(/^\/api\/api/, "/api");
  }
  next();
});

const allowedOrigins =
  process.env.FRONTEND_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) || ["http://localhost:3000"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.options("*", cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(securityHeaders);
app.use(morgan("dev"));

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
const avatarUploadsDir = path.join(__dirname, "..", "uploads", "avatars");
if (!fs.existsSync(avatarUploadsDir)) {
  fs.mkdirSync(avatarUploadsDir, { recursive: true });
}
app.use("/api/media/avatars", express.static(avatarUploadsDir));
const staticCandidates = [
  path.join(__dirname, "static"),
  path.join(__dirname, "..", "static"),
  path.join(process.cwd(), "public", "static"),
  path.join(process.cwd(), "static")
];
const staticDir = staticCandidates.find((dir) => fs.existsSync(dir)) || path.join(__dirname, "..", "static");
const imagesDir = fs.existsSync(path.join(staticDir, "images"))
  ? path.join(staticDir, "images")
  : path.join(process.cwd(), "static", "images");
app.use("/static", express.static(staticDir, { fallthrough: true }));
app.use("/static", (req, res) => {
  console.warn(`[static-404] ${req.originalUrl}`);
  return res.status(404).json({ message: "Static file not found" });
});
app.use("/images", express.static(imagesDir, { fallthrough: true }));
app.use("/images", (req, res) => {
  console.warn(`[images-404] ${req.originalUrl}`);
  return res.status(404).json({ message: "Image file not found" });
});
app.get("/", (_req, res) => {
  res.json({ status: "UniServe backend running" });
});

// prefix all API routes once to avoid /api/api duplication
app.use("/api/auth", authRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/products", productRoutes);
app.get("/api/categories", categoriesHandler);
app.use("/api/services", serviceRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/home", homeRoutes);
app.use("/api/service-categories", serviceCategoryRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/agent/listings", agentListingsRoutes);
app.use("/api/user", userRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/taxi", taxiRoutes);
app.use("/api/education", educationRoutes);
app.use("/api/construction", constructionRoutes);
app.use("/api/media", mediaRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: err?.message || "Internal server error" });
});

const PORT = Number(process.env.PORT || 5001);
const mongoUrl = process.env.MONGO_URL;

if (!mongoUrl) {
  console.error("❌ MONGO_URL not set in .env");
  process.exit(1);
}

async function start(url: string) {
  try {
    await connectDb(url);
    console.log("UniServe DB Connected");
    await seedIfEmpty();

    const server = createServer(app);
    initWebsocket(server);
    server.listen(PORT, () => {
      console.log(`🚀 UniServe backend running on http://localhost:${PORT}`);
      console.log(`🔌 WebSocket ready on ws://localhost:${PORT}/ws`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start(mongoUrl);
