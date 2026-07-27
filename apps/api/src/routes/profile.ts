import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import Stripe from "stripe";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-04-10" });

router.get("/", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, username: true, createdAt: true, stripeCustomerId: true },
  });
  if (!user) { res.status(404).json({ ok: false, error: "User not found" }); return; }

  let paymentMethods: Stripe.PaymentMethod[] = [];
  if (user.stripeCustomerId) {
    try {
      const list = await stripe.paymentMethods.list({ customer: user.stripeCustomerId, type: "card" });
      paymentMethods = list.data;
    } catch { /* ignore */ }
  }

  res.json({
    ok: true,
    data: {
      user: { id: user.id, email: user.email, username: user.username, createdAt: user.createdAt },
      paymentMethods: paymentMethods.map((pm) => ({
        id: pm.id,
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        expMonth: pm.card?.exp_month,
        expYear: pm.card?.exp_year,
      })),
    },
  });
});

router.patch("/", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { username, email } = req.body;
  if (!username && !email) { res.status(400).json({ ok: false, error: "Nothing to update" }); return; }

  if (username || email) {
    const conflict = await prisma.user.findFirst({
      where: {
        AND: [
          { id: { not: req.userId } },
          { OR: [...(username ? [{ username }] : []), ...(email ? [{ email }] : [])] },
        ],
      },
    });
    if (conflict) {
      const field = conflict.username === username ? "username" : "email";
      res.status(409).json({ ok: false, error: `That ${field} is already taken` });
      return;
    }
  }

  const updated = await prisma.user.update({
    where: { id: req.userId },
    data: { ...(username ? { username } : {}), ...(email ? { email } : {}) },
    select: { id: true, email: true, username: true, createdAt: true },
  });

  res.json({ ok: true, data: { user: updated } });
});

router.post("/change-password", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ ok: false, error: "Missing required fields" }); return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ ok: false, error: "New password must be at least 8 characters" }); return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) { res.status(404).json({ ok: false, error: "User not found" }); return; }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) { res.status(401).json({ ok: false, error: "Current password is incorrect" }); return; }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: req.userId }, data: { passwordHash } });

  res.json({ ok: true, data: null });
});

router.post("/setup-payment", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, username: true, stripeCustomerId: true },
  });
  if (!user) { res.status(404).json({ ok: false, error: "User not found" }); return; }

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, name: user.username });
    customerId = customer.id;
    await prisma.user.update({ where: { id: req.userId }, data: { stripeCustomerId: customerId } });
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
  });

  res.json({ ok: true, data: { clientSecret: setupIntent.client_secret } });
});

router.delete("/payment-method/:pmId", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { stripeCustomerId: true } });
  if (!user?.stripeCustomerId) { res.status(400).json({ ok: false, error: "No payment methods" }); return; }

  const pm = await stripe.paymentMethods.retrieve(req.params.pmId);
  if (pm.customer !== user.stripeCustomerId) {
    res.status(403).json({ ok: false, error: "Not your payment method" }); return;
  }

  await stripe.paymentMethods.detach(req.params.pmId);
  res.json({ ok: true, data: null });
});

export default router;
