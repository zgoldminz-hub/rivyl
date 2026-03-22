import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "../../../../src/api/client";

interface TradeItem { id: string; fromTeamId: string; playerId: string; }
interface Trade {
  id: string; status: string; note: string | null; createdAt: string;
  proposingTeam: { id: string; name: string };
  receivingTeam: { id: string; name: string };
  items: TradeItem[];
}

const STATUS_COLOR: Record<string, string> = { PENDING: "#f59e0b", ACCEPTED: "#22c55e", REJECTED: "#ef4444", CANCELLED: "#6b7280" };

export default function TradesScreen() {
  const router = useRouter();
  const { id: leagueId } = useLocalSearchParams<{ id: string }>();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [myTeamId, setMyTeamId] = useState("");
  const [tab, setTab] = useState<"active" | "history">("active");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId) return;
    api.get<{ trades: Trade[]; myTeamId: string }>(`/trades/${leagueId}`).then((res) => {
      if (res.ok) { setTrades(res.data.trades); setMyTeamId(res.data.myTeamId); }
      setLoading(false);
    });
  }, [leagueId]);

  async function respondToTrade(tradeId: string, action: "accept" | "reject") {
    if (!leagueId) return;
    const label = action === "accept" ? "Accept" : "Reject";
    Alert.alert(`${label} Trade`, `Are you sure you want to ${action} this trade?`, [
      { text: "Cancel", style: "cancel" },
      { text: label, style: action === "reject" ? "destructive" : "default", onPress: async () => {
        const res = action === "accept"
          ? await api.post(`/trades/${leagueId}/${tradeId}/accept`, {})
          : await api.post(`/trades/${leagueId}/${tradeId}/reject`, {});
        if (res.ok) {
          setTrades((prev) => prev.map((t) => t.id === tradeId ? { ...t, status: action === "accept" ? "ACCEPTED" : "REJECTED" } : t));
        }
      }},
    ]);
  }

  async function cancelTrade(tradeId: string) {
    if (!leagueId) return;
    const res = await api.del(`/trades/${leagueId}/${tradeId}`);
    if (res.ok) setTrades((prev) => prev.map((t) => t.id === tradeId ? { ...t, status: "CANCELLED" } : t));
  }

  const activeTrades = trades.filter((t) => t.status === "PENDING");
  const historyTrades = trades.filter((t) => t.status !== "PENDING");
  const displayed = tab === "active" ? activeTrades : historyTrades;

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color="#4f7cff" style={{ flex: 1 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>← League</Text></TouchableOpacity>
        <Text style={styles.title}>Trades</Text>
        <View style={{ width: 70 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === "active" && styles.activeTab]} onPress={() => setTab("active")}>
          <Text style={[styles.tabText, tab === "active" && styles.activeTabText]}>Active {activeTrades.length > 0 ? `(${activeTrades.length})` : ""}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "history" && styles.activeTab]} onPress={() => setTab("history")}>
          <Text style={[styles.tabText, tab === "history" && styles.activeTabText]}>History</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {displayed.length === 0 ? (
          <Text style={styles.empty}>{tab === "active" ? "No active trades." : "No trade history."}</Text>
        ) : displayed.map((trade) => {
          const isProposer = trade.proposingTeam.id === myTeamId;
          const isReceiver = trade.receivingTeam.id === myTeamId;
          const offered = trade.items.filter((i) => i.fromTeamId === trade.proposingTeam.id);
          const requested = trade.items.filter((i) => i.fromTeamId === trade.receivingTeam.id);
          const statusColor = STATUS_COLOR[trade.status] ?? "#6b7280";

          return (
            <View key={trade.id} style={styles.tradeCard}>
              <View style={styles.tradeHeader}>
                <Text style={styles.tradeTeams}>{trade.proposingTeam.name} ↔ {trade.receivingTeam.name}</Text>
                <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>{trade.status}</Text>
                </View>
              </View>

              <View style={styles.tradePlayers}>
                <View style={styles.tradeCol}>
                  <Text style={styles.colLabel}>{trade.proposingTeam.name} sends</Text>
                  {offered.map((i) => <Text key={i.id} style={styles.tradePill}>{i.playerId}</Text>)}
                </View>
                <View style={styles.tradeCol}>
                  <Text style={styles.colLabel}>{trade.receivingTeam.name} sends</Text>
                  {requested.map((i) => <Text key={i.id} style={styles.tradePill}>{i.playerId}</Text>)}
                </View>
              </View>

              {trade.note ? <Text style={styles.tradeNote}>"{trade.note}"</Text> : null}

              {trade.status === "PENDING" && (
                <View style={styles.tradeActions}>
                  {isReceiver && (
                    <>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => respondToTrade(trade.id, "accept")}>
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => respondToTrade(trade.id, "reject")}>
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {isProposer && (
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => cancelTrade(trade.id)}>
                      <Text style={styles.cancelBtnText}>Cancel offer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}
        <Text style={styles.note}>To propose a trade, use the web app or contact your trade partner directly.</Text>
      </ScrollView>
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
  empty: { color: "#8a95a8", fontSize: 14, textAlign: "center", marginTop: 40 },
  tradeCard: { backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347", borderRadius: 12, padding: 16, marginBottom: 12 },
  tradeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  tradeTeams: { fontSize: 14, fontWeight: "600", color: "#e8eaf0", flex: 1 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  tradePlayers: { flexDirection: "row", gap: 16, marginBottom: 10 },
  tradeCol: { flex: 1 },
  colLabel: { fontSize: 11, fontWeight: "600", color: "#8a95a8", textTransform: "uppercase", marginBottom: 6 },
  tradePill: { fontSize: 13, color: "#4f7cff", backgroundColor: "rgba(79,124,255,0.1)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 4 },
  tradeNote: { fontSize: 13, color: "#8a95a8", fontStyle: "italic", marginBottom: 8 },
  tradeActions: { flexDirection: "row", gap: 8 },
  acceptBtn: { flex: 1, backgroundColor: "#4f7cff", borderRadius: 8, padding: 10, alignItems: "center" },
  acceptBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  rejectBtn: { flex: 1, borderWidth: 1, borderColor: "#ef4444", borderRadius: 8, padding: 10, alignItems: "center" },
  rejectBtnText: { color: "#ef4444", fontWeight: "600", fontSize: 14 },
  cancelBtn: { borderWidth: 1, borderColor: "#2a3347", borderRadius: 8, padding: 10, alignItems: "center", flex: 1 },
  cancelBtnText: { color: "#8a95a8", fontSize: 13 },
  note: { fontSize: 12, color: "#4a5568", textAlign: "center", marginTop: 16 },
});
