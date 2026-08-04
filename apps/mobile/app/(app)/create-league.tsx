import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api } from "../../src/api/client";

const TEAM_OPTIONS = [4, 6, 8, 10, 12];
const BUY_IN_OPTIONS = [
  { label: "Free", value: 0 },
  { label: "$10", value: 1000 },
  { label: "$25", value: 2500 },
  { label: "$50", value: 5000 },
  { label: "$100", value: 10000 },
];
const SCORING_OPTIONS = [
  { label: "Half PPR", value: "HALF_PPR" },
  { label: "Full PPR", value: "FULL_PPR" },
];
const DRAFT_OPTIONS = [
  { label: "Snake", value: "SNAKE" },
  { label: "Auction ($200)", value: "AUCTION" },
];
const PAYOUT_OPTIONS = [
  { label: "Winner Takes All", value: "WINNER_TAKES_ALL" },
  { label: "Top 2 (70/30)", value: "TOP_TWO" },
  { label: "Top 3 (60/25/15)", value: "TOP_THREE" },
];
const VISIBILITY_OPTIONS = [
  { label: "Private", value: "PRIVATE" },
  { label: "Public", value: "PUBLIC" },
];

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, selected && styles.chipSelected]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function CreateLeagueScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [maxTeams, setMaxTeams] = useState(10);
  const [buyIn, setBuyIn] = useState(0);
  const [scoringType, setScoringType] = useState("HALF_PPR");
  const [draftType, setDraftType] = useState("SNAKE");
  const [payoutPreset, setPayoutPreset] = useState("WINNER_TAKES_ALL");
  const [visibility, setVisibility] = useState("PRIVATE");
  const [loading, setLoading] = useState(false);

  const potTotal = (buyIn / 100) * maxTeams;
  const prizePool = Math.floor(potTotal * 0.95);

  async function handleCreate() {
    if (!name.trim()) { Alert.alert("Missing Name", "Please enter a league name."); return; }
    if (buyIn > 0) {
      Alert.alert(
        "Paid Leagues",
        "Paid league buy-ins are processed on rivyl.com. Your league will be created — members can pay on web before the draft.",
        [{ text: "Create Anyway", onPress: submit }, { text: "Cancel", style: "cancel" }]
      );
      return;
    }
    await submit();
  }

  async function submit() {
    setLoading(true);
    const res = await api.post<{ league: { id: string } }>("/leagues", {
      name: name.trim(), maxTeams, buyIn, scoringType, draftType, payoutPreset, visibility,
    });
    setLoading(false);
    if (!res.ok) { Alert.alert("Error", (res as any).error ?? "Failed to create league"); return; }
    router.replace(("/(app)/league/" + res.data.league.id) as any);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create League</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>League Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Bulldog HOF"
            placeholderTextColor="#4a5568"
            maxLength={40}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Number of Teams</Text>
          <View style={styles.chips}>
            {TEAM_OPTIONS.map((n) => (
              <Chip key={n} label={String(n)} selected={maxTeams === n} onPress={() => setMaxTeams(n)} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Scoring</Text>
          <View style={styles.chips}>
            {SCORING_OPTIONS.map((o) => (
              <Chip key={o.value} label={o.label} selected={scoringType === o.value} onPress={() => setScoringType(o.value)} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Draft Type</Text>
          <View style={styles.chips}>
            {DRAFT_OPTIONS.map((o) => (
              <Chip key={o.value} label={o.label} selected={draftType === o.value} onPress={() => setDraftType(o.value)} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Buy-In</Text>
          <View style={styles.chips}>
            {BUY_IN_OPTIONS.map((o) => (
              <Chip key={o.value} label={o.label} selected={buyIn === o.value} onPress={() => setBuyIn(o.value)} />
            ))}
          </View>
        </View>

        {buyIn > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Payout Structure</Text>
            <View style={styles.chips}>
              {PAYOUT_OPTIONS.map((o) => (
                <Chip key={o.value} label={o.label} selected={payoutPreset === o.value} onPress={() => setPayoutPreset(o.value)} />
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Visibility</Text>
          <View style={styles.chips}>
            {VISIBILITY_OPTIONS.map((o) => (
              <Chip key={o.value} label={o.label} selected={visibility === o.value} onPress={() => setVisibility(o.value)} />
            ))}
          </View>
        </View>

        {buyIn > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Prize Pool Estimate</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Pot</Text>
              <Text style={styles.summaryValue}>${potTotal.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>After 5% fee</Text>
              <Text style={[styles.summaryValue, { color: "#4f7cff" }]}>${prizePool.toLocaleString()}</Text>
            </View>
            <Text style={styles.paidNote}>Paid buy-ins are processed on rivyl.com</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.createBtn, loading && { opacity: 0.6 }]} onPress={handleCreate} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Create League</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0f14" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#2a3347", backgroundColor: "#161b24" },
  back: { fontSize: 14, color: "#8a95a8", width: 50 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#e8eaf0" },
  content: { padding: 20, paddingBottom: 60 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 12, fontWeight: "600", color: "#8a95a8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  input: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 10, padding: 14, color: "#e8eaf0", fontSize: 15 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#2a3347", backgroundColor: "#161b24" },
  chipSelected: { backgroundColor: "#4f7cff", borderColor: "#4f7cff" },
  chipText: { fontSize: 13, color: "#8a95a8", fontWeight: "600" },
  chipTextSelected: { color: "#fff" },
  summaryCard: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 12, padding: 16, marginBottom: 24 },
  summaryTitle: { fontSize: 12, fontWeight: "600", color: "#8a95a8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  summaryLabel: { fontSize: 13, color: "#8a95a8" },
  summaryValue: { fontSize: 13, fontWeight: "700", color: "#e8eaf0" },
  paidNote: { fontSize: 11, color: "#f59e0b", marginTop: 10 },
  createBtn: { backgroundColor: "#4f7cff", borderRadius: 12, padding: 16, alignItems: "center" },
  createBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
