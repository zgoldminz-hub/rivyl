import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// GET /notifications — list unread + recent
router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  res.json({ ok: true, data: { notifications, unreadCount } });
});

// POST /notifications/read-all — mark all read
router.post("/read-all", async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.notification.updateMany({
    where: { userId: req.userId, read: false },
    data: { read: true },
  });
  res.json({ ok: true });
});

// POST /notifications/:id/read — mark one read
router.post("/:id/read", async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.userId },
    data: { read: true },
  });
  res.json({ ok: true });
});

export default router;
