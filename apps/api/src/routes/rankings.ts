import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

// GET /rankings — public, returns all rankings
router.get("/", async (req, res) => {
  try {
    const rankings = await prisma.playerRanking.findMany({
      orderBy: { rank: "asc" },
    });
    res.json({ ok: true, data: { rankings } });
  } catch (e) {
    res.status(500).json({ ok: false, error: "Failed to fetch rankings" });
  }
});

// PUT /rankings — admin only, save full rankings list
router.put("/", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user?.isAdmin) return res.status(403).json({ ok: false, error: "Forbidden" });

    const { rankings } = req.body as { rankings: { playerId: string; rank: number; notes?: string }[] };

    await prisma.$transaction(
      rankings.map((r) =>
        prisma.playerRanking.upsert({
          where: { playerId: r.playerId },
          update: { rank: r.rank, notes: r.notes ?? null },
          create: { playerId: r.playerId, rank: r.rank, notes: r.notes ?? null },
        })
      )
    );

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: "Failed to save rankings" });
  }
});

// DELETE /rankings/:playerId — admin only
router.delete("/:playerId", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user?.isAdmin) return res.status(403).json({ ok: false, error: "Forbidden" });

    await prisma.playerRanking.deleteMany({ where: { playerId: req.params.playerId } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: "Failed to delete ranking" });
  }
});

export default router;
