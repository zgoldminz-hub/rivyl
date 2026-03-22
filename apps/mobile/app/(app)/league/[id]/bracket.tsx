import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "../../../../src/api/client";

interface BracketMatchup {
  id: string; week: number; homeScore: number; awayScore: number; isPlayoff: boolean;
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
}

export default function BracketScreen() {
  const router = useRouter();
  const { id: leagueId } = useLocalSearchParams<{ id: string }>();
  const [bracket, setBracket] = useState<BracketMatchup[]>([]);
  const [seeds, setSeeds] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId) return;
    api.get<{ bracket: BracketMatchup[]; seeds: Record<string, number> }>(`/season/${leagueId}/bracket`).then((res) => {
      if (res.ok) { setBracket(res.data.bracket); setSeeds(res.data.seeds); }
      setLoading(false);
    });
  }, [leagueId]);

  const week15 = bracket.filter((m) => m.week === 15);
  const week16 = bracket.filter((m) => m.week === 16);
  const week17 = bracket.filter((m) => m.week === 17);

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color="#4f7cff" style={{ flex: 1 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>← Standings</Text></TouchableOpacity>
        <Text style={styles.title}>🏆 Playoffs</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {[{ label: "Semifinals — Week 15", matchups: week15 }, { label: "Championship — Week 16", matchups: week16 }, { label: "Finals — Week 17", matchups: week17 }].map(({ label, matchups }) => (
          <View key={label} style={styles.round}>
            <Text style={styles.roundLabel}>{label}</Text>
            {matchups.length === 0 ? (
              <Text style={styles.tbd}>TBD</Text>
            ) : matchups.map((m) => {
              const homeWin = m.homeScore > m.awayScore && (m.homeScore > 0 || m.awayScore > 0);
              const awayWin = m.awayScore > m.homeScore && (m.homeScore > 0 || m.awayScore > 0);
              return (
                <TouchableOpacity
                  key={m.id}
                  style={styles.matchupCard}
                  onPress={() => router.push(`/(app)/league/${leagueId}/matchup/${m.id}` as any)}
                  activeOpacity={0.8}
                >
                  <MatchupRow
                    name={m.homeTeam?.name ?? "TBD"}
                    seed={m.homeTeam ? seeds[m.homeTeam.id] : undefined}
                    score={m.homeScore}
                    winner={homeWin}
                  />
                  <View style={styles.divider} />
                  <MatchupRow
                    name={m.awayTeam?.name ?? "TBD"}
                    seed={m.awayTeam ? seeds[m.awayTeam.id] : undefined}
                    score={m.awayScore}
                    winner={awayWin}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function MatchupRow({ name, seed, score, winner }: { name: string; seed?: number; score: number; winner: boolean }) {
  return (
    <View style={styles.matchupRow}>
      <View style={styles.teamInfo}>
        {seed !== undefined && <Text style={styles.seed}>#{seed}</Text>}
        <Text style={[styles.teamName, winner && styles.winnerText]} numberOfLines={1}>{name}</Text>
      </View>
      <Text style={[styles.score, winner && styles.winnerScore]}>{score > 0 ? score.toFixed(1) : "—"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0f14" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#2a3347", backgroundColor: "#161b24" },
  back: { fontSize: 13, color: "#8a95a8", width: 80 },
  title: { fontSize: 17, fontWeight: "700", color: "#e8eaf0" },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  round: { marginBottom: 24 },
  roundLabel: { fontSize: 13, fontWeight: "600", color: "#8a95a8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  tbd: { color: "#4a5568", fontSize: 14, fontStyle: "italic" },
  matchupCard: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 12, padding: 14, marginBottom: 10 },
  matchupRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  teamInfo: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  seed: { fontSize: 11, fontWeight: "700", color: "#4f7cff", width: 24 },
  teamName: { fontSize: 14, color: "#8a95a8", flex: 1 },
  winnerText: { color: "#e8eaf0", fontWeight: "700" },
  score: { fontSize: 15, fontWeight: "700", color: "#8a95a8" },
  winnerScore: { color: "#22c55e" },
  divider: { height: 1, backgroundColor: "#2a3347", marginVertical: 2 },
});
