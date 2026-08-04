import { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, FlatList,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/store/auth";
import { api } from "../../src/api/client";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = SCREEN_W - 40;

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
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    api.get<{ leagues: League[] }>("/leagues/mine").then((res) => {
      if (res.ok) setLeagues(res.data.leagues);
      setLoading(false);
    });
  }, []);

  const onViewRef = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0);
  });
  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 60 });

  const entryLabel = (buyIn: number) =>
    buyIn === 0 ? "Free" : "$" + buyIn.toLocaleString() + " entry";

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header — just logo + Create + Search */}
      <View style={styles.header}>
        <Text style={styles.logo}>Rivyl</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.createBtn} onPress={() => router.push("/(app)/create-league" as any)}>
            <Text style={styles.createBtnText}>+ Create</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.searchBtn} onPress={() => router.push("/(app)/discover" as any)}>
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* My Leagues row with Rankings button on the right */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionHeading}>My Leagues</Text>
          <TouchableOpacity activeOpacity={0.85} onPress={() => router.push("/(app)/rankings" as any)}>
            <LinearGradient
              colors={["#ef4444", "#7c3aed", "#4f7cff"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.rankingsBtn}
            >
              <Text style={styles.rankingsBtnText}>Rivyl Rankings</Text>
            </LinearGradient>
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
          <>
            <FlatList
              data={leagues}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_W + 16}
              decelerationRate="fast"
              contentContainerStyle={{ paddingRight: 20 }}
              onViewableItemsChanged={onViewRef.current}
              viewabilityConfig={viewConfig.current}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.leagueCard}
                  onPress={() => router.push(("/(app)/league/" + item.id) as any)}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.leagueName} numberOfLines={1}>{item.name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + "22" }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>{item.status}</Text>
                    </View>
                  </View>
                  {item.myTeam && <Text style={styles.teamName}>{item.myTeam.name}</Text>}
                  <View style={styles.cardMeta}>
                    <Text style={[styles.metaEntry, { color: "#22c55e" }]}>{entryLabel(item.buyIn)}</Text>
                    <Text style={styles.metaDot}> · </Text>
                    <Text style={styles.metaItem}>{item.memberCount}/{item.maxTeams} teams</Text>
                    <Text style={styles.metaDot}> · </Text>
                    <Text style={styles.metaItem}>{item.scoringType === "FULL_PPR" ? "Full PPR" : "Half PPR"}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
            {leagues.length > 1 && (
              <View style={styles.dots}>
                {leagues.map((_: any, i: number) => (
                  <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => router.push("/(app)/profile" as any)}>
          <Text style={styles.username}>@{user?.username}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0f14" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#2a3347", backgroundColor: "#161b24" },
  logo: { fontSize: 20, fontWeight: "700", color: "#4f7cff", letterSpacing: -0.5 },
  headerActions: { flexDirection: "row", gap: 8 },
  createBtn: { backgroundColor: "#4f7cff", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  createBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  searchBtn: { backgroundColor: "#ef4444", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  searchBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 20, paddingBottom: 40 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 14 },
  sectionHeading: { fontSize: 20, fontWeight: "700", color: "#e8eaf0" },
  rankingsBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  rankingsBtnText: { color: "#fff", fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  emptyState: { alignItems: "center", marginTop: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#e8eaf0", marginBottom: 8 },
  emptyBody: { fontSize: 14, color: "#8a95a8", textAlign: "center" },
  leagueCard: { width: CARD_W, backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 16, padding: 20, marginLeft: 20, marginBottom: 4 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  leagueName: { fontSize: 17, fontWeight: "700", color: "#e8eaf0", flex: 1, marginRight: 8 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  teamName: { fontSize: 13, color: "#8a95a8", marginBottom: 12 },
  cardMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  metaEntry: { fontSize: 13, fontWeight: "700" },
  metaItem: { fontSize: 12, color: "#8a95a8" },
  metaDot: { fontSize: 12, color: "#374151" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#2a3347" },
  dotActive: { backgroundColor: "#4f7cff", width: 18 },
  footer: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: "#2a3347" },
  username: { fontSize: 14, color: "#8a95a8", fontWeight: "600" },
});
