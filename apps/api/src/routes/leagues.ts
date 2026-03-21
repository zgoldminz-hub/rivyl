import { Router, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { stripe, PAYOUT_SPLITS } from "../lib/stripe";

const router = Router();

// All league routes require auth
router.use(requireAuth);

// ─── POST /leagues — Create league ───────────────────────────────────────────

router.post(
  "/",
  [
    body("name").trim().isLength({ min: 3, max: 50 }),
    body("maxTeams").isIn([8, 10, 12]),
    body("buyIn").isInt({ min: 10, max: 1000 }),
    body("payoutPreset").isIn(["WINNER_TAKES_ALL", "TOP_TWO", "TOP_THREE"]),
    body("scoringType").isIn(["FULL_PPR", "HALF_PPR"]),
    body("draftType").isIn(["SNAKE", "AUCTION"]),
    body("visibility").isIn(["PRIVATE", "PUBLIC"]),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ ok: false, error: "Validation failed", details: errors.array() });
      return;
    }

    const { name, maxTeams, buyIn, payoutPreset, scoringType, draftType, visibility } = req.body;

    const league = await prisma.league.create({
      data: {
        name,
        commissionerId: req.userId!,
        maxTeams,
        buyIn: buyIn * 100, // store in cents
        payoutPreset,
        scoringType,
        draftType,
        visibility,
      },
    });

    // Commissioner auto-joins as team 1
    const team = await prisma.team.create({
      data: {
        leagueId: league.id,
        userId: req.userId!,
        name: await defaultTeamName(req.userId!),
        paid: buyIn === 0,
      },
    });

    res.status(201).json({
      ok: true,
      data: { league: formatLeague(league, 1), team },
    });
  }
);

// ─── GET /leagues — List public leagues ──────────────────────────────────────

router.get(
  "/",
  [query("page").optional().isInt({ min: 1 })],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const page = parseInt((req.query.page as string) ?? "1");
    const limit = 20;
    const skip = (page - 1) * limit;

    const [leagues, total] = await Promise.all([
      prisma.league.findMany({
        where: { visibility: "PUBLIC", status: { in: ["SETUP", "DRAFTING"] } },
        include: { _count: { select: { teams: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.league.count({
        where: { visibility: "PUBLIC", status: { in: ["SETUP", "DRAFTING"] } },
      }),
    ]);

    res.json({
      ok: true,
      data: {
        leagues: leagues.map((l) => formatLeague(l, l._count.teams)),
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  }
);

// ─── GET /leagues/mine — Current user's leagues ───────────────────────────────

router.get("/mine", async (req: AuthRequest, res: Response): Promise<void> => {
  const teams = await prisma.team.findMany({
    where: { userId: req.userId },
    include: {
      league: {
        include: { _count: { select: { teams: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    ok: true,
    data: {
      leagues: teams.map((t) => ({
        ...formatLeague(t.league, t.league._count.teams),
        teamId: t.id,
        teamName: t.name,
        paid: t.paid,
        isCommissioner: t.league.commissionerId === req.userId,
      })),
    },
  });
});

// ─── GET /leagues/:id — Get league by id or invite code ──────────────────────

router.get(
  "/:idOrCode",
  [param("idOrCode").notEmpty()],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { idOrCode } = req.params;

    const league = await prisma.league.findFirst({
      where: { OR: [{ id: idOrCode }, { inviteCode: idOrCode }] },
      include: {
        _count: { select: { teams: true } },
        teams: {
          include: { user: { select: { id: true, username: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!league) {
      res.status(404).json({ ok: false, error: "League not found" });
      return;
    }

    // Only members or public leagues can be viewed
    const isMember = league.teams.some((t) => t.userId === req.userId);
    if (league.visibility === "PRIVATE" && !isMember) {
      res.status(403).json({ ok: false, error: "This league is private" });
      return;
    }

    res.json({
      ok: true,
      data: {
        league: formatLeague(league, league._count.teams),
        teams: league.teams.map((t) => ({
          id: t.id,
          name: t.name,
          paid: t.paid,
          userId: t.userId,
          username: t.user.username,
          isCommissioner: t.userId === league.commissionerId,
        })),
        isMember,
        isCommissioner: league.commissionerId === req.userId,
        payoutSplit: PAYOUT_SPLITS[league.payoutPreset],
      },
    });
  }
);

// ─── POST /leagues/:id/join — Join a league ───────────────────────────────────

router.post(
  "/:id/join",
  [
    param("id").notEmpty(),
    body("teamName").trim().isLength({ min: 2, max: 30 }),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ ok: false, error: "Validation failed", details: errors.array() });
      return;
    }

    const league = await prisma.league.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { teams: true } } },
    });

    if (!league) {
      res.status(404).json({ ok: false, error: "League not found" });
      return;
    }
    if (league.status !== "SETUP") {
      res.status(400).json({ ok: false, error: "League is no longer accepting members" });
      return;
    }
    if (league._count.teams >= league.maxTeams) {
      res.status(400).json({ ok: false, error: "League is full" });
      return;
    }

    const existing = await prisma.team.findUnique({
      where: { leagueId_userId: { leagueId: league.id, userId: req.userId! } },
    });
    if (existing) {
      res.status(409).json({ ok: false, error: "You are already in this league" });
      return;
    }

    // Create payment intent BEFORE creating the team.
    // The team is only created by the Stripe webhook after payment succeeds.
    // This ensures no slot is held without a completed payment.
    const buyInDollars = league.buyIn / 100;
    const intent = await stripe.paymentIntents.create({
      amount: league.buyIn, // already in cents
      currency: "usd",
      metadata: {
        leagueId: league.id,
        userId: req.userId!,
        teamName: req.body.teamName,
      },
      description: `Rivyl buy-in: ${league.name} ($${buyInDollars})`,
    });

    res.status(201).json({
      ok: true,
      data: {
        clientSecret: intent.client_secret,
        amount: buyInDollars,
      },
    });
  }
);

// ─── DELETE /leagues/:id/leave — Leave a league ───────────────────────────────

router.delete("/:id/leave", async (req: AuthRequest, res: Response): Promise<void> => {
  const league = await prisma.league.findUnique({ where: { id: req.params.id } });
  if (!league) {
    res.status(404).json({ ok: false, error: "League not found" });
    return;
  }
  if (league.commissionerId === req.userId) {
    res.status(400).json({ ok: false, error: "Commissioner cannot leave their own league" });
    return;
  }
  if (league.status !== "SETUP") {
    res.status(400).json({ ok: false, error: "Cannot leave after draft has started" });
    return;
  }

  await prisma.team.delete({
    where: { leagueId_userId: { leagueId: league.id, userId: req.userId! } },
  });

  res.json({ ok: true, data: null });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatLeague(league: any, memberCount: number) {
  return {
    id: league.id,
    name: league.name,
    commissionerId: league.commissionerId,
    maxTeams: league.maxTeams,
    buyIn: league.buyIn / 100, // return in dollars
    payoutPreset: league.payoutPreset,
    scoringType: league.scoringType,
    draftType: league.draftType,
    visibility: league.visibility,
    status: league.status,
    inviteCode: league.inviteCode,
    memberCount,
    createdAt: league.createdAt,
  };
}

async function defaultTeamName(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });
  return `${user?.username ?? "Team"}'s Team`;
}

export default router;
