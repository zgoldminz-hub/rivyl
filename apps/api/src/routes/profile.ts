import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import Stripe from "stripe";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { enrichPlayers } from "../lib/sleeperApi";
import { getPlayers } from "../lib/sleeperApi";

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

router.get("/trophy-room", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const teams = await prisma.team.findMany({
    where: { userId: req.userId, league: { status: "COMPLETE" } },
    include: {
      league: { select: { id: true, name: true, createdAt: true } },
      homeMatchups: { where: { isPlayoff: true }, select: { week: true, homeScore: true, awayScore: true } },
      awayMatchups: { where: { isPlayoff: true }, select: { week: true, homeScore: true, awayScore: true } },
      rosterSlots: { select: { playerId: true, slot: true } },
    },
  });

  if (!teams.length) {
    res.json({ ok: true, data: { trophies: [] } });
    return;
  }

  const leagueIds = [...new Set(teams.map(t => t.leagueId))];
  const leagueMaxWeeks = await prisma.matchup.groupBy({
    by: ["leagueId"],
    where: { leagueId: { in: leagueIds }, isPlayoff: true },
    _max: { week: true },
  });
  const maxWeekByLeague: Record<string, number | null> = {};
  for (const r of leagueMaxWeeks) maxWeekByLeague[r.leagueId] = r._max.week;

  const trophies: {
    finish: 1 | 2;
    team: { id: string; name: string };
    league: { id: string; name: string };
    year: number;
    roster: { playerId: string; slot: string }[];
  }[] = [];

  for (const team of teams) {
    const champWeek = maxWeekByLeague[team.leagueId];
    if (!champWeek) continue;

    const allPlayoff = [
      ...team.homeMatchups.map(m => ({ week: m.week, myScore: m.homeScore, oppScore: m.awayScore })),
      ...team.awayMatchups.map(m => ({ week: m.week, myScore: m.awayScore, oppScore: m.homeScore })),
    ];

    const final = allPlayoff.find(m => m.week === champWeek);
    if (!final) continue;

    trophies.push({
      finish: final.myScore > final.oppScore ? 1 : 2,
      team: { id: team.id, name: team.name },
      league: { id: team.leagueId, name: team.league.name },
      year: new Date(team.league.createdAt).getFullYear(),
      roster: team.rosterSlots,
    });
  }

  trophies.sort((a, b) => a.finish - b.finish);

  const playerMap = await getPlayers();
  const enriched = trophies.map(t => ({
    ...t,
    roster: t.roster.map(slot => {
      const p = playerMap.get(slot.playerId);
      return {
        playerId: slot.playerId,
        slot: slot.slot,
        name: p?.full_name ?? "Unknown",
        position: p?.position ?? slot.slot,
        headshotUrl: `https://sleepercdn.com/content/nfl/players/thumb/${slot.playerId}.jpg`,
      };
    }),
  }));

  res.json({ ok: true, data: { trophies: enriched } });
});

router.get("/stats", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const teams = await prisma.team.findMany({
    where: { userId: req.userId },
    include: {
      league: { select: { status: true } },
      homeMatchups: true,
      awayMatchups: true,
    },
  });

  let regWins = 0, regLosses = 0, playoffWins = 0, playoffLosses = 0;
  let championships = 0, runnerUps = 0;

  for (const team of teams) {
    const mine = [
      ...team.homeMatchups.map(m => ({ ...m, myScore: m.homeScore, oppScore: m.awayScore })),
      ...team.awayMatchups.map(m => ({ ...m, myScore: m.awayScore, oppScore: m.homeScore })),
    ];
    for (const m of mine) {
      const won = m.myScore > m.oppScore;
      if (!m.isPlayoff) { won ? regWins++ : regLosses++; }
      else { won ? playoffWins++ : playoffLosses++; }
    }
    if (team.league.status === "COMPLETE") {
      const playoffs = mine.filter(m => m.isPlayoff);
      if (!playoffs.length) continue;
      const maxWeek = Math.max(...playoffs.map(m => m.week));
      const final = playoffs.find(m => m.week === maxWeek);
      if (final) {
        if (final.myScore > final.oppScore) championships++;
        else runnerUps++;
      }
    }
  }

  res.json({
    ok: true,
    data: {
      stats: {
        regWins, regLosses, playoffWins, playoffLosses,
        championships, runnerUps,
        winPct: regWins + regLosses > 0 ? Math.round((regWins / (regWins + regLosses)) * 100) : 0,
        totalLeagues: teams.length,
      },
    },
  });
});

export default router;
