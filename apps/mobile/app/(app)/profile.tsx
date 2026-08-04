import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, FlatList, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../src/store/auth";
import { api } from "../../src/api/client";
import { AVATARS, AVATAR_CATEGORIES, DEFAULT_AVATAR_ID, Avatar } from "../../src/constants/avatars";

const AVATAR_KEY = "selected_avatar_id";

interface Stats {
  regWins: number;
  regLosses: number;
  playoffWins: number;
  playoffLosses: number;
  championships: number;
  runnerUps: number;
  winPct: number;
  totalLeagues: number;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [avatarId, setAvatarId] = useState(DEFAULT_AVATAR_ID);
  const [showPicker, setShowPicker] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(AVATAR_CATEGORIES[0]);

  useEffect(() => {
    AsyncStorage.getItem(AVATAR_KEY).then((val) => { if (val) setAvatarId(val); });
    api.get<{ stats: Stats }>("/profile/stats").then((res) => {
      if (res.ok) setStats(res.data.stats);
      setLoadingStats(false);
    });
  }, []);

  const selectAvatar = useCallback(async (avatar: Avatar) => {
    setAvatarId(avatar.id);
    await AsyncStorage.setItem(AVATAR_KEY, avatar.id);
    setShowPicker(false);
  }, []);

  const currentAvatar = AVATARS.find((a) => a.id === avatarId) ?? AVATARS[0];
  const filtered = AVATARS.filter((a) => a.category === activeCategory);

  function handleLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  }

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
        <View style={styles.identityBlock}>
          <TouchableOpacity onPress={() => setShowPicker(true)} activeOpacity={0.8}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarEmoji}>{currentAvatar.emoji}</Text>
            </View>
            <Text style={styles.changeAvatarHint}>Tap to change</Text>
          </TouchableOpacity>
          <Text style={styles.username}>@{user?.username}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

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
                <StatBox label="Leagues" value={stats.totalLeagues} color="#a78bfa" />
              </View>
              <View style={styles.divider} />
              <Text style={styles.subLabel}>Playoff Record</Text>
              <View style={styles.playoffRow}>
                <Text style={styles.playoffStat}>
                  <Text style={{ color: "#22c55e" }}>{stats.playoffWins}W</Text>
                  <Text style={{ color: "#8a95a8" }}> – </Text>
                  <Text style={{ color: "#ef4444" }}>{stats.playoffLosses}L</Text>
                </Text>
              </View>
              <View style={styles.divider} />
              <Text style={styles.subLabel}>Hardware</Text>
              <View style={styles.trophyRow}>
                <TrophyBadge emoji="🏆" label="Championships" count={stats.championships} color="#f59e0b" />
                <TrophyBadge emoji="🥈" label="Runner-Up" count={stats.runnerUps} color="#9ca3af" />
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

      <Modal visible={showPicker} animationType="slide" presentationStyle="pageSheet">
        <View style={modal.container}>
          <View style={modal.handle} />
          <View style={modal.topBar}>
            <Text style={modal.title}>Choose Avatar</Text>
            <TouchableOpacity onPress={() => setShowPicker(false)}>
              <Text style={modal.close}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={modal.tabs} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10 }}>
            {AVATAR_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[modal.tab, activeCategory === cat && modal.tabActive]}
                onPress={() => setActiveCategory(cat)}
              >
                <Text style={[modal.tabText, activeCategory === cat && modal.tabTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            numColumns={4}
            contentContainerStyle={modal.grid}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[modal.avatarCell, avatarId === item.id && modal.avatarSelected]}
                onPress={() => selectAvatar(item)}
                activeOpacity={0.7}
              >
                <Text style={modal.cellEmoji}>{item.emoji}</Text>
                <Text style={modal.cellLabel} numberOfLines={2}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
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
  avatarCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: "#1e2535", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#4f7cff", marginBottom: 6 },
  avatarEmoji: { fontSize: 44 },
  changeAvatarHint: { fontSize: 11, color: "#4f7cff", textAlign: "center", marginBottom: 10 },
  username: { fontSize: 22, fontWeight: "800", color: "#e8eaf0", marginBottom: 4 },
  email: { fontSize: 13, color: "#8a95a8" },
  card: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 12, fontWeight: "600", color: "#8a95a8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 },
  statsGrid: { flexDirection: "row", justifyContent: "space-around" },
  statBox: { alignItems: "center" },
  statValue: { fontSize: 28, fontWeight: "800" },
  statLabel: { fontSize: 11, color: "#8a95a8", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#1a2133", marginVertical: 14 },
  subLabel: { fontSize: 12, color: "#8a95a8", marginBottom: 10 },
  playoffRow: { alignItems: "center" },
  playoffStat: { fontSize: 20, fontWeight: "700", color: "#e8eaf0" },
  trophyRow: { flexDirection: "row", justifyContent: "space-around" },
  trophyBadge: { alignItems: "center" },
  trophyEmoji: { fontSize: 32, marginBottom: 4 },
  trophyCount: { fontSize: 24, fontWeight: "800" },
  trophyLabel: { fontSize: 11, color: "#8a95a8", marginTop: 2 },
  noData: { color: "#8a95a8", textAlign: "center", paddingVertical: 16 },
  signOutBtn: { backgroundColor: "#1a0d0d", borderWidth: 1, borderColor: "#7f1d1d", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
  signOutText: { color: "#ef4444", fontSize: 15, fontWeight: "700" },
});

const modal = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0f14" },
  handle: { width: 36, height: 4, backgroundColor: "#2a3347", borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#2a3347" },
  title: { fontSize: 17, fontWeight: "700", color: "#e8eaf0" },
  close: { fontSize: 15, color: "#4f7cff", fontWeight: "600" },
  tabs: { flexGrow: 0 },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, marginRight: 8, backgroundColor: "#1a2133", borderWidth: 1, borderColor: "#2a3347" },
  tabActive: { backgroundColor: "#4f7cff", borderColor: "#4f7cff" },
  tabText: { fontSize: 12, color: "#8a95a8", fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  grid: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 40 },
  avatarCell: { flex: 1, margin: 6, padding: 10, backgroundColor: "#161b24", borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "#2a3347" },
  avatarSelected: { borderColor: "#4f7cff", backgroundColor: "#1a2640" },
  cellEmoji: { fontSize: 32, marginBottom: 4 },
  cellLabel: { fontSize: 10, color: "#8a95a8", textAlign: "center", lineHeight: 13 },
});
