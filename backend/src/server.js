const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const walletRoutes = require("./routes/walletRoutes");
const depositRoutes = require("./routes/depositRoutes");
const withdrawRoutes = require("./routes/withdrawRoutes");
const adminWithdrawRoutes = require("./routes/adminWithdrawRoutes");
const adminDepositRoutes = require("./routes/adminDepositRoutes");
const adminAnalyticsRoutes = require("./routes/adminAnalyticsRoutes");
const adminContentRoutes = require("./routes/adminContentRoutes");
const contentRoutes = require("./routes/contentRoutes");
const referralRoutes = require("./routes/referralRoutes");
const vipRoutes = require("./routes/vipRoutes");
const taskRoutes = require("./routes/taskRoutes");
const { startAutomaticDepositScanner } = require("./services/depositScannerService");
const { apiRateLimiter } = require("./middleware/rateLimitMiddleware");

const app = express();
app.set("trust proxy", 1);

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3005",
  "http://localhost:3100",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3005",
  "http://127.0.0.1:3100",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS bloqueado para origin: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf ? buf.toString("utf8") : ""; } }));
app.use("/api", apiRateLimiter);
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

app.get("/", (req, res) => res.json({ message: "Backend Royal Imperial AI funcionando correctamente.", version: "1.0.64" }));

app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/deposits", depositRoutes);
app.use("/api/withdraw", withdrawRoutes);
app.use("/api", contentRoutes);
app.use("/api/admin", adminAnalyticsRoutes);
app.use("/api/admin", adminContentRoutes);
app.use("/api/admin", adminWithdrawRoutes);
app.use("/api/admin", adminDepositRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/vip", vipRoutes);
app.use("/api/tasks", taskRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Royal Imperial AI backend corriendo en http://localhost:${PORT}`);
  startAutomaticDepositScanner();
  console.log("Escaneo automático de recargas activo. Recolección manual desde admin si está configurada.");
});
