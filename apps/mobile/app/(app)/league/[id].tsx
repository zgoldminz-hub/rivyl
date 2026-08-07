import { useEffect, useState, useCallback } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, Image, Clipboard,
  KeyboardAvoidingView, Platform,
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
  projected?: number | null; gameStarted?: boolean;
  name?: string; position?: string; team?: string | null;
  opponent?: string | null; headshotUrl?: string; statLine?: string;
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
const TEAM_LOGOS: { id: string; icon: string; gradient: [string, string] }[] = [
  { id: "flame",        icon: "flame",         gradient: ["#ef4444", "#f97316"] },
  { id: "bolt",         icon: "flash",         gradient: ["#fbbf24", "#f97316"] },
  { id: "trophy",       icon: "trophy",        gradient: ["#d97706", "#fbbf24"] },
  { id: "shield",       icon: "shield",        gradient: ["#1d4ed8", "#7c3aed"] },
  { id: "skull",        icon: "skull",         gradient: ["#1f2937", "#C81A1A"] },
  { id: "football",     icon: "football",      gradient: ["#78350f", "#b45309"] },
  { id: "rocket",       icon: "rocket",        gradient: ["#7c3aed", "#4f46e5"] },
  { id: "star",         icon: "star",          gradient: ["#C81A1A", "#d97706"] },
  { id: "paw",          icon: "paw",           gradient: ["#ea580c", "#fbbf24"] },
  { id: "barbell",      icon: "barbell",       gradient: ["#374151", "#6b7280"] },
  { id: "snow",         icon: "snow",          gradient: ["#0891b2", "#1d4ed8"] },
  { id: "planet",       icon: "planet",        gradient: ["#7c3aed", "#C81A1A"] },
  { id: "nuclear",      icon: "nuclear",       gradient: ["#16a34a", "#374151"] },
  { id: "airplane",     icon: "airplane",      gradient: ["#475569", "#4f46e5"] },
  { id: "hammer",       icon: "hammer",        gradient: ["#374151", "#C81A1A"] },
  { id: "eye",          icon: "eye",           gradient: ["#dc2626", "#7c3aed"] },
  { id: "leaf",         icon: "leaf",          gradient: ["#16a34a", "#0d9488"] },
  { id: "basketball",   icon: "basketball",    gradient: ["#ea580c", "#C81A1A"] },
  { id: "fish",         icon: "fish",          gradient: ["#0284c7", "#06b6d4"] },
  { id: "baseball",     icon: "baseball",      gradient: ["#C81A1A", "#374151"] },
  { id: "compass",      icon: "compass",       gradient: ["#1d4ed8", "#0891b2"] },
  { id: "speedometer",  icon: "speedometer",   gradient: ["#C81A1A", "#f97316"] },
  { id: "thunderstorm", icon: "thunderstorm",  gradient: ["#1d4ed8", "#7c3aed"] },
  { id: "bug",          icon: "bug",           gradient: ["#16a34a", "#1f2937"] },
  { id: "bonfire",      icon: "bonfire",       gradient: ["#C81A1A", "#ea580c"] },
  { id: "telescope",    icon: "telescope",     gradient: ["#7c3aed", "#0891b2"] },
  { id: "diamond",      icon: "diamond",       gradient: ["#06b6d4", "#4f46e5"] },
  { id: "headset",      icon: "headset",       gradient: ["#374151", "#4f46e5"] },
  { id: "car",          icon: "car-sport",     gradient: ["#dc2626", "#374151"] },
  { id: "magnet",       icon: "magnet",        gradient: ["#C81A1A", "#7c3aed"] },
];

async function loadSavedPhotoUri(teamId: string): Promise<string | null> {
  try {
    const AS = require("@react-native-async-storage/async-storage").default;
    return await AS.getItem(`rivyl_avatar_${teamId}`);
  } catch { return null; }
}
async function savePhotoUri(teamId: string, uri: string | null) {
  try {
    const AS = require("@react-native-async-storage/async-storage").default;
    if (uri) await AS.setItem(`rivyl_avatar_${teamId}`, uri);
    else await AS.removeItem(`rivyl_avatar_${teamId}`);
  } catch {}
}

