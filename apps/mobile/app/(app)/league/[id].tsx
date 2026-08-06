import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, Image,
  Clipboard, useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "../../../src/api/client";
import Button from "../../../src/components/Button";

// ─── Theme ────────────────────────────────────────────────────────────────────

const DARK = {
  bg: "#0d0f14", surface: "#161b24", border: "#2a3347",
  innerBorder: "#1a2133", text: "#e8eaf0", sub: "#8a95a8",
  muted: "#4a5568", accent: "#4f7cff", badgeText: "#ffffff",
  inputBg: "#161b24", modalBg: "rgba(0,0,0,0.75)",
};
const LIGHT = {
  bg: "#f4f6fb", surface: "#ffffff", border: "#e2e8f0",
  innerBorder: "#f0f4f8", text: "#111827", sub: "#64748b",
  muted: "#94a3b8", accent: "#4f7cff", badgeText: "#000000",
  inputBg: "#ffffff", modalBg: "rgba(0,0,0,0.5)",
};

function useTheme() {
  const scheme = useColorScheme();
  return scheme === "dark" ? DARK : LIGHT;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string; name: string; username: string; userId: string;
  paid: boolean; isCommissioner: boolean;
}
interface PayoutSplit { place: number; percent: number; }
interface LeagueDetail {
  id: string; name: string; status: string; buyIn: number; maxTeams: number;
  memberCount: number; scoringType: string; draftType: string; visibility: string;
  payoutPreset: string; isMember: boolean; isCommissioner: boolean;
  inviteCode: string; commissionerId: string;
  teams: TeamMember[]; payoutSplit: PayoutSplit[];
}
interface RosterSlot {
  id: string; playerId: string; slot: string; points: number | null;
  name?: string; position?: string; team?: string | null;
  headshotUrl?: string; statLine?: string;
}
interface MatchupSummary {
  id: string; week: number; homeScore: number; awayScore: number;
  homeTeam: { id: string; name: string; userId: string };
  awayTeam: { id: string; name: string; userId: string };
}
interface MatchupDetail {
  id: string; week: number; homeScore: number; awayScore: number; isPlayoff: boolean;
  homeTeam: { id: string; name: string; user: { username: string }; rosterSlots: RosterSlot[] };
  awayTeam: { id: string; name: string; user: { username: string }; rosterSlots: RosterSlot[] };
}
interface StandingRow {
  teamId: string; teamName: string; userId: string;
  wins: number; losses: number; pointsFor: number; pointsAgainst: number;
}
interface TradeItem { id: string; fromTeamId: string; playerId: string; }
interface Trade {
  id: string; proposingTeamId: string; receivingTeamId: string;
  status: string; note?: string; createdAt: string;
  proposingTeam: { id: string; name: string };
  receivingTeam: { id: string; name: string };
  items: TradeItem[];
}
interface WaiverClaim {
  id: string; addPlayerId: string; dropPlayerId: string | null; status: string;
  addPlayer?: { name: string } | null;
  dropPlayer?: { name: string } | null;
}
interface SleeperPlayer {
  player_id: string; full_name: string; position: string;
  team: string | null; injury_status: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POS_COLORS: Record<string, string> = {
  QB: "#f59e0b", RB: "#22c55e", WR: "#4f7cff", TE: "#a78bfa",
  K: "#6b7280", DEF: "#ef4444", FLEX: "#22c55e", BENCH: "#374151",
};
const STARTER_ORDER = ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF"];
const STATUS_COLOR: Record<string, string> = {
  SETUP: "#6b7280", DRAFTING: "#f59e0b", ACTIVE: "#22c55e",
  PLAYOFFS: "#a78bfa", COMPLETE: "#374151",
};
const PAYOUT_LABEL: Record<string, string> = {
  WINNER_TAKES_ALL: "Winner Takes All",
  TOP_TWO: "Top 2 (70% / 30%)",
  TOP_THREE: "Top 3 (60% / 25% / 15%)",
};
const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"];
const TABS = ["My Team", "Matchup", "Waivers", "Trades", "Standings", "Settings"] as const;
type Tab = typeof TABS[number];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LeagueScreen() {
  const router = useRouter();
  const { id: leagueId } = useLocalSearchParams<{ id: string }>();
  const C = useTheme();
  const [league, setLeague] = useState<LeagueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("My Team");
  const [startingDraft, setStartingDraft] = useState(false);

  useEffect(() => {
    if (!leagueId) return;
    api.get<{
      league: LeagueDetail; teams: TeamMember[];
      isMember: boolean; isCommissioner: boolean; payoutSplit: PayoutSplit[];
    }>(`/leagues/${leagueId}`).then((res) => {
      if (res.ok) {
        setLeague({
          ...res.data.league,
          teams: res.data.teams ?? [],
          isMember: res.data.isMember,
          isCommissioner: res.data.isCommissioner,
          payoutSplit: res.data.payoutSplit ?? [],
        });
      }
      setLoading(false);
    });
  }, [leagueId]);

  async function startDraft() {
    setStartingDraft(true);
    const res = await api.post(`/draft/${leagueId}/start`, {});
    setStartingDraft(false);
    if (!res.ok) { Alert.alert("Error", (res as any).error ?? "Failed to start draft"); return; }
    router.push(`/(app)/league/${leagueId}/draft` as any);
  }

  function copyInvite() {
    if (!league?.inviteCode) return;
    Clipboard.setString(league.inviteCode);
    Alert.alert("Copied!", "Invite code copied to clipboard.");
  }

  if (loading) return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]}>
      <ActivityIndicator color={C.accent} style={{ flex: 1 }} />
    </SafeAreaView>
  );

  if (!league) return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]}>
      <View style={s.center}>
        <Text style={[s.errorText]}>League not found</Text>
        <TouchableOpacity onPress={() => router.back()}><Text style={[s.link, { color: C.accent }]}>Go back</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  const isActive = league.status === "ACTIVE" || league.status === "PLAYOFFS";

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.push("/(app)/dashboard" as any)} style={s.brandBtn}>
          <Text style={[s.brandText, { color: C.accent }]}>Rivyl Fantasy</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: C.text }]} numberOfLines={1}>{league.name}</Text>
        <View style={[s.statusPill, { backgroundColor: `${STATUS_COLOR[league.status] ?? "#6b7280"}22` }]}>
          <Text style={[s.statusText, { color: STATUS_COLOR[league.status] ?? "#6b7280" }]}>{league.status}</Text>
        </View>
      </View>

      {/* SETUP */}
      {league.status === "SETUP" && (
        <SetupView league={league} startingDraft={startingDraft} onStartDraft={startDraft} onCopyInvite={copyInvite} />
      )}

      {/* DRAFTING */}
      {league.status === "DRAFTING" && (
        <ScrollView style={s.scroll} contentContainerStyle={s.content}>
          <TouchableOpacity style={[s.primaryBtn, { backgroundColor: C.accent }]}
            onPress={() => router.push(`/(app)/league/${leagueId}/draft` as any)}>
            <Text style={s.primaryBtnText}>Enter Draft Room</Text>
          </TouchableOpacity>
          <TeamsCard league={league} />
        </ScrollView>
      )}

      {/* ACTIVE / PLAYOFFS — top tab bar */}
      {isActive && (
        <View style={{ flex: 1 }}>
          {/* Fixed-height tab bar wrapper prevents grey space expansion */}
          <View style={[s.tabBarWrap, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBarInner}>
              {TABS.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[s.tabItem, activeTab === t && { borderBottomColor: C.accent, borderBottomWidth: 2 }]}
                  onPress={() => setActiveTab(t)}
                >
                  <Text style={[s.tabLabel, { color: activeTab === t ? C.text : C.muted },
                    activeTab === t && s.tabLabelActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {activeTab === "My Team" && <MyTeamTab leagueId={leagueId!} />}
          {activeTab === "Matchup" && <MatchupTab leagueId={leagueId!} />}
          {activeTab === "Waivers" && <WaiversTab leagueId={leagueId!} />}
          {activeTab === "Trades" && <TradesTab leagueId={leagueId!} />}
          {activeTab === "Standings" && <StandingsTab leagueId={leagueId!} />}
          {activeTab === "Settings" && <SettingsTab league={league} onCopyInvite={copyInvite} />}
        </View>
      )}

      {league.status === "COMPLETE" && (
        <View style={s.center}><Text style={[s.emptyText, { color: C.sub }]}>This season is complete.</Text></View>
      )}
    </SafeAreaView>
  );
}

// ─── Setup View ───────────────────────────────────────────────────────────────

function SetupView({ league, startingDraft, onStartDraft, onCopyInvite }: {
  league: LeagueDetail; startingDraft: boolean;
  onStartDraft: () => void; onCopyInvite: () => void;
}) {
  const C = useTheme();
  const pot = league.buyIn * league.maxTeams;
  const prize = Math.floor(pot * 0.95);
  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      {league.isCommissioner && (
        <TouchableOpacity
          style={[s.primaryBtn, { backgroundColor: C.accent }, league.memberCount < 2 && s.disabledBtn]}
          onPress={league.memberCount >= 2 ? onStartDraft : undefined}
        >
          <Text style={s.primaryBtnText}>{startingDraft ? "Starting…" : "Start Draft"}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]} onPress={onCopyInvite} activeOpacity={0.75}>
        <Text style={[s.cardTitle, { color: C.sub }]}>Invite Code</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={[s.inviteCode, { color: C.accent }]}>{league.inviteCode}</Text>
          <Text style={[s.hint, { color: C.sub }]}>Tap to copy</Text>
        </View>
      </TouchableOpacity>
      <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
        <Text style={[s.cardTitle, { color: C.sub }]}>Settings</Text>
        <InfoRow label="Buy-In" value={`$${league.buyIn}`} accent />
        <InfoRow label="Teams" value={`${league.memberCount} / ${league.maxTeams}`} />
        <InfoRow label="Scoring" value={league.scoringType === "FULL_PPR" ? "Full PPR" : "Half PPR"} />
        <InfoRow label="Draft" value={league.draftType === "SNAKE" ? "Snake Draft" : "Auction ($200)"} />
        <InfoRow label="Visibility" value={league.visibility === "PUBLIC" ? "Public" : "Private"} />
      </View>
      {league.buyIn > 0 && (
        <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[s.cardTitle, { color: C.sub }]}>Prize Pool</Text>
          <InfoRow label="Total Pot" value={`$${pot.toLocaleString()}`} />
          <InfoRow label="After 5% fee" value={`$${prize.toLocaleString()}`} accent />
          {(league.payoutSplit?.length ?? 0) > 0 && (
            <View style={{ marginTop: 10 }}>
              <Text style={[s.subLabel, { color: C.sub }]}>{PAYOUT_LABEL[league.payoutPreset]}</Text>
              {league.payoutSplit.map((sp) => (
                <View key={sp.place} style={s.payoutRow}>
                  <Text style={[s.payoutPlace, { color: C.text }]}>{sp.place === 1 ? "1st" : sp.place === 2 ? "2nd" : "3rd"} Place</Text>
                  <Text style={[s.payoutAmt, { color: C.accent }]}>${Math.floor(prize * sp.percent / 100).toLocaleString()}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
      <TeamsCard league={league} />
    </ScrollView>
  );
}

// ─── Teams Card ───────────────────────────────────────────────────────────────

function TeamsCard({ league }: { league: LeagueDetail }) {
  const C = useTheme();
  return (
    <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
      <Text style={[s.cardTitle, { color: C.sub }]}>Teams ({league.memberCount}/{league.maxTeams})</Text>
      {(league.teams ?? []).map((t) => (
        <View key={t.id} style={[s.teamRow, { borderBottomColor: C.innerBorder }]}>
          <View>
            <Text style={[s.teamName, { color: C.text }]}>{t.name}</Text>
            <Text style={[s.teamUsername, { color: C.sub }]}>@{t.username}</Text>
          </View>
          {t.isCommissioner && <Text style={s.commLabel}>Comm.</Text>}
        </View>
      ))}
      {Array.from({ length: Math.max(0, league.maxTeams - (league.memberCount ?? 0)) }).map((_, i) => (
        <View key={`open-${i}`} style={[s.teamRow, { borderBottomColor: C.innerBorder, opacity: 0.3 }]}>
          <Text style={[{ color: C.sub, fontSize: 14 }]}>Open slot</Text>
        </View>
      ))}
    </View>
  );
}

// ─── My Team Tab ──────────────────────────────────────────────────────────────

function MyTeamTab({ leagueId }: { leagueId: string }) {
  const C = useTheme();
  const [team, setTeam] = useState<{ id: string; name: string } | null>(null);
  const [roster, setRoster] = useState<RosterSlot[]>([]);
  const [week, setWeek] = useState(1);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [swap, setSwap] = useState<RosterSlot | null>(null);

  useEffect(() => {
    api.get<{ team: any; roster: RosterSlot[]; currentWeek: number; isLocked: boolean }>(
      `/season/${leagueId}/my-team`
    ).then((res) => {
      if (res.ok) {
        setTeam(res.data.team);
        setRoster(res.data.roster);
        setWeek(res.data.currentWeek);
        setIsLocked(res.data.isLocked);
      }
      setLoading(false);
    });
  }, [leagueId]);

  function handlePress(slot: RosterSlot) {
    if (isLocked) return;
    if (!swap) { setSwap(slot); return; }
    if (swap.id === slot.id) { setSwap(null); return; }
    setRoster((prev) => prev.map((r) => {
      if (r.id === swap.id) return { ...r, slot: slot.slot };
      if (r.id === slot.id) return { ...r, slot: swap.slot };
      return r;
    }));
    setSwap(null);
  }

  async function saveLineup() {
    setSaving(true);
    const res = await api.post(`/season/${leagueId}/lineup`, {
      slots: roster.map((r) => ({ playerId: r.playerId, slot: r.slot })),
    });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    else Alert.alert("Error", (res as any).error ?? "Failed to save lineup");
  }

  if (loading) return <LoadingView />;

  const starters = roster
    .filter((r) => r.slot !== "BENCH")
    .sort((a, b) => STARTER_ORDER.indexOf(a.slot) - STARTER_ORDER.indexOf(b.slot));
  const bench = roster.filter((r) => r.slot === "BENCH");
  const pts = starters.reduce((n, r) => n + (r.points ?? 0), 0);

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <View style={s.teamHeaderRow}>
        <View>
          <Text style={[s.myTeamName, { color: C.text }]}>{team?.name}</Text>
          <Text style={[s.weekLabel, { color: C.sub }]}>Week {week}</Text>
        </View>
        {isLocked ? (
          <Text style={[s.lockedLabel, { color: C.sub }]}>Locked</Text>
        ) : (
          <TouchableOpacity style={[s.saveBtn, { backgroundColor: C.accent }]} onPress={saveLineup} disabled={saving}>
            <Text style={s.saveBtnText}>{saving ? "Saving…" : saved ? "Saved ✓" : "Save"}</Text>
          </TouchableOpacity>
        )}
      </View>
      {!isLocked && (
        <Text style={[s.swapHint, { color: C.accent }]}>
          {swap ? "Tap another player to swap" : "Tap a player to change lineup"}
        </Text>
      )}
      <Text style={[s.sectionTitle, { color: C.sub }]}>Starters · {pts.toFixed(1)} pts</Text>
      {starters.map((r) => (
        <PlayerCard key={r.id} slot={r} selected={swap?.id === r.id} onPress={() => handlePress(r)} />
      ))}
      <Text style={[s.sectionTitle, { color: C.sub, marginTop: 16 }]}>Bench</Text>
      {bench.map((r) => (
        <PlayerCard key={r.id} slot={r} muted selected={swap?.id === r.id} onPress={() => handlePress(r)} />
      ))}
    </ScrollView>
  );
}

// ─── Matchup Tab ──────────────────────────────────────────────────────────────

function MatchupTab({ leagueId }: { leagueId: string }) {
  const C = useTheme();
  const [matchup, setMatchup] = useState<MatchupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    async function load() {
      const teamRes = await api.get<{ team: { id: string }; currentWeek: number }>(
        `/season/${leagueId}/my-team`
      );
      if (!teamRes.ok) { setEmpty(true); setLoading(false); return; }
      const { team, currentWeek } = teamRes.data;
      const wRes = await api.get<{ matchups: MatchupSummary[] }>(
        `/season/${leagueId}/matchups/${currentWeek}`
      );
      if (!wRes.ok) { setEmpty(true); setLoading(false); return; }
      const mine = wRes.data.matchups.find(
        (m) => m.homeTeam.id === team.id || m.awayTeam.id === team.id
      );
      if (!mine) { setEmpty(true); setLoading(false); return; }
      const dRes = await api.get<{ matchup: MatchupDetail }>(
        `/season/${leagueId}/matchup/${mine.id}`
      );
      if (dRes.ok) setMatchup(dRes.data.matchup);
      else setEmpty(true);
      setLoading(false);
    }
    load();
  }, [leagueId]);

  if (loading) return <LoadingView />;
  if (empty || !matchup) return (
    <View style={s.center}><Text style={[s.emptyText, { color: C.sub }]}>No matchup found for this week.</Text></View>
  );

  const homeWin = matchup.homeScore >= matchup.awayScore;
  const sortSlots = (slots: RosterSlot[]) =>
    slots.filter((sl) => sl.slot !== "BENCH").sort((a, b) => STARTER_ORDER.indexOf(a.slot) - STARTER_ORDER.indexOf(b.slot));
  const benchSlots = (slots: RosterSlot[]) => slots.filter((sl) => sl.slot === "BENCH");

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <View style={[s.scoreCard, { backgroundColor: C.surface, borderColor: C.border }]}>
        <View style={s.scoreHalf}>
          <Text style={[s.scoreTeamName, { color: C.text }]} numberOfLines={1}>{matchup.homeTeam.name}</Text>
          <Text style={[s.scoreUser, { color: C.sub }]}>@{matchup.homeTeam.user.username}</Text>
          <Text style={[s.bigScore, { color: C.sub }, homeWin && s.winScore]}>{matchup.homeScore.toFixed(2)}</Text>
        </View>
        <Text style={[s.vs, { color: C.sub }]}>vs</Text>
        <View style={[s.scoreHalf, { alignItems: "flex-end" }]}>
          <Text style={[s.scoreTeamName, { color: C.text }]} numberOfLines={1}>{matchup.awayTeam.name}</Text>
          <Text style={[s.scoreUser, { color: C.sub }]}>@{matchup.awayTeam.user.username}</Text>
          <Text style={[s.bigScore, { color: C.sub }, !homeWin && s.winScore]}>{matchup.awayScore.toFixed(2)}</Text>
        </View>
      </View>

      <Text style={[s.rosterLabel, { color: C.sub }]}>{matchup.homeTeam.name}</Text>
      {sortSlots(matchup.homeTeam.rosterSlots).map((sl) => <PlayerCard key={sl.id} slot={sl} showStats />)}
      <Text style={[s.rosterLabel, { color: C.sub, opacity: 0.5, marginTop: 4 }]}>Bench</Text>
      {benchSlots(matchup.homeTeam.rosterSlots).map((sl) => <PlayerCard key={sl.id} slot={sl} muted showStats />)}

      <View style={[s.divider, { backgroundColor: C.border }]} />

      <Text style={[s.rosterLabel, { color: C.sub }]}>{matchup.awayTeam.name}</Text>
      {sortSlots(matchup.awayTeam.rosterSlots).map((sl) => <PlayerCard key={sl.id} slot={sl} showStats />)}
      <Text style={[s.rosterLabel, { color: C.sub, opacity: 0.5, marginTop: 4 }]}>Bench</Text>
      {benchSlots(matchup.awayTeam.rosterSlots).map((sl) => <PlayerCard key={sl.id} slot={sl} muted showStats />)}
    </ScrollView>
  );
}

// ─── Waivers Tab ──────────────────────────────────────────────────────────────

function WaiversTab({ leagueId }: { leagueId: string }) {
  const C = useTheme();
  const [subTab, setSubTab] = useState<"browse" | "claims">("browse");
  const [players, setPlayers] = useState<SleeperPlayer[]>([]);
  const [claims, setClaims] = useState<WaiverClaim[]>([]);
  const [myRoster, setMyRoster] = useState<RosterSlot[]>([]);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [claimTarget, setClaimTarget] = useState<SleeperPlayer | null>(null);
  const [dropId, setDropId] = useState("");
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<{ claims: WaiverClaim[] }>(`/waivers/${leagueId}/claims`),
      api.get<{ roster: RosterSlot[] }>(`/season/${leagueId}/my-team`),
    ]).then(([cr, tr]) => {
      if (cr.ok) setClaims(cr.data.claims);
      if (tr.ok) setMyRoster(tr.data.roster);
      setLoading(false);
    });
  }, [leagueId]);

  const fetchFreeAgents = useCallback(() => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (pos !== "ALL") p.set("position", pos);
    api.get<{ players: SleeperPlayer[] }>(`/waivers/${leagueId}/available?${p}`).then((r) => {
      if (r.ok) setPlayers(r.data.players);
    });
  }, [leagueId, search, pos]);

  useEffect(() => {
    const t = setTimeout(fetchFreeAgents, 300);
    return () => clearTimeout(t);
  }, [fetchFreeAgents]);

  async function submitClaim() {
    if (!claimTarget) return;
    setClaiming(true);
    const res = await api.post(`/waivers/${leagueId}/claim`, {
      addPlayerId: claimTarget.player_id,
      dropPlayerId: dropId || undefined,
    });
    setClaiming(false);
    if (res.ok) {
      setClaims((prev) => [...prev, (res as any).data.claim]);
      setClaimTarget(null); setDropId("");
    } else Alert.alert("Error", (res as any).error ?? "Failed to submit claim");
  }

  async function cancelClaim(id: string) {
    const res = await api.del(`/waivers/${leagueId}/claims/${id}`);
    if (res.ok) setClaims((prev) => prev.filter((c) => c.id !== id));
  }

  async function dropPlayer(playerId: string) {
    Alert.alert("Drop Player", "Remove from roster?", [
      { text: "Cancel", style: "cancel" },
      { text: "Drop", style: "destructive", onPress: async () => {
        const res = await api.del(`/waivers/${leagueId}/drop/${playerId}`);
        if (res.ok) setMyRoster((prev) => prev.filter((sl) => sl.playerId !== playerId));
      }},
    ]);
  }

  if (loading) return <LoadingView />;

  return (
    <View style={{ flex: 1 }}>
      <View style={[s.subTabRow, { borderBottomColor: C.border }]}>
        <TouchableOpacity style={[s.subTab, subTab === "browse" && { borderBottomWidth: 2, borderBottomColor: C.accent }]} onPress={() => setSubTab("browse")}>
          <Text style={[s.subTabText, { color: subTab === "browse" ? C.accent : C.muted }]}>Free Agents</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.subTab, subTab === "claims" && { borderBottomWidth: 2, borderBottomColor: C.accent }]} onPress={() => setSubTab("claims")}>
          <Text style={[s.subTabText, { color: subTab === "claims" ? C.accent : C.muted }]}>
            My Claims{claims.length > 0 ? ` (${claims.length})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {subTab === "browse" && (
          <>
            <TextInput
              style={[s.searchInput, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]}
              placeholder="Search players…" placeholderTextColor={C.muted}
              value={search} onChangeText={setSearch}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {POSITIONS.map((p) => (
                <TouchableOpacity key={p}
                  style={[s.posBtn, { backgroundColor: C.surface, borderColor: C.border }, pos === p && { backgroundColor: C.accent, borderColor: C.accent }]}
                  onPress={() => setPos(p)}>
                  <Text style={[s.posBtnText, { color: pos === p ? "#fff" : C.muted }]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {players.map((p) => {
              const color = POS_COLORS[p.position] ?? "#6b7280";
              return (
                <View key={p.player_id} style={[s.playerRow, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <View style={[s.slotBadge, { backgroundColor: color }]}>
                    <Text style={[s.slotText, { color: "#fff" }]}>{p.position}</Text>
                  </View>
                  <View style={s.playerInfo}>
                    <Text style={[s.playerName, { color: C.text }]}>{p.full_name}</Text>
                    <Text style={[s.playerMeta, { color: C.sub }]}>{p.team ?? "FA"}{p.injury_status ? ` · ${p.injury_status}` : ""}</Text>
                  </View>
                  <TouchableOpacity style={[s.claimBtn, { backgroundColor: C.accent }]} onPress={() => { setClaimTarget(p); setDropId(""); }}>
                    <Text style={s.claimBtnText}>Claim</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            <Text style={[s.sectionTitle, { color: C.sub, marginTop: 20 }]}>My Roster — Drop Players</Text>
            {myRoster.map((sl) => (
              <View key={sl.id} style={[s.playerRow, { backgroundColor: C.surface, borderColor: C.border }]}>
                <View style={[s.slotBadge, { backgroundColor: POS_COLORS[sl.slot] ?? "#374151" }]}>
                  <Text style={[s.slotText, { color: "#fff" }]}>{sl.slot}</Text>
                </View>
                <Text style={[s.playerName, { flex: 1, color: C.text }]}>{sl.name ?? sl.playerId}</Text>
                <TouchableOpacity style={s.dropBtn} onPress={() => dropPlayer(sl.playerId)}>
                  <Text style={s.dropBtnText}>Drop</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {subTab === "claims" && (
          <>
            {claims.length === 0 ? (
              <Text style={[s.emptyText, { color: C.sub, marginTop: 40 }]}>No pending claims.</Text>
            ) : claims.map((c) => (
              <View key={c.id} style={[s.claimRow, { backgroundColor: C.surface, borderColor: C.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.claimLine, { color: C.text }]}>+ {c.addPlayer?.name ?? c.addPlayerId}</Text>
                  {c.dropPlayerId && <Text style={[s.claimLine, { color: "#ef4444" }]}>- {c.dropPlayer?.name ?? c.dropPlayerId}</Text>}
                </View>
                <TouchableOpacity style={[s.cancelBtn, { borderColor: C.border }]} onPress={() => cancelClaim(c.id)}>
                  <Text style={[s.cancelBtnText, { color: C.sub }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={!!claimTarget} transparent animationType="slide" onRequestClose={() => setClaimTarget(null)}>
        <View style={[s.modalOverlay, { backgroundColor: C.modalBg }]}>
          <View style={[s.modalBox, { backgroundColor: C.surface }]}>
            <Text style={[s.modalTitle, { color: C.text }]}>Claim {claimTarget?.full_name}</Text>
            <Text style={[s.modalSub, { color: C.sub }]}>{claimTarget?.position} · {claimTarget?.team ?? "FA"}</Text>
            <Text style={[s.sectionTitle, { color: C.sub }]}>Drop a player (optional)</Text>
            <ScrollView style={{ maxHeight: 180, marginBottom: 16 }}>
              <TouchableOpacity style={[s.dropOption, { backgroundColor: C.bg, borderColor: C.border }, dropId === "" && { borderColor: C.accent, backgroundColor: `${C.accent}12` }]} onPress={() => setDropId("")}>
                <Text style={[s.dropOptionText, { color: C.text }]}>— No drop —</Text>
              </TouchableOpacity>
              {myRoster.map((sl) => (
                <TouchableOpacity key={sl.id} style={[s.dropOption, { backgroundColor: C.bg, borderColor: C.border }, dropId === sl.playerId && { borderColor: C.accent, backgroundColor: `${C.accent}12` }]} onPress={() => setDropId(sl.playerId)}>
                  <Text style={[s.dropOptionText, { color: C.text }]}>{sl.name ?? sl.playerId} ({sl.slot})</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row" }}>
              <Button variant="ghost" onPress={() => setClaimTarget(null)} style={{ flex: 1, marginRight: 8 }}>Cancel</Button>
              <Button onPress={submitClaim} loading={claiming} style={{ flex: 1 }}>Submit</Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Trades Tab ───────────────────────────────────────────────────────────────

function TradesTab({ leagueId }: { leagueId: string }) {
  const C = useTheme();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [myTeamId, setMyTeamId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ trades: Trade[]; myTeamId: string }>(`/trades/${leagueId}`).then((res) => {
      if (res.ok) { setTrades(res.data.trades); setMyTeamId(res.data.myTeamId); }
      setLoading(false);
    });
  }, [leagueId]);

  async function accept(tradeId: string) {
    const res = await api.post(`/trades/${leagueId}/${tradeId}/accept`, {});
    if (res.ok) setTrades((prev) => prev.map((t) => t.id === tradeId ? { ...t, status: "ACCEPTED" } : t));
    else Alert.alert("Error", (res as any).error ?? "Failed");
  }
  async function reject(tradeId: string) {
    const res = await api.post(`/trades/${leagueId}/${tradeId}/reject`, {});
    if (res.ok) setTrades((prev) => prev.map((t) => t.id === tradeId ? { ...t, status: "REJECTED" } : t));
    else Alert.alert("Error", (res as any).error ?? "Failed");
  }
  async function cancel(tradeId: string) {
    const res = await api.del(`/trades/${leagueId}/${tradeId}`);
    if (res.ok) setTrades((prev) => prev.filter((t) => t.id !== tradeId));
    else Alert.alert("Error", (res as any).error ?? "Failed");
  }

  if (loading) return <LoadingView />;
  if (trades.length === 0) return <View style={s.center}><Text style={[s.emptyText, { color: C.sub }]}>No trades yet.</Text></View>;

  const pending = trades.filter((t) => t.status === "PENDING");
  const history = trades.filter((t) => t.status !== "PENDING");

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      {pending.length > 0 && (
        <>
          <Text style={[s.sectionTitle, { color: C.sub }]}>Pending</Text>
          {pending.map((t) => {
            const myItems = t.items.filter((i) => i.fromTeamId === myTeamId);
            const theirItems = t.items.filter((i) => i.fromTeamId !== myTeamId);
            return (
              <View key={t.id} style={[s.tradeCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[s.tradeHeader, { color: C.text }]}>{t.proposingTeam.name} → {t.receivingTeam.name}</Text>
                <View style={s.tradeBody}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.tradeLabel, { color: C.sub }]}>You give</Text>
                    {myItems.map((i) => <Text key={i.id} style={[s.tradePlayer, { color: C.text }]}>{i.playerId}</Text>)}
                  </View>
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text style={[s.tradeLabel, { color: C.sub }]}>You get</Text>
                    {theirItems.map((i) => <Text key={i.id} style={[s.tradePlayer, { color: C.text }]}>{i.playerId}</Text>)}
                  </View>
                </View>
                {t.note ? <Text style={[s.tradeNote, { color: C.sub }]}>{t.note}</Text> : null}
                <View style={s.tradeActions}>
                  {t.receivingTeamId === myTeamId && (
                    <>
                      <TouchableOpacity style={s.acceptBtn} onPress={() => accept(t.id)}>
                        <Text style={s.acceptBtnText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.rejectBtn, { borderColor: C.border }]} onPress={() => reject(t.id)}>
                        <Text style={[s.rejectBtnText, { color: C.sub }]}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {t.proposingTeamId === myTeamId && (
                    <TouchableOpacity style={[s.rejectBtn, { flex: 1, borderColor: C.border }]} onPress={() => cancel(t.id)}>
                      <Text style={[s.rejectBtnText, { color: C.sub }]}>Cancel Offer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </>
      )}
      {history.length > 0 && (
        <>
          <Text style={[s.sectionTitle, { color: C.sub, marginTop: 16 }]}>History</Text>
          {history.map((t) => (
            <View key={t.id} style={[s.tradeCard, { backgroundColor: C.surface, borderColor: C.border, opacity: 0.55 }]}>
              <Text style={[s.tradeHeader, { color: C.text }]}>{t.proposingTeam.name} ↔ {t.receivingTeam.name}</Text>
              <Text style={[s.tradeLabel, { marginTop: 4, color: t.status === "ACCEPTED" ? "#22c55e" : C.sub }]}>{t.status}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

// ─── Standings Tab ────────────────────────────────────────────────────────────

function StandingsTab({ leagueId }: { leagueId: string }) {
  const C = useTheme();
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [week, setWeek] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ standings: StandingRow[]; currentWeek: number }>(
      `/season/${leagueId}/standings`
    ).then((res) => {
      if (res.ok) { setStandings(res.data.standings); setWeek(res.data.currentWeek); }
      setLoading(false);
    });
  }, [leagueId]);

  if (loading) return <LoadingView />;

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <Text style={[s.sectionTitle, { color: C.sub }]}>Week {week} Standings</Text>
      {standings.map((row, i) => (
        <View key={row.teamId} style={[s.standingRow, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[s.standingRank, { color: C.accent }]}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.standingName, { color: C.text }]}>{row.teamName}</Text>
            <Text style={[s.standingPts, { color: C.sub }]}>{row.pointsFor.toFixed(1)} pts</Text>
          </View>
          <Text style={[s.standingRecord, { color: C.text }]}>{row.wins}-{row.losses}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ league, onCopyInvite }: { league: LeagueDetail; onCopyInvite: () => void }) {
  const C = useTheme();
  const pot = league.buyIn * league.maxTeams;
  const prize = Math.floor(pot * 0.95);
  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
        <Text style={[s.cardTitle, { color: C.sub }]}>League Settings</Text>
        <InfoRow label="Buy-In" value={`$${league.buyIn}`} accent />
        <InfoRow label="Teams" value={`${league.memberCount} / ${league.maxTeams}`} />
        <InfoRow label="Scoring" value={league.scoringType === "FULL_PPR" ? "Full PPR" : "Half PPR"} />
        <InfoRow label="Draft" value={league.draftType === "SNAKE" ? "Snake Draft" : "Auction ($200)"} />
        <InfoRow label="Payout" value={PAYOUT_LABEL[league.payoutPreset] ?? league.payoutPreset} />
        <InfoRow label="Visibility" value={league.visibility === "PUBLIC" ? "Public" : "Private"} />
      </View>
      {league.buyIn > 0 && (
        <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[s.cardTitle, { color: C.sub }]}>Prize Pool</Text>
          <InfoRow label="Total Pot" value={`$${pot.toLocaleString()}`} />
          <InfoRow label="After 5% fee" value={`$${prize.toLocaleString()}`} accent />
          {(league.payoutSplit?.length ?? 0) > 0 && league.payoutSplit.map((sp) => (
            <View key={sp.place} style={s.payoutRow}>
              <Text style={[s.payoutPlace, { color: C.text }]}>{sp.place === 1 ? "1st" : sp.place === 2 ? "2nd" : "3rd"} Place</Text>
              <Text style={[s.payoutAmt, { color: C.accent }]}>${Math.floor(prize * sp.percent / 100).toLocaleString()}</Text>
            </View>
          ))}
        </View>
      )}
      {league.isCommissioner && (
        <TouchableOpacity style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]} onPress={onCopyInvite} activeOpacity={0.75}>
          <Text style={[s.cardTitle, { color: C.sub }]}>Invite Code</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={[s.inviteCode, { color: C.accent }]}>{league.inviteCode}</Text>
            <Text style={[s.hint, { color: C.sub }]}>Tap to copy</Text>
          </View>
        </TouchableOpacity>
      )}
      <TeamsCard league={league} />
    </ScrollView>
  );
}

// ─── Shared: PlayerCard ───────────────────────────────────────────────────────

function PlayerCard({
  slot, selected, muted, onPress, showStats,
}: {
  slot: RosterSlot; selected?: boolean; muted?: boolean; showStats?: boolean; onPress?: () => void;
}) {
  const C = useTheme();
  const [imgErr, setImgErr] = useState(false);
  const color = POS_COLORS[slot.slot] ?? "#6b7280";

  const inner = (
    <View style={[
      s.playerRow,
      { backgroundColor: C.surface, borderColor: C.border },
      selected && { borderColor: C.accent, backgroundColor: `${C.accent}12` },
      muted && s.playerRowMuted,
    ]}>
      {slot.headshotUrl && !imgErr ? (
        <Image source={{ uri: slot.headshotUrl }} style={s.headshot} onError={() => setImgErr(true)} />
      ) : (
        <View style={[s.headshotFallback, { backgroundColor: `${color}22` }]}>
          <Text style={[s.headshotText, { color }]}>{(slot.position ?? slot.slot).slice(0, 2)}</Text>
        </View>
      )}
      {/* Solid colored background, white text in dark / black text in light */}
      <View style={[s.slotBadge, { backgroundColor: color }]}>
        <Text style={[s.slotText, { color: C.badgeText }]}>{slot.slot}</Text>
      </View>
      <View style={s.playerInfo}>
        <Text style={[s.playerName, { color: C.text }]} numberOfLines={1}>{slot.name ?? slot.playerId}</Text>
        {showStats && slot.statLine ? (
          <Text style={[s.playerMeta, { color: C.sub }]} numberOfLines={1}>{slot.statLine}</Text>
        ) : slot.position ? (
          <Text style={[s.playerMeta, { color: C.sub }]}>{slot.position}{slot.team ? ` · ${slot.team}` : ""}</Text>
        ) : null}
      </View>
      <Text style={[s.pts, { color: C.sub }, (slot.points ?? 0) > 0 && { color: C.text }]}>
        {slot.points !== null && slot.points !== undefined ? slot.points.toFixed(1) : "—"}
      </Text>
    </View>
  );

  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.75}>{inner}</TouchableOpacity>;
  return inner;
}

// ─── Shared: InfoRow ──────────────────────────────────────────────────────────

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const C = useTheme();
  return (
    <View style={[s.infoRow, { borderBottomColor: C.innerBorder }]}>
      <Text style={[s.infoLabel, { color: C.sub }]}>{label}</Text>
      <Text style={[s.infoValue, { color: C.text }, accent && { color: C.accent, fontWeight: "700" }]}>{value}</Text>
    </View>
  );
}

// ─── Shared: LoadingView ──────────────────────────────────────────────────────

function LoadingView() {
  const C = useTheme();
  return <View style={s.center}><ActivityIndicator color={C.accent} /></View>;
}

// ─── Styles (layout only — colors applied inline via theme) ───────────────────

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorText: { color: "#ef4444", fontSize: 15, marginBottom: 12 },
  link: { fontSize: 14 },
  emptyText: { fontSize: 14, textAlign: "center" },

  // Header
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  brandBtn: { width: 110 },
  brandText: { fontSize: 13, fontWeight: "800", letterSpacing: -0.3 },
  headerTitle: { fontSize: 14, fontWeight: "700", flex: 1, textAlign: "center", marginHorizontal: 4 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: "700" },

  // Tab bar — fixed height to prevent grey space expansion
  tabBarWrap: { height: 46, borderBottomWidth: 1, flexShrink: 0 },
  tabBarInner: { paddingHorizontal: 4, alignItems: "center" },
  tabItem: { paddingHorizontal: 14, height: 46, justifyContent: "center" },
  tabLabel: { fontSize: 13, fontWeight: "600" },
  tabLabelActive: { fontWeight: "700" },

  // Cards
  card: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
  sectionTitle: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  subLabel: { fontSize: 12, marginBottom: 6 },

  // Buttons
  primaryBtn: { borderRadius: 10, padding: 14, marginBottom: 12, alignItems: "center" },
  primaryBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  disabledBtn: { opacity: 0.4 },

  // Invite
  inviteCode: { fontSize: 22, fontWeight: "800", letterSpacing: 2 },
  hint: { fontSize: 12 },

  // InfoRow
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1 },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: "500" },

  // Payout
  payoutRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  payoutPlace: { fontSize: 13 },
  payoutAmt: { fontSize: 13, fontWeight: "700" },

  // Teams
  teamRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1 },
  teamName: { fontSize: 14, fontWeight: "600" },
  teamUsername: { fontSize: 12 },
  commLabel: { fontSize: 11, color: "#f59e0b", backgroundColor: "rgba(245,158,11,0.12)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },

  // My Team
  teamHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  myTeamName: { fontSize: 16, fontWeight: "700" },
  weekLabel: { fontSize: 12, marginTop: 2 },
  lockedLabel: { fontSize: 12 },
  saveBtn: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  saveBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  swapHint: { fontSize: 12, textAlign: "center", marginBottom: 10 },

  // Matchup
  scoreCard: { borderWidth: 1, borderRadius: 12, padding: 20, flexDirection: "row", alignItems: "center", marginBottom: 16 },
  scoreHalf: { flex: 1 },
  scoreTeamName: { fontSize: 14, fontWeight: "600" },
  scoreUser: { fontSize: 12, marginBottom: 4 },
  bigScore: { fontSize: 32, fontWeight: "800" },
  winScore: { color: "#22c55e" },
  vs: { fontSize: 12, marginHorizontal: 12 },
  rosterLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 8 },
  divider: { height: 1, marginVertical: 16 },

  // Player card
  playerRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderWidth: 1, borderRadius: 8, marginBottom: 6 },
  playerRowMuted: { opacity: 0.5 },
  headshot: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#1a2133" },
  headshotFallback: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headshotText: { fontSize: 11, fontWeight: "800" },
  slotBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, minWidth: 40, alignItems: "center" },
  slotText: { fontSize: 10, fontWeight: "700" },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 13, fontWeight: "600" },
  playerMeta: { fontSize: 11, marginTop: 1 },
  pts: { fontSize: 14, fontWeight: "700" },

  // Waivers
  subTabRow: { flexDirection: "row", borderBottomWidth: 1 },
  subTab: { flex: 1, paddingVertical: 11, alignItems: "center" },
  subTabText: { fontSize: 13, fontWeight: "600" },
  searchInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 10 },
  posBtn: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderRadius: 6, marginRight: 6 },
  posBtnText: { fontSize: 12, fontWeight: "600" },
  claimBtn: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  claimBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  dropBtn: { borderWidth: 1, borderColor: "#ef4444", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  dropBtnText: { color: "#ef4444", fontSize: 12 },
  claimRow: { flexDirection: "row", alignItems: "center", padding: 12, borderWidth: 1, borderRadius: 8, marginBottom: 6 },
  claimLine: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  cancelBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  cancelBtnText: { fontSize: 12 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBox: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "80%" },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  modalSub: { fontSize: 13, marginBottom: 16 },
  dropOption: { padding: 12, borderWidth: 1, borderRadius: 8, marginBottom: 6 },
  dropOptionText: { fontSize: 14 },

  // Trades
  tradeCard: { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 10 },
  tradeHeader: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  tradeBody: { flexDirection: "row", marginBottom: 8 },
  tradeLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", marginBottom: 4 },
  tradePlayer: { fontSize: 13 },
  tradeNote: { fontSize: 12, fontStyle: "italic", marginBottom: 8 },
  tradeActions: { flexDirection: "row", gap: 8 },
  acceptBtn: { flex: 1, backgroundColor: "#22c55e", borderRadius: 6, padding: 8, alignItems: "center" },
  acceptBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  rejectBtn: { flex: 1, borderWidth: 1, borderRadius: 6, padding: 8, alignItems: "center" },
  rejectBtnText: { fontSize: 13 },

  // Standings
  standingRow: { flexDirection: "row", alignItems: "center", padding: 12, borderWidth: 1, borderRadius: 8, marginBottom: 6 },
  standingRank: { fontSize: 16, fontWeight: "800", width: 28 },
  standingName: { fontSize: 14, fontWeight: "600" },
  standingPts: { fontSize: 11 },
  standingRecord: { fontSize: 14, fontWeight: "700" },
});
