import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import leaguesRouter from "./routes/leagues";
import webhooksRouter from "./routes/webhooks";
import draftRouter from "./routes/draft";
import seasonRouter from "./routes/season";
import notificationsRouter from "./routes/notifications";
import commissionerRouter from "./routes/commissioner";
import waiversRouter from "./routes/waivers";
import tradesRouter from "./routes/trades";
import profileRouter from "./routes/profile";
import playersRouter from "./routes/players";
import rankingsRouter from "./routes/rankings";
import { initDraftSocket } from "./ws/draftSocket";
import { restoreActiveDrafts } from "./lib/draftEngine";

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT ?? 4000;
const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:5173";

app.use(cors({ origin: CLIENT_URL, credentials: true }));

// Stripe webhooks need raw body — register before express.json()
app.use("/webhooks", express.raw({ type: "application/json" }), webhooksRouter);

app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/auth", authRouter);
app.use("/leagues", leaguesRouter);
app.use("/draft", draftRouter);
app.use("/season", seasonRouter);
app.use("/notifications", notificationsRouter);
app.use("/commissioner", commissionerRouter);
app.use("/waivers", waiversRouter);
app.use("/trades", tradesRouter);
app.use("/profile", profileRouter);
app.use("/players", playersRouter);
app.use("/rankings", rankingsRouter);

app.get("/health", (_req, res) => res.json({ ok: true, data: { status: "healthy" } }));

// ─── WebSocket ────────────────────────────────────────────────────────────────

initDraftSocket(httpServer, CLIENT_URL);

// ─── Start ────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, async () => {
  console.log(`Rivyl API running on http://localhost:${PORT}`);
  await restoreActiveDrafts();
});
