import { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, Modal, Alert, Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../src/store/auth";
import { api } from "../../src/api/client";
import AvatarCharacter from "../../src/components/AvatarCharacter";
import {
  AvatarConfig, DEFAULT_AVATAR_CONFIG, AVATAR_IDS,
} from "../../src/constants/avatar-parts";
import { useTheme, Colors } from "../../src/context/theme";

const AVATAR_KEY = "avatar_config_v2";
const SCREEN_W = Dimensions.get("window").width;
const GRID_PAD = 16;
const GRID_GAP = 10;
const CELL_SIZE = Math.floor((SCREEN_W - 2 * GRID_PAD - 3 * GRID_GAP) / 4);
const INNER_SIZE = CELL_SIZE - 6;

const AVATAR_ROWS = [
  AVATAR_IDS.slice(0, 4),
  AVATAR_IDS.slice(4, 8),
  AVATAR_IDS.slice(8, 12),
  AVATAR_IDS.slice(12, 16),
  AVATAR_IDS.slice(16, 20),
  AVATAR_IDS.slice(20, 24),
];

interface Stats {
  regWins: number; regLosses: number;
  playoffWins: number; playoffLosses: number;
  championships: number; runnerUps: number;
  winPct: number; totalLeagues: number;
}
interface RankInfo { name: string; color: string; description: string; }

function lerpN(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}
function rivylColor(t: number): string {
  if (t < 0.5) {
    const t2 = t * 2;
    return "rgb("+lerpN(0xef,0x7c,t2)+","+lerpN(0x44,0x3a,t2)+","+lerpN(0x44,0xed,t2)+")";
  }
  const t2 = (t - 0.5) * 2;
  return "rgb("+lerpN(0x7c,0x4f,t2)+","+lerpN(0x3a,0x7c,t2)+","+lerpN(0xed,0xff,t2)+")";
}
function ChromaticText({ text, style }: { text: string; style?: object }) {
  const chars = text.split(""); const len = Math.max(chars.length - 1, 1);
  return <Text style={style}>{chars.map((ch, i) => <Text key={i} style={{ color: rivylColor(i/len) }}>{ch}</Text>)}</Text>;
}
function hx(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}
function MetallicText({ text, color, darkHex, style, waves = 1 }: {
  text: string; color: string; darkHex?: string; style?: object; waves?: number;
}) {
  const [r,g,b] = hx(color);
  const [dr,dg,db] = darkHex ? hx(darkHex) : [Math.round(r*0.65),Math.round(g*0.65),Math.round(b*0.65)];
  const br=Math.min(255,Math.round(r*1.6)), bg=Math.min(255,Math.round(g*1.6)), bb=Math.min(255,Math.round(b*1.6));
  const chars = text.split(""); const len = Math.max(chars.length-1,1);
  return (
    <Text style={style}>
      {chars.map((ch,i) => {
        const shine = Math.max(0.05, Math.sin((i/len)*Math.PI*waves));
        return <Text key={i} style={{ color: "rgb("+lerpN(dr,br,shine)+","+lerpN(dg,bg,shine)+","+lerpN(db,bb,shine)+")" }}>{ch}</Text>;
      })}
    </Text>
  );
}
function RankSortIcon({ color }: { color: string }) {
  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <Text style={{ color, fontSize: 8, lineHeight: 9 }}>▲</Text>
      <Text style={{ color, fontSize: 8, lineHeight: 9 }}>▼</Text>
    </View>
  );
}

