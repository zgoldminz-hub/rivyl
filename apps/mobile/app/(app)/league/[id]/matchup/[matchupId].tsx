import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "../../../../../src/api/client";

interface RosterSlotDetail {
  id: string; playerId: string; slot: string; points: number; statLine?: string;
  name?: string; position?: string; team?: string | null; headshotUrl?: string;
}
interface TeamDetail { id: string; name: string; user: { username: string }; rosterSlots: RosterSlotDetail[]; }
interface MatchupData { id: string; week: number; homeScore: number; awayScore: number; isPlayoff: boolean; homeTeam: TeamDetail; awayTeam: TeamDetail; }

const POS_COLORS: Record<string, string> = {
  QB: "#f59e0b", RB: "#22c55e", WR: "#4f7cff", TE: "#a78bfa", K: "#6b7280", DEF: "#ef4444", FLEX: "#22c55e",
};
const STARTER_ORDER = ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF"];

export default function MatchupDetailScreen() {
  const router = useRouter();
  const { id: leagueId, matchupId } = useLocalSearchParams<{ id: string; matchupId: string }>();
  const [matchup, setMatchup] = useState<MatchupData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId || !matchupId) return;
    api.get<{ matchup: MatchupData }>(`/season/${leagueId}/matchup/${matchupId}`).then((res) => {
      if (res.ok) setMatchup(res.data.matchup);
      setLoading(false);
    });
  }, [leagueId, matchupId]);

  if (loading || !matchup) return <SafeAreaView style={styles.safe}><ActivityIndicator color="#4f7cff" style={{ flex: 1 }} /></SafeAreaView>;

  const homeWinning = matchup.homeScore >= matchup.awayScore;
  const sortedStarters = (slots: RosterSlotDetail[]) => slots.filter((s) => s.slot !== "BENCH").sort((a, b) => STARTER_ORDER.indexOf(a.slot) - STARTER_ORDER.indexOf(b.slot));
  const bench = (slots: RosterSlotDetail[]) => slots.filter((s) => s.slot === "BENCH");

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Week {matchup.week}{matchup.isPlayoff ? " · Playoff" : ""}</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Score header */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreTeam}>
            <Text style={styles.teamName} numberOfLines={1}>{matchup.homeTeam.name}</Text>
            <Text style={styles.teamUser}>@{matchup.homeTeam.user.username}</Text>
            <Text style={[styles.bigScore, homeWinning && styles.winnerScore]}>{matchup.homeScore.toFixed(2)}</Text>
          </View>
          <Text style={styles.vs}>vs</Text>
          <View style={[styles.scoreTeam, { alignItems: "flex-end" }]}>
            <Text style={styles.teamName} numberOfLines={1}>{matchup.awayTeam.name}</Text>
            <Text style={[styles.teamUser, { textAlign: "right" }]}>@{matchup.awayTeam.user.username}</Text>
            <Text style={[styles.bigScore, !homeWinning && styles.winnerScore]}>{matchup.awayScore.toFixed(2)}</Text>
          </View>
        </View>

        {/* Home roster */}
        <Text style={styles.rosterLabel}>{matchup.homeTeam.name} — Starters</Text>
        {sortedStarters(matchup.homeTeam.rosterSlots).map((s) => <PlayerRow key={s.id} slot={s} />)}
        <Text style={[styles.rosterLabel, { opacity: 0.5 }]}>{matchup.homeTeam.name} — Bench</Text>
        {bench(matchup.homeTeam.rosterSlots).map((s) => <PlayerRow key={s.id} slot={s} muted />)}

        {/* Away roster */}
        <Text style={[styles.rosterLabel, { marginTop: 16 }]}>{matchup.awayTeam.name} — Starters</Text>
        {sortedStarters(matchup.awayTeam.rosterSlots).map((s) => <PlayerRow key={s.id} slot={s} />)}
        <Text style={[styles.rosterLabel, { opacity: 0.5 }]}>{matchup.awayTeam.name} — Bench</Text>
        {bench(matchup.awayTeam.rosterSlots).map((s) => <PlayerRow key={s.id} slot={s} muted />)}
      </ScrollView>
    </SafeAreaView>
  );
}

function PlayerRow({ slot, muted }: { slot: RosterSlotDetail; muted?: boolean }) {
  const [imgErr, setImgErr] = useState(false);
  const slotColor = POS_COLORS[slot.slot] ?? "#6b7280";
  const posColor = POS_COLORS[slot.position ?? ""] ?? slotColor;
  const displayName = slot.name ?? slot.playerId;
  return (
    <View style={[styles.playerRow, muted && styles.playerRowMuted]}>
      {slot.headshotUrl && !imgErr ? (
        <Image source={{ uri: slot.headshotUrl }} style={styles.headshot} onError={() => setImgErr(true)} />
      ) : (
        <View style={[styles.headshot, styles.headshotFallback, { backgroundColor: `${posColor}25` }]}>
          <Text style={[styles.headshotFallbackText, { color: posColor }]}>{slot.position ?? slot.slot}</Text>
        </View>
      )}
      <View style={[styles.slotBadge, { backgroundColor: `${slotColor}20` }]}>
        <Text style={[styles.slotText, { color: slotColor }]}>{slot.slot}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName} numberOfLines={1}>{displayName}</Text>
        {slot.statLine ? (
          <Text style={styles.statLine}>{slot.statLine}</Text>
        ) : (slot.position || slot.team) ? (
          <Text style={styles.statLine}>{[slot.position, slot.team].filter(Boolean).join(" · ")}</Text>
        ) : null}
      </View>
      <Text style={[styles.pts, slot.points > 0 && styles.ptsActive]}>{slot.points.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0f14" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#2a3347", backgroundColor: "#161b24" },
  back: { fontSize: 13, color: "#8a95a8", width: 80 },
  title: { fontSize: 15, fontWeight: "700", color: "#e8eaf0" },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  scoreCard: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 12, padding: 20, flexDirection: "row", alignItems: "center", marginBottom: 20 },
  scoreTeam: { flex: 1 },
  teamName: { fontSize: 14, fontWeight: "700", color: "#e8eaf0", marginBottom: 2 },
  teamUser: { fontSize: 11, color: "#8a95a8", marginBottom: 6 },
  bigScore: { fontSize: 34, fontWeight: "800", color: "#8a95a8" },
  winnerScore: { color: "#22c55e" },
  vs: { fontSize: 14, color: "#8a95a8", marginHorizontal: 12 },
  rosterLabel: { fontSize: 11, fontWeight: "600", color: "#8a95a8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 8 },
  playerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#1a2133" },
  playerRowMuted: { opacity: 0.45 },
  headshot: { width: 36, height: 36, borderRadius: 18 },
  headshotFallback: { justifyContent: "center", alignItems: "center" },
  headshotFallbackText: { fontSize: 8, fontWeight: "700" },
  slotBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, minWidth: 40, alignItems: "center" },
  slotText: { fontSize: 10, fontWeight: "700" },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 13, fontWeight: "500", color: "#e8eaf0" },
  statLine: { fontSize: 11, color: "#8a95a8", marginTop: 1 },
  pts: { fontSize: 14, fontWeight: "700", color: "#8a95a8" },
  ptsActive: { color: "#e8eaf0" },
});
