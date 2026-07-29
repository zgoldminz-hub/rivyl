import { Router, Request, Response } from "express";
import { stripe } from "../lib/stripe";
import Stripe from "stripe";
import { prisma } from "../lib/prisma";

const router = Router();

// Raw body needed for Stripe signature verification
router.post("/stripe", async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers["stripe-signature"];
  if (!sig) {
    res.status(400).json({ ok: false, error: "Missing stripe-signature header" });
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    res.status(400).json({ ok: false, error: `Webhook signature failed: ${err.message}` });
    return;
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object as any;
      const { leagueId, userId, teamName, teamId, type } = intent.metadata;

      if (type === "MEMBER_BUYIN") {
        await prisma.team.update({ where: { id: teamId }, data: { paid: true } });
        await prisma.payment.create({
          data: { leagueId, userId, amountCents: intent.amount, type: "BUY_IN", status: "COMPLETED", stripePaymentIntentId: intent.id },
        });
        console.log(`Member buy-in confirmed: team=${teamId}`);
        break;
      }

      // Verify league still has room (race condition guard)
      const league = await prisma.league.findUnique({
        where: { id: leagueId },
        include: { _count: { select: { teams: true } } },
      });

      if (!league || league.status !== "SETUP" || league._count.teams >= league.maxTeams) {
        // League is full or closed — refund the payment
        await stripe.refunds.create({ payment_intent: intent.id });
        console.warn(`Buy-in refunded (league full/closed): league=${leagueId} user=${userId}`);
        break;
      }

      // Create team now that payment is confirmed
      const team = await prisma.team.create({
        data: {
          leagueId,
          userId,
          name: teamName,
          paid: true,
        },
      });

      // Record the payment
      await prisma.payment.create({
        data: {
          leagueId,
          userId,
          amountCents: intent.amount,
          type: "BUY_IN",
          status: "COMPLETED",
          stripePaymentIntentId: intent.id,
        },
      });

      console.log(`Buy-in confirmed, team created: league=${leagueId} team=${team.id}`);
      break;
    }

    case "payment_intent.payment_failed": {
      // Nothing to clean up — no team was ever created
      const intent = event.data.object as any;
      console.log(`Buy-in payment failed: intent=${intent.id}`);
      break;
    }
  }

  res.json({ received: true });
});

export default router;
