import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/store/auth";
import { api } from "../../src/api/client";

interface League {
  id: string;
  name: string;
  status: string;
  buyIn: number;
  maxTeams: number;
  memberCount: number;
  scoringType: string;
  myTeam?: { name: string };
}

const STATUS_COLOR: Record<string, string> = {
  SETUP: "#6b7280", DRAFTING: "#f59e0b", ACTIVE: "#22c55e", PLAYOFFS: "#a78bfa", COMPLETE: "#374151",
};

export default function DashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ leagues: League[] }>("/leagues/mine").then((res) => {
      if (res.ok) setLeagues(res.data.leagues);
      setLoading(false);
    });
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.logo}>Rivyl</Text>
        <TouchableOpacity onPress={() => router.push("/(app)/discover")}>
          <Text style={styles.discoverLink}>Discover</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleRow}>
          <Text style={styles.heading}>My Leagues</Text>
          <TouchableOpacity style={styles.createBtn} onPress={() => router.push("/(app)/create-league" as any)}>
            <Text style={styles.createBtnText}>+ Create</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#4f7cff" style={{ marginTop: 40 }} />
        ) : leagues.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No leagues yet</Text>
            <Text style={styles.emptyBody}>Create a league or join one via invite link.</Text>
          </View>
        ) : (
          leagues.map((league) => (
            <TouchableOpacity
              key={league.id}
              style={styles.leagueCard}
              onPress={() => router.push(`/(app)/league/${league.id}` as any)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.leagueName}>{league.name}</Text>
                <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLOR[league.status]}22` }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLOR[league.status] }]}>{league.status}</Text>
                </View>
              </View>
              {league.myTeam && <Text style={styles.teamName}>{league.myTeam.name}</Text>}
              <View style={styles.cardMeta}>
                <Text style={styles.metaItem}>${league.buyIn} buy-in</Text>
                <Text style={styles.metaDot}> · </Text>
                <Text style={styles.metaItem}>{league.memberCount}/{league.maxTeams} teams</Text>
                <Text style={styles.metaDot}> · </Text>
                <Text style={styles.metaItem}>{league.scoringType === "FULL_PPR" ? "Full PPR" : "Half PPR"}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.username}>@{user?.username}</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0f14" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#2a3347", backgroundColor: "#161b24" },
  logo: { fontSize: 20, fontWeight: "700", color: "#4f7cff", letterSpacing: -0.5 },
  discoverLink: { fontSize: 14, color: "#8a95a8" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  heading: { fontSize: 20, fontWeight: "700", color: "#e8eaf0" },
  createBtn: { backgroundColor: "#4f7cff", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  createBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  emptyState: { alignItems: "center", marginTop: 60 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#e8eaf0", marginBottom: 8 },
  emptyBody: { fontSize: 14, color: "#8a95a8", textAlign: "center" },
  leagueCard: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  leagueName: { fontSize: 16, fontWeight: "700", color: "#e8eaf0", flex: 1 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  teamName: { fontSize: 13, color: "#8a95a8", marginBottom: 8 },
  cardMeta: { flexDirection: "row", alignItems: "center" },
  metaItem: { fontSize: 12, color: "#8a95a8" },
  metaDot: { fontSize: 12, color: "#374151" },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderTopWidth: 1, borderTopColor: "#2a3347" },
  username: { fontSize: 13, color: "#8a95a8" },
  signOut: { fontSize: 13, color: "#ef4444" },
});
