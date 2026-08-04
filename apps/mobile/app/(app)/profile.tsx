import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../src/store/auth";
import { api } from "../../src/api/client";
import AvatarCharacter from "../../src/components/AvatarCharacter";
import {
  AvatarConfig, DEFAULT_AVATAR_CONFIG,
  SKIN_TONES, HAIR_STYLES, HAIR_COLORS, HAT_OPTIONS, JERSEY_COLORS, EXPRESSIONS,
} from "../../src/constants/avatar-parts";

const AVATAR_KEY = "avatar_config_v2";
type Category = "Skin" | "Hair Style" | "Hair Color" | "Hat" | "Jersey" | "Expression";
const CATEGORIES: Category[] = ["Skin", "Hair Style", "Hair Color", "Hat", "Jersey", "Expression"];

interface Stats {
  regWins: number; regLosses: number;
  playoffWins: number; playoffLosses: number;
  championships: number; runnerUps: number;
  winPct: number; totalLeagues: number;
}

interface RankInfo {
  name: string;
  color: string;
  description: string;
}

function computeRank(stats: Stats): RankInfo {
  const w = stats.regWins;
  const leagues = stats.totalLeagues;
  const wp = stats.winPct;
  const champs = stats.championships;
  const runnerUps = stats.runnerUps;
  const combined = champs + runnerUps;

  if (w >= 300 && champs >= 10) return {
    name: "GOAT Status", color: "#FFD700",
    description: "The pinnacle of Rivyl. 300+ wins and 10 championships. There is no higher rank — you are the greatest of all time.",
  };
  if (wp >= 65 && w >= 200 && combined >= 5 && champs >= 2) return {
    name: "Hall of Famer", color: "#f59e0b",
    description: "An all-time great. Requires 200+ wins, 65%+ win rate, and 5 top-3 finishes with at least 2 championships. Next: GOAT Status (300 wins, 10 championships).",
  };
  if (w >= 100 && champs >= 2) return {
    name: "Franchise Legend", color: "#ef4444",
    description: "A dynasty builder. Requires 100+ all-time wins and 2 championships. Next: Hall of Famer (200+ wins, 65%+ win rate, 5 top-3 finishes including 2 championships).",
  };
  if (leagues >= 60 && champs >= 1 && wp >= 60) return {
    name: "All-Pro", color: "#f97316",
    description: "Elite of the elite. Requires 60+ leagues, 1 championship, and 60%+ win rate. Next: Franchise Legend (100+ wins, 2 championships).",
  };
  if (leagues >= 50 && wp >= 50 && runnerUps >= 1) return {
    name: "Pro-Bowler", color: "#8b5cf6",
    description: "A serious competitor. Requires 50+ leagues, 50%+ win rate, and a runner-up finish. Next: All-Pro (60+ leagues, 1 championship, 60%+ win rate).",
  };
  if (leagues >= 20 && wp >= 50) return {
    name: "Contender", color: "#22c55e",
    description: "A consistent winner. Requires 20+ leagues and 50%+ win rate. Drop below 50% and you fall back to Rising Star. Next: Pro-Bowler (50+ leagues, runner-up finish).",
  };
  if (leagues >= 10) return {
    name: "Rising Star", color: "#3b82f6",
    description: "Building momentum. You have 10+ leagues under your belt. Next: Contender (20+ leagues and 50%+ win rate). Drop below 50% and you stay here.",
  };
  return {
    name: "Rookie", color: "#6b7280",
    description: "Every champion starts somewhere. Play in 10+ leagues to earn Rising Star status and begin your Rivyl journey.",
  };
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [config, setConfig] = useState<AvatarConfig>(DEFAULT_AVATAR_CONFIG);
  const [draftConfig, setDraftConfig] = useState<AvatarConfig>(DEFAULT_AVATAR_CONFIG);
  const [showPicker, setShowPicker] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>("Skin");

  useEffect(() => {
    AsyncStorage.getItem(AVATAR_KEY).then((val) => {
      if (val) { try { setConfig(JSON.parse(val)); } catch {} }
    });
    api.get<{ stats: Stats }>("/profile/stats").then((res) => {
      if (res.ok) setStats(res.data.stats);
      setLoadingStats(false);
    });
  }, []);

  function openPicker() {
    setDraftConfig({ ...config });
    setShowPicker(true);
  }

  async function savePicker() {
    setConfig(draftConfig);
    await AsyncStorage.setItem(AVATAR_KEY, JSON.stringify(draftConfig));
    setShowPicker(false);
  }

  function updateDraft(key: keyof AvatarConfig, value: string) {
    setDraftConfig(prev => ({ ...prev, [key]: value }));
  }

  function handleLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  }

  function showRankInfo(rank: RankInfo) {
    Alert.alert(rank.name, rank.description);
  }

  const rank = stats ? computeRank(stats) : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar + identity */}
        <View style={styles.identityBlock}>
          <TouchableOpacity onPress={openPicker} activeOpacity={0.8}>
            <View style={styles.avatarRing}>
              <AvatarCharacter config={config} size={110} />
            </View>
            <Text style={styles.changeHint}>Tap to customize</Text>
          </TouchableOpacity>
          <Text style={styles.username}>@{user?.username}</Text>
          {rank && (
            <TouchableOpacity
              onPress={() => showRankInfo(rank)}
              style={[styles.rankBadge, { backgroundColor: rank.color + "22", borderColor: rank.color + "55" }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.rankText, { color: rank.color }]}>{rank.name}</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Career Stats */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Career Stats</Text>
          {loadingStats ? (
            <ActivityIndicator color="#4f7cff" style={{ marginVertical: 16 }} />
          ) : stats ? (
            <>
              <View style={styles.statsGrid}>
                <StatBox label="W" value={stats.regWins} color="#22c55e" />
                <StatBox label="L" value={stats.regLosses} color="#ef4444" />
                <StatBox label="Win %" value={stats.winPct + "%"} color="#4f7cff" />
                <ExperienceBox count={stats.totalLeagues} />
              </View>
              <View style={styles.divider} />
              <Text style={styles.subLabel}>Playoff Record</Text>
              <View style={styles.playoffRow}>
                <Text style={styles.playoffStat}>
                  <Text style={{ color: "#22c55e" }}>{stats.playoffWins}W</Text>
                  <Text style={{ color: "#4a5568" }}> – </Text>
                  <Text style={{ color: "#ef4444" }}>{stats.playoffLosses}L</Text>
                </Text>
              </View>
              <View style={styles.divider} />
              <Text style={styles.subLabel}>Hardware</Text>
              <View style={styles.trophyRow}>
                <TrophyBadge emoji="🏆" label="Champ" count={stats.championships} color="#f59e0b" />
                <TrophyBadge emoji="🥈" label="Runner-Up" count={stats.runnerUps} color="#9ca3af" />
                <TrophyBadge emoji="🥉" label="3rd Place" count={0} color="#cd7c32" />
              </View>
            </>
          ) : (
            <Text style={styles.noData}>No stats yet — join a league!</Text>
          )}
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Avatar Picker Modal */}
      <Modal visible={showPicker} animationType="slide" presentationStyle="pageSheet">
        <View style={modal.container}>
          <View style={modal.handle} />
          <View style={modal.topBar}>
            <TouchableOpacity onPress={() => setShowPicker(false)}>
              <Text style={modal.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={modal.title}>Customize Avatar</Text>
            <TouchableOpacity onPress={savePicker}>
              <Text style={modal.save}>Save</Text>
            </TouchableOpacity>
          </View>
          <View style={modal.preview}>
            <View style={modal.previewRing}>
              <AvatarCharacter config={draftConfig} size={140} />
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={modal.tabScroll} contentContainerStyle={modal.tabContent}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity key={cat} style={[modal.tab, activeCategory === cat && modal.tabActive]} onPress={() => setActiveCategory(cat)}>
                <Text style={[modal.tabText, activeCategory === cat && modal.tabTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView contentContainerStyle={modal.grid}>
            {activeCategory === "Skin" && (
              <View style={modal.swatchRow}>
                {SKIN_TONES.map(s => (
                  <TouchableOpacity key={s.id} style={[modal.swatch, { backgroundColor: s.color }, draftConfig.skinTone === s.id && modal.swatchSel]} onPress={() => updateDraft("skinTone", s.id)}>
                    {draftConfig.skinTone === s.id && <Text style={modal.swatchCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {activeCategory === "Hair Style" && (
              <View style={modal.chipGrid}>
                {HAIR_STYLES.map(h => (
                  <TouchableOpacity key={h.id} style={[modal.optChip, draftConfig.hairStyle === h.id && modal.optChipSel]} onPress={() => updateDraft("hairStyle", h.id)}>
                    <Text style={[modal.optChipText, draftConfig.hairStyle === h.id && modal.optChipTextSel]}>{h.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {activeCategory === "Hair Color" && (
              <View style={modal.swatchRow}>
                {HAIR_COLORS.map(h => (
                  <TouchableOpacity key={h.id} style={[modal.swatch, { backgroundColor: h.color }, draftConfig.hairColor === h.id && modal.swatchSel]} onPress={() => updateDraft("hairColor", h.id)}>
                    {draftConfig.hairColor === h.id && <Text style={[modal.swatchCheck, { color: h.color === "#DCDCDC" ? "#333" : "#fff" }]}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {activeCategory === "Hat" && (
              <View style={modal.chipGrid}>
                {HAT_OPTIONS.map(h => (
                  <TouchableOpacity key={h.id} style={[modal.hatChip, { backgroundColor: h.primary === "none" ? "#161b24" : h.primary }, draftConfig.hat === h.id && modal.hatChipSel]} onPress={() => updateDraft("hat", h.id)}>
                    <Text style={[modal.hatChipText, { color: h.text === "none" ? "#8a95a8" : h.text }]} numberOfLines={1}>{h.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {activeCategory === "Jersey" && (
              <View style={modal.swatchRow}>
                {JERSEY_COLORS.map(j => (
                  <TouchableOpacity key={j.id} style={[modal.swatch, { backgroundColor: j.color }, draftConfig.jersey === j.id && modal.swatchSel]} onPress={() => updateDraft("jersey", j.id)}>
                    {draftConfig.jersey === j.id && <Text style={modal.swatchCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {activeCategory === "Expression" && (
              <View style={modal.chipGrid}>
                {EXPRESSIONS.map(e => (
                  <TouchableOpacity key={e.id} style={[modal.optChip, draftConfig.expression === e.id && modal.optChipSel]} onPress={() => updateDraft("expression", e.id)}>
                    <Text style={[modal.optChipText, draftConfig.expression === e.id && modal.optChipTextSel]}>{e.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatBox({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ExperienceBox({ count }: { count: number }) {
  return (
    <View style={styles.statBox}>
      <View style={styles.expRow}>
        <Text style={[styles.statValue, { color: "#a78bfa" }]}>{count}</Text>
        <Text style={styles.expWord}>leagues</Text>
      </View>
      <Text style={styles.statLabel}>Experience</Text>
    </View>
  );
}

function TrophyBadge({ emoji, label, count, color }: { emoji: string; label: string; count: number; color: string }) {
  return (
    <View style={styles.trophyBadge}>
      <Text style={styles.trophyEmoji}>{emoji}</Text>
      <Text style={[styles.trophyCount, { color }]}>{count}</Text>
      <Text style={styles.trophyLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0f14" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#2a3347", backgroundColor: "#161b24" },
  back: { fontSize: 14, color: "#8a95a8", width: 50 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#e8eaf0" },
  content: { padding: 20, paddingBottom: 60 },
  identityBlock: { alignItems: "center", marginBottom: 24 },
  avatarRing: { width: 120, height: 120, borderRadius: 60, overflow: "hidden", borderWidth: 3, borderColor: "#4f7cff", marginBottom: 6 },
  changeHint: { fontSize: 11, color: "#4f7cff", textAlign: "center", marginBottom: 10 },
  username: { fontSize: 22, fontWeight: "800", color: "#e8eaf0", marginBottom: 8 },
  rankBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 8 },
  rankText: { fontSize: 13, fontWeight: "700" },
  email: { fontSize: 13, color: "#8a95a8" },
  card: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 12, fontWeight: "600", color: "#8a95a8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 },
  statsGrid: { flexDirection: "row", justifyContent: "space-around" },
  statBox: { alignItems: "center" },
  statValue: { fontSize: 26, fontWeight: "800" },
  statLabel: { fontSize: 11, color: "#8a95a8", marginTop: 2 },
  expRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  expWord: { fontSize: 14, fontWeight: "700", color: "#a78bfa" },
  divider: { height: 1, backgroundColor: "#1a2133", marginVertical: 14 },
  subLabel: { fontSize: 12, color: "#8a95a8", marginBottom: 10 },
  playoffRow: { alignItems: "center" },
  playoffStat: { fontSize: 20, fontWeight: "700", color: "#e8eaf0" },
  trophyRow: { flexDirection: "row", justifyContent: "space-around" },
  trophyBadge: { alignItems: "center" },
  trophyEmoji: { fontSize: 30, marginBottom: 4 },
  trophyCount: { fontSize: 22, fontWeight: "800" },
  trophyLabel: { fontSize: 10, color: "#8a95a8", marginTop: 2 },
  noData: { color: "#8a95a8", textAlign: "center", paddingVertical: 16 },
  signOutBtn: { backgroundColor: "#1a0d0d", borderWidth: 1, borderColor: "#7f1d1d", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
  signOutText: { color: "#ef4444", fontSize: 15, fontWeight: "700" },
});

const modal = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0f14" },
  handle: { width: 36, height: 4, backgroundColor: "#2a3347", borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#2a3347" },
  title: { fontSize: 16, fontWeight: "700", color: "#e8eaf0" },
  cancel: { fontSize: 15, color: "#8a95a8" },
  save: { fontSize: 15, color: "#4f7cff", fontWeight: "700" },
  preview: { alignItems: "center", paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: "#1a2133" },
  previewRing: { width: 148, height: 148, borderRadius: 74, overflow: "hidden", borderWidth: 3, borderColor: "#4f7cff" },
  tabScroll: { flexGrow: 0 },
  tabContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: "#1a2133", borderWidth: 1, borderColor: "#2a3347" },
  tabActive: { backgroundColor: "#4f7cff", borderColor: "#4f7cff" },
  tabText: { fontSize: 12, color: "#8a95a8", fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  grid: { padding: 16, paddingBottom: 60 },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  swatch: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  swatchSel: { borderColor: "#4f7cff", borderWidth: 3 },
  swatchCheck: { color: "#fff", fontSize: 20, fontWeight: "800" },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: "#2a3347", backgroundColor: "#161b24" },
  optChipSel: { backgroundColor: "#4f7cff", borderColor: "#4f7cff" },
  optChipText: { fontSize: 13, color: "#8a95a8", fontWeight: "600" },
  optChipTextSel: { color: "#fff" },
  hatChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: "#2a3347", minWidth: 80, alignItems: "center" },
  hatChipSel: { borderWidth: 2, borderColor: "#fff" },
  hatChipText: { fontSize: 12, fontWeight: "700" },
});
