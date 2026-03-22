import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
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

export default function DiscoverScreen() {
  const router = useRouter();
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Discover Leagues</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Invite code */}
        <View style={styles.inviteBox}>
          <Text style={styles.sectionLabel}>Have an invite code?</Text>
          <View style={styles.inviteRow}>
            <TextInput
              style={styles.inviteInput}
              placeholder="Paste invite code…"
              placeholderTextColor="#4a5568"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.goBtn} onPress={handleJoinCode}>
              <Text style={styles.goBtnText}>Go →</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Public Leagues</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search leagues…"
          placeholderTextColor="#4a5568"
          value={search}
          onChangeText={setSearch}
        />

        {loading ? (
          <ActivityIndicator color="#4f7cff" style={{ marginTop: 24 }} />
        ) : filtered.length === 0 ? (
          <Text style={styles.empty}>No public leagues found.</Text>
        ) : filtered.map((league) => (
          <TouchableOpacity
            key={league.id}
            style={styles.leagueCard}
            onPress={() => router.push(`/(app)/league/${league.id}` as any)}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.leagueName}>{league.name}</Text>
              <Text style={styles.buyIn}>${league.buyIn}</Text>
            </View>
            <Text style={styles.meta}>
              {league.memberCount}/{league.maxTeams} teams · {league.scoringType === "FULL_PPR" ? "Full PPR" : "Half PPR"} · {league.draftType === "SNAKE" ? "Snake" : "Auction"}
            </Text>
            <Text style={styles.joinHint}>Tap to view & join →</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0f14" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#2a3347", backgroundColor: "#161b24" },
  back: { fontSize: 14, color: "#8a95a8", width: 60 },
  title: { fontSize: 17, fontWeight: "700", color: "#e8eaf0" },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  inviteBox: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 12, padding: 16, marginBottom: 24 },
  sectionLabel: { fontSize: 12, fontWeight: "600", color: "#8a95a8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  inviteRow: { flexDirection: "row", gap: 10 },
  inviteInput: { flex: 1, backgroundColor: "#0d0f14", borderWidth: 1, borderColor: "#2a3347", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: "#e8eaf0", fontSize: 14 },
  goBtn: { backgroundColor: "#4f7cff", borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" },
  goBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  searchInput: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: "#e8eaf0", fontSize: 14, marginBottom: 12 },
  empty: { color: "#8a95a8", fontSize: 14, marginTop: 20, textAlign: "center" },
  leagueCard: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 12, padding: 16, marginBottom: 10 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  leagueName: { fontSize: 15, fontWeight: "700", color: "#e8eaf0" },
  buyIn: { fontSize: 15, fontWeight: "700", color: "#4f7cff" },
  meta: { fontSize: 12, color: "#8a95a8", marginBottom: 8 },
  joinHint: { fontSize: 12, color: "#4f7cff" },
});