function TeamAvatar({ logoId, photoUri, size = 54 }: { logoId?: string | null; photoUri?: string | null; size?: number }) {
  if (photoUri) {
    return <Image source={{ uri: photoUri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  const logo = TEAM_LOGOS.find(l => l.id === logoId) ?? TEAM_LOGOS[0];
  return (
    <LinearGradient
      colors={logo.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}
    >
      <Ionicons name={logo.icon as any} size={Math.round(size * 0.46)} color="#fff" />
    </LinearGradient>
  );
}

const STARTER_ORDER = ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF"];
function abbrevName(name?: string | null): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}
const MOCK_PROJ: Record<string, number> = {
  QB: 22.5, RB: 10.8, WR: 11.4, TE: 8.2, FLEX: 10.8, K: 8.0, DEF: 7.5, BENCH: 6.0,
};
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
  const [team, setTeam] = useState<{ id: string; name: string; abbreviation?: string; avatarId?: string; ownerName?: string; photoUri?: string | null } | null>(null);
  const [pendingLogoId, setPendingLogoId] = useState<string>(TEAM_LOGOS[0].id);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
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
  const [oppMap, setOppMap] = useState<Record<string, string>>({});
  const [selectedPlayer, setSelectedPlayer] = useState<RosterSlot | null>(null);
  const [weekDropdown, setWeekDropdown] = useState(false);

  useEffect(() => {
    async function load() {
      const [teamRes, standingsRes] = await Promise.all([
        api.get<{ team: any; roster: RosterSlot[]; currentWeek: number; isLocked: boolean }>(`/season/${leagueId}/my-team`),
        api.get<{ standings: StandingRow[] }>(`/season/${leagueId}/standings`),
      ]);
      if (teamRes.ok) {
        const t = teamRes.data.team;
        const savedPhoto = await loadSavedPhotoUri(t.id);
        setTeam({
          id: t.id, name: t.name, abbreviation: t.abbreviation,
          avatarId: t.avatarId ?? null,
          ownerName: t.user?.firstName && t.user?.lastName
            ? `${t.user.firstName} ${t.user.lastName}`
            : (t.user?.username ?? t.ownerName ?? null),
          photoUri: savedPhoto,
        });
        setRoster(teamRes.data.roster);
        setCurrentWeek(teamRes.data.currentWeek);
        setSelectedWeek(teamRes.data.currentWeek);
        setIsLocked(false);
        setTeamName(t.name ?? "");
        setTeamAbbr(t.abbreviation ?? "");
        setPendingLogoId(t.avatarId ?? TEAM_LOGOS[0].id);
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
        setIsLocked(selectedWeek < currentWeek);
      }
    });
  }, [selectedWeek]);

  useEffect(() => {
    async function fetchSchedule() {
      try {
        const res = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${selectedWeek}&dates=2025`
        );
        const data = await res.json();
        const map: Record<string, string> = {};
        for (const event of (data.events ?? [])) {
          const comp = event.competitions?.[0];
          if (!comp) continue;
          const home = comp.competitors?.find((c: any) => c.homeAway === "home");
          const away = comp.competitors?.find((c: any) => c.homeAway === "away");
          if (!home || !away) continue;
          map[home.team.abbreviation] = `vs ${away.team.abbreviation}`;
          map[away.team.abbreviation] = `@${home.team.abbreviation}`;
        }
        setOppMap(map);
      } catch {}
    }
    fetchSchedule();
  }, [selectedWeek]);

  function canFillSlot(position: string, slotName: string): boolean {
    if (slotName === "BENCH") return true;
    if (slotName === "FLEX") return ["RB", "WR", "TE"].includes(position);
    return position === slotName;
  }

  function isValidSwap(a: RosterSlot, b: RosterSlot): boolean {
    const posA = a.position ?? a.slot;
    const posB = b.position ?? b.slot;
    return canFillSlot(posA, b.slot) && canFillSlot(posB, a.slot);
  }

  function handlePress(slot: RosterSlot) {
    if (!editMode || slot.gameStarted) return;
    if (!swap) { setSwap(slot); return; }
    if (swap.id === slot.id) { setSwap(null); return; }
    if (!isValidSwap(swap, slot)) return;
    setRoster((prev) => prev.map((r) => {
      if (r.id === swap.id) return { ...r, slot: slot.slot };
      if (r.id === slot.id) return { ...r, slot: swap.slot };
      return r;
    }));
    setSwap(null);
  }

  async function saveLineup() {
    setSaving(true);
    await api.post(`/season/${leagueId}/lineup`, {
      slots: roster.map((r) => ({ playerId: r.playerId, slot: r.slot })),
    });
    setSaving(false);
    setSaved(true); setEditMode(false); setSwap(null);
    setTimeout(() => setSaved(false), 2000);
  }

  function openSettings() {
    setTeamName(team?.name ?? "");
    setTeamAbbr(team?.abbreviation ?? "");
    setPendingLogoId(team?.avatarId ?? TEAM_LOGOS[0].id);
    setPendingPhotoUri(team?.photoUri ?? null);
    setSettingsOpen(true);
  }

  async function pickFromCameraRoll() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission Required", "Please allow photo library access in Settings to use a custom team photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setPendingPhotoUri(result.assets[0].uri);
    }
  }

  async function saveTeamSettings() {
    setSavingSettings(true);
    const avatarIdToSave = pendingPhotoUri ? null : pendingLogoId;
    const res = await api.post(`/season/${leagueId}/team/settings`, {
      name: teamName, abbreviation: teamAbbr,
      avatarId: avatarIdToSave,
    });
    setSavingSettings(false);
    if (res.ok) {
      if (team?.id) await savePhotoUri(team.id, pendingPhotoUri);
      setTeam((prev) => prev ? {
        ...prev,
        name: teamName,
        abbreviation: teamAbbr,
        avatarId: avatarIdToSave ?? undefined,
        photoUri: pendingPhotoUri,
      } : prev);
      setSettingsOpen(false);
    } else Alert.alert("Error", (res as any).error ?? "Failed to save settings");
  }

  if (loading) return <LoadingView />;

  const enrichedRoster = roster.map((r) => ({
    ...r,
    opponent: r.team ? (oppMap[r.team] ?? r.opponent ?? null) : (r.opponent ?? null),
  }));
  const starters = enrichedRoster.filter((r) => r.slot !== "BENCH").sort((a, b) => STARTER_ORDER.indexOf(a.slot) - STARTER_ORDER.indexOf(b.slot));
  const bench = enrichedRoster.filter((r) => r.slot === "BENCH");
  const pts = starters.reduce((n, r) => n + (r.points ?? 0), 0);
  const totalProj = starters.reduce((n, r) => n + (r.projected ?? MOCK_PROJ[r.position ?? r.slot] ?? 0), 0);
  const hasScore = starters.some(r => (r.points ?? 0) > 0);
  const MAX_WEEK = 18;

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 48 }}>
      {/* ── Team Hero ── */}
      <LinearGradient
        colors={["#C81A1A18", "#7520CC18", "#1834D418"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[s.teamHero, { borderBottomColor: colors.border }]}
      >
        {/* Team avatar + name row */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <TouchableOpacity onPress={openSettings} activeOpacity={0.8}>
            <TeamAvatar logoId={team?.avatarId} photoUri={team?.photoUri} size={58} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[s.myTeamName, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>{team?.name}</Text>
              <TouchableOpacity onPress={openSettings} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="settings-outline" size={16} color={colors.textSub} />
              </TouchableOpacity>
            </View>
            {team?.ownerName ? (
              <Text style={[s.recordText, { color: colors.textSub, marginTop: 2 }]}>{team.ownerName}</Text>
            ) : null}
            {record && (
              <Text style={[{ fontSize: 11, color: colors.textSub, fontWeight: "600", marginTop: 2 }]}>{record.wins}–{record.losses}</Text>
            )}
          </View>
        </View>

        {/* Week selector */}
        <View style={s.weekRow}>
          <TouchableOpacity
            onPress={() => setSelectedWeek((w) => Math.max(1, w - 1))}
            disabled={selectedWeek <= 1}
            style={[s.weekArrow, selectedWeek <= 1 && { opacity: 0.3 }]}
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setWeekDropdown(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }} activeOpacity={0.7}>
            <Text style={[s.weekLabel, { color: colors.text }]}>
              Week {selectedWeek}{selectedWeek === currentWeek ? " · Current" : selectedWeek < currentWeek ? " · Past" : " · Upcoming"}
            </Text>
            <View style={{ alignItems: "center" }}>
              <Ionicons name="chevron-up" size={11} color={colors.textSub} style={{ marginBottom: -3 }} />
              <Ionicons name="chevron-down" size={11} color={colors.textSub} />
            </View>
          </TouchableOpacity>
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
          <View style={[s.matchupMini, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 10 }]}>
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

        {isLocked && (
          <View style={[s.lockedBanner, { backgroundColor: "#f59e0b18", borderColor: "#f59e0b44" }]}>
            <Ionicons name="lock-closed" size={12} color="#f59e0b" />
            <Text style={[s.lockedBannerText, { color: "#f59e0b" }]}>Viewing past week — lineup locked</Text>
          </View>
        )}
      </LinearGradient>

      {/* ── Lineup ── */}
      <View style={{ padding: 16 }}>
        {editMode && swap && (
          <View style={[s.swapBanner, { backgroundColor: `${colors.accent}18`, borderColor: colors.accent }]}>
            <Text style={[s.swapHint, { color: colors.accent }]}>Tap a player to swap with {swap.name ?? swap.slot}</Text>
          </View>
        )}
        {/* Set Lineup / Save-Cancel row */}
        {!isLocked && (
          !editMode ? (
            <View style={{ marginBottom: 10 }}>
              <TouchableOpacity
                style={[s.lineupEditBar, { backgroundColor: "#C81A1A", alignSelf: "flex-start", paddingHorizontal: 18, marginBottom: 0 }]}
                onPress={() => setEditMode(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="create-outline" size={14} color="#fff" />
                <Text style={s.lineupEditBarText}>Set Lineup</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
              <TouchableOpacity
                style={[s.lineupEditBar, { backgroundColor: "#22c55e", flex: 1, marginBottom: 0 }]}
                onPress={saveLineup}
                disabled={saving}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark" size={14} color="#fff" />
                <Text style={s.lineupEditBarText}>{saving ? "Saving…" : "Save Lineup"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.lineupEditBar, { flex: 0, paddingHorizontal: 16, backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border, marginBottom: 0 }]}
                onPress={() => { setEditMode(false); setSwap(null); }}
              >
                <Text style={[s.lineupEditBarText, { color: colors.textSub }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )
        )}

        {/* Category header — gap: 12 mirrors playerRow. Totals sit above PROJ/SCORE labels. */}
        <View style={[s.categoryRow, { borderBottomColor: colors.border, gap: 12 }]}>
          <Text style={[s.catLabel, { width: 32, textAlign: "center", color: colors.textSub }]}>POS</Text>
          <View style={{ width: 38 }} />
          <Text style={[s.catLabel, { flex: 1, color: colors.textSub }]}>PLAYER</Text>
          <Text style={[s.catLabel, { width: 50, textAlign: "center", color: colors.textSub }]}>OPP</Text>
          <View style={{ width: 48, alignItems: "center" }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13, lineHeight: 15 }}>{totalProj.toFixed(1)}</Text>
            <Text style={[s.catLabel, { color: colors.textSub }]}>PROJ</Text>
          </View>
          <View style={{ width: 52, alignItems: "center" }}>
            <Text style={{ color: hasScore ? colors.text : colors.textSub, fontWeight: "800", fontSize: 13, lineHeight: 15 }}>{hasScore ? pts.toFixed(1) : "—"}</Text>
            <Text style={[s.catLabel, { color: colors.textSub }]}>SCORE</Text>
          </View>
          {editMode && <View style={{ width: 26, marginLeft: 6 }} />}
        </View>

        {editMode && swap && (
          <Text style={[s.swapHint, { color: colors.textSub, marginBottom: 8, textAlign: "center" }]}>
            Moving {swap.name ?? swap.slot} — tap a highlighted slot
          </Text>
        )}

        {starters.map((r, i) => (
          <PlayerCard key={r.id} slot={r}
            selected={swap?.id === r.id}
            isLast={i === starters.length - 1}
            editMode={editMode}
            hasSelection={!!swap}
            isValidTarget={!!swap && swap.id !== r.id && !r.gameStarted && isValidSwap(swap, r)}
            onPress={editMode && !r.gameStarted ? () => handlePress(r) : undefined}
            onTap={!editMode ? () => setSelectedPlayer(r) : undefined} />
        ))}
        <Text style={[s.sectionTitle, { color: colors.textSub, marginTop: 20 }]}>Bench</Text>
        {bench.map((r, i) => (
          <PlayerCard key={r.id} slot={r}
            selected={swap?.id === r.id}
            isLast={i === bench.length - 1}
            editMode={editMode}
            hasSelection={!!swap}
            isValidTarget={!!swap && swap.id !== r.id && !r.gameStarted && isValidSwap(swap, r)}
            onPress={editMode && !r.gameStarted ? () => handlePress(r) : undefined}
            onTap={!editMode ? () => setSelectedPlayer(r) : undefined} />
        ))}
      </View>

      {selectedPlayer && (
        <PlayerDetailSheet slot={selectedPlayer} leagueId={leagueId} currentWeek={currentWeek} onClose={() => setSelectedPlayer(null)} />
      )}

      {/* ── Week Picker Modal ── */}
      <Modal visible={weekDropdown} transparent animationType="fade">
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", paddingHorizontal: 48 }} activeOpacity={1} onPress={() => setWeekDropdown(false)}>
          <TouchableOpacity activeOpacity={1}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, overflow: "hidden", maxHeight: 420 }}>
              <View style={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>Select Week</Text>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {Array.from({ length: MAX_WEEK }, (_, i) => i + 1).map((w) => {
                  const isSelected = w === selectedWeek;
                  const label = w === currentWeek ? "Current" : w < currentWeek ? "Past" : "Upcoming";
                  return (
                    <TouchableOpacity
                      key={w}
                      onPress={() => { setSelectedWeek(w); setWeekDropdown(false); }}
                      style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: `${colors.border}66`, backgroundColor: isSelected ? `${colors.accent}14` : "transparent" }}
                    >
                      <Text style={{ flex: 1, color: isSelected ? colors.accent : colors.text, fontWeight: isSelected ? "700" : "500", fontSize: 14 }}>
                        Week {w}
                      </Text>
                      <Text style={{ color: isSelected ? colors.accent : colors.textSub, fontSize: 12, fontWeight: "600" }}>{label}</Text>
                      {isSelected && <Ionicons name="checkmark" size={15} color={colors.accent} style={{ marginLeft: 10 }} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Team Settings Modal ── */}
      <Modal visible={settingsOpen} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={[s.modalOverlay, { backgroundColor: "rgba(0,0,0,0.75)" }]}>
          <View style={[s.modalBox, { backgroundColor: colors.surface }]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Text style={[s.modalTitle, { color: colors.text }]}>Team Settings</Text>
              <TouchableOpacity onPress={() => setSettingsOpen(false)}>
                <Ionicons name="close" size={22} color={colors.textSub} />
              </TouchableOpacity>
            </View>

            {/* Logo preview + picker */}
            <Text style={[s.settingsFieldLabel, { color: colors.textSub }]}>Team Logo</Text>
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <TeamAvatar logoId={pendingPhotoUri ? null : pendingLogoId} photoUri={pendingPhotoUri} size={68} />
            </View>

            {/* Camera roll button */}
            <TouchableOpacity
              onPress={pickFromCameraRoll}
              activeOpacity={0.8}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 4 }}
            >
              <Ionicons name="image-outline" size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>Upload from Photos</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.textSub, fontSize: 10, textAlign: "center", marginBottom: 10 }}>No offensive or inappropriate content</Text>

            {pendingPhotoUri && (
              <TouchableOpacity
                onPress={() => setPendingPhotoUri(null)}
                activeOpacity={0.75}
                style={{ alignItems: "center", marginBottom: 10 }}
              >
                <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "600" }}>Remove Photo</Text>
              </TouchableOpacity>
            )}

            <Text style={[s.settingsFieldLabel, { color: colors.textSub, marginBottom: 8 }]}>Or pick an icon</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
              <View style={{ flexDirection: "row", gap: 10, paddingVertical: 4 }}>
                {TEAM_LOGOS.map((logo) => (
                  <TouchableOpacity
                    key={logo.id}
                    onPress={() => { setPendingLogoId(logo.id); setPendingPhotoUri(null); }}
                    activeOpacity={0.75}
                    style={{ position: "relative" }}
                  >
                    <View style={{
                      borderRadius: 26, borderWidth: 2,
                      borderColor: !pendingPhotoUri && pendingLogoId === logo.id ? colors.accent : "transparent",
                      padding: 2,
                    }}>
                      <TeamAvatar logoId={logo.id} size={44} />
                    </View>
                    {!pendingPhotoUri && pendingLogoId === logo.id && (
                      <View style={{ position: "absolute", bottom: 0, right: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="checkmark" size={10} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

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
          </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
    </View>
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
      {sortSlots(matchup.homeTeam.rosterSlots).map((sl, i, arr) => <PlayerCard key={sl.id} slot={sl} showStats isLast={i === arr.length - 1} />)}
      <Text style={[s.rosterLabel, { color: colors.textSub, opacity: 0.5, marginTop: 4 }]}>Bench</Text>
      {benchSlots(matchup.homeTeam.rosterSlots).map((sl, i, arr) => <PlayerCard key={sl.id} slot={sl} muted showStats isLast={i === arr.length - 1} />)}
      <View style={[s.divider, { backgroundColor: colors.border }]} />
      <Text style={[s.rosterLabel, { color: colors.textSub }]}>{matchup.awayTeam.name}</Text>
      {sortSlots(matchup.awayTeam.rosterSlots).map((sl, i, arr) => <PlayerCard key={sl.id} slot={sl} showStats isLast={i === arr.length - 1} />)}
      <Text style={[s.rosterLabel, { color: colors.textSub, opacity: 0.5, marginTop: 4 }]}>Bench</Text>
      {benchSlots(matchup.awayTeam.rosterSlots).map((sl, i, arr) => <PlayerCard key={sl.id} slot={sl} muted showStats isLast={i === arr.length - 1} />)}
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
            {players.map((pl, i) => (
              <View key={pl.player_id} style={[
                s.playerRow,
                i < players.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
              ]}>
                <View style={[s.headshotFallback, { backgroundColor: colors.surface }]}>
                  <Text style={[s.headshotText, { color: colors.textSub }]}>{pl.position?.slice(0, 2)}</Text>
                </View>
                <View style={[s.slotBadge, { backgroundColor: colors.border }]}>
                  <Text style={[s.slotText, { color: colors.text }]}>{pl.position}</Text>
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

function PlayerCard({ slot, selected, muted, onPress, onTap, showStats, isLast, editMode, hasSelection, isValidTarget }: {
  slot: RosterSlot; selected?: boolean; muted?: boolean; showStats?: boolean; onPress?: () => void; onTap?: () => void;
  isLast?: boolean; editMode?: boolean; hasSelection?: boolean; isValidTarget?: boolean;
}) {
  const { colors } = useTheme();
  const [imgErr, setImgErr] = useState(false);

  const dimmed = editMode && hasSelection && !selected && !isValidTarget && !slot.gameStarted;

  const inner = (
    <View style={[
      s.playerRow,
      !isLast && { borderBottomWidth: 1, borderBottomColor: `${colors.accent}28` },
      selected && { backgroundColor: `${colors.accent}18` },
      isValidTarget && { backgroundColor: "#22c55e12" },
      dimmed && { opacity: 0.28 },
      muted && s.playerRowMuted,
    ]}>
      <Text style={[s.slotLabel, { color: colors.accent }]}>{slot.slot}</Text>
      <View>
        {slot.headshotUrl && !imgErr ? (
          <Image source={{ uri: slot.headshotUrl }} style={s.headshot} onError={() => setImgErr(true)} />
        ) : (
          <View style={[s.headshotFallback, { backgroundColor: colors.surface }]}>
            <Text style={[s.headshotText, { color: colors.textSub }]}>{(slot.position ?? slot.slot).slice(0, 2)}</Text>
          </View>
        )}
        {slot.gameStarted && (
          <View style={s.lockBadge}>
            <Ionicons name="lock-closed" size={8} color="#fff" />
          </View>
        )}
      </View>
      <View style={s.playerInfo}>
        <Text style={[s.playerName, { color: colors.text }]} numberOfLines={1}>{abbrevName(slot.name) ?? slot.playerId}</Text>
        {showStats && slot.statLine ? (
          <Text style={[s.playerMeta, { color: colors.textSub }]} numberOfLines={1}>{slot.statLine}</Text>
        ) : slot.position ? (
          <Text style={[s.playerMeta, { color: colors.textSub }]}>{slot.position}{slot.team ? ` · ${slot.team}` : ""}</Text>
        ) : null}
      </View>
      <Text style={[s.oppCell, { color: colors.textSub }]} numberOfLines={1}>
        {slot.opponent ?? "—"}
      </Text>
      <Text style={[s.projCell, { color: colors.textSub }]}>
        {slot.projected != null
          ? slot.projected.toFixed(1)
          : (MOCK_PROJ[slot.position ?? slot.slot] ?? 0).toFixed(1)}
      </Text>
      <Text style={[s.scoreCell, { color: (slot.points ?? 0) > 0 ? colors.text : colors.textSub }]}>
        {slot.points != null && slot.points > 0 ? slot.points.toFixed(1) : "—"}
      </Text>
      {editMode && !slot.gameStarted && (
        <View style={[
          s.moveHandle,
          selected
            ? { backgroundColor: colors.accent }
            : isValidTarget
              ? { backgroundColor: "#22c55e" }
              : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
        ]}>
          <Ionicons
            name={selected ? "close" : isValidTarget ? "checkmark" : "swap-vertical-outline"}
            size={12}
            color={selected || isValidTarget ? "#fff" : colors.textSub}
          />
        </View>
      )}
    </View>
  );

  const handler = onPress ?? onTap;
  if (handler) return <TouchableOpacity onPress={handler} activeOpacity={0.6}>{inner}</TouchableOpacity>;
  return inner;
}

function PlayerDetailSheet({ slot, leagueId, currentWeek, onClose }: {
  slot: RosterSlot; leagueId: string; currentWeek: number; onClose: () => void;
}) {
  const { colors } = useTheme();
  const [detailTab, setDetailTab] = useState<"news" | "schedule">("news");
  const [news, setNews] = useState<{ headline: string; description?: string }[]>([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [schedule, setSchedule] = useState<{ week: number; opponent: string; score: number | null; bye: boolean }[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [imgErr, setImgErr] = useState(false);

  // News — live ESPN, fetches fresh every open, updates within minutes of player news breaking
  useEffect(() => {
    setLoadingNews(true);
    setNews([]);
    async function fetchNews() {
      try {
        const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=20");
        const data = await res.json();
        const lastName = slot.name?.split(" ").slice(1).join(" ")?.toLowerCase() ?? "";
        const filtered = (data.articles ?? [])
          .filter((a: any) =>
            lastName && (
              (a.headline ?? "").toLowerCase().includes(lastName) ||
              (a.description ?? "").toLowerCase().includes(lastName)
            )
          )
          .slice(0, 5)
          .map((a: any) => ({ headline: a.headline ?? "", description: a.description ?? "" }));
        setNews(filtered);
      } catch {}
      setLoadingNews(false);
    }
    fetchNews();
  }, [slot.name]);

  // Schedule — ESPN team schedule (2 API calls) + backend scores for past weeks
  useEffect(() => {
    if (!slot.team) { setLoadingSchedule(false); return; }
    setLoadingSchedule(true);
    async function buildSchedule() {
      try {
        const teamsRes = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams?limit=32");
        const teamsData = await teamsRes.json();
        const espnTeam = (teamsData.sports?.[0]?.leagues?.[0]?.teams ?? [])
          .find((t: any) => t.team.abbreviation === slot.team);
        if (!espnTeam) throw new Error("not found");

        const schedRes = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${espnTeam.team.id}/schedule?season=2025&seasontype=2`
        );
        const schedData = await schedRes.json();

        const weeks: { week: number; opponent: string; bye: boolean; score: number | null }[] = [];
        for (const event of (schedData.events ?? [])) {
          const weekNum = event.week?.number;
          if (!weekNum) continue;
          const comp = event.competitions?.[0];
          const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
          const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
          if (!home || !away) continue;
          const isHome = home.team.abbreviation === slot.team;
          weeks.push({
            week: weekNum,
            opponent: isHome ? `vs ${away.team.abbreviation}` : `@${home.team.abbreviation}`,
            bye: false,
            score: null,
          });
        }
        const covered = new Set(weeks.map(w => w.week));
        for (let w = 1; w <= 18; w++) {
          if (!covered.has(w)) weeks.push({ week: w, opponent: "BYE", bye: true, score: null });
        }
        weeks.sort((a, b) => a.week - b.week);

        // Fetch this player's fantasy score for each past week in parallel
        const scoreMap: Record<number, number | null> = {};
        await Promise.all(
          weeks
            .filter(w => w.week <= currentWeek && !w.bye)
            .map(async ({ week }) => {
              try {
                const res = await api.get<{ roster: RosterSlot[] }>(`/season/${leagueId}/my-team?week=${week}`);
                if (res.ok) {
                  const found = res.data.roster.find(r => r.playerId === slot.playerId);
                  scoreMap[week] = found?.points ?? null;
                }
              } catch {}
            })
        );

        setSchedule(weeks.map(w => ({ ...w, score: scoreMap[w.week] ?? null })));
      } catch {
        setSchedule([]);
      }
      setLoadingSchedule(false);
    }
    buildSchedule();
  }, [slot.team, slot.playerId]);

  const proj = slot.projected != null ? slot.projected : (MOCK_PROJ[slot.position ?? slot.slot] ?? 0);
  const hasScore = (slot.points ?? 0) > 0;

  return (
    <Modal visible transparent animationType="slide">
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" }}>
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44, maxHeight: "82%" }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 20 }} />

          {/* Player header */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 }}>
            {slot.headshotUrl && !imgErr ? (
              <Image source={{ uri: slot.headshotUrl }} style={{ width: 56, height: 56, borderRadius: 28 }} onError={() => setImgErr(true)} />
            ) : (
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.textSub, fontSize: 18, fontWeight: "800" }}>{(slot.position ?? slot.slot).slice(0, 2)}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 19, fontWeight: "900", lineHeight: 22 }}>{slot.name ?? slot.playerId}</Text>
              <Text style={{ color: colors.textSub, fontSize: 12, marginTop: 3 }}>
                {[slot.position, slot.team, slot.opponent ? `· ${slot.opponent}` : null].filter(Boolean).join(" ")}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.textSub} />
            </TouchableOpacity>
          </View>

          {/* Stats row */}
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Projected", value: proj.toFixed(1), color: colors.accent },
              { label: "Score", value: hasScore ? (slot.points ?? 0).toFixed(1) : "—", color: hasScore ? colors.text : colors.textSub },
              { label: "Opponent", value: slot.opponent ?? "—", color: colors.text },
            ].map((stat) => (
              <View key={stat.label} style={{ flex: 1, backgroundColor: colors.bg, borderRadius: 10, padding: 12, alignItems: "center" }}>
                <Text style={{ color: colors.textSub, fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>{stat.label}</Text>
                <Text style={{ color: stat.color, fontSize: 18, fontWeight: "900", marginTop: 4 }}>{stat.value}</Text>
              </View>
            ))}
          </View>

          {/* Tab toggle */}
          <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 16 }}>
            {(["news", "schedule"] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setDetailTab(tab)}
                style={{ flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: detailTab === tab ? 2 : 0, borderBottomColor: colors.accent, marginBottom: -1 }}
              >
                <Text style={{ color: detailTab === tab ? colors.text : colors.textSub, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {detailTab === "news" && (
              loadingNews ? (
                <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />
              ) : news.length === 0 ? (
                <Text style={{ color: colors.textSub, fontSize: 13, textAlign: "center", marginTop: 8, paddingBottom: 8 }}>No recent news found.</Text>
              ) : news.map((a, i) => (
                <View key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottomWidth: i < news.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700", lineHeight: 18 }}>{a.headline}</Text>
                  {a.description ? <Text style={{ color: colors.textSub, fontSize: 11, marginTop: 4, lineHeight: 16 }} numberOfLines={3}>{a.description}</Text> : null}
                </View>
              ))
            )}

            {detailTab === "schedule" && (
              loadingSchedule ? (
                <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />
              ) : schedule.length === 0 ? (
                <Text style={{ color: colors.textSub, fontSize: 13, textAlign: "center", marginTop: 8 }}>Schedule unavailable.</Text>
              ) : (
                <>
                  <View style={{ flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4 }}>
                    <Text style={{ width: 36, color: colors.textSub, fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>WK</Text>
                    <Text style={{ flex: 1, color: colors.textSub, fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>OPPONENT</Text>
                    <Text style={{ width: 56, textAlign: "right", color: colors.textSub, fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>SCORE</Text>
                  </View>
                  {schedule.map((row) => (
                    <View key={row.week} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: `${colors.border}55` }}>
                      <Text style={{ width: 36, color: row.week === currentWeek ? colors.accent : colors.textSub, fontSize: 12, fontWeight: row.week === currentWeek ? "800" : "600" }}>{row.week}</Text>
                      <Text style={{ flex: 1, color: row.bye ? colors.textSub : colors.text, fontSize: 13, fontWeight: row.bye ? "400" : "600", fontStyle: row.bye ? "italic" : "normal" }}>
                        {row.opponent}
                      </Text>
                      <Text style={{ width: 56, textAlign: "right", color: row.score != null && row.score > 0 ? colors.text : colors.textSub, fontSize: 13, fontWeight: "700" }}>
                        {row.score != null && row.score > 0 ? row.score.toFixed(1) : row.week < currentWeek && !row.bye ? "—" : ""}
                      </Text>
                    </View>
                  ))}
                </>
              )
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
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

  teamHero: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1 },
  heroTopRow: { flexDirection: "column", marginBottom: 14 },
  settingsBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  settingsBtnText: { fontSize: 12, fontWeight: "600" },
  heroEditBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  heroEditBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  weekRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 0, gap: 12 },
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
  playerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 4 },
  playerRowMuted: { opacity: 0.4 },
  headshot: { width: 38, height: 38, borderRadius: 19 },
  headshotFallback: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  headshotText: { fontSize: 11, fontWeight: "800" },
  slotBadge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3, minWidth: 42, alignItems: "center" },
  slotText: { fontSize: 10, fontWeight: "700" },
  slotLabel: { fontSize: 10, fontWeight: "800", minWidth: 32, textAlign: "center" },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 13, fontWeight: "600" },
  playerMeta: { fontSize: 11, marginTop: 1 },
  pts: { fontSize: 14, fontWeight: "700" },
  lineupEditBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 10, marginBottom: 14 },
  lineupEditBarText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  lockBadge: { position: "absolute", bottom: 0, right: 0, width: 15, height: 15, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  moveHandle: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", marginLeft: 6 },
  categoryRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingBottom: 5, paddingTop: 2, borderBottomWidth: 1, marginBottom: 2 },
  catLabel: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  oppCell: { width: 50, textAlign: "center", fontSize: 11, fontWeight: "600" },
  projCell: { fontSize: 13, fontWeight: "600", width: 48, textAlign: "center" },
  scoreCell: { fontSize: 13, fontWeight: "600", width: 52, textAlign: "center" },

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
