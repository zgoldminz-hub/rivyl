import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  refreshTokenExpiresAt,
} from "../lib/jwt";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// ─── POST /auth/register ─────────────────────────────────────────────────────

router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("username").trim().isLength({ min: 3, max: 20 }).matches(/^[a-zA-Z0-9_]+$/),
    body("password").isLength({ min: 8 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ ok: false, error: "Validation failed", details: errors.array() });
      return;
    }

    const { email, username, password } = req.body;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      const field = existing.email === email ? "email" : "username";
      res.status(409).json({ ok: false, error: `That ${field} is already taken` });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, username, passwordHash },
    });

    const accessToken = signAccessToken({ userId: user.id });
    const rawRefresh = signRefreshToken({ userId: user.id });

    await prisma.refreshToken.create({
      data: { token: rawRefresh, userId: user.id, expiresAt: refreshTokenExpiresAt() },
    });

    res.status(201).json({
      ok: true,
      data: {
        accessToken,
        refreshToken: rawRefresh,
        user: { id: user.id, email: user.email, username: user.username, createdAt: user.createdAt },
      },
    });
  }
);

// ─── POST /auth/login ─────────────────────────────────────────────────────────

router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").notEmpty(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ ok: false, error: "Validation failed", details: errors.array() });
      return;
    }

    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ ok: false, error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ ok: false, error: "Invalid email or password" });
      return;
    }

    const accessToken = signAccessToken({ userId: user.id });
    const rawRefresh = signRefreshToken({ userId: user.id });

    await prisma.refreshToken.create({
      data: { token: rawRefresh, userId: user.id, expiresAt: refreshTokenExpiresAt() },
    });

    res.json({
      ok: true,
      data: {
        accessToken,
        refreshToken: rawRefresh,
        user: { id: user.id, email: user.email, username: user.username, createdAt: user.createdAt },
      },
    });
  }
);

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

router.post("/refresh", async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ ok: false, error: "Missing refreshToken" });
    return;
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    res.status(401).json({ ok: false, error: "Invalid or expired refresh token" });
    return;
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.userId !== payload.userId || stored.expiresAt < new Date()) {
    res.status(401).json({ ok: false, error: "Refresh token not recognized" });
    return;
  }

  // Rotate refresh token
  await prisma.refreshToken.delete({ where: { id: stored.id } });

  const newAccess = signAccessToken({ userId: payload.userId });
  const newRefresh = signRefreshToken({ userId: payload.userId });

  await prisma.refreshToken.create({
    data: { token: newRefresh, userId: payload.userId, expiresAt: refreshTokenExpiresAt() },
  });

  res.json({ ok: true, data: { accessToken: newAccess, refreshToken: newRefresh } });
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────

router.post("/logout", async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }
  res.json({ ok: true, data: null });
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

router.get("/me", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, username: true, createdAt: true },
  });
  if (!user) {
    res.status(404).json({ ok: false, error: "User not found" });
    return;
  }
  res.json({ ok: true, data: { user } });
});

export default router;
