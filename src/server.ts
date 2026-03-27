import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import "dotenv/config";
import path from "path";
import fs from "fs";
import { createServer } from "http";
import { connectDb, disconnectDb } from "./config/db";
import { getServerRuntimeConfig } from "./config/serverRuntime";
import authRoutes from "./routes/auth.routes";
import agentRoutes from "./routes/agentRoutes";
import agentPortalRoutes from "./routes/agentPortalRoutes";
import listingRoutes from "./routes/listingRoutes";
import homeRoutes from "./routes/homeRoutes";
import productRoutes from "./routes/productRoutes";
import cartRoutes from "./routes/cartRoutes";
import checkoutRoutes from "./routes/checkoutRoutes";
import orderRoutes from "./routes/orderRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import paymentMethodRoutes from "./routes/paymentMethodRoutes";
import disputeRoutes from "./routes/disputeRoutes";
import payoutRoutes from "./routes/payoutRoutes";
import refundRoutes from "./routes/refundRoutes";
import serviceRoutes from "./routes/serviceRoutes";
import postRoutes from "./routes/posts.routes";
import adminRoutes from "./routes/adminRoutes";
import feedRoutes from "./routes/feedRoutes";
import agentListingsRoutes from "./routes/agentListingsRoutes";
import userRoutes from "./routes/userRoutes";
import usersRoutes from "./routes/users.routes";
import searchRoutes from "./routes/searchRoutes";
import recommendationRoutes from "./routes/recommendationRoutes";
import taxiRoutes from "./routes/taxiRoutes";
import educationRoutes from "./routes/educationRoutes";
import constructionRoutes from "./routes/constructionRoutes";
import mediaRoutes from "./routes/mediaRoutes";
import serviceCategoryRoutes from "./routes/serviceCategoryRoutes";
import communityRoutes from "./routes/communityRoutes";
import newsRoutes from "./routes/newsRoutes";
import chatRoutes from "./routes/chatRoutes";
import deliveryRoutes from "./routes/deliveryRoutes";
import { initWebsocket, SOCKET_IO_CLIENT_VERSION, SOCKET_PATH } from "./utils/websocket";
import { seedIfEmpty } from "./seed";
import { categoriesHandler, categoryLandingHandler } from "./stubs/categories";
import { securityHeaders } from "./middlewares/securityHeaders";
import { localeMiddleware } from "./middlewares/locale";
import { createGracefulShutdown } from "./utils/gracefulShutdown";
import { listenWithPortRecovery, logStartupError } from "./utils/startupErrors";

const app = express();
const runtime = getServerRuntimeConfig();

// Normalize double /api/api prefixes from upstream clients
app.use((req, _res, next) => {
  if (req.url.startsWith("/api/api")) {
    req.url = req.url.replace(/^\/api\/api/, "/api");
  }
  next();
});

const allowedOrigins = runtime.frontendOrigins;

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept-Language",
      "X-Locale",
      "X-Admin-Session-Id",
      "X-Device-Fingerprint",
      "X-Admin-Bootstrap-Key"
    ]
  })
);
app.options("*", cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(securityHeaders);
app.use(localeMiddleware);
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
app.use("/api/agent", agentPortalRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/payment-methods", paymentMethodRoutes);
app.use("/api/disputes", disputeRoutes);
app.use("/api/refunds", refundRoutes);
app.use("/api/payouts", payoutRoutes);
app.get("/api/categories", categoriesHandler);
app.get("/api/categories/:main/:subcategory?", categoryLandingHandler);
app.use("/api/services", serviceRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/home", homeRoutes);
app.use("/api/service-categories", serviceCategoryRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/agent/listings", agentListingsRoutes);
app.use("/api/user", userRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/taxi", taxiRoutes);
app.use("/api/education", educationRoutes);
app.use("/api/construction", constructionRoutes);
app.use("/api/media", mediaRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: err?.message || "Internal server error" });
});

async function start() {
  if (!runtime.mongoUrl) {
    console.error("[startup] MONGO_URL or MONGO_URI must be set before starting UniServe backend.");
    process.exit(1);
  }

  let server: ReturnType<typeof createServer> | null = null;
  try {
    console.info(`[startup] Preferred HTTP port: ${runtime.port}`);
    if (runtime.fallbackPort) {
      console.info(
        `[startup] Fallback port: ${runtime.fallbackPort}${runtime.autoFallbackPort ? " (auto enabled)" : " (auto disabled)"}`
      );
    }
    console.info(`[startup] Allowed frontend origins: ${allowedOrigins.join(", ")}`);
    console.info("[startup] Connecting to MongoDB...");
    await connectDb(runtime.mongoUrl);
    console.info("[startup] Running seed checks...");
    await seedIfEmpty();

    server = createServer(app);
    const websocketServer = initWebsocket(server, allowedOrigins);
    const shutdownController = createGracefulShutdown({
      server,
      websocketServer,
      shutdownTimeoutMs: runtime.shutdownTimeoutMs,
      closeResources: disconnectDb
    });

    shutdownController.registerSignalHandlers();
    shutdownController.registerProcessErrorHandlers();

    const activePort = await listenWithPortRecovery(server, runtime);
    console.info(`[startup] UniServe backend listening on http://localhost:${activePort}`);
    console.info(`[startup] Socket.IO ready on http://localhost:${activePort} (path: ${SOCKET_PATH}, client: ${SOCKET_IO_CLIENT_VERSION})`);
  } catch (err) {
    logStartupError(err, runtime);
    if (server) {
      try {
        await new Promise<void>((resolve) => server!.close(() => resolve()));
      } catch {
        // ignore close errors during failed startup
      }
    }
    try {
      await disconnectDb();
    } catch {
      // ignore disconnect errors during failed startup
    }
    process.exit(1);
  }
}

void start();