const RANK_TIERS = [
  { name: "Rookie",           color: "#7c4a1e", req: "0-9 leagues played",                                             desc: "Every champion starts somewhere. Play in 10+ leagues to begin your Rivyl journey." },
  { name: "Rising Star",      color: "#3b82f6", req: "10+ leagues played",                                             desc: "Building momentum. Reach 20+ leagues with a 50%+ win rate to become a Contender." },
  { name: "Contender",        color: "#ef4444", req: "20+ leagues, 50%+ win rate",                                     desc: "A consistent winner. Drop below 50% win rate and you fall back to Rising Star." },
  { name: "Pro-Bowler",       color: "#8b5cf6", req: "50+ leagues, 50%+ win rate, 1+ runner-up",                      desc: "A serious competitor. You have been to the finals and kept a winning record doing it." },
  { name: "All-Pro",          color: "#f97316", req: "60+ leagues, 1+ championship, 60%+ win rate",                   desc: "Elite of the elite. You have won a championship and maintained an elite win rate." },
  { name: "Franchise Legend", color: "#15803d", req: "100+ wins, 2+ championships",                                   desc: "A dynasty builder. Multiple championships and over 100 all-time wins." },
  { name: "Hall of Famer",    color: "#FFD700", req: "200+ wins, 65%+ win rate, 5+ top-3 finishes, 2+ championships", desc: "An all-time great. Sustained excellence over a long career." },
  { name: "GOAT Status",      color: "#4f7cff", req: "300+ wins, 10 championships",                                   desc: "The pinnacle of Rivyl. There is no higher rank - you are the greatest of all time." },
];

function computeRank(stats: Stats): RankInfo {
  const w=stats.regWins, leagues=stats.totalLeagues, wp=stats.winPct;
  const champs=stats.championships, runnerUps=stats.runnerUps;
  if (w>=300&&champs>=10) return {name:"GOAT Status",color:"#4f7cff",description:"The pinnacle of Rivyl."};
  if (wp>=65&&w>=200&&champs+runnerUps>=5&&champs>=2) return {name:"Hall of Famer",color:"#FFD700",description:"An all-time great."};
  if (w>=100&&champs>=2) return {name:"Franchise Legend",color:"#15803d",description:"A dynasty builder."};
  if (leagues>=60&&champs>=1&&wp>=60) return {name:"All-Pro",color:"#f97316",description:"Elite of the elite."};
  if (leagues>=50&&wp>=50&&runnerUps>=1) return {name:"Pro-Bowler",color:"#8b5cf6",description:"A serious competitor."};
  if (leagues>=20&&wp>=50) return {name:"Contender",color:"#ef4444",description:"A consistent winner."};
  if (leagues>=10) return {name:"Rising Star",color:"#3b82f6",description:"Building momentum."};
  return {name:"Rookie",color:"#7c4a1e",description:"Every champion starts somewhere."};
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe:           { flex: 1, backgroundColor: c.bg },
    content:        { padding: 20, paddingBottom: 60 },
    identityBlock:  { alignItems: "center", marginBottom: 24 },
    changeHint:     { fontSize: 11, color: c.accent, textAlign: "center", marginTop: 6, marginBottom: 10 },
    username:       { fontSize: 22, fontWeight: "800", color: c.text, marginBottom: 8 },
    rankBadge:      { borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 8 },
    rankBadgeGrad:  { paddingHorizontal: 14, paddingVertical: 5 },
    rankText:       { fontSize: 13, fontWeight: "700" },
    rankTextWhite:  { fontSize: 13, fontWeight: "700", color: "#fff" },
    email:          { fontSize: 13, color: c.textSub },
    card:           { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 16, marginBottom: 16 },
    cardTitle:      { fontSize: 12, fontWeight: "600", color: c.textSub, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 },
    statsGrid:      { flexDirection: "row", justifyContent: "space-around" },
    statBox:        { alignItems: "center" },
    statValue:      { fontSize: 26, fontWeight: "800" },
    statLabel:      { fontSize: 11, color: c.textSub, marginTop: 2 },
    expRow:         { flexDirection: "row", alignItems: "baseline", gap: 3 },
    expWord:        { fontSize: 14, fontWeight: "700", color: "#a78bfa" },
    divider:        { height: 1, backgroundColor: c.border, marginVertical: 14 },
    subLabel:       { fontSize: 12, color: c.textSub, marginBottom: 10 },
    playoffRow:     { alignItems: "center" },
    playoffStat:    { fontSize: 20, fontWeight: "700", color: c.text },
    trophyRow:      { flexDirection: "row", justifyContent: "space-around" },
    trophyBadge:    { alignItems: "center" },
    trophyEmoji:    { fontSize: 30, marginBottom: 4 },
    trophyCount:    { fontSize: 22, fontWeight: "800" },
    trophyLabel:    { fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 2 },
    noData:         { color: c.textSub, textAlign: "center", paddingVertical: 16 },
    trophyCase:     { backgroundColor: "#0d1b35", borderWidth: 1.5, borderColor: "#c9a84c", borderRadius: 16, padding: 20, marginBottom: 16 },
    trophyCaseTitle:{ color: "#d4af37", fontSize: 13, fontWeight: "800", letterSpacing: 2.5, textAlign: "center", marginBottom: 16 },
    trophyRoomBtn:  { backgroundColor: "rgba(201,168,76,0.12)", borderWidth: 1, borderColor: "#c9a84c", borderRadius: 12, paddingVertical: 15, alignItems: "center" },
    trophyRoomLabel:{ color: "#d4af37", fontSize: 15, fontWeight: "800", letterSpacing: 1.2 },
    signOutBtn:     { borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
    signOutText:    { color: "#ef4444", fontSize: 15, fontWeight: "700" },
  });
}

