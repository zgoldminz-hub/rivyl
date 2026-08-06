import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "../../../../src/api/client";
import Button from "../../../../src/components/Button";

interface SleeperPlayer { player_id: string; full_name: string; position: string; team: string | null; injury_status: string | null; }
interface WaiverClaim {
  id: string; addPlayerId: string; dropPlayerId: string | null; status: string;
  addPlayer?: { name: string } | null;
  dropPlayer?: { name: string } | null;
}
interface RosterSlot { id: string; playerId: string; slot: string; name?: string; position?: string; team?: string | null; }

const POS_COLORS: Record<string, string> = { QB: "#f59e0b", RB: "#22c55e", WR: "#4f7cff", TE: "#a78bfa", K: "#6b7280", DEF: "#ef4444" };
const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"];

export default function WaiversScreen() {
  const router = useRouter();
  const { id: leagueId } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<"browse" | "claims">("browse");
  const [players, setPlayers] = useState<SleeperPlayer[]>([]);
  const [claims, setClaims] = useState<WaiverClaim[]>([]);
  const [myRoster, setMyRoster] = useState<RosterSlot[]>([]);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [claimTarget, setClaimTarget] = useState<SleeperPlayer | null>(null);
  const [dropPlayerId, setDropPlayerId] = useState("");
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!leagueId) return;
    Promise.all([
      api.get<{ claims: WaiverClaim[] }>(`/waivers/${leagueId}/claims`),
      api.get<{ team: any; roster: RosterSlot[] }>(`/season/${leagueId}/my-team`),
    ]).then(([claimsRes, teamRes]) => {
      if (claimsRes.ok) setClaims(claimsRes.data.claims);
      if (teamRes.ok) setMyRoster(teamRes.data.roster);
      setLoading(false);
    });
  }, [leagueId]);

  const fetchFreeAgents = useCallback(() => {
    if (!leagueId) return;
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (position !== "ALL") params.set("position", position);
    api.get<{ players: SleeperPlayer[] }>(`/waivers/${leagueId}/available?${params}`).then((res) => {
      if (res.ok) setPlayers(res.data.players);
    });
  }, [leagueId, search, position]);

  useEffect(() => {
    const t = setTimeout(fetchFreeAgents, 300);
    return () => clearTimeout(t);
  }, [fetchFreeAgents]);

  async function submitClaim() {
    if (!claimTarget || !leagueId) return;
    setClaiming(true);
    const res = await api.post(`/waivers/${leagueId}/claim`, { addPlayerId: claimTarget.player_id, dropPlayerId: dropPlayerId || undefined });
    setClaiming(false);
    if (res.ok) {
      setClaims((prev) => [...prev, (res as any).data.claim]);
      setClaimTarget(null);
      setDropPlayerId("");
    } else {
      Alert.alert("Error", (res as any).error ?? "Failed to submit claim");
    }
  }

  async function cancelClaim(claimId: string) {
    if (!leagueId) return;
    const res = await api.del(`/waivers/${leagueId}/claims/${claimId}`);
    if (res.ok) setClaims((prev) => prev.filter((c) => c.id !== claimId));
  }

  async function dropPlayer(playerId: string) {
    Alert.alert("Drop Player", "Remove this player from your roster?", [
      { text: "Cancel", style: "cancel" },
      { text: "Drop", style: "destructive", onPress: async () => {
        const res = await api.del(`/waivers/${leagueId}/drop/${playerId}`);
        if (res.ok) setMyRoster((prev) => prev.filter((s) => s.playerId !== playerId));
      }},
    ]);
  }

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color="#4f7cff" style={{ flex: 1 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>← League</Text></TouchableOpacity>
        <Text style={styles.title}>Waivers</Text>
        <View style={{ width: 70 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === "browse" && styles.activeTab]} onPress={() => setTab("browse")}>
          <Text style={[styles.tabText, tab === "browse" && styles.activeTabText]}>Free Agents</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "claims" && styles.activeTab]} onPress={() => setTab("claims")}>
          <Text style={[styles.tabText, tab === "claims" && styles.activeTabText]}>My Claims {claims.length > 0 ? `(${claims.length})` : ""}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {tab === "browse" && (
          <>
            <TextInput style={styles.searchInput} placeholder="Search players…" placeholderTextColor="#4a5568" value={search} onChangeText={setSearch} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.posRow}>
              {POSITIONS.map((pos) => (
                <TouchableOpacity key={pos} style={[styles.posBtn, position === pos && styles.posBtnActive]} onPress={() => setPosition(pos)}>
                  <Text style={[styles.posBtnText, position === pos && styles.posBtnTextActive]}>{pos}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {players.map((p) => (
              <View key={p.player_id} style={styles.playerRow}>
                <View style={[styles.slotBadge, { backgroundColor: `${POS_COLORS[p.position] ?? "#374151"}20` }]}>
                  <Text style={[styles.slotText, { color: POS_COLORS[p.position] ?? "#6b7280" }]}>{p.position}</Text>
                </View>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{p.full_name}</Text>
                  <Text style={styles.playerMeta}>{p.team ?? "FA"}{p.injury_status ? ` · ${p.injury_status}` : ""}</Text>
                </View>
                <TouchableOpacity style={styles.claimBtn} onPress={() => { setClaimTarget(p); setDropPlayerId(""); }}>
                  <Text style={styles.claimBtnText}>Claim</Text>
                </TouchableOpacity>
              </View>
            ))}

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>My Roster — Drop Players</Text>
            {myRoster.map((s) => (
              <View key={s.id} style={styles.playerRow}>
                <View style={styles.slotBadge}><Text style={styles.slotText}>{s.slot}</Text></View>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{s.name ?? s.playerId}</Text>
                  {s.position ? <Text style={styles.playerMeta}>{s.position}{s.team ? ` · ${s.team}` : ""}</Text> : null}
                </View>
                <TouchableOpacity style={styles.dropBtn} onPress={() => dropPlayer(s.playerId)}>
                  <Text style={styles.dropBtnText}>Drop</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {tab === "claims" && (
          <>
            {claims.length === 0 ? (
              <Text style={styles.empty}>No pending claims.</Text>
            ) : claims.map((c) => (
              <View key={c.id} style={styles.claimRow}>
                <View style={styles.claimInfo}>
                  <Text style={styles.claimLabel}>Add</Text>
                  <Text style={styles.claimPlayer}>{c.addPlayer?.name ?? c.addPlayerId}</Text>
                  {c.dropPlayerId && <><Text style={styles.claimLabel}>Drop</Text><Text style={[styles.claimPlayer, { color: "#ef4444" }]}>{c.dropPlayer?.name ?? c.dropPlayerId}</Text></>}
                </View>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => cancelClaim(c.id)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Claim modal */}
      <Modal visible={!!claimTarget} transparent animationType="slide" onRequestClose={() => setClaimTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Claim {claimTarget?.full_name}</Text>
            <Text style={styles.modalSub}>{claimTarget?.position} · {claimTarget?.team ?? "FA"}</Text>
            <Text style={styles.label}>Drop a player (optional)</Text>
            <ScrollView style={styles.dropList} contentContainerStyle={{ gap: 6 }}>
              <TouchableOpacity style={[styles.dropOption, dropPlayerId === "" && styles.dropOptionActive]} onPress={() => setDropPlayerId("")}>
                <Text style={styles.dropOptionText}>— No drop —</Text>
              </TouchableOpacity>
              {myRoster.map((s) => (
                <TouchableOpacity key={s.id} style={[styles.dropOption, dropPlayerId === s.playerId && styles.dropOptionActive]} onPress={() => setDropPlayerId(s.playerId)}>
                  <Text style={styles.dropOptionText}>{s.name ?? s.playerId} ({s.slot})</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <Button variant="ghost" onPress={() => setClaimTarget(null)} style={{ flex: 1, marginRight: 8 }}>Cancel</Button>
              <Button onPress={submitClaim} loading={claiming} style={{ flex: 1 }}>Submit</Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0f14" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#2a3347", backgroundColor: "#161b24" },
  back: { fontSize: 13, color: "#8a95a8", width: 70 },
  title: { fontSize: 17, fontWeight: "700", color: "#e8eaf0" },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#2a3347" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  activeTab: { borderBottomWidth: 2, borderBottomColor: "#4f7cff" },
  tabText: { fontSize: 14, color: "#8a95a8", fontWeight: "500" },
  activeTabText: { color: "#4f7cff" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  searchInput: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: "#e8eaf0", fontSize: 14, marginBottom: 10 },
  posRow: { marginBottom: 12 },
  posBtn: { paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 6, marginRight: 6 },
  posBtnActive: { backgroundColor: "#4f7cff", borderColor: "#4f7cff" },
  posBtnText: { fontSize: 12, fontWeight: "600", color: "#8a95a8" },
  posBtnTextActive: { color: "#fff" },
  playerRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 8, marginBottom: 6 },
  slotBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, minWidth: 40, alignItems: "center", backgroundColor: "#2a3347" },
  slotText: { fontSize: 10, fontWeight: "700", color: "#8a95a8" },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 14, fontWeight: "600", color: "#e8eaf0" },
  playerMeta: { fontSize: 12, color: "#8a95a8" },
  claimBtn: { backgroundColor: "#4f7cff", borderRadius: 6, paddingHorizontal: 14, paddingVertical: 7 },
  claimBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  dropBtn: { borderWidth: 1, borderColor: "#ef4444", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  dropBtnText: { color: "#ef4444", fontSize: 13 },
  sectionTitle: { fontSize: 12, fontWeight: "600", color: "#8a95a8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  empty: { color: "#8a95a8", fontSize: 14, textAlign: "center", marginTop: 40 },
  claimRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 8, marginBottom: 8 },
  claimInfo: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", flex: 1 },
  claimLabel: { fontSize: 11, fontWeight: "600", color: "#8a95a8", textTransform: "uppercase" },
  claimPlayer: { fontSize: 13, fontWeight: "600", color: "#e8eaf0" },
  cancelBtn: { borderWidth: 1, borderColor: "#2a3347", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  cancelBtnText: { color: "#8a95a8", fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#161b24", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "80%" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#e8eaf0", marginBottom: 4 },
  modalSub: { fontSize: 13, color: "#8a95a8", marginBottom: 20 },
  label: { fontSize: 12, fontWeight: "600", color: "#8a95a8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  dropList: { maxHeight: 180, marginBottom: 16 },
  dropOption: { padding: 12, backgroundColor: "#0d0f14", borderWidth: 1, borderColor: "#2a3347", borderRadius: 8 },
  dropOptionActive: { borderColor: "#4f7cff", backgroundColor: "rgba(79,124,255,0.08)" },
  dropOptionText: { color: "#e8eaf0", fontSize: 14 },
  modalActions: { flexDirection: "row" },
});
