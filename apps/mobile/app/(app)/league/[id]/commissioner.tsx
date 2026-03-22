import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "../../../../src/api/client";
import Button from "../../../../src/components/Button";

interface PanelData {
  league: { id: string; name: string; status: string; inviteCode: string; payoutPreset: string };
  teams: { id: string; name: string; username: string; paid: boolean }[];
  standings: { teamName: string; wins: number; losses: number; pointsFor: number }[];
  payoutPreview: { place: number; teamName: string | null; amount: number }[];
  prizePool: number;
  payouts: { id: string; createdAt: string; amountCents: number; status: string }[];
}

export default function CommissionerScreen() {
  const router = useRouter();
  const { id: leagueId } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [sending, setSending] = useState(false);
  const [issuingPayout, setIssuingPayout] = useState(false);

  useEffect(() => {
    if (!leagueId) return;
    api.get<PanelData>(`/commissioner/${leagueId}/panel`).then((res) => {
      if (res.ok) setData(res.data as any);
      setLoading(false);
    });
  }, [leagueId]);

  async function sendNotification() {
    if (!leagueId || !notifTitle.trim() || !notifBody.trim()) return;
    setSending(true);
    const res = await api.post(`/commissioner/${leagueId}/notify`, { title: notifTitle, body: notifBody });
    setSending(false);
    if (res.ok) {
      setNotifTitle("");
      setNotifBody("");
      Alert.alert("Sent", "Notification sent to all members.");
    } else {
      Alert.alert("Error", (res as any).error ?? "Failed to send");
    }
  }

  async function issuePayout() {
    if (!leagueId) return;
    Alert.alert("Issue Payouts", "This will distribute prizes to the winners. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Issue", style: "destructive", onPress: async () => {
        setIssuingPayout(true);
        const res = await api.post(`/commissioner/${leagueId}/trigger-payouts`, {});
        setIssuingPayout(false);
        if (res.ok) Alert.alert("Success", "Payouts issued successfully!");
        else Alert.alert("Error", (res as any).error ?? "Failed to issue payouts");
      }},
    ]);
  }

  if (loading || !data) return <SafeAreaView style={styles.safe}><ActivityIndicator color="#4f7cff" style={{ flex: 1 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>← League</Text></TouchableOpacity>
        <Text style={styles.title}>Commissioner Panel</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Members */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Members</Text>
          {data.teams.map((t) => (
            <View key={t.id} style={styles.teamRow}>
              <View>
                <Text style={styles.teamName}>{t.name}</Text>
                <Text style={styles.teamUser}>@{t.username}</Text>
              </View>
              <Text style={[styles.paidBadge, { color: t.paid ? "#22c55e" : "#ef4444" }]}>
                {t.paid ? "Paid" : "Pending"}
              </Text>
            </View>
          ))}
        </View>

        {/* Prize Pool */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Prize Pool — ${(data.prizePool / 100).toFixed(2)}</Text>
          {data.payoutPreview.map((p) => (
            <View key={p.place} style={styles.payoutRow}>
              <Text style={styles.payoutPlace}>{p.place === 1 ? "🥇" : p.place === 2 ? "🥈" : "🥉"} {["1st", "2nd", "3rd"][p.place - 1]} Place</Text>
              <View style={{ alignItems: "flex-end" }}>
                {p.teamName && <Text style={styles.payoutTeam}>{p.teamName}</Text>}
                <Text style={styles.payoutAmount}>${(p.amount / 100).toFixed(2)}</Text>
              </View>
            </View>
          ))}
          <Button
            onPress={issuePayout}
            loading={issuingPayout}
            disabled={data.league.status !== "PLAYOFFS" && data.league.status !== "COMPLETE"}
            style={{ marginTop: 12 }}
          >
            Issue Payouts
          </Button>
        </View>

        {/* Message all members */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Message All Members</Text>
          <TextInput
            style={styles.input}
            placeholder="Notification title…"
            placeholderTextColor="#4a5568"
            value={notifTitle}
            onChangeText={setNotifTitle}
          />
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Message body…"
            placeholderTextColor="#4a5568"
            value={notifBody}
            onChangeText={setNotifBody}
            multiline
            numberOfLines={3}
          />
          <Button onPress={sendNotification} loading={sending} disabled={!notifTitle.trim() || !notifBody.trim()}>
            Send Notification
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0f14" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#2a3347", backgroundColor: "#161b24" },
  back: { fontSize: 13, color: "#8a95a8", width: 70 },
  title: { fontSize: 16, fontWeight: "700", color: "#e8eaf0" },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 13, fontWeight: "600", color: "#8a95a8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  teamRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1a2133" },
  teamName: { fontSize: 14, fontWeight: "600", color: "#e8eaf0" },
  teamUser: { fontSize: 12, color: "#8a95a8" },
  paidBadge: { fontSize: 12, fontWeight: "600" },
  payoutRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1a2133" },
  payoutPlace: { fontSize: 14, color: "#e8eaf0", fontWeight: "600" },
  payoutTeam: { fontSize: 12, color: "#8a95a8", marginBottom: 2 },
  payoutAmount: { fontSize: 15, fontWeight: "700", color: "#22c55e" },
  input: { backgroundColor: "#0d0f14", borderWidth: 1, borderColor: "#2a3347", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: "#e8eaf0", fontSize: 14, marginBottom: 10 },
  textarea: { minHeight: 80, textAlignVertical: "top" },
});
