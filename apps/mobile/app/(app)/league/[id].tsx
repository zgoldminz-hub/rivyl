import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, Image, Clipboard,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "../../../src/api/client";
import { useTheme } from "../../../src/context/theme";

const RV_LOGO = require("../../../assets/RV.png");

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

export default function LeagueScreen() {
  const router = useRouter();
  const { id: leagueId } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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

  const statusColor = STATUS_COLOR[league?.status ?? ""] ?? "#6b7280";
  const isActive = league?.status === "ACTIVE" || league?.status === "PLAYOFFS";

  const header = (
    <LinearGradient
      colors={["#C81A1A", "#7520CC", "#1834D4"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[s.header, { paddingTop: insets.top + 10 }]}
    >
      <TouchableOpacity onPress={() => router.replace("/(app)/dashboard" as any)} style={s.headerLogo} activeOpacity={0.75}>
        <Image source={RV_LOGO} style={{ width: 72, height: 18, tintColor: "#ffffff" }} resizeMode="contain" />
      </TouchableOpacity>
      <View style={s.headerCenter}>
        <Text style={s.headerLeagueName} numberOfLines={1}>{league?.name ?? "League"}</Text>
        {league && (
          <Text style={s.headerMeta}>
            {league.memberCount}/{league.maxTeams} teams · {league.scoringType === "FULL_PPR" ? "Full PPR" : "Half PPR"}
          </Text>
        )}
      </View>
      {league && (
        <View style={[s.statusPill, { backgroundColor: `${statusColor}44`, minWidth: 72, alignItems: "flex-end" }]}>
          <Text style={[s.statusText, { color: "#fff" }]}>{league.status}</Text>
        </View>
      )}
      {!league && <View style={{ width: 72 }} />}
    </LinearGradient>
  );

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {header}
      <ActivityIndicator color={colors.accent} style={{ flex: 1 }} />
    </View>
  );

  if (!league) return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {header}
      <View style={s.center}>
        <Text style={s.errorText}>League not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.accent, fontSize: 14 }}>Go back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {header}

      {league.status === "SETUP" && (
        <SetupView league={league} startingDraft={startingDraft} onStartDraft={startDraft} onCopyInvite={copyInvite} />
      )}

      {league.status === "DRAFTING" && (
        <ScrollView style={s.scroll} contentContainerStyle={s.content}>
          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: colors.accent }]}
            onPress={() => router.push(`/(app)/league/${leagueId}/draft` as any)}
          >
            <Text style={s.primaryBtnText}>Enter Draft Room</Text>
          </TouchableOpacity>
          <TeamsCard league={league} />
        </ScrollView>
      )}

      {isActive && (
        <View style={{ flex: 1 }}>
          <View style={[s.tabBarWrap, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBarInner}>
              {TABS.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[s.tabItem, activeTab === t && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}
                  onPress={() => setActiveTab(t)}
                >
                  <Text style={[s.tabLabel, { color: activeTab === t ? colors.text : colors.textSub },
                    activeTab === t && s.tabLabelActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          {activeTab === "My Team"   && <MyTeamTab   leagueId={leagueId!} />}
          {activeTab === "Matchup"   && <MatchupTab  leagueId={leagueId!} />}
          {activeTab === "Waivers"   && <WaiversTab  leagueId={leagueId!} />}
          {activeTab === "Trades"    && <TradesTab   leagueId={leagueId!} />}
          {activeTab === "Standings" && <StandingsTab leagueId={leagueId!} />}
          {activeTab === "Settings"  && <SettingsTab league={league} onCopyInvite={copyInvite} />}
        </View>
      )}

      {league.status === "COMPLETE" && (
        <View style={s.center}>
          <Text style={[s.emptyText, { color: colors.textSub }]}>This season is complete.</Text>
        </View>
      )}
    </View>
  );
}

function SetupView({ league, startingDraft, onStartDraft, onCopyInvite }: {
  league: LeagueDetail; startingDraft: boolean;
  onStartDraft: () => void; onCopyInvite: () => void;
}) {
  const { colors } = useTheme();
  const pot = league.buyIn * league.maxTeams;
  const prize = Math.floor(pot * 0.95);
  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      {league.isCommissioner && (
        <TouchableOpacity
          style={[s.primaryBtn, { backgroundColor: colors.accent }, league.memberCount < 2 && s.disabledBtn]}
          onPress={league.memberCount >= 2 ? onStartDraft : undefined}
        >
          <Text style={s.primaryBtnText}>{startingDraft ? "Starting…" : "Start Draft"}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onCopyInvite} activeOpacity={0.75}>
        <Text style={[s.cardTitle, { color: colors.textSub }]}>Invite Code</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={[s.inviteCode, { color: colors.accent }]}>{league.inviteCode}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="copy-outline" size={14} color={colors.textSub} />
            <Text style={[s.hint, { color: colors.textSub }]}>Copy</Text>
          </View>
        </View>
      </TouchableOpacity>
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[s.cardTitle, { color: colors.textSub }]}>League Settings</Text>
        <InfoRow label="Buy-In" value={league.buyIn > 0 ? `$${league.buyIn}` : "Free"} accent={league.buyIn > 0} />
        <InfoRow label="Teams" value={`${league.memberCount} / ${league.maxTeams}`} />
        <InfoRow label="Scoring" value={league.scoringType === "FULL_PPR" ? "Full PPR" : "Half PPR"} />
        <InfoRow label="Draft" value={league.draftType === "SNAKE" ? "Snake Draft" : "Auction ($200)"} />
        <InfoRow label="Visibility" value={league.visibility === "PUBLIC" ? "Public" : "Private"} />
      </View>
      {league.buyIn > 0 && (
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.cardTitle, { color: colors.textSub }]}>Prize Pool</Text>
          <InfoRow label="Total Pot" value={`$${pot.toLocaleString()}`} />
          <InfoRow label="After 5% fee" value={`$${prize.toLocaleString()}`} accent />
          {(league.payoutSplit?.length ?? 0) > 0 && (
            <View style={{ marginTop: 10 }}>
              <Text style={[s.subLabel, { color: colors.textSub }]}>{PAYOUT_LABEL[league.payoutPreset]}</Text>
              {league.payoutSplit.map((sp) => (
                <View key={sp.place} style={s.payoutRow}>
                  <Text style={[s.payoutPlace, { color: colors.text }]}>
                    {sp.place === 1 ? "1st" : sp.place === 2 ? "2nd" : "3rd"} Place
                  </Text>
                  <Text style={[s.payoutAmt, { color: colors.accent }]}>
                    ${Math.floor(prize * sp.percent / 100).toLocaleString()}
                  </Text>
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
  const { colors } = useTheme();
  return (
    <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[s.cardTitle, { color: colors.textSub }]}>Teams ({league.memberCount}/{league.maxTeams})</Text>
      {(league.teams ?? []).map((t) => (
        <View key={t.id} style={[s.teamRow, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={[s.teamName, { color: colors.text }]}>{t.name}</Text>
            <Text style={[s.teamUsername, { color: colors.textSub }]}>@{t.username}</Text>
          </View>
          {t.isCommissioner && <Text style={s.commLabel}>Comm.</Text>}
        </View>
      ))}
      {Array.from({ length: Math.max(0, league.maxTeams - (league.memberCount ?? 0)) }).map((_, i) => (
        <View key={`open-${i}`} style={[s.teamRow, { borderBottomColor: colors.border, opacity: 0.3 }]}>
          <Text style={{ color: colors.textSub, fontSize: 14 }}>Open slot</Text>
        </View>
      ))}
    </View>
  );
}

function MyTeamTab({ leagueId }: { leagueId: string }) {
  const { colors } = useTheme();
  const [team, setTeam] = useState<{ id: string; name: string; abbreviation?: string } | null>(null);
  const [record, setRecord] = useState<{ wins: number; losses: number } | null>(null);
  const [roster, setRoster] = useState<RosterSlot[]>([]);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [swap, setSwap] = useState<RosterSlot | null>(null);
  const [matchupPreview, setMatchupPreview] = useState<{ myScore: number; oppScore: number; oppName: string; projected?: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamAbbr, setTeamAbbr] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    async function load() {
      const [teamRes, standingsRes] = await Promise.all([
        api.get<{ team: any; roster: RosterSlot[]; currentWeek: number; isLocked: boolean }>(`/season/${leagueId}/my-team`),
        api.get<{ standings: StandingRow[] }>(`/season/${leagueId}/standings`),
      ]);
      if (teamRes.ok) {
        setTeam(teamRes.data.team);
        setRoster(teamRes.data.roster);
        setCurrentWeek(teamRes.data.currentWeek);
        setSelectedWeek(teamRes.data.currentWeek);
        setIsLocked(teamRes.data.isLocked);
        setTeamName(teamRes.data.team?.name ?? "");
        setTeamAbbr(teamRes.data.team?.abbreviation ?? "");
        if (standingsRes.ok) {
          const row = standingsRes.data.standings.find((r) => r.teamId === teamRes.data.team?.id);
          if (row) setRecord({ wins: row.wins, losses: row.losses });
        }
      }
      setLoading(false);
    }
    load();
  }, [leagueId]);

  useEffect(() => {
    if (!team) return;
    api.get<{ matchups: MatchupSummary[] }>(`/season/${leagueId}/matchups/${selectedWeek}`).then((res) => {
      if (!res.ok) { setMatchupPreview(null); return; }
      const mine = res.data.matchups.find((m) => m.homeTeam.id === team.id || m.awayTeam.id === team.id);
      if (!mine) { setMatchupPreview(null); return; }
      const isHome = mine.homeTeam.id === team.id;
      setMatchupPreview({
        myScore: isHome ? mine.homeScore : mine.awayScore,
        oppScore: isHome ? mine.awayScore : mine.homeScore,
        oppName: isHome ? mine.awayTeam.name : mine.homeTeam.name,
      });
    });
  }, [leagueId, team, selectedWeek]);

  useEffect(() => {
    if (!team || selectedWeek === currentWeek) return;
    api.get<{ roster: RosterSlot[]; isLocked: boolean }>(`/season/${leagueId}/my-team?week=${selectedWeek}`).then((res) => {
      if (res.ok) {
        setRoster(res.data.roster);
        setIsLocked(res.data.isLocked ?? selectedWeek < currentWeek);
      }
    });
  }, [selectedWeek]);

  function handlePress(slot: RosterSlot) {
    if (!editMode || isLocked) return;
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
    if (res.ok) { setSaved(true); setEditMode(false); setSwap(null); setTimeout(() => setSaved(false), 2000); }
    else Alert.alert("Error", (res as any).error ?? "Failed to save lineup");
  }

  async function saveTeamSettings() {
    setSavingSettings(true);
    const res = await api.post(`/season/${leagueId}/team/settings`, { name: teamName, abbreviation: teamAbbr });
    setSavingSettings(false);
    if (res.ok) {
      setTeam((prev) => prev ? { ...prev, name: teamName, abbreviation: teamAbbr } : prev);
      setSettingsOpen(false);
    } else Alert.alert("Error", (res as any).error ?? "Failed to save settings");
  }

  if (loading) return <LoadingView />;

  const starters = roster.filter((r) => r.slot !== "BENCH").sort((a, b) => STARTER_ORDER.indexOf(a.slot) - STARTER_ORDER.indexOf(b.slot));
  const bench = roster.filter((r) => r.slot === "BENCH");
  const pts = starters.reduce((n, r) => n + (r.points ?? 0), 0);
  const MAX_WEEK = 18;

  return (
    <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 48 }}>
      {/* ── Team Hero ── */}
      <LinearGradient
        colors={["#C81A1A18", "#7520CC18", "#1834D418"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[s.teamHero, { borderBottomColor: colors.border }]}
      >
        {/* Row 1: name + record + settings */}
        <View style={s.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={[s.myTeamName, { color: colors.text }]} numberOfLines={1}>{team?.name}</Text>
            {record && (
              <Text style={[s.recordText, { color: colors.textSub }]}>{record.wins}–{record.losses} · Season</Text>
            )}
          </View>
          <TouchableOpacity style={[s.settingsBtn, { borderColor: colors.border }]} onPress={() => setSettingsOpen(true)}>
            <Ionicons name="settings-outline" size={16} color={colors.textSub} />
            <Text style={[s.settingsBtnText, { color: colors.textSub }]}>Team</Text>
          </TouchableOpacity>
        </View>

        {/* Row 2: week selector */}
        <View style={s.weekRow}>
          <TouchableOpacity
            onPress={() => setSelectedWeek((w) => Math.max(1, w - 1))}
            disabled={selectedWeek <= 1}
            style={[s.weekArrow, selectedWeek <= 1 && { opacity: 0.3 }]}
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.weekLabel, { color: colors.text }]}>
            Week {selectedWeek}{selectedWeek === currentWeek ? " · Current" : selectedWeek < currentWeek ? " · Past" : " · Upcoming"}
          </Text>
          <TouchableOpacity
            onPress={() => setSelectedWeek((w) => Math.min(MAX_WEEK, w + 1))}
            disabled={selectedWeek >= MAX_WEEK}
            style={[s.weekArrow, selectedWeek >= MAX_WEEK && { opacity: 0.3 }]}
          >
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Row 3: matchup mini-card */}
        {matchupPreview && (
          <View style={[s.matchupMini, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={s.matchupMiniHalf}>
              <Text style={[s.matchupMiniTeam, { color: colors.text }]} numberOfLines={1}>{team?.name}</Text>
              <Text style={[s.matchupMiniScore, { color: pts > matchupPreview.oppScore ? "#22c55e" : colors.text }]}>
                {pts.toFixed(1)}
              </Text>
            </View>
            <View style={s.matchupMiniDivider}>
              <Text style={[s.matchupMiniVs, { color: colors.textSub }]}>VS</Text>
            </View>
            <View style={[s.matchupMiniHalf, { alignItems: "flex-end" }]}>
              <Text style={[s.matchupMiniTeam, { color: colors.text }]} numberOfLines={1}>{matchupPreview.oppName}</Text>
              <Text style={[s.matchupMiniScore, { color: matchupPreview.oppScore > pts ? "#22c55e" : colors.text }]}>
                {matchupPreview.oppScore.toFixed(1)}
              </Text>
            </View>
          </View>
        )}

        {/* Row 4: Edit Lineup button */}
        {!isLocked && selectedWeek === currentWeek && (
          <View style={s.editRow}>
            {!editMode ? (
              <TouchableOpacity style={[s.editBtn, { backgroundColor: colors.accent }]} onPress={() => setEditMode(true)}>
                <Ionicons name="create-outline" size={15} color="#fff" />
                <Text style={s.editBtnText}>Edit Lineup</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flexDirection: "row", gap: 8, flex: 1 }}>
                <TouchableOpacity style={[s.editBtn, { backgroundColor: "#22c55e", flex: 1 }]} onPress={saveLineup} disabled={saving}>
                  <Ionicons name="checkmark" size={15} color="#fff" />
                  <Text style={s.editBtnText}>{saving ? "Saving…" : saved ? "Saved!" : "Save Lineup"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.editBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border }]}
                  onPress={() => { setEditMode(false); setSwap(null); }}
                >
                  <Text style={[s.editBtnText, { color: colors.textSub }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        {isLocked && (
          <View style={[s.lockedBanner, { backgroundColor: `${"#f59e0b"}18`, borderColor: "#f59e0b44" }]}>
            <Ionicons name="lock-closed" size={12} color="#f59e0b" />
            <Text style={[s.lockedBannerText, { color: "#f59e0b" }]}>Lineup locked for this week</Text>
          </View>
        )}
      </LinearGradient>

      {/* ── Lineup ── */}
      <View style={{ padding: 16 }}>
        {editMode && swap && (
          <View style={[s.swapBanner, { backgroundColor: `${colors.accent}18`, borderColor: colors.accent }]}>
            <Text style={[s.swapHint, { color: colors.accent }]}>Now tap a player to swap with {swap.name ?? swap.slot}</Text>
          </View>
        )}
        {editMode && !swap && (
          <Text style={[s.swapHint, { color: colors.textSub, marginBottom: 10, textAlign: "center" }]}>Tap a player to move them</Text>
        )}

        <Text style={[s.sectionTitle, { color: colors.textSub }]}>Starters · {pts.toFixed(1)} pts</Text>
        <View style={[s.rosterSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {starters.map((r, i) => (
            <PlayerCard key={r.id} slot={r} selected={swap?.id === r.id} isLast={i === starters.length - 1} onPress={editMode ? () => handlePress(r) : undefined} />
          ))}
        </View>
        <Text style={[s.sectionTitle, { color: colors.textSub, marginTop: 20 }]}>Bench</Text>
        <View style={[s.rosterSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {bench.map((r, i) => (
            <PlayerCard key={r.id} slot={r} muted selected={swap?.id === r.id} isLast={i === bench.length - 1} onPress={editMode ? () => handlePress(r) : undefined} />
          ))}
        </View>
      </View>

      {/* ── Team Settings Modal ── */}
      <Modal visible={settingsOpen} transparent animationType="slide">
        <View style={[s.modalOverlay, { backgroundColor: "rgba(0,0,0,0.75)" }]}>
          <View style={[s.modalBox, { backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Text style={[s.modalTitle, { color: colors.text }]}>Team Settings</Text>
              <TouchableOpacity onPress={() => setSettingsOpen(false)}>
                <Ionicons name="close" size={22} color={colors.textSub} />
              </TouchableOpacity>
            </View>
            <Text style={[s.settingsFieldLabel, { color: colors.textSub }]}>Team Name</Text>
            <TextInput
              style={[s.settingsInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
              value={teamName}
              onChangeText={setTeamName}
              placeholder="My Awesome Team"
              placeholderTextColor={colors.textSub}
              maxLength={40}
            />
            <Text style={[s.settingsFieldLabel, { color: colors.textSub, marginTop: 14 }]}>Abbreviation</Text>
            <TextInput
              style={[s.settingsInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
              value={teamAbbr}
              onChangeText={(t) => setTeamAbbr(t.toUpperCase().slice(0, 4))}
              placeholder="MYT"
              placeholderTextColor={colors.textSub}
              autoCapitalize="characters"
              maxLength={4}
            />
            <Text style={[{ fontSize: 11, color: colors.textSub, marginTop: 6, marginBottom: 20 }]}>Up to 4 characters</Text>
            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: colors.accent }]}
              onPress={saveTeamSettings}
              disabled={savingSettings}
            >
              <Text style={s.primaryBtnText}>{savingSettings ? "Saving…" : "Save Changes"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function MatchupTab({ leagueId }: { leagueId: string }) {
  const { colors } = useTheme();
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
  if (empty || !matchup) return (
    <View style={s.center}><Text style={[s.emptyText, { color: colors.textSub }]}>No matchup found for this week.</Text></View>
  );

  const homeWin = matchup.homeScore >= matchup.awayScore;
  const sortSlots = (slots: RosterSlot[]) =>
    slots.filter((sl) => sl.slot !== "BENCH").sort((a, b) => STARTER_ORDER.indexOf(a.slot) - STARTER_ORDER.indexOf(b.slot));
  const benchSlots = (slots: RosterSlot[]) => slots.filter((sl) => sl.slot === "BENCH");

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <LinearGradient
        colors={["#C81A1A22", "#7520CC22", "#1834D422"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[s.scoreCard, { borderColor: colors.border }]}
      >
        <View style={s.scoreHalf}>
          <Text style={[s.scoreTeamName, { color: colors.text }]} numberOfLines={1}>{matchup.homeTeam.name}</Text>
          <Text style={[s.scoreUser, { color: colors.textSub }]}>@{matchup.homeTeam.user.username}</Text>
          <Text style={[s.bigScore, homeWin ? s.winScore : { color: colors.textSub }]}>{matchup.homeScore.toFixed(2)}</Text>
        </View>
        <View style={s.vsBox}>
          <Text style={[s.vs, { color: colors.textSub }]}>VS</Text>
          <Text style={[s.weekBadge, { color: colors.textSub }]}>Wk {matchup.week}</Text>
        </View>
        <View style={[s.scoreHalf, { alignItems: "flex-end" }]}>
          <Text style={[s.scoreTeamName, { color: colors.text }]} numberOfLines={1}>{matchup.awayTeam.name}</Text>
          <Text style={[s.scoreUser, { color: colors.textSub }]}>@{matchup.awayTeam.user.username}</Text>
          <Text style={[s.bigScore, !homeWin ? s.winScore : { color: colors.textSub }]}>{matchup.awayScore.toFixed(2)}</Text>
        </View>
      </LinearGradient>

      <Text style={[s.rosterLabel, { color: colors.textSub }]}>{matchup.homeTeam.name}</Text>
      <View style={[s.rosterSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {sortSlots(matchup.homeTeam.rosterSlots).map((sl, i, arr) => <PlayerCard key={sl.id} slot={sl} showStats isLast={i === arr.length - 1} />)}
      </View>
      <Text style={[s.rosterLabel, { color: colors.textSub, opacity: 0.5, marginTop: 4 }]}>Bench</Text>
      <View style={[s.rosterSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {benchSlots(matchup.homeTeam.rosterSlots).map((sl, i, arr) => <PlayerCard key={sl.id} slot={sl} muted showStats isLast={i === arr.length - 1} />)}
      </View>
      <View style={[s.divider, { backgroundColor: colors.border }]} />
      <Text style={[s.rosterLabel, { color: colors.textSub }]}>{matchup.awayTeam.name}</Text>
      <View style={[s.rosterSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {sortSlots(matchup.awayTeam.rosterSlots).map((sl, i, arr) => <PlayerCard key={sl.id} slot={sl} showStats isLast={i === arr.length - 1} />)}
      </View>
      <Text style={[s.rosterLabel, { color: colors.textSub, opacity: 0.5, marginTop: 4 }]}>Bench</Text>
      <View style={[s.rosterSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {benchSlots(matchup.awayTeam.rosterSlots).map((sl, i, arr) => <PlayerCard key={sl.id} slot={sl} muted showStats isLast={i === arr.length - 1} />)}
      </View>
    </ScrollView>
  );
}

function WaiversTab({ leagueId }: { leagueId: string }) {
  const { colors } = useTheme();
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

  if (loading) return <LoadingView />;

  return (
    <View style={{ flex: 1 }}>
      <View style={[s.subTabRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {(["browse", "claims"] as const).map((st) => (
          <TouchableOpacity
            key={st}
            style={[s.subTab, subTab === st && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}
            onPress={() => setSubTab(st)}
          >
            <Text style={[s.subTabText, { color: subTab === st ? colors.text : colors.textSub }]}>
              {st === "browse" ? "Browse" : `My Claims (${claims.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {subTab === "browse" ? (
        <View style={{ flex: 1 }}>
          <View style={{ padding: 12, paddingBottom: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TextInput
              style={[s.searchInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
              placeholder="Search players…"
              placeholderTextColor={colors.textSub}
              value={search}
              onChangeText={setSearch}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {POSITIONS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[s.posBtn, { borderColor: pos === p ? colors.accent : colors.border, backgroundColor: pos === p ? `${colors.accent}18` : "transparent" }]}
                  onPress={() => setPos(p)}
                >
                  <Text style={[s.posBtnText, { color: pos === p ? colors.accent : colors.textSub }]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <ScrollView contentContainerStyle={s.content}>
            <View style={[s.rosterSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {players.map((pl, i) => (
                <View key={pl.player_id} style={[
                  s.playerRow,
                  i < players.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                ]}>
                  <View style={[s.headshotFallback, { backgroundColor: `${POS_COLORS[pl.position] ?? "#6b7280"}22` }]}>
                    <Text style={[s.headshotText, { color: POS_COLORS[pl.position] ?? "#6b7280" }]}>{pl.position?.slice(0, 2)}</Text>
                  </View>
                  <View style={[s.slotBadge, { backgroundColor: POS_COLORS[pl.position] ?? "#6b7280" }]}>
                    <Text style={s.slotText}>{pl.position}</Text>
                  </View>
                  <View style={s.playerInfo}>
                    <Text style={[s.playerName, { color: colors.text }]}>{pl.full_name}</Text>
                    <Text style={[s.playerMeta, { color: colors.textSub }]}>
                      {pl.team ?? "FA"}{pl.injury_status ? ` · ${pl.injury_status}` : ""}
                    </Text>
                  </View>
                  <TouchableOpacity style={[s.claimBtn, { backgroundColor: colors.accent }]} onPress={() => setClaimTarget(pl)}>
                    <Text style={s.claimBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {claims.length === 0 ? (
            <View style={[s.center, { paddingTop: 40 }]}>
              <Text style={[s.emptyText, { color: colors.textSub }]}>No waiver claims yet.</Text>
            </View>
          ) : claims.map((cl) => (
            <View key={cl.id} style={[s.claimRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.claimLine, { color: colors.text }]}>+ {cl.addPlayer?.name ?? cl.addPlayerId}</Text>
                {cl.dropPlayerId && (
                  <Text style={[s.claimLine, { color: "#ef4444", fontWeight: "400" }]}>− {cl.dropPlayer?.name ?? cl.dropPlayerId}</Text>
                )}
                <Text style={{ fontSize: 11, color: colors.textSub, marginTop: 2 }}>{cl.status}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={!!claimTarget} transparent animationType="slide">
        <View style={[s.modalOverlay, { backgroundColor: "rgba(0,0,0,0.75)" }]}>
          <View style={[s.modalBox, { backgroundColor: colors.surface }]}>
            <Text style={[s.modalTitle, { color: colors.text }]}>Add {claimTarget?.full_name}</Text>
            <Text style={[s.modalSub, { color: colors.textSub }]}>Choose a player to drop (optional)</Text>
            <TouchableOpacity style={[s.dropOption, { borderColor: !dropId ? colors.accent : colors.border }]} onPress={() => setDropId("")}>
              <Text style={[s.dropOptionText, { color: !dropId ? colors.accent : colors.text }]}>No drop</Text>
            </TouchableOpacity>
            {myRoster.map((r) => (
              <TouchableOpacity key={r.id} style={[s.dropOption, { borderColor: dropId === r.playerId ? colors.accent : colors.border }]}
                onPress={() => setDropId(r.playerId)}>
                <Text style={[s.dropOptionText, { color: dropId === r.playerId ? colors.accent : colors.text }]}>
                  {r.name ?? r.playerId} ({r.slot})
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: colors.accent, marginTop: 8 }]} onPress={submitClaim} disabled={claiming}>
              <Text style={s.primaryBtnText}>{claiming ? "Submitting…" : "Submit Claim"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border }]}
              onPress={() => { setClaimTarget(null); setDropId(""); }}>
              <Text style={[s.primaryBtnText, { color: colors.textSub }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TradesTab({ leagueId }: { leagueId: string }) {
  const { colors } = useTheme();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ trades: Trade[] }>(`/trades/${leagueId}`).then((res) => {
      if (res.ok) setTrades(res.data.trades);
      setLoading(false);
    });
  }, [leagueId]);

  async function respond(tradeId: string, action: "accept" | "reject") {
    const res = await api.post(`/trades/${tradeId}/${action}`, {});
    if (res.ok) setTrades((prev) => prev.filter((t) => t.id !== tradeId));
    else Alert.alert("Error", (res as any).error ?? "Failed");
  }

  if (loading) return <LoadingView />;

  return (
    <ScrollView contentContainerStyle={s.content}>
      {trades.length === 0 ? (
        <View style={[s.center, { paddingTop: 40 }]}>
          <Text style={[s.emptyText, { color: colors.textSub }]}>No pending trades.</Text>
        </View>
      ) : trades.map((tr) => (
        <View key={tr.id} style={[s.tradeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.tradeHeader, { color: colors.text }]}>{tr.proposingTeam.name} → {tr.receivingTeam.name}</Text>
          {tr.note && <Text style={[s.tradeNote, { color: colors.textSub }]}>"{tr.note}"</Text>}
          <View style={s.tradeActions}>
            <TouchableOpacity style={s.acceptBtn} onPress={() => respond(tr.id, "accept")}>
              <Text style={s.acceptBtnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.rejectBtn, { borderColor: colors.border }]} onPress={() => respond(tr.id, "reject")}>
              <Text style={[s.rejectBtnText, { color: colors.textSub }]}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function StandingsTab({ leagueId }: { leagueId: string }) {
  const { colors } = useTheme();
  const [rows, setRows] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ standings: StandingRow[] }>(`/season/${leagueId}/standings`).then((res) => {
      if (res.ok) setRows(res.data.standings);
      setLoading(false);
    });
  }, [leagueId]);

  if (loading) return <LoadingView />;

  const RANK_COLORS = ["#f59e0b", "#94a3b8", "#cd7c54"];

  return (
    <ScrollView contentContainerStyle={s.content}>
      {rows.map((row, i) => (
        <View key={row.teamId} style={[s.standingRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.standingRank, { color: RANK_COLORS[i] ?? colors.textSub }]}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.standingName, { color: colors.text }]}>{row.teamName}</Text>
            <Text style={[s.standingPts, { color: colors.textSub }]}>{row.pointsFor.toFixed(1)} pts for</Text>
          </View>
          <Text style={[s.standingRecord, { color: colors.text }]}>{row.wins}-{row.losses}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function SettingsTab({ league, onCopyInvite }: { league: LeagueDetail; onCopyInvite: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  const pot = league.buyIn * league.maxTeams;
  const prize = Math.floor(pot * 0.95);

  return (
    <ScrollView contentContainerStyle={s.content}>
      <TouchableOpacity style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onCopyInvite} activeOpacity={0.75}>
        <Text style={[s.cardTitle, { color: colors.textSub }]}>Invite Code</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={[s.inviteCode, { color: colors.accent }]}>{league.inviteCode}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="copy-outline" size={14} color={colors.textSub} />
            <Text style={[s.hint, { color: colors.textSub }]}>Copy</Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[s.cardTitle, { color: colors.textSub }]}>League Info</Text>
        <InfoRow label="Scoring" value={league.scoringType === "FULL_PPR" ? "Full PPR" : "Half PPR"} />
        <InfoRow label="Draft" value={league.draftType === "SNAKE" ? "Snake Draft" : "Auction ($200)"} />
        <InfoRow label="Visibility" value={league.visibility === "PUBLIC" ? "Public" : "Private"} />
        <InfoRow label="Teams" value={`${league.memberCount} / ${league.maxTeams}`} />
        {league.buyIn > 0 && <InfoRow label="Buy-In" value={`$${league.buyIn}`} accent />}
        {league.buyIn > 0 && <InfoRow label="Prize Pool" value={`$${prize.toLocaleString()}`} accent />}
      </View>

      {league.isCommissioner && (
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.cardTitle, { color: colors.textSub }]}>Commissioner Tools</Text>
          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: "#7520CC" }]}
            onPress={() => router.push(`/(app)/league/${league.id}/draft` as any)}
          >
            <Text style={s.primaryBtnText}>Go to Draft Room</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function PlayerCard({ slot, selected, muted, onPress, showStats, isLast }: {
  slot: RosterSlot; selected?: boolean; muted?: boolean; showStats?: boolean; onPress?: () => void; isLast?: boolean;
}) {
  const { colors } = useTheme();
  const [imgErr, setImgErr] = useState(false);
  const color = POS_COLORS[slot.slot] ?? "#6b7280";

  const inner = (
    <View style={[
      s.playerRow,
      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      selected && { backgroundColor: `${colors.accent}10` },
      muted && s.playerRowMuted,
    ]}>
      {slot.headshotUrl && !imgErr ? (
        <Image source={{ uri: slot.headshotUrl }} style={s.headshot} onError={() => setImgErr(true)} />
      ) : (
        <View style={[s.headshotFallback, { backgroundColor: `${color}22` }]}>
          <Text style={[s.headshotText, { color }]}>{(slot.position ?? slot.slot).slice(0, 2)}</Text>
        </View>
      )}
      <View style={[s.slotBadge, { backgroundColor: color }]}>
        <Text style={s.slotText}>{slot.slot}</Text>
      </View>
      <View style={s.playerInfo}>
        <Text style={[s.playerName, { color: colors.text }]} numberOfLines={1}>{slot.name ?? slot.playerId}</Text>
        {showStats && slot.statLine ? (
          <Text style={[s.playerMeta, { color: colors.textSub }]} numberOfLines={1}>{slot.statLine}</Text>
        ) : slot.position ? (
          <Text style={[s.playerMeta, { color: colors.textSub }]}>{slot.position}{slot.team ? ` · ${slot.team}` : ""}</Text>
        ) : null}
      </View>
      <Text style={[s.pts, (slot.points ?? 0) > 0 ? { color: colors.text } : { color: colors.textSub }]}>
        {slot.points !== null && slot.points !== undefined ? slot.points.toFixed(1) : "—"}
      </Text>
    </View>
  );

  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.6}>{inner}</TouchableOpacity>;
  return inner;
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[s.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[s.infoLabel, { color: colors.textSub }]}>{label}</Text>
      <Text style={[s.infoValue, { color: accent ? colors.accent : colors.text }, accent && { fontWeight: "700" }]}>{value}</Text>
    </View>
  );
}

function LoadingView() {
  const { colors } = useTheme();
  return <View style={s.center}><ActivityIndicator color={colors.accent} /></View>;
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorText: { color: "#ef4444", fontSize: 15, marginBottom: 12 },
  emptyText: { fontSize: 14, textAlign: "center" },

  header: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 16, paddingBottom: 14 },
  headerLogo: { width: 72, justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  headerLeagueName: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: -0.3 },
  headerMeta: { color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: "600", marginTop: 2 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: "700" },

  tabBarWrap: { height: 46, borderBottomWidth: 1, flexShrink: 0 },
  tabBarInner: { paddingHorizontal: 4, alignItems: "center" },
  tabItem: { paddingHorizontal: 14, height: 46, justifyContent: "center" },
  tabLabel: { fontSize: 13, fontWeight: "600" },
  tabLabelActive: { fontWeight: "700" },

  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  subLabel: { fontSize: 12, marginBottom: 6 },

  primaryBtn: { borderRadius: 12, padding: 14, marginBottom: 10, alignItems: "center" },
  primaryBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  disabledBtn: { opacity: 0.4 },

  inviteCode: { fontSize: 24, fontWeight: "800", letterSpacing: 3 },
  hint: { fontSize: 12 },

  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1 },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: "500" },

  payoutRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  payoutPlace: { fontSize: 13 },
  payoutAmt: { fontSize: 13, fontWeight: "700" },

  teamRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1 },
  teamName: { fontSize: 14, fontWeight: "600" },
  teamUsername: { fontSize: 12, marginTop: 1 },
  commLabel: { fontSize: 11, color: "#f59e0b", backgroundColor: "rgba(245,158,11,0.12)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },

  teamHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  myTeamName: { fontSize: 20, fontWeight: "900", letterSpacing: -0.3 },
  recordText: { fontSize: 12, marginTop: 2, fontWeight: "600" },
  weekLabel: { fontSize: 14, fontWeight: "700" },
  lockedLabel: { fontSize: 12 },
  saveBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  saveBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  swapBanner: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  swapHint: { fontSize: 12, textAlign: "center" },

  teamHero: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1 },
  heroTopRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
  settingsBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 10 },
  settingsBtnText: { fontSize: 12, fontWeight: "600" },
  weekRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 14, gap: 12 },
  weekArrow: { padding: 4 },
  matchupMini: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  matchupMiniHalf: { flex: 1 },
  matchupMiniTeam: { fontSize: 12, fontWeight: "600", marginBottom: 2 },
  matchupMiniScore: { fontSize: 26, fontWeight: "900" },
  matchupMiniDivider: { paddingHorizontal: 10, alignItems: "center" },
  matchupMiniVs: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  editRow: { flexDirection: "row", gap: 8 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  editBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  lockedBanner: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  lockedBannerText: { fontSize: 12, fontWeight: "600" },
  settingsFieldLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  settingsInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 4 },

  scoreCard: { borderWidth: 1, borderRadius: 14, padding: 20, flexDirection: "row", alignItems: "center", marginBottom: 20 },
  scoreHalf: { flex: 1 },
  scoreTeamName: { fontSize: 14, fontWeight: "700" },
  scoreUser: { fontSize: 11, marginBottom: 6 },
  bigScore: { fontSize: 34, fontWeight: "900" },
  winScore: { color: "#22c55e" },
  vsBox: { alignItems: "center", paddingHorizontal: 8 },
  vs: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  weekBadge: { fontSize: 10, marginTop: 4 },
  rosterLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 8 },
  divider: { height: 1, marginVertical: 20 },

  rosterSection: { borderWidth: 1, borderRadius: 12, overflow: "hidden", marginBottom: 6 },
  playerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
  playerRowMuted: { opacity: 0.4 },
  headshot: { width: 38, height: 38, borderRadius: 19 },
  headshotFallback: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  headshotText: { fontSize: 11, fontWeight: "800" },
  slotBadge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3, minWidth: 42, alignItems: "center" },
  slotText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 13, fontWeight: "600" },
  playerMeta: { fontSize: 11, marginTop: 1 },
  pts: { fontSize: 14, fontWeight: "700" },

  subTabRow: { flexDirection: "row", borderBottomWidth: 1 },
  subTab: { flex: 1, paddingVertical: 11, alignItems: "center" },
  subTabText: { fontSize: 13, fontWeight: "600" },
  searchInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 8 },
  posBtn: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderRadius: 6, marginRight: 6 },
  posBtnText: { fontSize: 12, fontWeight: "600" },
  claimBtn: { borderRadius: 7, paddingHorizontal: 14, paddingVertical: 7 },
  claimBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  claimRow: { flexDirection: "row", alignItems: "center", padding: 14, borderWidth: 1, borderRadius: 10, marginBottom: 8 },
  claimLine: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBox: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: "80%" },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 4 },
  modalSub: { fontSize: 13, marginBottom: 16 },
  dropOption: { padding: 12, borderWidth: 1, borderRadius: 8, marginBottom: 8 },
  dropOptionText: { fontSize: 14 },

  tradeCard: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 10 },
  tradeHeader: { fontSize: 14, fontWeight: "700", marginBottom: 8 },
  tradeNote: { fontSize: 12, fontStyle: "italic", marginBottom: 10 },
  tradeActions: { flexDirection: "row", gap: 10 },
  acceptBtn: { flex: 1, backgroundColor: "#22c55e", borderRadius: 8, padding: 10, alignItems: "center" },
  acceptBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  rejectBtn: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 10, alignItems: "center" },
  rejectBtnText: { fontSize: 13 },

  standingRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1, borderRadius: 10, marginBottom: 8 },
  standingRank: { fontSize: 18, fontWeight: "900", width: 28, textAlign: "center" },
  standingName: { fontSize: 14, fontWeight: "700" },
  standingPts: { fontSize: 11, marginTop: 2 },
  standingRecord: { fontSize: 16, fontWeight: "700" },
});