function makePickerStyles(c: Colors) {
  return StyleSheet.create({
    container:     { flex: 1, backgroundColor: c.bg },
    handle:        { width: 36, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
    topBar:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border },
    title:         { fontSize: 16, fontWeight: "700", color: c.text },
    cancel:        { fontSize: 15, color: c.textSub },
    save:          { fontSize: 15, color: c.accent, fontWeight: "700" },
    preview:       { alignItems: "center", paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: c.border },
    scrollContent: { padding: GRID_PAD, paddingBottom: 60 },
    sectionLabel:  { fontSize: 11, color: c.textSub, fontWeight: "700", letterSpacing: 1, marginBottom: 12 },
    row:           { flexDirection: "row", justifyContent: "space-between", marginBottom: GRID_GAP },
    cell:          { width: CELL_SIZE, height: CELL_SIZE, borderRadius: CELL_SIZE / 2, alignItems: "center", justifyContent: "center", backgroundColor: c.bg },
    cellSel:       { backgroundColor: c.accent + "33" },
  });
}

function makeRanksStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    handle:    { width: 36, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
    topBar:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border },
    title:     { fontSize: 16, fontWeight: "700", color: c.text },
    done:      { fontSize: 15, color: c.accent, fontWeight: "700" },
    content:   { padding: 20, paddingBottom: 60 },
    tierRow:   { flexDirection: "row", gap: 14, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 14, marginBottom: 10 },
    dot:       { width: 12, height: 12, borderRadius: 6, marginTop: 4, flexShrink: 0 },
    tierBody:  { flex: 1 },
    nameRow:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
    tierName:  { fontSize: 15, fontWeight: "800" },
    youPill:   { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
    youText:   { fontSize: 10, fontWeight: "800" },
    req:       { fontSize: 12, color: c.text, fontWeight: "600", marginBottom: 4 },
    desc:      { fontSize: 12, lineHeight: 17 },
  });
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const pickerModal = useMemo(() => makePickerStyles(colors), [colors]);
  const ranksModal = useMemo(() => makeRanksStyles(colors), [colors]);

  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [config, setConfig] = useState<AvatarConfig>(DEFAULT_AVATAR_CONFIG);
  const [draftConfig, setDraftConfig] = useState<AvatarConfig>(DEFAULT_AVATAR_CONFIG);
  const [showPicker, setShowPicker] = useState(false);
  const [showAllRanks, setShowAllRanks] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(AVATAR_KEY).then((val) => {
      if (val) { try { setConfig(JSON.parse(val)); } catch {} }
    });
    api.get<{ stats: Stats }>("/profile/stats").then((res) => {
      if (res.ok) setStats(res.data.stats);
      setLoadingStats(false);
    });
  }, []);

  function openPicker() { setDraftConfig({ ...config }); setShowPicker(true); }
  async function savePicker() {
    setConfig(draftConfig);
    await AsyncStorage.setItem(AVATAR_KEY, JSON.stringify(draftConfig));
    setShowPicker(false);
  }
  function handleLogout() {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  }

  const rank = stats ? computeRank(stats) : null;
  const isGoat = rank?.name === "GOAT Status";

  return (
    <View style={styles.safe}>
      <LinearGradient
        colors={["#C81A1A", "#7520CC", "#1834D4"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ paddingTop: insets.top + 10, paddingBottom: 14, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
      >
        <TouchableOpacity activeOpacity={0.75} onPress={() => router.replace("/(app)/dashboard" as any)}>
          <Image
            source={require("../../assets/RV.png")}
            style={{ width: 118, height: 27, tintColor: "#ffffff" }}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>Profile</Text>
        <View style={{ width: 118 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identityBlock}>
          <TouchableOpacity onPress={openPicker} activeOpacity={0.85} style={{ marginBottom: 6 }}>
            <AvatarCharacter config={config} size={120} />
            <Text style={styles.changeHint}>Tap to customize</Text>
          </TouchableOpacity>
          <Text style={styles.username}>@{user?.username}</Text>
          {rank && (
            isGoat ? (
              <TouchableOpacity onPress={() => setShowAllRanks(true)} style={{ borderRadius: 999, overflow: "hidden", marginBottom: 8 }} activeOpacity={0.7}>
                <LinearGradient colors={["#C81A1A", "#7520CC", "#1834D4"]} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.rankBadgeGrad}>
                  <Text style={styles.rankTextWhite}>{rank.name}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setShowAllRanks(true)} style={[styles.rankBadge, { backgroundColor: rank.color+"22", borderColor: rank.color+"cc", marginBottom: 8 }]} activeOpacity={0.7}>
                <RankSortIcon color={rank.color} />
                <Text style={[styles.rankText, { color: rank.color }]}>{rank.name}</Text>
              </TouchableOpacity>
            )
          )}
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
                <StatBox label="Win %" value={stats.winPct+"%"} color="#1834D4" />
                <ExperienceBox count={stats.totalLeagues} />
              </View>
              <View style={styles.divider} />
              <Text style={styles.subLabel}>Playoff Record</Text>
              <View style={styles.playoffRow}>
                <Text style={styles.playoffStat}>
                  <Text style={{ color: "#22c55e" }}>{stats.playoffWins}W</Text>
                  <Text style={{ color: colors.border }}> - </Text>
                  <Text style={{ color: "#ef4444" }}>{stats.playoffLosses}L</Text>
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.noData}>No stats yet - join a league!</Text>
          )}
        </View>

        {stats && (
          <View style={styles.trophyCase}>
            <Text style={styles.trophyCaseTitle}>TROPHY CASE</Text>
            <View style={styles.trophyRow}>
              <TrophyBadge emoji="🏆" label="Champ" count={stats.championships} color="#f59e0b" />
              <TrophyBadge emoji="🥈" label="Runner-Up" count={stats.runnerUps} color="#9ca3af" />
              <TrophyBadge emoji="🥉" label="3rd Place" count={0} color="#cd7c32" />
            </View>
            <View style={{ height: 16 }} />
            <TouchableOpacity style={styles.trophyRoomBtn} onPress={() => router.push("/(app)/trophy-room")} activeOpacity={0.8}>
              <Text style={styles.trophyRoomLabel}>Trophy Room</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showAllRanks} animationType="slide" presentationStyle="pageSheet">
        <View style={ranksModal.container}>
          <View style={ranksModal.handle} />
          <View style={ranksModal.topBar}>
            <View style={{ width: 50 }} />
            <Text style={ranksModal.title}>All Ranks</Text>
            <TouchableOpacity onPress={() => setShowAllRanks(false)}><Text style={ranksModal.done}>Done</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={ranksModal.content}>
            {RANK_TIERS.map((tier) => {
              const isCurrent = rank?.name === tier.name;
              const isGoatTier = tier.name === "GOAT Status";
              const isRookie = tier.name === "Rookie";
              const isHoF = tier.name === "Hall of Famer";
              const useMetallic = !isGoatTier && !isRookie;
              const hofDark = "#7A5C00";
              return (
                <View key={tier.name} style={[ranksModal.tierRow, isCurrent&&!isGoatTier&&{backgroundColor:tier.color+"12",borderColor:tier.color+"44"}, isCurrent&&isGoatTier&&{borderColor:"#7c3aed55",backgroundColor:"#1a0d2e"}]}>
                  {isGoatTier ? (
                    <LinearGradient colors={["#C81A1A","#1834D4"]} start={{x:0,y:0}} end={{x:1,y:0}} style={ranksModal.dot} />
                  ) : (
                    <View style={[ranksModal.dot, { backgroundColor: tier.color }]} />
                  )}
                  <View style={ranksModal.tierBody}>
                    <View style={ranksModal.nameRow}>
                      {isGoatTier ? <ChromaticText text={tier.name} style={ranksModal.tierName} />
                        : useMetallic ? <MetallicText text={tier.name} color={tier.color} darkHex={isHoF?hofDark:undefined} style={ranksModal.tierName} waves={1} />
                        : <Text style={[ranksModal.tierName,{color:tier.color}]}>{tier.name}</Text>}
                      {isCurrent && (isGoatTier ? (
                        <LinearGradient colors={["#C81A1A","#1834D4"]} start={{x:0,y:0}} end={{x:1,y:0}} style={ranksModal.youPill}>
                          <Text style={[ranksModal.youText,{color:"#fff"}]}>YOU</Text>
                        </LinearGradient>
                      ) : (
                        <View style={[ranksModal.youPill,{backgroundColor:tier.color+"33"}]}>
                          <Text style={[ranksModal.youText,{color:tier.color}]}>YOU</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={ranksModal.req}>{tier.req}</Text>
                    {isGoatTier ? <ChromaticText text={tier.desc} style={ranksModal.desc} />
                      : useMetallic ? <MetallicText text={tier.desc} color={tier.color} darkHex={isHoF?hofDark:undefined} style={ranksModal.desc} waves={1.5} />
                      : <Text style={[ranksModal.desc,{color:tier.color}]}>{tier.desc}</Text>}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showPicker} animationType="slide" presentationStyle="pageSheet">
        <View style={pickerModal.container}>
          <View style={pickerModal.handle} />
          <View style={pickerModal.topBar}>
            <TouchableOpacity onPress={() => setShowPicker(false)}><Text style={pickerModal.cancel}>Cancel</Text></TouchableOpacity>
            <Text style={pickerModal.title}>Customize Avatar</Text>
            <TouchableOpacity onPress={savePicker}><Text style={pickerModal.save}>Save</Text></TouchableOpacity>
          </View>
          <View style={pickerModal.preview}>
            <AvatarCharacter config={draftConfig} size={148} />
          </View>
          <ScrollView contentContainerStyle={pickerModal.scrollContent}>
            <Text style={pickerModal.sectionLabel}>CHARACTERS</Text>
            {AVATAR_ROWS.map((row, rowIdx) => (
              <View key={rowIdx} style={pickerModal.row}>
                {row.map((id) => {
                  const sel = draftConfig.avatarId === id;
                  return (
                    <TouchableOpacity
                      key={id}
                      onPress={() => setDraftConfig({ avatarId: id })}
                      activeOpacity={0.8}
                      style={[pickerModal.cell, sel && pickerModal.cellSel]}
                    >
                      <AvatarCharacter config={{ avatarId: id }} size={INNER_SIZE} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function StatBox({ label, value, color }: { label: string; value: number | string; color: string }) {
  return <View style={{ alignItems: "center" }}><Text style={{ fontSize: 26, fontWeight: "800", color }}>{value}</Text><Text style={{ fontSize: 11, color: "#8a95a8", marginTop: 2 }}>{label}</Text></View>;
}
function ExperienceBox({ count }: { count: number }) {
  const { colors } = useTheme();
  return <View style={{ alignItems: "center" }}><View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}><Text style={{ fontSize: 26, fontWeight: "800", color: colors.text }}>{count}</Text><Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>leagues</Text></View><Text style={{ fontSize: 11, color: "#8a95a8", marginTop: 2 }}>Experience</Text></View>;
}
function TrophyBadge({ emoji, label, count, color }: { emoji: string; label: string; count: number; color: string }) {
  return <View style={{ alignItems: "center" }}><Text style={{ fontSize: 30, marginBottom: 4 }}>{emoji}</Text><Text style={{ fontSize: 22, fontWeight: "800", color }}>{count}</Text><Text style={{ fontSize: 10, color: "#8a95a8", marginTop: 2 }}>{label}</Text></View>;
}
