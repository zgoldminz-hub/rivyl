import { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/store/auth";
import { api } from "../../src/api/client";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 40;

interface League {
  id: string; name: string; status: string; buyIn: number;
  maxTeams: number; memberCount: number; scoringType: string;
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
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    api.get<{ leagues: League[] }>("/leagues/mine").then((res) => {
      if (res.ok) setLeagues(res.data.leagues);
      setLoading(false);
    });
  }, []);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
    setActiveIndex(index);
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>Rivyl</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.createBtn} onPress={() => router.push("/(app)/create-league" as any)}>
            <Text style={styles.createBtnText}>+ Create</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.searchBtn} onPress={() => router.push("/(app)/discover")}>
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* My Leagues */}
        <Text style={styles.sectionTitle}>My Leagues</Text>

        {loading ? (
          <ActivityIndicator color="#4f7cff" style={{ marginTop: 24 }} />
        ) : leagues.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No leagues yet</Text>
            <Text style={styles.emptyBody}>Create a league or join one via invite code.</Text>
          </View>
        ) : (
          <View>
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={16}
              snapToInterval={CARD_WIDTH}
              decelerationRate="fast"
              contentContainerStyle={{ paddingRight: 0 }}
            >
              {leagues.map((league) => (
                <TouchableOpacity
                  key={league.id}
                  style={[styles.leagueCard, { width: CARD_WIDTH }]}
                  onPress={() => router.push(`/(app)/league/${league.id}` as any)}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.leagueName} numberOfLines={1}>{league.name}</Text>
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
                  <View style={styles.cardArrow}>
                    <Text style={styles.cardArrowText}>View League →</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Dots */}
            {leagues.length > 1 && (
              <View style={styles.dots}>
                {leagues.map((_, i) => (
                  <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Rankings */}
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Rankings</Text>
        <TouchableOpacity style={styles.rankingsCard} onPress={() => router.push("/(app)/rankings" as any)} activeOpacity={0.85}>
          <View>
            <Text style={styles.rankingsTitle}>Rivyl Rankings</Text>
            <Text style={styles.rankingsSubtitle}>Player rankings, projections & mock draft</Text>
          </View>
          <Text style={styles.rankingsArrow}>→</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={() => router.push("/(app)/profile" as any)}>
          <Text style={styles.username}>@{user?.username}</Text>
        </TouchableOpacity>
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
  logo: { fontSize: 22, fontWeight: "800", color: "#4f7cff", letterSpacing: -0.5 },
  headerActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  createBtn: { backgroundColor: "#4f7cff", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  createBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  searchBtn: { backgroundColor: "#e63946", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  searchBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#e8eaf0", marginBottom: 14 },
  emptyState: { alignItems: "center", marginTop: 40, padding: 24, backgroundColor: "#161b24", borderRadius: 12, borderWidth: 1, borderColor: "#2a3347" },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#e8eaf0", marginBottom: 6 },
  emptyBody: { fontSize: 13, color: "#8a95a8", textAlign: "center" },
  leagueCard: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 14, padding: 18, marginRight: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  leagueName: { fontSize: 17, fontWeight: "700", color: "#e8eaf0", flex: 1, marginRight: 8 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  teamName: { fontSize: 13, color: "#8a95a8", marginBottom: 10 },
  cardMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  metaItem: { fontSize: 12, color: "#8a95a8" },
  metaDot: { fontSize: 12, color: "#374151" },
  cardArrow: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#2a3347" },
  cardArrowText: { fontSize: 13, color: "#4f7cff", fontWeight: "600" },
  dots: { flexDirection: "row", justifyContent: "center", marginTop: 12, gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#2a3347" },
  dotActive: { backgroundColor: "#4f7cff", width: 18 },
  rankingsCard: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 14, padding: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rankingsTitle: { fontSize: 16, fontWeight: "700", color: "#e8eaf0", marginBottom: 4 },
  rankingsSubtitle: { fontSize: 13, color: "#8a95a8" },
  rankingsArrow: { fontSize: 20, color: "#4f7cff", fontWeight: "700" },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderTopWidth: 1, borderTopColor: "#2a3347" },
  username: { fontSize: 13, color: "#8a95a8" },
  signOut: { fontSize: 13, color: "#e63946" },
});
