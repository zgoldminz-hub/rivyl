import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api } from "../../src/api/client";

interface RosterSlot { playerId: string; slot: string; }
interface Trophy {
  finish: 1 | 2;
  team: { id: string; name: string };
  league: { id: string; name: string };
  year: number;
  roster: RosterSlot[];
}

const SLOT_ORDER = ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF"];
const MONO_COLORS = ["#4f7cff", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#14b8a6"];

function monoColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % MONO_COLORS.length;
  return MONO_COLORS[h];
}

function TrophyCard({ trophy, accentColor }: { trophy: Trophy; accentColor: string }) {
  const color = monoColor(trophy.team.name);
  const starters = trophy.roster
    .filter(r => r.slot !== "BENCH")
    .sort((a, b) => {
      const ai = SLOT_ORDER.indexOf(a.slot);
      const bi = SLOT_ORDER.indexOf(b.slot);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  const bench = trophy.roster.filter(r => r.slot === "BENCH");

  return (
    <View style={[card.container, { borderColor: accentColor + "40" }]}>
      <View style={card.headerRow}>
        <View style={[card.mono, { backgroundColor: color + "25", borderColor: color + "60" }]}>
          <Text style={[card.monoText, { color }]}>{trophy.team.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={card.meta}>
          <Text style={card.teamName}>{trophy.team.name}</Text>
          <Text style={card.leagueMeta}>{trophy.league.name}  ·  {trophy.year}</Text>
        </View>
      </View>

      <View style={card.divider} />

      {starters.length > 0 ? (
        <>
          <Text style={card.rosterHeading}>Starting Lineup</Text>
          {starters.map((r, i) => (
            <View key={i} style={card.playerRow}>
              <View style={card.posTag}>
                <Text style={card.posText}>{r.slot}</Text>
              </View>
              <Text style={card.playerId}>{r.playerId}</Text>
            </View>
          ))}
          {bench.length > 0 && (
            <>
              <Text style={[card.rosterHeading, { marginTop: 10, color: "#4a5568" }]}>
                Bench ({bench.length})
              </Text>
              {bench.map((r, i) => (
                <View key={i} style={card.playerRow}>
                  <View style={[card.posTag, { backgroundColor: "#161b24" }]}>
                    <Text style={[card.posText, { color: "#4a5568" }]}>BN</Text>
                  </View>
                  <Text style={[card.playerId, { color: "#4a5568" }]}>{r.playerId}</Text>
                </View>
              ))}
            </>
          )}
        </>
      ) : (
        <Text style={card.noRoster}>Roster data unavailable</Text>
      )}
    </View>
  );
}

function Section({
  emoji, title, color, items, emptyText,
}: {
  emoji: string; title: string; color: string; items: Trophy[]; emptyText: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEmoji}>{emoji}</Text>
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
        {items.length > 0 && (
          <View style={[styles.countPill, { backgroundColor: color + "22" }]}>
            <Text style={[styles.countText, { color }]}>{items.length}</Text>
          </View>
        )}
      </View>
      {items.length > 0 ? (
        items.map((t, i) => <TrophyCard key={t.team.id + i} trophy={t} accentColor={color} />)
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      )}
    </View>
  );
}

export default function TrophyRoomScreen() {
  const router = useRouter();
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ trophies: Trophy[] }>("/profile/trophy-room").then((res) => {
      if (res.ok) setTrophies(res.data.trophies);
      setLoading(false);
    });
  }, []);

  const champions = trophies.filter(t => t.finish === 1);
  const runners = trophies.filter(t => t.finish === 2);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trophy Room</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <ActivityIndicator color="#FFD700" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Section
            emoji="🏆"
            title="Champions"
            color="#f59e0b"
            items={champions}
            emptyText="No championships yet — your time is coming."
          />
          <Section
            emoji="🥈"
            title="Runner-Ups"
            color="#9ca3af"
            items={runners}
            emptyText="No runner-up finishes yet."
          />
          <Section
            emoji="🥉"
            title="Third Place"
            color="#cd7c32"
            items={[]}
            emptyText="No third place finishes yet."
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0f14" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#2a3347", backgroundColor: "#161b24",
  },
  back: { fontSize: 14, color: "#8a95a8", width: 50 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#FFD700" },
  content: { padding: 20, paddingBottom: 60 },
  section: { marginBottom: 28 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 },
  sectionEmoji: { fontSize: 22 },
  sectionTitle: { fontSize: 16, fontWeight: "800", flex: 1 },
  countPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  countText: { fontSize: 12, fontWeight: "700" },
  emptyCard: {
    backgroundColor: "#161b24", borderWidth: 1, borderColor: "#2a3347",
    borderRadius: 12, padding: 20, alignItems: "center",
  },
  emptyText: { color: "#4a5568", fontSize: 13, textAlign: "center" },
});

const card = StyleSheet.create({
  container: {
    backgroundColor: "#161b24", borderWidth: 1,
    borderRadius: 12, padding: 16, marginBottom: 12,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 0 },
  mono: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  monoText: { fontSize: 20, fontWeight: "800" },
  meta: { flex: 1 },
  teamName: { fontSize: 16, fontWeight: "800", color: "#e8eaf0" },
  leagueMeta: { fontSize: 12, color: "#8a95a8", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#1a2133", marginVertical: 12 },
  rosterHeading: { fontSize: 11, fontWeight: "600", color: "#8a95a8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  playerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  posTag: { backgroundColor: "#0d1520", borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3, minWidth: 40, alignItems: "center" },
  posText: { fontSize: 11, fontWeight: "700", color: "#4f7cff" },
  playerId: { fontSize: 13, color: "#c4cbda", fontWeight: "500" },
  noRoster: { fontSize: 13, color: "#4a5568", textAlign: "center" },
});
