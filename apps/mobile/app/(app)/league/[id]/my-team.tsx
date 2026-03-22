import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "../../../../src/api/client";
import Button from "../../../../src/components/Button";

interface RosterSlot { id: string; playerId: string; slot: string; points: number | null; }

const POS_COLORS: Record<string, string> = {
  QB: "#f59e0b", RB: "#22c55e", WR: "#4f7cff", TE: "#a78bfa", K: "#6b7280", DEF: "#ef4444", FLEX: "#22c55e", BENCH: "#374151",
};

export default function MyTeamScreen() {
  const router = useRouter();
  const { id: leagueId } = useLocalSearchParams<{ id: string }>();
  const [team, setTeam] = useState<{ id: string; name: string } | null>(null);
  const [roster, setRoster] = useState<RosterSlot[]>([]);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTime, setLockTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [swapSource, setSwapSource] = useState<RosterSlot | null>(null);

  useEffect(() => {
    if (!leagueId) return;
    api.get<{ team: any; roster: RosterSlot[]; currentWeek: number; isLocked: boolean; lockTime: string }>(
      `/season/${leagueId}/my-team`
    ).then((res) => {
      if (res.ok) {
        setTeam(res.data.team);
        setRoster(res.data.roster);
        setCurrentWeek(res.data.currentWeek);
        setIsLocked(res.data.isLocked);
        setLockTime(res.data.lockTime);
      }
      setLoading(false);
    });
  }, [leagueId]);

  function handleSlotPress(slot: RosterSlot) {
    if (isLocked) return;
    if (!swapSource) { setSwapSource(slot); return; }
    if (swapSource.id === slot.id) { setSwapSource(null); return; }
    setRoster((prev) => prev.map((r) => {
      if (r.id === swapSource.id) return { ...r, slot: slot.slot };
      if (r.id === slot.id) return { ...r, slot: swapSource.slot };
      return r;
    }));
    setSwapSource(null);
  }

  async function saveLineup() {
    setSaving(true);
    const res = await api.post(`/season/${leagueId}/lineup`, {
      slots: roster.map((r) => ({ playerId: r.playerId, slot: r.slot })),
    });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  }

  const starters = roster.filter((r) => r.slot !== "BENCH").sort((a, b) => {
    const order = ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF"];
    return order.indexOf(a.slot) - order.indexOf(b.slot);
  });
  const bench = roster.filter((r) => r.slot === "BENCH");
  const totalPts = starters.reduce((sum, r) => sum + (r.points ?? 0), 0);

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color="#4f7cff" style={{ flex: 1 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Standings</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.teamName}>{team?.name}</Text>
          <Text style={styles.weekLabel}>Week {currentWeek}</Text>
        </View>
        {isLocked ? (
          <Text style={styles.locked}>🔒 Locked</Text>
        ) : (
          <Button onPress={saveLineup} loading={saving} style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
            {saved ? "Saved ✓" : "Save"}
          </Button>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {!isLocked && (
          <Text style={styles.swapHint}>{swapSource ? "Tap another player to swap" : "Tap a player to swap"}</Text>
        )}

        <Text style={styles.sectionTitle}>Starters · {totalPts.toFixed(1)} pts</Text>
        {starters.map((r) => (
          <PlayerRow key={r.id} slot={r} selected={swapSource?.id === r.id} locked={isLocked} onPress={() => handleSlotPress(r)} />
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Bench</Text>
        {bench.map((r) => (
          <PlayerRow key={r.id} slot={r} selected={swapSource?.id === r.id} locked={isLocked} onPress={() => handleSlotPress(r)} />
        ))}

        <View style={styles.waiverLink}>
          <TouchableOpacity onPress={() => router.push(`/(app)/league/${leagueId}/waivers` as any)}>
            <Text style={styles.waiverLinkText}>Waiver Wire →</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push(`/(app)/league/${leagueId}/trades` as any)}>
            <Text style={styles.waiverLinkText}>Trades →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlayerRow({ slot, selected, locked, onPress }: { slot: RosterSlot; selected: boolean; locked: boolean; onPress: () => void }) {
  const color = POS_COLORS[slot.slot] ?? "#6b7280";
  return (
    <TouchableOpacity
      style={[styles.playerRow, selected && styles.selectedRow]}
      onPress={onPress}
      disabled={locked}
      activeOpacity={0.7}
    >
      <View style={[styles.slotBadge, { backgroundColor: `${color}20` }]}>
        <Text style={[styles.slotText, { color }]}>{slot.slot}</Text>
      </View>
      <Text style={styles.playerName} numberOfLines={1}>{slot.playerId}</Text>
      <Text style={styles.pts}>{slot.points !== null ? `${slot.points.toFixed(1)}` : "—"}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0f14" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#2a3347", backgroundColor: "#161b24" },
  back: { fontSize: 13, color: "#8a95a8", width: 80 },
  headerCenter: { alignItems: "center" },
  teamName: { fontSize: 15, fontWeight: "700", color: "#e8eaf0" },
  weekLabel: { fontSize: 12, color: "#8a95a8" },
  locked: { fontSize: 12, color: "#8a95a8" },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  swapHint: { fontSize: 12, color: "#4f7cff", textAlign: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: "600", color: "#8a95a8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  playerRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 8, marginBottom: 6 },
  selectedRow: { borderColor: "#4f7cff", backgroundColor: "rgba(79,124,255,0.08)" },
  slotBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, minWidth: 44, alignItems: "center" },
  slotText: { fontSize: 10, fontWeight: "700" },
  playerName: { flex: 1, fontSize: 14, fontWeight: "500", color: "#e8eaf0" },
  pts: { fontSize: 14, fontWeight: "700", color: "#8a95a8" },
  waiverLink: { flexDirection: "row", justifyContent: "space-around", marginTop: 24 },
  waiverLinkText: { fontSize: 14, color: "#4f7cff", fontWeight: "600" },
});
