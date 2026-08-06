import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api } from "../../src/api/client";

interface League {
  id: string;
  name: string;
  status: string;
  buyIn: number;
  maxTeams: number;
  memberCount: number;
  scoringType: string;
  draftType: string;
}

const DARK = {
  bg: "#0d0f14", surface: "#161b24", border: "#2a3347",
  text: "#e8eaf0", sub: "#8a95a8", muted: "#4a5568", accent: "#4f7cff",
  inputBg: "#161b24",
};
const LIGHT = {
  bg: "#f4f6fb", surface: "#ffffff", border: "#e2e8f0",
  text: "#111827", sub: "#64748b", muted: "#94a3b8", accent: "#4f7cff",
  inputBg: "#ffffff",
};

function useTheme() {
  const scheme = useColorScheme();
  return scheme === "dark" ? DARK : LIGHT;
}

export default function DiscoverScreen() {
  const router = useRouter();
  const C = useTheme();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [search, setSearch] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ leagues: League[] }>("/leagues?limit=20").then((res) => {
      if (res.ok) setLeagues(res.data.leagues);
      setLoading(false);
    });
  }, []);

  const filtered = leagues.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));

  function handleJoinCode() {
    if (!inviteCode.trim()) return;
    router.push(`/(app)/league/${inviteCode.trim()}` as any);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>
      <View style={[styles.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.back, { color: C.sub }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: C.text }]}>Discover Leagues</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={[styles.inviteBox, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.sectionLabel, { color: C.sub }]}>Have an invite code?</Text>
          <View style={styles.inviteRow}>
            <TextInput
              style={[styles.inviteInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
              placeholder="Paste invite code…"
              placeholderTextColor={C.muted}
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="none"
            />
            <TouchableOpacity style={[styles.goBtn, { backgroundColor: C.accent }]} onPress={handleJoinCode}>
              <Text style={styles.goBtnText}>Go →</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: C.sub }]}>Public Leagues</Text>
        <TextInput
          style={[styles.searchInput, { backgroundColor: C.surface, borderColor: C.border, color: C.text }]}
          placeholder="Search leagues…"
          placeholderTextColor={C.muted}
          value={search}
          onChangeText={setSearch}
        />

        {loading ? (
          <ActivityIndicator color={C.accent} style={{ marginTop: 24 }} />
        ) : filtered.length === 0 ? (
          <Text style={[styles.empty, { color: C.sub }]}>No public leagues found.</Text>
        ) : filtered.map((league) => (
          <TouchableOpacity
            key={league.id}
            style={[styles.leagueCard, { backgroundColor: C.surface, borderColor: C.border }]}
            onPress={() => router.push(`/(app)/league/${league.id}` as any)}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.leagueName, { color: C.text }]}>{league.name}</Text>
              <Text style={[styles.buyIn, { color: C.accent }]}>${league.buyIn}</Text>
            </View>
            <Text style={[styles.meta, { color: C.sub }]}>
              {league.memberCount}/{league.maxTeams} teams · {league.scoringType === "FULL_PPR" ? "Full PPR" : "Half PPR"} · {league.draftType === "SNAKE" ? "Snake" : "Auction"}
            </Text>
            <Text style={[styles.joinHint, { color: C.accent }]}>Tap to view & join →</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  back: { fontSize: 14, width: 60 },
  title: { fontSize: 17, fontWeight: "700" },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  inviteBox: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 24 },
  sectionLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  inviteRow: { flexDirection: "row", gap: 10 },
  inviteInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  goBtn: { borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" },
  goBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  searchInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 12 },
  empty: { fontSize: 14, marginTop: 20, textAlign: "center" },
  leagueCard: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 10 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  leagueName: { fontSize: 15, fontWeight: "700" },
  buyIn: { fontSize: 15, fontWeight: "700" },
  meta: { fontSize: 12, marginBottom: 8 },
  joinHint: { fontSize: 12 },
});
