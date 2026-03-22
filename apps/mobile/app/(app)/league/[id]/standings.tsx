import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "../../../../src/api/client";

interface Standing {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

interface Matchup {
  id: string;
  week: number;
  homeScore: number;
  awayScore: number;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
}

export default function StandingsScreen() {
  const router = useRouter();
  const { id: leagueId } = useLocalSearchParams<{ id: string }>();
  const [standings, setStandings] = useState<Standing[]>([]);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId) return;
    api.get<{ standings: Standing[]; currentWeek: number }>(`/season/${leagueId}/standings`).then((res) => {
      if (res.ok) {
        setStandings(res.data.standings);
        setCurrentWeek(res.data.currentWeek);
        setSelectedWeek(res.data.currentWeek);
      }
      setLoading(false);
    });
  }, [leagueId]);

  useEffect(() => {
    if (!leagueId) return;
    api.get<{ matchups: Matchup[] }>(`/season/${leagueId}/matchups/${selectedWeek}`).then((res) => {
      if (res.ok) setMatchups(res.data.matchups);
    });
  }, [leagueId, selectedWeek]);

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color="#4f7cff" style={{ flex: 1 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← League</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Standings</Text>
        <TouchableOpacity onPress={() => router.push(`/(app)/league/${leagueId}/my-team` as any)}>
          <Text style={styles.myTeamLink}>My Team</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Standings table */}
        <View style={styles.card}>
          <View style={styles.tableHeader}>
            <Text style={[styles.col, { flex: 3 }]}>Team</Text>
            <Text style={styles.col}>W</Text>
            <Text style={styles.col}>L</Text>
            <Text style={styles.col}>PF</Text>
          </View>
          {standings.map((s, i) => (
            <View key={s.teamId} style={[styles.tableRow, i === standings.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={[styles.col, { flex: 3, flexDirection: "row", alignItems: "center", gap: 8 }]}>
                <Text style={styles.rank}>{i + 1}</Text>
                <Text style={styles.teamName} numberOfLines={1}>{s.teamName}</Text>
              </View>
              <Text style={[styles.col, styles.stat]}>{s.wins}</Text>
              <Text style={[styles.col, styles.stat]}>{s.losses}</Text>
              <Text style={[styles.col, styles.stat]}>{s.pointsFor.toFixed(0)}</Text>
            </View>
          ))}
        </View>

        {/* Week nav */}
        <View style={styles.weekNav}>
          <TouchableOpacity onPress={() => setSelectedWeek((w) => Math.max(1, w - 1))} disabled={selectedWeek <= 1}>
            <Text style={[styles.weekArrow, selectedWeek <= 1 && { opacity: 0.3 }]}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.weekLabel}>Week {selectedWeek}</Text>
          <TouchableOpacity onPress={() => setSelectedWeek((w) => Math.min(currentWeek, w + 1))} disabled={selectedWeek >= currentWeek}>
            <Text style={[styles.weekArrow, selectedWeek >= currentWeek && { opacity: 0.3 }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Matchups */}
        {matchups.map((m) => {
          const homeWin = m.homeScore > m.awayScore;
          const hasScores = m.homeScore > 0 || m.awayScore > 0;
          return (
            <TouchableOpacity
              key={m.id}
              style={styles.matchupCard}
              onPress={() => router.push(`/(app)/league/${leagueId}/matchup/${m.id}` as any)}
              activeOpacity={0.8}
            >
              <View style={styles.matchupRow}>
                <Text style={[styles.matchupTeam, hasScores && homeWin && styles.winner]} numberOfLines={1}>{m.homeTeam.name}</Text>
                <Text style={[styles.matchupScore, hasScores && homeWin && styles.winnerScore]}>{m.homeScore.toFixed(1)}</Text>
              </View>
              <View style={styles.matchupRow}>
                <Text style={[styles.matchupTeam, hasScores && !homeWin && styles.winner]} numberOfLines={1}>{m.awayTeam.name}</Text>
                <Text style={[styles.matchupScore, hasScores && !homeWin && styles.winnerScore]}>{m.awayScore.toFixed(1)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0f14" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#2a3347", backgroundColor: "#161b24" },
  back: { fontSize: 14, color: "#8a95a8", width: 70 },
  title: { fontSize: 17, fontWeight: "700", color: "#e8eaf0" },
  myTeamLink: { fontSize: 14, color: "#4f7cff", width: 70, textAlign: "right" },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 12, padding: 16, marginBottom: 16 },
  tableHeader: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#2a3347", marginBottom: 4 },
  tableRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1a2133", alignItems: "center" },
  col: { flex: 1, fontSize: 12, color: "#8a95a8", fontWeight: "600", textTransform: "uppercase" },
  rank: { fontSize: 13, fontWeight: "700", color: "#8a95a8", width: 20 },
  teamName: { fontSize: 14, fontWeight: "600", color: "#e8eaf0", flex: 1 },
  stat: { fontSize: 14, color: "#e8eaf0", fontWeight: "600", textAlign: "center" },
  weekNav: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 12 },
  weekArrow: { fontSize: 24, color: "#8a95a8", paddingHorizontal: 8 },
  weekLabel: { fontSize: 15, fontWeight: "600", color: "#e8eaf0" },
  matchupCard: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 10, padding: 14, marginBottom: 10 },
  matchupRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  matchupTeam: { fontSize: 14, color: "#8a95a8", flex: 1 },
  matchupScore: { fontSize: 15, fontWeight: "700", color: "#8a95a8" },
  winner: { color: "#e8eaf0", fontWeight: "700" },
  winnerScore: { color: "#22c55e" },
});
