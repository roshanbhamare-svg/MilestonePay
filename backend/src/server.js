
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import paypalRoutes from "./routes/paypalRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import milestoneRoutes from "./routes/milestoneRoutes.js";
import submissionRoutes from "./routes/submissionRoutes.js";
import approvalRoutes from "./routes/approvalRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import {
  verifyWebhookSignature,
  handleWebhookEvent,
} from "./services/paypalWebhookService.js";

dotenv.config();

const app = express();

// Trust first reverse proxy (Render, Railway, etc.) so rate limiting & client IPs resolve accurately
app.set("trust proxy", 1);

const PORT = process.env.PORT || 5001;

function normalizeOrigin(origin) {
  return String(origin || "").trim().replace(/\/+$/, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// Security Middleware
// ─────────────────────────────────────────────────────────────────────────────

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: false,
  })
);

const configuredOrigins = [
  process.env.CLIENT_URL,
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",") : []),
]
  .map(normalizeOrigin)
  .filter(Boolean);

const allowedOrigins = [
  ...configuredOrigins,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      const normalized = normalizeOrigin(origin);
      if (
        allowedOrigins.includes(normalized) ||
        /^http:\/\/(localhost|127\.0\.0\.1):(517\d|3000)$/.test(normalized)
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

// General API rate limiter (1000 requests per 15 minutes in dev)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests, please try again later." },
});

app.use("/api", generalLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// Webhook Route (must use raw body BEFORE express.json() middleware)
// PayPal signature verification requires the raw unparsed request body.
// ─────────────────────────────────────────────────────────────────────────────

app.post(
  "/api/paypal/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const rawBody = req.body?.toString("utf8");

    if (!rawBody) {
      console.warn("[Webhook] Empty request body received");
      return res.status(400).json({ error: "Empty webhook body" });
    }

    // Verify signature
    let isValid = false;
    try {
      isValid = await verifyWebhookSignature(req.headers, rawBody);
    } catch (err) {
      console.error("[Webhook] Signature verification threw an error:", err.message);
      return res.status(500).json({ error: "Webhook verification error" });
    }

    if (!isValid) {
      console.warn("[Webhook] Invalid signature – rejecting event");
      return res.status(401).json({ error: "Webhook signature verification failed" });
    }

    // Parse event and handle
    let event;
    try {
      event = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error("[Webhook] Failed to parse webhook event JSON:", parseErr.message);
      return res.status(400).json({ error: "Invalid JSON in webhook body" });
    }

    // Respond immediately (PayPal expects 2xx quickly)
    res.status(200).json({ received: true });

    // Handle event asynchronously (do not block the response)
    handleWebhookEvent(event).catch((err) => {
      console.error("[Webhook] Event handler error:", err.message);
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Body Parsing Middleware (after webhook route)
// ─────────────────────────────────────────────────────────────────────────────

app.use(express.json());
app.use(morgan("dev"));

// ─────────────────────────────────────────────────────────────────────────────
// Health Check API
// ─────────────────────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "MilestonePay API",
    health: "/api/health",
  });
});

app.get("/api/health", (req, res) => {
  const mongoState = mongoose.connection.readyState;

  // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  const mongoStatus = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  }[mongoState] ?? "unknown";

  const isHealthy = mongoState === 1;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "degraded",
    message: "MilestonePay backend running",
    mongodb: mongoStatus,
    environment: process.env.PAYPAL_ENV || "sandbox",
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Application Routes
// ─────────────────────────────────────────────────────────────────────────────

app.use("/api/paypal", paypalRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/milestones", milestoneRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/users", userRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

// ─────────────────────────────────────────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[Server] Unhandled error:", err.message);
  res.status(500).json({ success: false, error: "Internal server error" });
});

// ─────────────────────────────────────────────────────────────────────────────
// Server Startup
// ─────────────────────────────────────────────────────────────────────────────

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`MilestonePay backend running on port ${PORT}`);
      console.log(`PayPal environment: ${process.env.PAYPAL_ENV || "sandbox"}`);
      console.log(`CORS origin: ${process.env.CLIENT_URL || "http://localhost:5173"}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
