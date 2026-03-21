import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import { verifyAccessToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import {
  getDraftState,
  makeSnakePick,
  nominatePlayer,
  placeBid,
  finalizeNomination,
  autoPickBestAvailable,
  PICK_TIMER_SECONDS,
  DraftState,
} from "../lib/draftEngine";
import { getPlayers, searchPlayers } from "../lib/sleeperApi";

// Per-league auto-pick timers
const pickTimers = new Map<string, NodeJS.Timeout>();
// Per-league auction close timers
const auctionTimers = new Map<string, NodeJS.Timeout>();

export function initDraftSocket(httpServer: HttpServer, clientUrl: string) {
  const io = new SocketServer(httpServer, {
    cors: { origin: clientUrl, credentials: true },
  });

  // Auth middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error("No token"));
      const payload = verifyAccessToken(token);
      (socket as any).userId = payload.userId;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId as string;

    // ── Join draft room ──────────────────────────────────────────────────────
    socket.on("draft:join", async ({ leagueId }: { leagueId: string }) => {
      // Verify user is a member
      const team = await prisma.team.findFirst({ where: { leagueId, userId } });
      if (!team) {
        socket.emit("draft:error", { message: "You are not in this league" });
        return;
      }

      socket.join(leagueId);
      (socket as any).leagueId = leagueId;
      (socket as any).teamId = team.id;

      const state = getDraftState(leagueId);
      if (state) {
        socket.emit("draft:state", sanitizeState(state));
      }
    });

    // ── Search players ───────────────────────────────────────────────────────
    socket.on("draft:search", async ({ query, position }: { query: string; position?: string }) => {
      const leagueId = (socket as any).leagueId;
      const state = getDraftState(leagueId);

      const draftedIds = state
        ? new Set([
            ...state.picks.filter((p) => p.playerId).map((p) => p.playerId!),
            ...state.completedAuctionPicks.map((p) => p.playerId),
          ])
        : new Set<string>();

      const results = await searchPlayers(query, position, draftedIds);
      socket.emit("draft:searchResults", { players: results });
    });

    // ── Snake: make pick ─────────────────────────────────────────────────────
    socket.on("draft:pick", async ({ playerId }: { playerId: string }) => {
      const leagueId = (socket as any).leagueId;
      const teamId = (socket as any).teamId;

      try {
        const players = await getPlayers();
        const player = players.get(playerId);
        if (!player) throw new Error("Player not found");

        const { state, pick } = await makeSnakePick(leagueId, teamId, player);

        clearPickTimer(leagueId);
        io.to(leagueId).emit("draft:picked", { pick, state: sanitizeState(state) });

        if (state.status === "COMPLETE") {
          io.to(leagueId).emit("draft:complete", { state: sanitizeState(state) });
        } else {
          startPickTimer(io, leagueId);
        }
      } catch (err: any) {
        socket.emit("draft:error", { message: err.message });
      }
    });

    // ── Auction: nominate ────────────────────────────────────────────────────
    socket.on("draft:nominate", async ({ playerId, openingBid }: { playerId: string; openingBid: number }) => {
      const leagueId = (socket as any).leagueId;
      const teamId = (socket as any).teamId;

      try {
        const players = await getPlayers();
        const player = players.get(playerId);
        if (!player) throw new Error("Player not found");

        const state = nominatePlayer(leagueId, teamId, player, openingBid);
        io.to(leagueId).emit("draft:nominated", { state: sanitizeState(state) });
        startAuctionTimer(io, leagueId);
      } catch (err: any) {
        socket.emit("draft:error", { message: err.message });
      }
    });

    // ── Auction: bid ─────────────────────────────────────────────────────────
    socket.on("draft:bid", async ({ amount }: { amount: number }) => {
      const leagueId = (socket as any).leagueId;
      const teamId = (socket as any).teamId;

      try {
        const state = placeBid(leagueId, teamId, amount);
        io.to(leagueId).emit("draft:bidPlaced", { state: sanitizeState(state) });
        // Reset auction close timer if bid placed
        resetAuctionTimer(io, leagueId, state.currentNomination!.endsAt);
      } catch (err: any) {
        socket.emit("draft:error", { message: err.message });
      }
    });

    socket.on("disconnect", () => {
      // no-op — state persists in memory
    });
  });

  return io;
}

// ─── Pick timer (snake) ───────────────────────────────────────────────────────

function startPickTimer(io: SocketServer, leagueId: string) {
  clearPickTimer(leagueId);

  const timer = setTimeout(async () => {
    try {
      const players = await getPlayers();
      const result = await autoPickBestAvailable(leagueId, players);
      if (!result) return;

      const { state, pick } = result;
      io.to(leagueId).emit("draft:picked", { pick, state: sanitizeState(state) });

      if (state.status === "COMPLETE") {
        io.to(leagueId).emit("draft:complete", { state: sanitizeState(state) });
      } else {
        startPickTimer(io, leagueId);
      }
    } catch (err) {
      console.error("Auto-pick error:", err);
    }
  }, PICK_TIMER_SECONDS * 1000);

  pickTimers.set(leagueId, timer);
}

function clearPickTimer(leagueId: string) {
  const t = pickTimers.get(leagueId);
  if (t) { clearTimeout(t); pickTimers.delete(leagueId); }
}

// ─── Auction close timer ──────────────────────────────────────────────────────

function startAuctionTimer(io: SocketServer, leagueId: string) {
  const state = getDraftState(leagueId);
  if (!state?.currentNomination) return;
  resetAuctionTimer(io, leagueId, state.currentNomination.endsAt);
}

function resetAuctionTimer(io: SocketServer, leagueId: string, endsAt: number) {
  const t = auctionTimers.get(leagueId);
  if (t) clearTimeout(t);

  const delay = Math.max(0, endsAt - Date.now());
  const timer = setTimeout(async () => {
    try {
      const state = await finalizeNomination(leagueId);
      const nom = state.completedAuctionPicks[state.completedAuctionPicks.length - 1];
      io.to(leagueId).emit("draft:auctionWon", { winner: nom, state: sanitizeState(state) });

      if (state.status === "COMPLETE") {
        io.to(leagueId).emit("draft:complete", { state: sanitizeState(state) });
      }
    } catch (err) {
      console.error("Auction finalize error:", err);
    }
  }, delay);

  auctionTimers.set(leagueId, timer);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeState(state: DraftState) {
  return {
    leagueId: state.leagueId,
    draftType: state.draftType,
    status: state.status,
    teams: state.teams,
    picks: state.picks,
    currentPickNumber: state.currentPickNumber,
    currentRound: state.currentRound,
    currentTeamId: state.currentTeamId,
    timerEndsAt: state.timerEndsAt,
    currentNomination: state.currentNomination,
    nominationQueue: state.nominationQueue,
    completedAuctionPicks: state.completedAuctionPicks,
  };
}
