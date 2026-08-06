import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, Image, Clipboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "../../../src/api/client";
import Button from "../../../src/components/Button";

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

export default function LeagueScreen() {
  const router = useRouter();
  const { id: leagueId } = useLocalSearchParams<{ id: string }>();
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
    <SafeAreaView style={s.safe}><ActivityIndicator color="#4f7cff" style={{ flex: 1 }} /></SafeAreaView>
  );
  if (!league) return (
    <SafeAreaView style={s.safe}><View style={s.center}>
      <Text style={s.errorText}>League not found</Text>
      <TouchableOpacity onPress={() => router.back()}><Text style={s.link}>Go back</Text></TouchableOpacity>
    </View></SafeAreaView>
  );

  const isActive = league.status === "ACTIVE" || league.status === "PLAYOFFS";

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 60 }}>
          <Text style={s.back}>Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{league.name}</Text>
        <View style={[s.statusPill, { backgroundColor: `${STATUS_COLOR[league.status] ?? "#6b7280"}22` }]}>
          <Text style={[s.statusText, { color: STATUS_COLOR[league.status] ?? "#6b7280" }]}>{league.status}</Text>
        </View>
      </View>

      {league.status === "SETUP" && (
        <SetupView league={league} startingDraft={startingDraft} onStartDraft={startDraft} onCopyInvite={copyInvite} />
      )}
      {league.status === "DRAFTING" && (
        <ScrollView style={s.scroll} contentContainerStyle={s.content}>
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.push(`/(app)/league/${leagueId}/draft` as any)}>
            <Text style={s.primaryBtnText}>Enter Draft Room</Text>
          </TouchableOpacity>
          <TeamsCard league={league} />
        </ScrollView>
      )}
      {isActive && (
        <View style={{ flex: 1 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={s.tabBarInner}>
            {TABS.map((t) => (
              <TouchableOpacity key={t} style={[s.tabItem, activeTab === t && s.tabItemActive]} onPress={() => setActiveTab(t)}>
                <Text style={[s.tabLabel, activeTab === t && s.tabLabelActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {activeTab === "My Team" && <MyTeamTab leagueId={leagueId!} />}
          {activeTab === "Matchup" && <MatchupTab leagueId={leagueId!} />}
          {activeTab === "Waivers" && <WaiversTab leagueId={leagueId!} />}
          {activeTab === "Trades" && <TradesTab leagueId={leagueId!} />}
          {activeTab === "Standings" && <StandingsTab leagueId={leagueId!} />}
          {activeTab === "Settings" && <SettingsTab league={league} onCopyInvite={copyInvite} />}
        </View>
      )}
      {league.status === "COMPLETE" && (
        <View style={s.center}><Text style={s.emptyText}>This season is complete.</Text></View>
      )}
    </SafeAreaView>
  );
}

function SetupView({ league, startingDraft, onStartDraft, onCopyInvite }: {
  league: LeagueDetail; startingDraft: boolean; onStartDraft: () => void; onCopyInvite: () => void;
}) {
  const pot = league.buyIn * league.maxTeams;
  const prize = Math.floor(pot * 0.95);
  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      {league.isCommissioner && (
        <TouchableOpacity style={[s.primaryBtn, league.memberCount < 2 && s.disabledBtn]} onPress={league.memberCount >= 2 ? onStartDraft : undefined}>
          <Text style={s.primaryBtnText}>{startingDraft ? "Starting…" : "Start Draft"}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={s.card} onPress={onCopyInvite} activeOpacity={0.75}>
        <Text style={s.cardTitle}>Invite Code</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={s.inviteCode}>{league.inviteCode}</Text>
          <Text style={s.hint}>Tap to copy</Text>
        </View>
      </TouchableOpacity>
      <View style={s.card}>
        <Text style={s.cardTitle}>Settings</Text>
        <InfoRow label="Buy-In" value={`$${league.buyIn}`} accent />
        <InfoRow label="Teams" value={`${league.memberCount} / ${league.maxTeams}`} />
        <InfoRow label="Scoring" value={league.scoringType === "FULL_PPR" ? "Full PPR" : "Half PPR"} />
        <InfoRow label="Draft" value={league.draftType === "SNAKE" ? "Snake Draft" : "Auction ($200)"} />
        <InfoRow label="Visibility" value={league.visibility === "PUBLIC" ? "Public" : "Private"} />
      </View>
      {league.buyIn > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Prize Pool</Text>
          <InfoRow label="Total Pot" value={`$${pot.toLocaleString()}`} />
          <InfoRow label="After 5% fee" value={`$${prize.toLocaleString()}`} accent />
          {(league.payoutSplit?.length ?? 0) > 0 && (
            <View style={{ marginTop: 10 }}>
              <Text style={s.subLabel}>{PAYOUT_LABEL[league.payoutPreset]}</Text>
              {league.payoutSplit.map((sp) => (
                <View key={sp.place} style={s.payoutRow}>
                  <Text style={s.payoutPlace}>{sp.place === 1 ? "1st" : sp.place === 2 ? "2nd" : "3rd"} Place</Text>
                  <Text style={s.payoutAmt}>${Math.floor(prize * sp.percent / 100).toLocaleString()}</Text>
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

function TeamsCard({ league }: { league: LeagueDetail }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Teams ({league.memberCount}/{league.maxTeams})</Text>
      {(league.teams ?? []).map((t) => (
        <View key={t.id} style={s.teamRow}>
          <View>
            <Text style={s.teamName}>{t.name}</Text>
            <Text style={s.teamUsername}>@{t.username}</Text>
          </View>
          {t.isCommissioner && <Text style={s.commLabel}>Comm.</Text>}
        </View>
      ))}
      {Array.from({ length: Math.max(0, league.maxTeams - (league.memberCount ?? 0)) }).map((_, i) => (
        <View key={`open-${i}`} style={[s.teamRow, { opacity: 0.3 }]}>
          <Text style={{ color: "#8a95a8", fontSize: 14 }}>Open slot</Text>
        </View>
      ))}
    </View>
  );
}

function MyTeamTab({ leagueId }: { leagueId: string }) {
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
    const res = await api.post(`/season/${leagueId}/lineup`, { slots: roster.map((r) => ({ playerId: r.playerId, slot: r.slot })) });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    else Alert.alert("Error", (res as any).error ?? "Failed to save lineup");
  }

  if (loading) return <LoadingView />;
  const starters = roster.filter((r) => r.slot !== "BENCH").sort((a, b) => STARTER_ORDER.indexOf(a.slot) - STARTER_ORDER.indexOf(b.slot));
  const bench = roster.filter((r) => r.slot === "BENCH");
  const pts = starters.reduce((n, r) => n + (r.points ?? 0), 0);

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <View style={s.teamHeaderRow}>
        <View>
          <Text style={s.myTeamName}>{team?.name}</Text>
          <Text style={s.weekLabel}>Week {week}</Text>
        </View>
        {isLocked ? <Text style={s.lockedLabel}>Locked</Text> : (
          <TouchableOpacity style={s.saveBtn} onPress={saveLineup} disabled={saving}>
            <Text style={s.saveBtnText}>{saving ? "Saving…" : saved ? "Saved ✓" : "Save"}</Text>
          </TouchableOpacity>
        )}
      </View>
      {!isLocked && <Text style={s.swapHint}>{swap ? "Tap another player to swap" : "Tap a player to change lineup"}</Text>}
      <Text style={s.sectionTitle}>Starters · {pts.toFixed(1)} pts</Text>
      {starters.map((r) => <PlayerCard key={r.id} slot={r} selected={swap?.id === r.id} onPress={() => handlePress(r)} />)}
      <Text style={[s.sectionTitle, { marginTop: 16 }]}>Bench</Text>
      {bench.map((r) => <PlayerCard key={r.id} slot={r} muted selected={swap?.id === r.id} onPress={() => handlePress(r)} />)}
    </ScrollView>
  );
}

function MatchupTab({ leagueId }: { leagueId: string }) {
  const [matchup, setMatchup] = useState<MatchupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    async function load() {
      const teamRes = await api.get<{ team: { id: string }; currentWeek: number }>(`/season/${leagueId}/my-team`);
      if (!teamRes.ok) { setEmpty(true); setLoading(false); return; }
      const { team, currentWeek } = teamRes.data;
      const wRes = await api.get<{ matchups: MatchupSummary[] }>(`/season/${leagueId}/matchups/${currentWeek}`);
      if (!wRes.ok) { setEmpty(true); setLoading(false); return; }
      const mine = wRes.data.matchups.find((m) => m.homeTeam.id === team.id || m.awayTeam.id === team.id);
      if (!mine) { setEmpty(true); setLoading(false); return; }
      const dRes = await api.get<{ matchup: MatchupDetail }>(`/season/${leagueId}/matchup/${mine.id}`);
      if (dRes.ok) setMatchup(dRes.data.matchup);
      else setEmpty(true);
      setLoading(false);
    }
    load();
  }, [leagueId]);

  if (loading) return <LoadingView />;
  if (empty || !matchup) return <View style={s.center}><Text style={s.emptyText}>No matchup found for this week.</Text></View>;

  const homeWin = matchup.homeScore >= matchup.awayScore;
  const sortSlots = (slots: RosterSlot[]) => slots.filter((sl) => sl.slot !== "BENCH").sort((a, b) => STARTER_ORDER.indexOf(a.slot) - STARTER_ORDER.indexOf(b.slot));
  const benchSlots = (slots: RosterSlot[]) => slots.filter((sl) => sl.slot === "BENCH");

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <View style={s.scoreCard}>
        <View style={s.scoreHalf}>
          <Text style={s.scoreTeamName} numberOfLines={1}>{matchup.homeTeam.name}</Text>
          <Text style={s.scoreUser}>@{matchup.homeTeam.user.username}</Text>
          <Text style={[s.bigScore, homeWin && s.winScore]}>{matchup.homeScore.toFixed(2)}</Text>
        </View>
        <Text style={s.vs}>vs</Text>
        <View style={[s.scoreHalf, { alignItems: "flex-end" }]}>
          <Text style={s.scoreTeamName} numberOfLines={1}>{matchup.awayTeam.name}</Text>
          <Text style={s.scoreUser}>@{matchup.awayTeam.user.username}</Text>
          <Text style={[s.bigScore, !homeWin && s.winScore]}>{matchup.awayScore.toFixed(2)}</Text>
        </View>
      </View>
      <Text style={s.rosterLabel}>{matchup.homeTeam.name}</Text>
      {sortSlots(matchup.homeTeam.rosterSlots).map((sl) => <PlayerCard key={sl.id} slot={sl} showStats />)}
      <Text style={[s.rosterLabel, { opacity: 0.5, marginTop: 4 }]}>Bench</Text>
      {benchSlots(matchup.homeTeam.rosterSlots).map((sl) => <PlayerCard key={sl.id} slot={sl} muted showStats />)}
      <View style={s.divider} />
      <Text style={s.rosterLabel}>{matchup.awayTeam.name}</Text>
      {sortSlots(matchup.awayTeam.rosterSlots).map((sl) => <PlayerCard key={sl.id} slot={sl} showStats />)}
      <Text style={[s.rosterLabel, { opacity: 0.5, marginTop: 4 }]}>Bench</Text>
      {benchSlots(matchup.awayTeam.rosterSlots).map((sl) => <PlayerCard key={sl.id} slot={sl} muted showStats />)}
    </ScrollView>
  );
}

function WaiversTab({ leagueId }: { leagueId: string }) {
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
    const res = await api.post(`/waivers/${leagueId}/claim`, { addPlayerId: claimTarget.player_id, dropPlayerId: dropId || undefined });
    setClaiming(false);
    if (res.ok) { setClaims((prev) => [...prev, (res as any).data.claim]); setClaimTarget(null); setDropId(""); }
    else Alert.alert("Error", (res as any).error ?? "Failed to submit claim");
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
      <View style={s.subTabRow}>
        <TouchableOpacity style={[s.subTab, subTab === "browse" && s.subTabActive]} onPress={() => setSubTab("browse")}>
          <Text style={[s.subTabText, subTab === "browse" && s.subTabTextActive]}>Free Agents</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.subTab, subTab === "claims" && s.subTabActive]} onPress={() => setSubTab("claims")}>
          <Text style={[s.subTabText, subTab === "claims" && s.subTabTextActive]}>
            My Claims{claims.length > 0 ? ` (${claims.length})` : ""}
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {subTab === "browse" && (
          <>
            <TextInput style={s.searchInput} placeholder="Search players…" placeholderTextColor="#4a5568" value={search} onChangeText={setSearch} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {POSITIONS.map((p) => (
                <TouchableOpacity key={p} style={[s.posBtn, pos === p && s.posBtnActive]} onPress={() => setPos(p)}>
                  <Text style={[s.posBtnText, pos === p && s.posBtnTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {players.map((p) => {
              const color = (POS_COLORS as any)[p.position] ?? "#6b7280";
              return (
                <View key={p.player_id} style={s.playerRow}>
                  <View style={[s.slotBadge, { backgroundColor: `${color}20` }]}>
                    <Text style={[s.slotText, { color }]}>{p.position}</Text>
                  </View>
                  <View style={s.playerInfo}>
                    <Text style={s.playerName}>{p.full_name}</Text>
                    <Text style={s.playerMeta}>{p.team ?? "FA"}{p.injury_status ? ` · ${p.injury_status}` : ""}</Text>
                  </View>
                  <TouchableOpacity style={s.claimBtn} onPress={() => { setClaimTarget(p); setDropId(""); }}>
                    <Text style={s.claimBtnText}>Claim</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            <Text style={[s.sectionTitle, { marginTop: 20 }]}>My Roster — Drop Players</Text>
            {myRoster.map((sl) => (
              <View key={sl.id} style={s.playerRow}>
                <View style={s.slotBadge}><Text style={s.slotText}>{sl.slot}</Text></View>
                <Text style={[s.playerName, { flex: 1 }]}>{sl.name ?? sl.playerId}</Text>
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
              <Text style={[s.emptyText, { marginTop: 40 }]}>No pending claims.</Text>
            ) : claims.map((c) => (
              <View key={c.id} style={s.claimRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.claimLine}>+ {c.addPlayer?.name ?? c.addPlayerId}</Text>
                  {c.dropPlayerId && <Text style={[s.claimLine, { color: "#ef4444" }]}>- {c.dropPlayer?.name ?? c.dropPlayerId}</Text>}
                </View>
                <TouchableOpacity style={s.cancelBtn} onPress={() => cancelClaim(c.id)}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>
      <Modal visible={!!claimTarget} transparent animationType="slide" onRequestClose={() => setClaimTarget(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Claim {claimTarget?.full_name}</Text>
            <Text style={s.modalSub}>{claimTarget?.position} · {claimTarget?.team ?? "FA"}</Text>
            <Text style={s.sectionTitle}>Drop a player (optional)</Text>
            <ScrollView style={{ maxHeight: 180, marginBottom: 16 }}>
              <TouchableOpacity style={[s.dropOption, dropId === "" && s.dropOptionActive]} onPress={() => setDropId("")}>
                <Text style={s.dropOptionText}>— No drop —</Text>
              </TouchableOpacity>
              {myRoster.map((sl) => (
                <TouchableOpacity key={sl.id} style={[s.dropOption, dropId === sl.playerId && s.dropOptionActive]} onPress={() => setDropId(sl.playerId)}>
                  <Text style={s.dropOptionText}>{sl.name ?? sl.playerId} ({sl.slot})</Text>
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

function TradesTab({ leagueId }: { leagueId: string }) {
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
  if (trades.length === 0) return <View style={s.center}><Text style={s.emptyText}>No trades yet.</Text></View>;

  const pending = trades.filter((t) => t.status === "PENDING");
  const history = trades.filter((t) => t.status !== "PENDING");

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      {pending.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Pending</Text>
          {pending.map((t) => {
            const myItems = t.items.filter((i) => i.fromTeamId === myTeamId);
            const theirItems = t.items.filter((i) => i.fromTeamId !== myTeamId);
            return (
              <View key={t.id} style={s.tradeCard}>
                <Text style={s.tradeHeader}>{t.proposingTeam.name} → {t.receivingTeam.name}</Text>
                <View style={s.tradeBody}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.tradeLabel}>You give</Text>
                    {myItems.map((i) => <Text key={i.id} style={s.tradePlayer}>{i.playerId}</Text>)}
                  </View>
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text style={s.tradeLabel}>You get</Text>
                    {theirItems.map((i) => <Text key={i.id} style={s.tradePlayer}>{i.playerId}</Text>)}
                  </View>
                </View>
                {t.note ? <Text style={s.tradeNote}>{t.note}</Text> : null}
                <View style={s.tradeActions}>
                  {t.receivingTeamId === myTeamId && (
                    <>
                      <TouchableOpacity style={s.acceptBtn} onPress={() => accept(t.id)}>
                        <Text style={s.acceptBtnText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.rejectBtn} onPress={() => reject(t.id)}>
                        <Text style={s.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {t.proposingTeamId === myTeamId && (
                    <TouchableOpacity style={[s.rejectBtn, { flex: 1 }]} onPress={() => cancel(t.id)}>
                      <Text style={s.rejectBtnText}>Cancel Offer</Text>
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
          <Text style={[s.sectionTitle, { marginTop: 16 }]}>History</Text>
          {history.map((t) => (
            <View key={t.id} style={[s.tradeCard, { opacity: 0.55 }]}>
              <Text style={s.tradeHeader}>{t.proposingTeam.name} ↔ {t.receivingTeam.name}</Text>
              <Text style={[s.tradeLabel, { marginTop: 4, color: t.status === "ACCEPTED" ? "#22c55e" : "#8a95a8" }]}>{t.status}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function StandingsTab({ leagueId }: { leagueId: string }) {
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [week, setWeek] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ standings: StandingRow[]; currentWeek: number }>(`/season/${leagueId}/standings`).then((res) => {
      if (res.ok) { setStandings(res.data.standings); setWeek(res.data.currentWeek); }
      setLoading(false);
    });
  }, [leagueId]);

  if (loading) return <LoadingView />;
  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <Text style={s.sectionTitle}>Week {week} Standings</Text>
      {standings.map((row, i) => (
        <View key={row.teamId} style={s.standingRow}>
          <Text style={s.standingRank}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.standingName}>{row.teamName}</Text>
            <Text style={s.standingPts}>{row.pointsFor.toFixed(1)} pts</Text>
          </View>
          <Text style={s.standingRecord}>{row.wins}-{row.losses}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function SettingsTab({ league, onCopyInvite }: { league: LeagueDetail; onCopyInvite: () => void }) {
  const pot = league.buyIn * league.maxTeams;
  const prize = Math.floor(pot * 0.95);
  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <View style={s.card}>
        <Text style={s.cardTitle}>League Settings</Text>
        <InfoRow label="Buy-In" value={`$${league.buyIn}`} accent />
        <InfoRow label="Teams" value={`${league.memberCount} / ${league.maxTeams}`} />
        <InfoRow label="Scoring" value={league.scoringType === "FULL_PPR" ? "Full PPR" : "Half PPR"} />
        <InfoRow label="Draft" value={league.draftType === "SNAKE" ? "Snake Draft" : "Auction ($200)"} />
        <InfoRow label="Payout" value={PAYOUT_LABEL[league.payoutPreset] ?? league.payoutPreset} />
        <InfoRow label="Visibility" value={league.visibility === "PUBLIC" ? "Public" : "Private"} />
      </View>
      {league.buyIn > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Prize Pool</Text>
          <InfoRow label="Total Pot" value={`$${pot.toLocaleString()}`} />
          <InfoRow label="After 5% fee" value={`$${prize.toLocaleString()}`} accent />
          {(league.payoutSplit?.length ?? 0) > 0 && league.payoutSplit.map((sp) => (
            <View key={sp.place} style={s.payoutRow}>
              <Text style={s.payoutPlace}>{sp.place === 1 ? "1st" : sp.place === 2 ? "2nd" : "3rd"} Place</Text>
              <Text style={s.payoutAmt}>${Math.floor(prize * sp.percent / 100).toLocaleString()}</Text>
            </View>
          ))}
        </View>
      )}
      {league.isCommissioner && (
        <TouchableOpacity style={s.card} onPress={onCopyInvite} activeOpacity={0.75}>
          <Text style={s.cardTitle}>Invite Code</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={s.inviteCode}>{league.inviteCode}</Text>
            <Text style={s.hint}>Tap to copy</Text>
          </View>
        </TouchableOpacity>
      )}
      <TeamsCard league={league} />
    </ScrollView>
  );
}

function PlayerCard({ slot, selected, muted, onPress, showStats }: {
  slot: RosterSlot; selected?: boolean; muted?: boolean; showStats?: boolean; onPress?: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const color = (POS_COLORS as any)[slot.slot] ?? "#6b7280";
  const inner = (
    <View style={[s.playerRow, selected && s.playerRowSelected, muted && s.playerRowMuted]}>
      {slot.headshotUrl && !imgErr ? (
        <Image source={{ uri: slot.headshotUrl }} style={s.headshot} onError={() => setImgErr(true)} />
      ) : (
        <View style={[s.headshotFallback, { backgroundColor: `${color}22` }]}>
          <Text style={[s.headshotText, { color }]}>{(slot.position ?? slot.slot).slice(0, 2)}</Text>
        </View>
      )}
      <View style={[s.slotBadge, { backgroundColor: `${color}18` }]}>
        <Text style={[s.slotText, { color }]}>{slot.slot}</Text>
      </View>
      <View style={s.playerInfo}>
        <Text style={s.playerName} numberOfLines={1}>{slot.name ?? slot.playerId}</Text>
        {showStats && slot.statLine ? (
          <Text style={s.playerMeta} numberOfLines={1}>{slot.statLine}</Text>
        ) : slot.position ? (
          <Text style={s.playerMeta}>{slot.position}{slot.team ? ` · ${slot.team}` : ""}</Text>
        ) : null}
      </View>
      <Text style={[s.pts, (slot.points ?? 0) > 0 && s.ptsActive]}>
        {slot.points !== null && slot.points !== undefined ? slot.points.toFixed(1) : "—"}
      </Text>
    </View>
  );
  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.75}>{inner}</TouchableOpacity>;
  return inner;
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, accent && s.infoAccent]}>{value}</Text>
    </View>
  );
}

function LoadingView() {
  return <View style={s.center}><ActivityIndicator color="#4f7cff" /></View>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0f14" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorText: { color: "#ef4444", fontSize: 15, marginBottom: 12 },
  link: { color: "#4f7cff", fontSize: 14 },
  emptyText: { color: "#8a95a8", fontSize: 14, textAlign: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#2a3347", backgroundColor: "#161b24" },
  back: { fontSize: 14, color: "#8a95a8" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#e8eaf0", flex: 1, textAlign: "center", marginHorizontal: 8 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: "700" },
  tabBar: { borderBottomWidth: 1, borderBottomColor: "#2a3347", backgroundColor: "#161b24" },
  tabBarInner: { paddingHorizontal: 4 },
  tabItem: { paddingHorizontal: 16, paddingVertical: 13 },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: "#4f7cff" },
  tabLabel: { fontSize: 14, fontWeight: "600", color: "#4a5568" },
  tabLabelActive: { color: "#ffffff" },
  card: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 12, padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 11, fontWeight: "700", color: "#8a95a8", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: "#8a95a8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  subLabel: { fontSize: 12, color: "#8a95a8", marginBottom: 6 },
  primaryBtn: { backgroundColor: "#4f7cff", borderRadius: 10, padding: 14, marginBottom: 12, alignItems: "center" },
  primaryBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  disabledBtn: { opacity: 0.4 },
  inviteCode: { fontSize: 22, fontWeight: "800", color: "#4f7cff", letterSpacing: 2 },
  hint: { fontSize: 12, color: "#8a95a8" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1a2133" },
  infoLabel: { fontSize: 13, color: "#8a95a8" },
  infoValue: { fontSize: 13, color: "#e8eaf0", fontWeight: "500" },
  infoAccent: { color: "#4f7cff", fontWeight: "700" },
  payoutRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  payoutPlace: { fontSize: 13, color: "#e8eaf0" },
  payoutAmt: { fontSize: 13, fontWeight: "700", color: "#4f7cff" },
  teamRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1a2133" },
  teamName: { fontSize: 14, fontWeight: "600", color: "#e8eaf0" },
  teamUsername: { fontSize: 12, color: "#8a95a8" },
  commLabel: { fontSize: 11, color: "#f59e0b", backgroundColor: "rgba(245,158,11,0.12)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  teamHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  myTeamName: { fontSize: 16, fontWeight: "700", color: "#e8eaf0" },
  weekLabel: { fontSize: 12, color: "#8a95a8", marginTop: 2 },
  lockedLabel: { fontSize: 12, color: "#8a95a8" },
  saveBtn: { backgroundColor: "#4f7cff", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  saveBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  swapHint: { fontSize: 12, color: "#4f7cff", textAlign: "center", marginBottom: 10 },
  scoreCard: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 12, padding: 20, flexDirection: "row", alignItems: "center", marginBottom: 16 },
  scoreHalf: { flex: 1 },
  scoreTeamName: { fontSize: 14, fontWeight: "600", color: "#e8eaf0" },
  scoreUser: { fontSize: 12, color: "#8a95a8", marginBottom: 4 },
  bigScore: { fontSize: 32, fontWeight: "800", color: "#8a95a8" },
  winScore: { color: "#22c55e" },
  vs: { fontSize: 12, color: "#8a95a8", marginHorizontal: 12 },
  rosterLabel: { fontSize: 11, fontWeight: "600", color: "#8a95a8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 8 },
  divider: { height: 1, backgroundColor: "#2a3347", marginVertical: 16 },
  playerRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 8, marginBottom: 6 },
  playerRowSelected: { borderColor: "#4f7cff", backgroundColor: "rgba(79,124,255,0.08)" },
  playerRowMuted: { opacity: 0.5 },
  headshot: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#1a2133" },
  headshotFallback: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headshotText: { fontSize: 11, fontWeight: "800" },
  slotBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, minWidth: 40, alignItems: "center" },
  slotText: { fontSize: 10, fontWeight: "700" },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 13, fontWeight: "600", color: "#e8eaf0" },
  playerMeta: { fontSize: 11, color: "#8a95a8", marginTop: 1 },
  pts: { fontSize: 14, fontWeight: "700", color: "#8a95a8" },
  ptsActive: { color: "#e8eaf0" },
  subTabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#2a3347" },
  subTab: { flex: 1, paddingVertical: 11, alignItems: "center" },
  subTabActive: { borderBottomWidth: 2, borderBottomColor: "#4f7cff" },
  subTabText: { fontSize: 13, color: "#8a95a8", fontWeight: "500" },
  subTabTextActive: { color: "#4f7cff" },
  searchInput: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: "#e8eaf0", fontSize: 14, marginBottom: 10 },
  posBtn: { paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 6, marginRight: 6 },
  posBtnActive: { backgroundColor: "#4f7cff", borderColor: "#4f7cff" },
  posBtnText: { fontSize: 12, fontWeight: "600", color: "#8a95a8" },
  posBtnTextActive: { color: "#fff" },
  claimBtn: { backgroundColor: "#4f7cff", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  claimBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  dropBtn: { borderWidth: 1, borderColor: "#ef4444", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  dropBtnText: { color: "#ef4444", fontSize: 12 },
  claimRow: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 8, marginBottom: 6 },
  claimLine: { fontSize: 13, fontWeight: "600", color: "#e8eaf0", marginBottom: 2 },
  cancelBtn: { borderWidth: 1, borderColor: "#2a3347", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  cancelBtnText: { color: "#8a95a8", fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#161b24", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "80%" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#e8eaf0", marginBottom: 4 },
  modalSub: { fontSize: 13, color: "#8a95a8", marginBottom: 16 },
  dropOption: { padding: 12, backgroundColor: "#0d0f14", borderWidth: 1, borderColor: "#2a3347", borderRadius: 8, marginBottom: 6 },
  dropOptionActive: { borderColor: "#4f7cff", backgroundColor: "rgba(79,124,255,0.08)" },
  dropOptionText: { color: "#e8eaf0", fontSize: 14 },
  tradeCard: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 10, padding: 14, marginBottom: 10 },
  tradeHeader: { fontSize: 13, fontWeight: "600", color: "#e8eaf0", marginBottom: 8 },
  tradeBody: { flexDirection: "row", marginBottom: 8 },
  tradeLabel: { fontSize: 11, color: "#8a95a8", fontWeight: "600", textTransform: "uppercase", marginBottom: 4 },
  tradePlayer: { fontSize: 13, color: "#e8eaf0" },
  tradeNote: { fontSize: 12, color: "#8a95a8", fontStyle: "italic", marginBottom: 8 },
  tradeActions: { flexDirection: "row", gap: 8 },
  acceptBtn: { flex: 1, backgroundColor: "#22c55e", borderRadius: 6, padding: 8, alignItems: "center" },
  acceptBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  rejectBtn: { flex: 1, borderWidth: 1, borderColor: "#2a3347", borderRadius: 6, padding: 8, alignItems: "center" },
  rejectBtnText: { color: "#8a95a8", fontSize: 13 },
  standingRow: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 8, marginBottom: 6 },
  standingRank: { fontSize: 16, fontWeight: "800", color: "#4f7cff", width: 28 },
  standingName: { fontSize: 14, fontWeight: "600", color: "#e8eaf0" },
  standingPts: { fontSize: 11, color: "#8a95a8" },
  standingRecord: { fontSize: 14, fontWeight: "700", color: "#e8eaf0" },
});
