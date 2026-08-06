
import { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, FlatList, useColorScheme,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../src/store/auth";
import { api } from "../../src/api/client";
import AvatarCharacter from "../../src/components/AvatarCharacter";
import { AvatarConfig, DEFAULT_AVATAR_CONFIG } from "../../src/constants/avatar-parts";

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

const DARK = {
  bg: "#0d0f14", surface: "#161b24", border: "#2a3347",
  text: "#e8eaf0", sub: "#8a95a8", muted: "#4a5568", accent: "#4f7cff",
};
const LIGHT = {
  bg: "#f4f6fb", surface: "#ffffff", border: "#e2e8f0",
  text: "#111827", sub: "#64748b", muted: "#94a3b8", accent: "#4f7cff",
};

function useTheme() {
  const scheme = useColorScheme();
  return scheme === "dark" ? DARK : LIGHT;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const C = useTheme();
  const isDark = useColorScheme() === "dark";
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(DEFAULT_AVATAR_CONFIG);

  useEffect(() => {
    api.get<{ leagues: League[] }>("/leagues/mine").then((res) => {
      if (res.ok) setLeagues(res.data.leagues);
      setLoading(false);
    });
    AsyncStorage.getItem("avatar_config_v2").then((val) => {
      if (val) { try { setAvatarConfig(JSON.parse(val)); } catch {} }
    });
  }, []);

  const onViewRef = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0);
  });
  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 60 });

  const entryLabel = (buyIn: number) =>
    buyIn === 0 ? "Free" : "$" + buyIn.toLocaleString() + " entry";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>
      <View style={[styles.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <Text style={[styles.logo, { color: C.accent }]}>Rivyl</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.createBtn, { backgroundColor: C.accent }]} onPress={() => router.push("/(app)/create-league" as any)}>
            <Text style={styles.actionBtnText}>+ Create</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.searchBtn} onPress={() => router.push("/(app)/discover" as any)}>
            <Text style={styles.actionBtnText}>Search</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionHeading, { color: C.text }]}>My Leagues</Text>
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
          <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
        ) : leagues.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: C.text }]}>No leagues yet</Text>
            <Text style={[styles.emptyBody, { color: C.sub }]}>Create a league or join one via invite link.</Text>
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
                  style={[styles.leagueCard, { backgroundColor: C.surface, borderColor: C.border }]}
                  onPress={() => router.push(("/(app)/league/" + item.id) as any)}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardHeader}>
                    <Text style={[styles.leagueName, { color: C.text }]} numberOfLines={1}>{item.name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + "22" }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>{item.status}</Text>
                    </View>
                  </View>
                  {item.myTeam && <Text style={[styles.teamName, { color: C.sub }]}>{item.myTeam.name}</Text>}
                  <View style={styles.cardMeta}>
                    <Text style={[styles.metaEntry, { color: "#22c55e" }]}>{entryLabel(item.buyIn)}</Text>
                    <Text style={[styles.metaDot, { color: C.muted }]}> · </Text>
                    <Text style={[styles.metaItem, { color: C.sub }]}>{item.memberCount}/{item.maxTeams} teams</Text>
                    <Text style={[styles.metaDot, { color: C.muted }]}> · </Text>
                    <Text style={[styles.metaItem, { color: C.sub }]}>{item.scoringType === "FULL_PPR" ? "Full PPR" : "Half PPR"}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
            {leagues.length > 1 && (
              <View style={styles.dots}>
                {leagues.map((_: any, i: number) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      { backgroundColor: isDark ? "#2a3347" : "#e2e8f0" },
                      i === activeIndex && { backgroundColor: C.accent, width: 18 },
                    ]}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: C.border }]}>
        <TouchableOpacity style={styles.profileBtn} onPress={() => router.push("/(app)/profile" as any)} activeOpacity={0.8}>
          <View style={[styles.avatarRing, { borderColor: C.accent }]}>
            <AvatarCharacter config={avatarConfig} size={56} />
          </View>
          <Text style={[styles.username, { color: C.sub }]}>@{user?.username}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  logo: { fontSize: 20, fontWeight: "700", letterSpacing: -0.5 },
  headerActions: { flexDirection: "row", gap: 8 },
  createBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  searchBtn: { backgroundColor: "#ef4444", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  actionBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 20, paddingBottom: 40 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 14 },
  sectionHeading: { fontSize: 20, fontWeight: "700" },
  rankingsBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  rankingsBtnText: { color: "#fff", fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  emptyState: { alignItems: "center", marginTop: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 17, fontWeight: "600", marginBottom: 8 },
  emptyBody: { fontSize: 14, textAlign: "center" },
  leagueCard: { width: CARD_W, borderWidth: 1, borderRadius: 16, padding: 20, marginLeft: 20, marginBottom: 4 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  leagueName: { fontSize: 17, fontWeight: "700", flex: 1, marginRight: 8 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  teamName: { fontSize: 13, marginBottom: 12 },
  cardMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  metaEntry: { fontSize: 13, fontWeight: "700" },
  metaItem: { fontSize: 12 },
  metaDot: { fontSize: 12 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  footer: { paddingVertical: 12, borderTopWidth: 1, alignItems: "center" },
  profileBtn: { alignItems: "center", gap: 4 },
  avatarRing: { width: 60, height: 60, borderRadius: 30, overflow: "hidden", borderWidth: 2 },
  username: { fontSize: 12, fontWeight: "600" },
});

