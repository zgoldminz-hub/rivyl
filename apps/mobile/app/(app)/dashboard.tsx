import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, FlatList, Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../src/store/auth";
import { api } from "../../src/api/client";
import AvatarCharacter from "../../src/components/AvatarCharacter";
import { AvatarConfig, DEFAULT_AVATAR_CONFIG } from "../../src/constants/avatar-parts";
import { useTheme, Colors } from "../../src/context/theme";

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

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe:            { flex: 1, backgroundColor: c.bg },
    headerActions:   { flexDirection: "row", gap: 8, alignItems: "center" },
    createBtn:       { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
    createBtnText:   { color: "#fff", fontSize: 13, fontWeight: "700" },
    searchBtn:       { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
    searchBtnText:   { color: "#fff", fontSize: 13, fontWeight: "700" },
    settingsBtn:     { paddingHorizontal: 2, paddingVertical: 4 },
    logoName:        { color: "#fff", fontWeight: "900", fontSize: 18, letterSpacing: -0.3 },
    logoSub:         { color: "rgba(255,255,255,0.75)", fontWeight: "700", fontSize: 7.5, letterSpacing: 2.5, textAlign: "center", marginTop: 1 },
    scroll:          { flex: 1 },
    scrollContent:   { paddingTop: 20, paddingBottom: 40 },
    sectionRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 14 },
    sectionHeading:  { fontSize: 20, fontWeight: "700", color: c.text },
    rankingsBtn:     { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
    rankingsBtnText: { color: "#fff", fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
    emptyState:      { alignItems: "center", marginTop: 60, paddingHorizontal: 20 },
    emptyTitle:      { fontSize: 17, fontWeight: "600", color: c.text, marginBottom: 8 },
    emptyBody:       { fontSize: 14, color: c.textSub, textAlign: "center" },
    leagueCard:      { width: CARD_W, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 20, marginLeft: 20, marginBottom: 4 },
    cardHeader:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
    leagueName:      { fontSize: 17, fontWeight: "700", color: c.text, flex: 1, marginRight: 8 },
    statusBadge:     { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
    statusText:      { fontSize: 11, fontWeight: "700" },
    teamName:        { fontSize: 13, color: c.textSub, marginBottom: 12 },
    cardMeta:        { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
    metaEntry:       { fontSize: 13, fontWeight: "700" },
    metaItem:        { fontSize: 12, color: c.textSub },
    metaDot:         { fontSize: 12, color: c.border },
    dots:            { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 },
    dot:             { width: 6, height: 6, borderRadius: 3, backgroundColor: c.border },
    dotActive:       { backgroundColor: c.accent, width: 18 },
    footer:          { borderTopWidth: 1, borderTopColor: c.border, alignItems: "center", paddingTop: 10 },
    profileBtn:      { alignItems: "center", gap: 4 },
    username:        { fontSize: 12, color: c.textSub, fontWeight: "600" },
  });
}

function RivylLogoText({ onPress }: { onPress?: () => void }) {
  const img = (
    <Image
      source={require("../../assets/RV.png")}
      style={{ width: 118, height: 27, tintColor: "#ffffff" }}
      resizeMode="contain"
    />
  );
  if (!onPress) return img;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.75}>{img}</TouchableOpacity>;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(DEFAULT_AVATAR_CONFIG);

  useEffect(() => {
    api.get<{ leagues: League[] }>("/leagues/mine").then((res) => {
      if (res.ok) setLeagues(res.data.leagues);
      setLoading(false);
    });
  }, []);

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem("avatar_config_v2").then((val) => {
      if (val) { try { setAvatarConfig(JSON.parse(val)); } catch {} }
    });
  }, []));

  const onViewRef = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0);
  });
  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 60 });

  const entryLabel = (buyIn: number) =>
    buyIn === 0 ? "Free" : "$" + buyIn.toLocaleString() + " entry";

  return (
    <View style={styles.safe}>
      <LinearGradient
        colors={["#C81A1A", "#7520CC", "#1834D4"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 10, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
      >
        {/* RIVYL FANTASY — decorative on home page */}
        <RivylLogoText />
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.createBtn} onPress={() => router.push("/(app)/create-league" as any)}>
            <Text style={styles.createBtnText}>+ Create</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.searchBtn} onPress={() => router.push("/(app)/discover" as any)}>
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push("/(app)/settings" as any)}>
            <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionHeading}>My Leagues</Text>

          {/* R icon — top portion of logo, clipped */}
          <View style={{ width: 52, height: 43, overflow: "hidden" }}>
                  <Image
                  source={require("../../assets/R.png")}
                  style={{ width: 50, height: 40 }}
                  resizeMode="contain"
                />
                </View>

          <TouchableOpacity activeOpacity={0.85} onPress={() => router.push("/(app)/rankings" as any)}>
            <LinearGradient
              colors={["#C81A1A", "#7520CC", "#1834D4"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.rankingsBtn}
            >
              <Text style={styles.rankingsBtnText}>Rivyl Rankings</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
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

      <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
        <TouchableOpacity style={styles.profileBtn} onPress={() => router.push("/(app)/profile" as any)} activeOpacity={0.8}>
          <AvatarCharacter config={avatarConfig} size={56} />
          <Text style={styles.username}>@{user?.username}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
