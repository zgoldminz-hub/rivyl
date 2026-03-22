import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "../../../src/api/client";

interface LeagueDetail {
  id: string;
  name: string;
  status: string;
  buyIn: number;
  maxTeams: number;
  memberCount: number;
  scoringType: string;
  draftType: string;
  visibility: string;
  isMember: boolean;
  isCommissioner?: boolean;
  inviteCode: string;
  teams: { id: string; name: string; username: string; paid: boolean; isCommissioner: boolean }[];
}

const STATUS_COLOR: Record<string, string> = {
  SETUP: "#6b7280", DRAFTING: "#f59e0b", ACTIVE: "#22c55e", PLAYOFFS: "#a78bfa", COMPLETE: "#374151",
};

export default function LeagueScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [league, setLeague] = useState<LeagueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get<{ league: LeagueDetail }>(`/leagues/${id}`).then((res) => {
      if (res.ok) setLeague(res.data.league);
      else setError((res as any).error ?? "Failed to load league");
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color="#4f7cff" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (error || !league) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? "League not found"}</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>← Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isActive = league.status === "ACTIVE" || league.status === "PLAYOFFS";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{league.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLOR[league.status]}22` }]}>
          <Text style={[styles.statusText, { color: STATUS_COLOR[league.status] }]}>{league.status}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Settings */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Settings</Text>
          <Row label="Buy-In" value={`$${league.buyIn}`} highlight />
          <Row label="Teams" value={`${league.memberCount} / ${league.maxTeams}`} />
          <Row label="Scoring" value={league.scoringType === "FULL_PPR" ? "Full PPR" : "Half PPR"} />
          <Row label="Draft" value={league.draftType === "SNAKE" ? "Snake" : "Auction ($200)"} />
          <Row label="Visibility" value={league.visibility === "PUBLIC" ? "Public" : "Private"} />
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {league.status === "DRAFTING" && league.isMember && (
            <NavButton label="Enter Draft Room →" onPress={() => router.push(`/(app)/league/${id}/draft` as any)} primary />
          )}
          {isActive && league.isMember && (
            <>
              <NavButton label="Standings" onPress={() => router.push(`/(app)/league/${id}/standings` as any)} />
              <NavButton label="My Team" onPress={() => router.push(`/(app)/league/${id}/my-team` as any)} primary />
              <NavButton label="Waiver Wire" onPress={() => router.push(`/(app)/league/${id}/waivers` as any)} />
              <NavButton label="Trades" onPress={() => router.push(`/(app)/league/${id}/trades` as any)} />
              {league.status === "PLAYOFFS" && (
                <NavButton label="🏆 Playoff Bracket" onPress={() => router.push(`/(app)/league/${id}/bracket` as any)} />
              )}
            </>
          )}
          {league.isCommissioner && (
            <NavButton label="⚙ Commissioner Panel" onPress={() => router.push(`/(app)/league/${id}/commissioner` as any)} />
          )}
        </View>

        {/* Teams */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Teams ({league.memberCount}/{league.maxTeams})</Text>
          {league.teams?.map((team) => (
            <View key={team.id} style={styles.teamRow}>
              <View>
                <Text style={styles.teamName}>{team.name}</Text>
                <Text style={styles.teamUser}>@{team.username}</Text>
              </View>
              <View style={styles.teamBadges}>
                {team.isCommissioner && <Text style={styles.commBadge}>Comm.</Text>}
                <Text style={[styles.paidBadge, { color: team.paid ? "#22c55e" : "#ef4444", backgroundColor: team.paid ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" }]}>
                  {team.paid ? "Paid" : "Pending"}
                </Text>
              </View>
            </View>
          ))}
          {Array.from({ length: league.maxTeams - league.memberCount }).map((_, i) => (
            <View key={`empty-${i}`} style={[styles.teamRow, { opacity: 0.3 }]}>
              <Text style={{ color: "#8a95a8", fontSize: 14 }}>Open slot</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, highlight && rowStyles.highlight]}>{value}</Text>
    </View>
  );
}

function NavButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <TouchableOpacity style={[navStyles.btn, primary && navStyles.primary]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[navStyles.text, primary && navStyles.textPrimary]}>{label}</Text>
    </TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1a2133" },
  label: { fontSize: 13, color: "#8a95a8" },
  value: { fontSize: 13, color: "#e8eaf0", fontWeight: "500" },
  highlight: { color: "#4f7cff", fontWeight: "700" },
});

const navStyles = StyleSheet.create({
  btn: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 10, padding: 14, marginBottom: 8 },
  primary: { backgroundColor: "#4f7cff", borderColor: "#4f7cff" },
  text: { fontSize: 15, color: "#e8eaf0", fontWeight: "600", textAlign: "center" },
  textPrimary: { color: "#fff" },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0f14" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#2a3347", backgroundColor: "#161b24" },
  back: { fontSize: 14, color: "#8a95a8", width: 60 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#e8eaf0", flex: 1, textAlign: "center" },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, minWidth: 60, alignItems: "center" },
  statusText: { fontSize: 11, fontWeight: "700" },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: "#8a95a8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  actions: { marginBottom: 16 },
  teamRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1a2133" },
  teamName: { fontSize: 14, fontWeight: "600", color: "#e8eaf0" },
  teamUser: { fontSize: 12, color: "#8a95a8" },
  teamBadges: { flexDirection: "row", gap: 6, alignItems: "center" },
  commBadge: { fontSize: 11, color: "#f59e0b", backgroundColor: "rgba(245,158,11,0.12)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  paidBadge: { fontSize: 11, fontWeight: "600", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#ef4444", fontSize: 15, marginBottom: 16 },
  backLink: { color: "#4f7cff", fontSize: 14 },
});
