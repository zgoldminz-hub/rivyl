import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api } from "../../src/api/client";

const TEAM_OPTIONS = [4, 6, 8, 10, 12];
const BUY_IN_OPTIONS = [
  { label: "Free", value: 0 },
  { label: "$10", value: 10 },
  { label: "$25", value: 25 },
  { label: "$50", value: 50 },
  { label: "$100", value: 100 },
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

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const C = useTheme();
  return (
    <TouchableOpacity
      style={[styles.chip, { backgroundColor: C.surface, borderColor: C.border }, selected && { backgroundColor: C.accent, borderColor: C.accent }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, { color: selected ? "#fff" : C.sub }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function CreateLeagueScreen() {
  const router = useRouter();
  const C = useTheme();
  const [name, setName] = useState("");
  const [maxTeams, setMaxTeams] = useState(10);
  const [buyIn, setBuyIn] = useState(0);
  const [scoringType, setScoringType] = useState("HALF_PPR");
  const [draftType, setDraftType] = useState("SNAKE");
  const [payoutPreset, setPayoutPreset] = useState("WINNER_TAKES_ALL");
  const [visibility, setVisibility] = useState("PRIVATE");
  const [loading, setLoading] = useState(false);

  const potTotal = buyIn * maxTeams;
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
    <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>
      <View style={[styles.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.back, { color: C.sub }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.text }]}>Create League</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: C.sub }]}>League Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Bulldog HOF"
            placeholderTextColor={C.muted}
            maxLength={40}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: C.sub }]}>Number of Teams</Text>
          <View style={styles.chips}>
            {TEAM_OPTIONS.map((n) => (
              <Chip key={n} label={String(n)} selected={maxTeams === n} onPress={() => setMaxTeams(n)} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: C.sub }]}>Scoring</Text>
          <View style={styles.chips}>
            {SCORING_OPTIONS.map((o) => (
              <Chip key={o.value} label={o.label} selected={scoringType === o.value} onPress={() => setScoringType(o.value)} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: C.sub }]}>Draft Type</Text>
          <View style={styles.chips}>
            {DRAFT_OPTIONS.map((o) => (
              <Chip key={o.value} label={o.label} selected={draftType === o.value} onPress={() => setDraftType(o.value)} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: C.sub }]}>Buy-In</Text>
          <View style={styles.chips}>
            {BUY_IN_OPTIONS.map((o) => (
              <Chip key={o.value} label={o.label} selected={buyIn === o.value} onPress={() => setBuyIn(o.value)} />
            ))}
          </View>
        </View>

        {buyIn > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: C.sub }]}>Payout Structure</Text>
            <View style={styles.chips}>
              {PAYOUT_OPTIONS.map((o) => (
                <Chip key={o.value} label={o.label} selected={payoutPreset === o.value} onPress={() => setPayoutPreset(o.value)} />
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: C.sub }]}>Visibility</Text>
          <View style={styles.chips}>
            {VISIBILITY_OPTIONS.map((o) => (
              <Chip key={o.value} label={o.label} selected={visibility === o.value} onPress={() => setVisibility(o.value)} />
            ))}
          </View>
        </View>

        {buyIn > 0 && (
          <View style={[styles.summaryCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[styles.summaryTitle, { color: C.sub }]}>Prize Pool Estimate</Text>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: C.sub }]}>Total Pot</Text>
              <Text style={[styles.summaryValue, { color: C.text }]}>${potTotal.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: C.sub }]}>After 5% fee</Text>
              <Text style={[styles.summaryValue, { color: C.accent }]}>${prizePool.toLocaleString()}</Text>
            </View>
            <Text style={styles.paidNote}>Paid buy-ins are processed on rivyl.com</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: C.accent }, loading && { opacity: 0.6 }]}
          onPress={handleCreate}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Create League</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  back: { fontSize: 14, width: 50 },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  content: { padding: 20, paddingBottom: 60 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: "600" },
  summaryCard: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 24 },
  summaryTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 13, fontWeight: "700" },
  paidNote: { fontSize: 11, color: "#f59e0b", marginTop: 10 },
  createBtn: { borderRadius: 12, padding: 16, alignItems: "center" },
  createBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
