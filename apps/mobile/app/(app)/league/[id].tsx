import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Clipboard, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "../../../src/api/client";

interface Team {
  id: string; name: string; username: string; userId: string; paid: boolean; isCommissioner: boolean;
}
interface PayoutSplit { place: number; percent: number; }
interface LeagueDetail {
  id: string; name: string; status: string; buyIn: number; maxTeams: number; memberCount: number;
  scoringType: string; draftType: string; visibility: string; payoutPreset: string;
  isMember: boolean; isCommissioner: boolean; inviteCode: string; commissionerId: string;
  teams: Team[]; payoutSplit: PayoutSplit[];
}

const STATUS_COLOR: Record<string, string> = { SETUP: "#6b7280", DRAFTING: "#f59e0b", ACTIVE: "#22c55e", PLAYOFFS: "#a78bfa", COMPLETE: "#374151" };
const PAYOUT_LABEL: Record<string, string> = { WINNER_TAKES_ALL: "Winner Takes All", TOP_TWO: "Top 2 (70% / 30%)", TOP_THREE: "Top 3 (60% / 25% / 15%)" };
const PLACE_EMOJI = ["🥇", "🥈", "🥉"];
function ordinal(n: number) { return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : n + "th"; }

export default function LeagueScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [league, setLeague] = useState<LeagueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingDraft, setStartingDraft] = useState(false);

  useEffect(() => { if (id) fetchLeague(); }, [id]);

  async function fetchLeague() {
    const res = await api.get<{ league: LeagueDetail; teams: Team[]; isMember: boolean; isCommissioner: boolean; payoutSplit: PayoutSplit[] }>(`/leagues/${id}`);
    if (res.ok) {
      setLeague({ ...res.data.league, teams: res.data.teams ?? [], isMember: res.data.isMember, isCommissioner: res.data.isCommissioner, payoutSplit: res.data.payoutSplit ?? [] });
    } else { setError((res as any).error ?? "Failed to load league"); }
    setLoading(false);
  }

  async function handleStartDraft() {
    setStartingDraft(true);
    const res = await api.post(`/draft/${id}/start`, {});
    setStartingDraft(false);
    if (!res.ok) { Alert.alert("Error", (res as any).error ?? "Failed to start draft"); return; }
    await fetchLeague();
    router.push(`/(app)/league/${id}/draft` as any);
  }

  function copyInviteCode() {
    if (!league?.inviteCode) return;
    Clipboard.setString(league.inviteCode);
    Alert.alert("Copied!", "Invite code copied to clipboard.");
  }

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color="#4f7cff" style={{ flex: 1 }} /></SafeAreaView>;
  if (error || !league) return (
    <SafeAreaView style={styles.safe}><View style={styles.center}>
      <Text style={styles.errorText}>{error ?? "League not found"}</Text>
      <TouchableOpacity onPress={() => router.back()}><Text style={styles.backLink}>← Go back</Text></TouchableOpacity>
    </View></SafeAreaView>
  );

  const isActive = league.status === "ACTIVE" || league.status === "PLAYOFFS";
  const potTotal = league.buyIn * league.maxTeams;
  const prizePool = Math.floor(potTotal * 0.95);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{league.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[league.status] + "22" }]}>
          <Text style={[styles.statusText, { color: STATUS_COLOR[league.status] }]}>{league.status}</Text>
        </View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.actions}>
          {league.isCommissioner && league.status === "SETUP" && (
            <>
              <NavButton label={startingDraft ? "Starting…" : "🏈 Start Draft"} onPress={handleStartDraft} primary disabled={league.memberCount < 2} />
              <NavButton label="📋 Copy Invite Code" onPress={copyInviteCode} />
            </>
          )}
          {league.status === "DRAFTING" && league.isMember && (
            <NavButton label="Enter Draft Room →" onPress={() => router.push(`/(app)/league/${id}/draft` as any)} primary />
          )}
          {isActive && league.isMember && (
            <>
              <NavButton label="My Team" onPress={() => router.push(`/(app)/league/${id}/my-team` as any)} primary />
              <NavButton label="Standings" onPress={() => router.push(`/(app)/league/${id}/standings` as any)} />
              <NavButton label="Waiver Wire" onPress={() => router.push(`/(app)/league/${id}/waivers` as any)} />
              <NavButton label="Trades" onPress={() => router.push(`/(app)/league/${id}/trades` as any)} />
              {league.status === "PLAYOFFS" && <NavButton label="🏆 Playoff Bracket" onPress={() => router.push(`/(app)/league/${id}/bracket` as any)} />}
            </>
          )}
          {league.isCommissioner && <NavButton label="⚙ Commissioner Panel" onPress={() => router.push(`/(app)/league/${id}/commissioner` as any)} />}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Settings</Text>
          <Row label="Buy-In" value={"$" + league.buyIn} highlight />
          <Row label="Teams" value={league.memberCount + " / " + league.maxTeams} />
          <Row label="Scoring" value={league.scoringType === "FULL_PPR" ? "Full PPR" : "Half PPR"} />
          <Row label="Draft" value={league.draftType === "SNAKE" ? "Snake Draft" : "Auction ($200)"} />
          <Row label="Visibility" value={league.visibility === "PUBLIC" ? "Public" : "Private"} />
        </View>

        {league.buyIn > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Prize Pool</Text>
            <Row label="Total Pot" value={"$" + potTotal.toLocaleString()} />
            <Row label="Prize Pool (after 5% fee)" value={"$" + prizePool.toLocaleString()} highlight />
            {league.payoutSplit?.length > 0 && (
              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#1a2133" }}>
                <Text style={styles.subLabel}>{PAYOUT_LABEL[league.payoutPreset]}</Text>
                {league.payoutSplit.map((s) => (
                  <View key={s.place} style={styles.payoutRow}>
                    <Text style={styles.payoutPlace}>{PLACE_EMOJI[s.place - 1]} {ordinal(s.place)} Place</Text>
                    <Text style={styles.payoutAmount}>{"$" + Math.floor(prizePool * s.percent / 100).toLocaleString()}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {league.status === "SETUP" && league.isCommissioner && league.inviteCode && (
          <TouchableOpacity style={styles.inviteCard} onPress={copyInviteCode} activeOpacity={0.7}>
            <View>
              <Text style={styles.cardTitle}>Invite Code</Text>
              <Text style={styles.inviteCode}>{league.inviteCode}</Text>
            </View>
            <Text style={styles.copyHint}>Tap to copy</Text>
          </TouchableOpacity>
        )}

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
              </View>
              </View>
