import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, Modal, ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../src/api/client";

type PlayerStats = {
  passYds?: number; passTds?: number; passInt?: number;
  carries?: number; rushYds?: number; rushTds?: number;
  rec?: number; recYds?: number; recTds?: number;
  fgMade?: number; fgAtt?: number;
  fg70plus?: number; fg60plus?: number; fg50plus?: number; fg40plus?: number; fgUnder40?: number;
  sacks?: number; defTurnovers?: number; defTds?: number; defPpg?: number;
};

type PlayerModalData = {
  totalPts: number; avgPtsPerWeek: number;
  highestScoringWeek: { week: number; pts: number };
  weeksStarted: number; weeksOutperformed: number;
  boomWeeks: number; seasonRank: string; consistencyScore: number;
};

type RosterSlot = {
  playerId: string; slot: string; name: string;
  position: string; team?: string; headshotUrl: string;
  stats?: PlayerStats; modalData?: PlayerModalData;
};

type Trophy = {
  finish: 1 | 2 | 3;
  team: { id: string; name: string; record?: string };
  league: { id: string; name: string };
  year: number; roster: RosterSlot[];
};

const SLOT_ORDER = ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF", "BENCH"];

const TEAM_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ARI: { bg: "#97233F", text: "#FFB612", border: "#FFB612" },
  ATL: { bg: "#A71930", text: "#000000", border: "#A71930" },
  BAL: { bg: "#241773", text: "#9E7C0C", border: "#9E7C0C" },
  BUF: { bg: "#00338D", text: "#C60C30", border: "#C60C30" },
  CAR: { bg: "#0085CA", text: "#101820", border: "#0085CA" },
  CHI: { bg: "#0B162A", text: "#C83803", border: "#C83803" },
  CIN: { bg: "#FB4F14", text: "#000000", border: "#FB4F14" },
  CLE: { bg: "#311D00", text: "#FF3C00", border: "#FF3C00" },
  DAL: { bg: "#003594", text: "#869397", border: "#869397" },
  DEN: { bg: "#FB4F14", text: "#002244", border: "#FB4F14" },
  DET: { bg: "#0076B6", text: "#B0B7BC", border: "#0076B6" },
  GB:  { bg: "#203731", text: "#FFB612", border: "#FFB612" },
  HOU: { bg: "#03202F", text: "#A71930", border: "#A71930" },
  IND: { bg: "#003A70", text: "#ffffff", border: "#003A70" },
  JAX: { bg: "#006778", text: "#D7A22A", border: "#D7A22A" },
  KC:  { bg: "#E31837", text: "#FFB81C", border: "#FFB81C" },
  LAC: { bg: "#0080C6", text: "#FFC20E", border: "#FFC20E" },
  LAR: { bg: "#003594", text: "#FFA300", border: "#FFA300" },
  LV:  { bg: "#000000", text: "#A5ACAF", border: "#A5ACAF" },
  MIA: { bg: "#008E97", text: "#FC4C02", border: "#FC4C02" },
  MIN: { bg: "#4F2683", text: "#FFC62F", border: "#FFC62F" },
  NE:  { bg: "#002244", text: "#C60C30", border: "#C60C30" },
  NO:  { bg: "#101820", text: "#D3BC8D", border: "#D3BC8D" },
  NYG: { bg: "#0B2265", text: "#A71930", border: "#A71930" },
  NYJ: { bg: "#125740", text: "#ffffff", border: "#125740" },
  PHI: { bg: "#004C54", text: "#A5ACAF", border: "#A5ACAF" },
  PIT: { bg: "#101820", text: "#FFB612", border: "#FFB612" },
  SEA: { bg: "#002244", text: "#69BE28", border: "#69BE28" },
  SF:  { bg: "#AA0000", text: "#B3995D", border: "#B3995D" },
  TB:  { bg: "#D50A0A", text: "#FF7900", border: "#FF7900" },
  TEN: { bg: "#0C2340", text: "#4B92DB", border: "#4B92DB" },
  WAS: { bg: "#5A1414", text: "#FFB612", border: "#FFB612" },
};

function teamBadge(team?: string) {
  return TEAM_COLORS[team ?? ""] ?? { bg: "#1e2736", text: "#8899bb", border: "#334466" };
}

function placementInfo(finish: 1 | 2 | 3) {
  if (finish === 1) return { emoji: "🏆", label: "CHAMPION", color: "#f59e0b", textColor: "#d4af37" };
  if (finish === 2) return { emoji: "🥈", label: "RUNNER-UP", color: "#9ca3af", textColor: "#b0b8c8" };
  return { emoji: "🥉", label: "THIRD PLACE", color: "#cd7c32", textColor: "#c87941" };
}

function initials(name: string): string {
  return name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}

function fmtNum(n: number): string {
  return n.toLocaleString();
}

function formatStats(position: string, stats?: PlayerStats): string {
  if (!stats) return "";
  const p: string[] = [];
  if (position === "QB") {
    if (stats.passYds) p.push(`${fmtNum(stats.passYds)} PASS`);
    if (stats.rushYds) p.push(`${fmtNum(stats.rushYds)} RUSH`);
    const td = (stats.passTds ?? 0) + (stats.rushTds ?? 0);
    if (td) p.push(`${td} TD`);
    if (stats.passInt != null) p.push(`${stats.passInt} INT`);
  } else if (position === "RB") {
    if (stats.carries) p.push(`${stats.carries} CAR`);
    if (stats.rushYds) p.push(`${fmtNum(stats.rushYds)} RUSH`);
    if (stats.rushTds) p.push(`${stats.rushTds} TD`);
  } else if (position === "WR" || position === "TE") {
    if (stats.rec) p.push(`${stats.rec} REC`);
    if (stats.recYds) p.push(`${fmtNum(stats.recYds)} YDS`);
    if (stats.recTds) p.push(`${stats.recTds} TD`);
  } else if (position === "K") {
    if (stats.fgMade != null) p.push(`${stats.fgMade}/${stats.fgAtt ?? "?"} FG`);
  } else if (position === "DEF") {
    if (stats.sacks) p.push(`${stats.sacks} SCK`);
    if (stats.defTurnovers) p.push(`${stats.defTurnovers} TO`);
    if (stats.defPpg != null) p.push(`${stats.defPpg} PPG`);
    if (stats.defTds) p.push(`${stats.defTds} TD`);
  }
  return p.join(" · ");
}


function formatModalStats(position: string, stats?: PlayerStats): { label: string; value: string }[] {
  if (!stats) return [];
  const rows: { label: string; value: string }[] = [];
  if (position === "QB") {
    if (stats.passYds != null) rows.push({ label: "Pass Yards", value: stats.passYds.toLocaleString() });
    if (stats.passTds != null) rows.push({ label: "Pass TDs", value: String(stats.passTds) });
    if (stats.passInt != null) rows.push({ label: "Interceptions", value: String(stats.passInt) });
    if (stats.rushYds != null) rows.push({ label: "Rush Yards", value: stats.rushYds.toLocaleString() });
    if (stats.rushTds != null) rows.push({ label: "Rush TDs", value: String(stats.rushTds) });
  } else if (position === "RB") {
    if (stats.carries != null) rows.push({ label: "Carries", value: String(stats.carries) });
    if (stats.rushYds != null) rows.push({ label: "Rush Yards", value: stats.rushYds.toLocaleString() });
    if (stats.rushTds != null) rows.push({ label: "Rush TDs", value: String(stats.rushTds) });
    if (stats.rec != null) rows.push({ label: "Receptions", value: String(stats.rec) });
    if (stats.recYds != null) rows.push({ label: "Rec Yards", value: stats.recYds.toLocaleString() });
    if (stats.recTds != null) rows.push({ label: "Rec TDs", value: String(stats.recTds) });
  } else if (position === "WR" || position === "TE") {
    if (stats.rec != null) rows.push({ label: "Receptions", value: String(stats.rec) });
    if (stats.recYds != null) rows.push({ label: "Rec Yards", value: stats.recYds.toLocaleString() });
    if (stats.recTds != null) rows.push({ label: "Rec TDs", value: String(stats.recTds) });
  } else if (position === "K") {
    if (stats.fgMade != null) rows.push({ label: "Total FG Made / Att", value: `${stats.fgMade}/${stats.fgAtt ?? "?"}` });
    if (stats.fg70plus != null) rows.push({ label: "Made 70+ yds", value: String(stats.fg70plus) });
    if (stats.fg60plus != null) rows.push({ label: "Made 60-69 yds", value: String(stats.fg60plus) });
    if (stats.fg50plus != null) rows.push({ label: "Made 50-59 yds", value: String(stats.fg50plus) });
    if (stats.fg40plus != null) rows.push({ label: "Made 40-49 yds", value: String(stats.fg40plus) });
    if (stats.fgUnder40 != null) rows.push({ label: "Made < 40 yds", value: String(stats.fgUnder40) });
  } else if (position === "DEF") {
    if (stats.sacks != null) rows.push({ label: "Sacks", value: String(stats.sacks) });
    if (stats.defTurnovers != null) rows.push({ label: "Turnovers", value: String(stats.defTurnovers) });
    if (stats.defPpg != null) rows.push({ label: "Pts Allowed / Game", value: `${stats.defPpg}` });
    if (stats.defTds != null) rows.push({ label: "Def TDs", value: String(stats.defTds) });
  }
  return rows;
}

function StatCell({ value, sub, label }: { value: string; sub?: string; label: string }) {
  return (
    <View style={pm.cell}>
      <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
        <Text style={pm.cellValue}>{value}</Text>
        {sub ? <Text style={pm.cellSub}>{sub}</Text> : null}
      </View>
      <Text style={pm.cellLabel}>{label}</Text>
    </View>
  );
}

function PlayerModal({ slot, onClose }: { slot: RosterSlot | null; onClose: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  const md = slot?.modalData;
  const statRows = formatModalStats(slot?.position ?? "", slot?.stats);

  return (
    <Modal transparent animationType="fade" visible={!!slot} onRequestClose={onClose}>
      <View style={pm.backdrop}>
        <TouchableOpacity
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          activeOpacity={1}
          onPress={onClose}
        />
        {slot && (
          <View style={pm.card}>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              <View style={pm.header}>
                <View style={pm.photoWrap}>
                  {slot.position === "DEF" ? (
                    <View style={[pm.photo, pm.photoFallback, { backgroundColor: teamBadge(slot.team).bg + "cc", borderWidth: 2, borderColor: teamBadge(slot.team).border }]}>
                      <Text style={[pm.photoInitials, { color: teamBadge(slot.team).text, fontSize: 16, fontWeight: "800" }]}>{slot.team ?? "DEF"}</Text>
                    </View>
                  ) : !imgFailed ? (
                    <Image
                      source={{ uri: slot.headshotUrl }}
                      style={pm.photo}
                      onError={() => setImgFailed(true)}
                    />
                  ) : (
                    <View style={[pm.photo, pm.photoFallback]}>
                      <Text style={pm.photoInitials}>{initials(slot.name)}</Text>
                    </View>
                  )}
                </View>
                <View style={pm.headerInfo}>
                  <Text style={pm.playerName} numberOfLines={1}>{slot.name}</Text>
                  <View style={pm.tagRow}>
                    {slot.team ? (
                      <View style={pm.teamTag}>
                        <Text style={pm.teamTagText}>{slot.team}</Text>
                      </View>
                    ) : null}
                    <View style={pm.posTag}>
                      <Text style={pm.posTagText}>{slot.position}</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity style={pm.closeBtn} onPress={onClose}>
                  <Text style={pm.closeX}>✕</Text>
                </TouchableOpacity>
              </View>

              {md && (
                <>
                  <View style={pm.hero}>
                    <Text style={pm.heroValue}>{md.totalPts.toFixed(1)}</Text>
                    <Text style={pm.heroLabel}>TOTAL FANTASY POINTS</Text>
                  </View>
                  <Text style={pm.rankText}>{md.seasonRank} overall that season</Text>
                  <View style={pm.divider} />
                  <View style={pm.grid}>
                    <StatCell value={md.avgPtsPerWeek.toFixed(1)} label="AVG / WEEK" />
                    <StatCell
                      value={`${md.highestScoringWeek.pts.toFixed(1)}`}
                      sub={` Wk${md.highestScoringWeek.week}`}
                      label="BEST WEEK"
                    />
                    <StatCell value={String(md.weeksStarted)} label="WKS STARTED" />
                    <StatCell value={String(md.weeksOutperformed)} label="BEAT PROJ" />
                    <StatCell value={String(md.boomWeeks)} sub=" (25+ pts)" label="BOOM WEEKS" />
                    <StatCell value={`${md.consistencyScore}%`} label="CONSISTENCY" />
                  </View>
                </>
              )}

              {statRows.length > 0 && (
                <>
                  <View style={pm.divider} />
                  <Text style={pm.sectionTitle}>SEASON STATS</Text>
                  <View style={pm.statRows}>
                    {statRows.map((r) => (
                      <View key={r.label} style={pm.statRow}>
                        <Text style={pm.statRowLabel}>{r.label}</Text>
                        <Text style={pm.statRowValue}>{r.value}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
              <View style={{ height: 16 }} />
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}

function PlayerRow({ slot, onPress }: { slot: RosterSlot; onPress: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  const isBench = slot.slot === "BENCH";
  const statsLine = formatStats(slot.position, slot.stats);

  return (
    <TouchableOpacity
      style={[row.container, isBench && row.bench]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {slot.position === "DEF" ? (
        <View style={[row.photo, row.photoFallback, { backgroundColor: teamBadge(slot.team).bg + "cc", borderWidth: 1.5, borderColor: teamBadge(slot.team).border }]}>
          <Text style={[row.photoInitials, { color: teamBadge(slot.team).text, fontSize: 10, fontWeight: "800" }]}>{slot.team ?? "DEF"}</Text>
        </View>
      ) : !imgFailed ? (
        <Image
          source={{ uri: slot.headshotUrl }}
          style={row.photo}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <View style={[row.photo, row.photoFallback]}>
          <Text style={row.photoInitials}>{initials(slot.name)}</Text>
        </View>
      )}
      <View style={row.posWrap}>
        <Text style={[row.posText, isBench && row.posTextBench]}>{slot.slot}</Text>
      </View>
      <View style={row.nameCol}>
        <View style={row.nameRow}>
          <Text style={[row.name, isBench && row.nameBench]} numberOfLines={1}>{slot.name}</Text>
          {slot.team ? <Text style={row.teamAbbr}> {slot.team}</Text> : null}
        </View>
        {statsLine ? <Text style={row.statsLine} numberOfLines={1}>{statsLine}</Text> : null}
      </View>
      <Text style={row.chevron}>›</Text>
    </TouchableOpacity>
  );
}

function TrophyCard({ trophy }: { trophy: Trophy }) {
  const [selectedSlot, setSelectedSlot] = useState<RosterSlot | null>(null);
  const info = placementInfo(trophy.finish);

  const starters = trophy.roster
    .filter(r => r.slot !== "BENCH")
    .sort((a, b) => {
      const ai = SLOT_ORDER.indexOf(a.slot);
      const bi = SLOT_ORDER.indexOf(b.slot);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  const bench = trophy.roster.filter(r => r.slot === "BENCH");

  return (
    <View style={[card.container, { borderColor: info.color + "60" }]}>
      <LinearGradient
        colors={[info.color + "40", info.color + "18"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={card.strip}
      >
        <Text style={card.stripEmoji}>{info.emoji}</Text>
        <Text style={[card.stripLabel, { color: info.textColor }]}>{info.label}</Text>
        <Text style={[card.stripYear, { color: info.textColor + "cc" }]}>{trophy.year}</Text>
      </LinearGradient>

      <View style={card.teamRow}>
        <View style={[card.mono, { borderColor: info.color + "80" }]}>
          <Text style={[card.monoText, { color: info.textColor }]}>
            {trophy.team.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={card.teamInfo}>
          <View style={card.teamNameRow}>
            <Text style={card.teamName}>{trophy.team.name}</Text>
            {trophy.team.record ? <Text style={card.teamRecord}> · {trophy.team.record}</Text> : null}
          </View>
          <Text style={card.leagueName}>{trophy.league.name}</Text>
        </View>
      </View>

      <View style={card.rosterSection}>
        <View style={card.rosterHeadRow}>
          <View style={card.rosterLine} />
          <Text style={card.rosterHeading}>CHAMPIONSHIP ROSTER</Text>
          <View style={card.rosterLine} />
        </View>
        {starters.map(s => (
          <PlayerRow key={s.playerId + s.slot} slot={s} onPress={() => setSelectedSlot(s)} />
        ))}
        {bench.length > 0 && (
          <>
            <View style={card.rosterHeadRow}>
              <View style={card.rosterLine} />
              <Text style={card.rosterHeading}>BENCH</Text>
              <View style={card.rosterLine} />
            </View>
            {bench.map(s => (
              <PlayerRow key={s.playerId + s.slot} slot={s} onPress={() => setSelectedSlot(s)} />
            ))}
          </>
        )}
      </View>

      <View style={card.footer}>
        <Text style={card.footerText}>
          {info.label === "CHAMPION"
            ? `${trophy.team.name} conquered the ${trophy.league.name} in ${trophy.year}`
            : `${trophy.team.name} finished ${info.label.toLowerCase()} in ${trophy.year}`}
        </Text>
      </View>

      <PlayerModal
        key={selectedSlot?.playerId ?? "none"}
        slot={selectedSlot}
        onClose={() => setSelectedSlot(null)}
      />
    </View>
  );
}

function EmptyRoom() {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyEmoji}>🏛️</Text>
      <Text style={styles.emptyTitle}>THE HISTORY BOOKS AWAIT</Text>
      <Text style={styles.emptyBody}>
        The moment you earn a top 3 finish, your entire squad — every starter, every player on that roster — gets preserved in this room forever.
      </Text>
      <View style={styles.emptyDivRow} />
      <Text style={styles.emptySub}>Your legacy is one finish away.</Text>
    </View>
  );
}

function LegacyBanner({ count }: { count: number }) {
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerTitle}>YOUR LEGACY</Text>
      <View style={styles.bannerDivider} />
      <Text style={styles.bannerBody}>
        Every player on these rosters is forever a part of your{" "}
        <Text style={{ color: "#d4af37", fontWeight: "700" }}>Rivyl history.</Text>
      </Text>
      <Text style={styles.bannerSub}>
        The lineups, the wins, the seasons that defined you —{"\n"}
        honored here forever.
      </Text>
      <View style={styles.bannerCountRow}>
        <Text style={styles.bannerCount}>
          {count === 1 ? "1 top-3 finish" : `${count} top-3 finishes`}
        </Text>
        <Text style={styles.bannerCountDot}> · </Text>
        <Text style={styles.bannerCountAccent}>and counting</Text>
      </View>
    </View>
  );
}

const MOCK_TROPHIES: Trophy[] = [
  {
    finish: 1,
    team: { id: "t1", name: "Rushing Rhinos", record: "11-3" },
    league: { id: "l1", name: "The Premier League" },
    year: 2024,
    roster: [
      {
        playerId: "4046", slot: "QB", name: "Patrick Mahomes", position: "QB", team: "KC",
        headshotUrl: "https://sleepercdn.com/content/nfl/players/thumb/4046.jpg",
        stats: { passYds: 4183, passTds: 30, passInt: 10, rushYds: 426, rushTds: 4 },
        modalData: { totalPts: 367.2, avgPtsPerWeek: 21.6, highestScoringWeek: { week: 14, pts: 42.3 }, weeksStarted: 17, weeksOutperformed: 11, boomWeeks: 8, seasonRank: "#1 QB", consistencyScore: 71 },
      },
      {
        playerId: "4866", slot: "RB", name: "Christian McCaffrey", position: "RB", team: "SF",
        headshotUrl: "https://sleepercdn.com/content/nfl/players/thumb/4866.jpg",
        stats: { carries: 187, rushYds: 1459, rushTds: 14, rec: 67, recYds: 580, recTds: 2 },
        modalData: { totalPts: 312.4, avgPtsPerWeek: 22.3, highestScoringWeek: { week: 5, pts: 38.1 }, weeksStarted: 14, weeksOutperformed: 9, boomWeeks: 7, seasonRank: "#1 RB", consistencyScore: 64 },
      },
      {
        playerId: "7528", slot: "RB", name: "Derrick Henry", position: "RB", team: "BAL",
        headshotUrl: "https://sleepercdn.com/content/nfl/players/thumb/7528.jpg",
        stats: { carries: 327, rushYds: 1921, rushTds: 16, rec: 52, recYds: 390, recTds: 1 },
        modalData: { totalPts: 289.7, avgPtsPerWeek: 17.0, highestScoringWeek: { week: 8, pts: 36.2 }, weeksStarted: 17, weeksOutperformed: 10, boomWeeks: 6, seasonRank: "#3 RB", consistencyScore: 59 },
      },
      {
        playerId: "5892", slot: "WR", name: "Tyreek Hill", position: "WR", team: "MIA",
        headshotUrl: "https://sleepercdn.com/content/nfl/players/thumb/5892.jpg",
        stats: { rec: 119, recYds: 1786, recTds: 13 },
        modalData: { totalPts: 271.3, avgPtsPerWeek: 15.9, highestScoringWeek: { week: 3, pts: 41.2 }, weeksStarted: 17, weeksOutperformed: 8, boomWeeks: 5, seasonRank: "#2 WR", consistencyScore: 53 },
      },
      {
        playerId: "6794", slot: "WR", name: "Justin Jefferson", position: "WR", team: "MIN",
        headshotUrl: "https://sleepercdn.com/content/nfl/players/thumb/6794.jpg",
        stats: { rec: 103, recYds: 1533, recTds: 10 },
        modalData: { totalPts: 248.9, avgPtsPerWeek: 14.6, highestScoringWeek: { week: 11, pts: 32.7 }, weeksStarted: 17, weeksOutperformed: 9, boomWeeks: 4, seasonRank: "#4 WR", consistencyScore: 65 },
      },
      {
        playerId: "1479", slot: "TE", name: "Travis Kelce", position: "TE", team: "KC",
        headshotUrl: "https://sleepercdn.com/content/nfl/players/thumb/1479.jpg",
        stats: { rec: 97, recYds: 823, recTds: 3 },
        modalData: { totalPts: 186.2, avgPtsPerWeek: 10.9, highestScoringWeek: { week: 6, pts: 28.4 }, weeksStarted: 17, weeksOutperformed: 7, boomWeeks: 2, seasonRank: "#1 TE", consistencyScore: 76 },
      },
      {
        playerId: "7561", slot: "FLEX", name: "Amon-Ra St. Brown", position: "WR", team: "DET",
        headshotUrl: "https://sleepercdn.com/content/nfl/players/thumb/7561.jpg",
        stats: { rec: 97, recYds: 1106, recTds: 12 },
        modalData: { totalPts: 231.4, avgPtsPerWeek: 13.6, highestScoringWeek: { week: 9, pts: 34.9 }, weeksStarted: 17, weeksOutperformed: 9, boomWeeks: 4, seasonRank: "#6 WR", consistencyScore: 71 },
      },
      {
        playerId: "1234", slot: "K", name: "Justin Tucker", position: "K", team: "BAL",
        headshotUrl: "https://sleepercdn.com/content/nfl/players/thumb/1234.jpg",
        stats: { fgMade: 31, fgAtt: 37, fg70plus: 0, fg60plus: 1, fg50plus: 9, fg40plus: 14, fgUnder40: 7 },
        modalData: { totalPts: 142.7, avgPtsPerWeek: 8.4, highestScoringWeek: { week: 12, pts: 18.0 }, weeksStarted: 17, weeksOutperformed: 6, boomWeeks: 0, seasonRank: "#2 K", consistencyScore: 82 },
      },
      {
        playerId: "BAL", slot: "DEF", name: "Ravens D/ST", position: "DEF", team: "BAL",
        headshotUrl: "https://sleepercdn.com/content/nfl/players/thumb/BAL.jpg",
        stats: { sacks: 49, defTurnovers: 20, defTds: 3, defPpg: 17.2 },
        modalData: { totalPts: 168.4, avgPtsPerWeek: 9.9, highestScoringWeek: { week: 7, pts: 24.0 }, weeksStarted: 17, weeksOutperformed: 8, boomWeeks: 0, seasonRank: "#3 DEF", consistencyScore: 59 },
      },
      {
        playerId: "6026", slot: "BENCH", name: "Jaylen Waddle", position: "WR", team: "MIA",
        headshotUrl: "https://sleepercdn.com/content/nfl/players/thumb/6026.jpg",
        stats: { rec: 55, recYds: 602, recTds: 3 },
        modalData: { totalPts: 123.6, avgPtsPerWeek: 7.3, highestScoringWeek: { week: 4, pts: 22.1 }, weeksStarted: 0, weeksOutperformed: 4, boomWeeks: 0, seasonRank: "#18 WR", consistencyScore: 44 },
      },
      {
        playerId: "7523", slot: "BENCH", name: "Tony Pollard", position: "RB", team: "TEN",
        headshotUrl: "https://sleepercdn.com/content/nfl/players/thumb/7523.jpg",
        stats: { carries: 118, rushYds: 628, rushTds: 5, rec: 43, recYds: 310 },
        modalData: { totalPts: 141.2, avgPtsPerWeek: 8.3, highestScoringWeek: { week: 2, pts: 24.8 }, weeksStarted: 0, weeksOutperformed: 5, boomWeeks: 1, seasonRank: "#14 RB", consistencyScore: 52 },
      },
    ],
  },
  {
    finish: 2,
    team: { id: "t2", name: "Gridiron Gods", record: "9-5" },
    league: { id: "l1", name: "The Premier League" },
    year: 2023,
    roster: [
      {
        playerId: "4981", slot: "QB", name: "Josh Allen", position: "QB", team: "BUF",
        headshotUrl: "https://sleepercdn.com/content/nfl/players/thumb/4981.jpg",
        stats: { passYds: 4306, passTds: 29, passInt: 18, rushYds: 524, rushTds: 7 },
        modalData: { totalPts: 348.6, avgPtsPerWeek: 20.5, highestScoringWeek: { week: 9, pts: 44.1 }, weeksStarted: 17, weeksOutperformed: 10, boomWeeks: 9, seasonRank: "#2 QB", consistencyScore: 65 },
      },
      {
        playerId: "6790", slot: "RB", name: "Jonathan Taylor", position: "RB", team: "IND",
        headshotUrl: "https://sleepercdn.com/content/nfl/players/thumb/6790.jpg",
        stats: { carries: 188, rushYds: 1035, rushTds: 11, rec: 45, recYds: 298 },
        modalData: { totalPts: 201.3, avgPtsPerWeek: 11.8, highestScoringWeek: { week: 7, pts: 31.4 }, weeksStarted: 17, weeksOutperformed: 8, boomWeeks: 4, seasonRank: "#8 RB", consistencyScore: 59 },
      },
      {
        playerId: "3294", slot: "WR", name: "Davante Adams", position: "WR", team: "LV",
        headshotUrl: "https://sleepercdn.com/content/nfl/players/thumb/3294.jpg",
        stats: { rec: 99, recYds: 1144, recTds: 7 },
        modalData: { totalPts: 198.7, avgPtsPerWeek: 11.7, highestScoringWeek: { week: 6, pts: 33.2 }, weeksStarted: 17, weeksOutperformed: 8, boomWeeks: 4, seasonRank: "#9 WR", consistencyScore: 70 },
      },
      {
        playerId: "4137", slot: "WR", name: "Stefon Diggs", position: "WR", team: "BUF",
        headshotUrl: "https://sleepercdn.com/content/nfl/players/thumb/4137.jpg",
        stats: { rec: 107, recYds: 1183, recTds: 8 },
        modalData: { totalPts: 207.4, avgPtsPerWeek: 12.2, highestScoringWeek: { week: 3, pts: 35.6 }, weeksStarted: 17, weeksOutperformed: 9, boomWeeks: 4, seasonRank: "#7 WR", consistencyScore: 65 },
      },
      {
        playerId: "4199", slot: "TE", name: "Mark Andrews", position: "TE", team: "BAL",
        headshotUrl: "https://sleepercdn.com/content/nfl/players/thumb/4199.jpg",
        stats: { rec: 73, recYds: 847, recTds: 6 },
        modalData: { totalPts: 176.8, avgPtsPerWeek: 10.4, highestScoringWeek: { week: 5, pts: 30.1 }, weeksStarted: 17, weeksOutperformed: 8, boomWeeks: 3, seasonRank: "#2 TE", consistencyScore: 71 },
      },
      {
        playerId: "5849", slot: "FLEX", name: "Miles Sanders", position: "RB", team: "CAR",
        headshotUrl: "https://sleepercdn.com/content/nfl/players/thumb/5849.jpg",
        stats: { carries: 183, rushYds: 898, rushTds: 10, rec: 28, recYds: 189 },
        modalData: { totalPts: 168.4, avgPtsPerWeek: 9.9, highestScoringWeek: { week: 4, pts: 27.3 }, weeksStarted: 17, weeksOutperformed: 7, boomWeeks: 3, seasonRank: "#11 RB", consistencyScore: 59 },
      },
      {
        playerId: "7672", slot: "K", name: "Evan McPherson", position: "K", team: "CIN",
        headshotUrl: "https://sleepercdn.com/content/nfl/players/thumb/7672.jpg",
        stats: { fgMade: 28, fgAtt: 32, fg70plus: 0, fg60plus: 0, fg50plus: 7, fg40plus: 14, fgUnder40: 7 },
        modalData: { totalPts: 138.4, avgPtsPerWeek: 8.1, highestScoringWeek: { week: 10, pts: 16.0 }, weeksStarted: 17, weeksOutperformed: 5, boomWeeks: 0, seasonRank: "#5 K", consistencyScore: 76 },
      },
      {
        playerId: "BUF", slot: "DEF", name: "Bills D/ST", position: "DEF", team: "BUF",
        headshotUrl: "https://sleepercdn.com/content/nfl/players/thumb/BUF.jpg",
        stats: { sacks: 40, defTurnovers: 22, defTds: 2, defPpg: 19.8 },
        modalData: { totalPts: 152.3, avgPtsPerWeek: 8.9, highestScoringWeek: { week: 8, pts: 22.0 }, weeksStarted: 17, weeksOutperformed: 6, boomWeeks: 0, seasonRank: "#5 DEF", consistencyScore: 65 },
      },
      {
        playerId: "6827", slot: "BENCH", name: "Elijah Mitchell", position: "RB", team: "SF",
        headshotUrl: "https://sleepercdn.com/content/nfl/players/thumb/6827.jpg",
        stats: { carries: 79, rushYds: 402, rushTds: 3, rec: 18, recYds: 122 },
        modalData: { totalPts: 82.6, avgPtsPerWeek: 4.9, highestScoringWeek: { week: 2, pts: 18.3 }, weeksStarted: 0, weeksOutperformed: 3, boomWeeks: 0, seasonRank: "#24 RB", consistencyScore: 35 },
      },
    ],
  },
];

export default function TrophyRoomScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/profile/trophy-room")
      .then((res: any) => setTrophies(Array.isArray(res?.data?.trophies) ? res.data.trophies : []))
      .catch(() => setTrophies([]))
      .finally(() => setLoading(false));
  }, []);

  const champions = trophies.filter(t => t.finish === 1).sort((a, b) => b.year - a.year);
  const runners   = trophies.filter(t => t.finish === 2).sort((a, b) => b.year - a.year);
  const thirds    = trophies.filter(t => t.finish === 3).sort((a, b) => b.year - a.year);

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <LinearGradient
        colors={["#C81A1A", "#7520CC", "#1834D4"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Image
            source={require("../../assets/RV.png")}
            style={{ width: 118, height: 27, tintColor: "#ffffff" }}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trophy Room</Text>
        <View style={{ width: 118 }} />
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#d4af37" />
        </View>
      ) : trophies.length === 0 ? (
        <EmptyRoom />
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <LegacyBanner count={trophies.length} />
          {champions.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionBar} />
                <Text style={styles.sectionTitle}>Champions</Text>
                <View style={styles.sectionBar} />
              </View>
              {champions.map(t => <TrophyCard key={`${t.year}-${t.team.id}`} trophy={t} />)}
            </View>
          )}
          {runners.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionBar} />
                <Text style={styles.sectionTitle}>Runner-Ups</Text>
                <View style={styles.sectionBar} />
              </View>
              {runners.map(t => <TrophyCard key={`${t.year}-${t.team.id}`} trophy={t} />)}
            </View>
          )}
          {thirds.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionBar} />
                <Text style={styles.sectionTitle}>Third Place</Text>
                <View style={styles.sectionBar} />
              </View>
              {thirds.map(t => <TrophyCard key={`${t.year}-${t.team.id}`} trophy={t} />)}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const row = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#ffffff08" },
  bench: { opacity: 0.55 },
  photo: { width: 36, height: 36, borderRadius: 18, marginRight: 8, backgroundColor: "#1e2736" },
  photoFallback: { alignItems: "center", justifyContent: "center" },
  photoInitials: { fontSize: 12, fontWeight: "700", color: "#8899bb" },
  posWrap: { width: 38, alignItems: "center", marginRight: 8 },
  posText: { fontSize: 10, fontWeight: "700", color: "#d4af37", letterSpacing: 0.5 },
  posTextBench: { color: "#556688" },
  nameCol: { flex: 1, marginRight: 4 },
  nameRow: { flexDirection: "row", alignItems: "center" },
  name: { fontSize: 13, fontWeight: "600", color: "#e8edf5", flexShrink: 1 },
  nameBench: { color: "#7a8ba8" },
  teamAbbr: { fontSize: 11, color: "#7a8ba8", fontWeight: "500" },
  statsLine: { fontSize: 11, color: "#8899bb", marginTop: 2 },
  chevron: { fontSize: 18, color: "#334466", marginLeft: 4 },
});

const card = StyleSheet.create({
  container: { backgroundColor: "#0d1b35", borderWidth: 1, borderRadius: 16, marginBottom: 20, overflow: "hidden" },
  strip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 },
  stripEmoji: { fontSize: 18, marginRight: 8 },
  stripLabel: { fontSize: 13, fontWeight: "800", letterSpacing: 2 },
  stripYear: { marginLeft: "auto", fontSize: 13, fontWeight: "700" },
  teamRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#ffffff10" },
  mono: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff08", marginRight: 12 },
  monoText: { fontSize: 20, fontWeight: "800" },
  teamInfo: { flex: 1 },
  teamNameRow: { flexDirection: "row", alignItems: "center" },
  teamName: { fontSize: 17, fontWeight: "700", color: "#e8edf5" },
  teamRecord: { fontSize: 13, color: "#8899bb", fontWeight: "500" },
  leagueName: { fontSize: 12, color: "#5a7090", marginTop: 2 },
  rosterSection: { paddingBottom: 4 },
  rosterHeadRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 },
  rosterLine: { flex: 1, height: 1, backgroundColor: "#ffffff14" },
  rosterHeading: { fontSize: 10, color: "#5a7090", fontWeight: "700", letterSpacing: 1.5, marginHorizontal: 10 },
  footer: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#ffffff08" },
  footerText: { fontSize: 11, color: "#3a5070", textAlign: "center", fontStyle: "italic" },
});

const pm = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  card: { width: "100%", maxHeight: 600, backgroundColor: "#0d1b35", borderWidth: 1.5, borderColor: "#c9a84c60", borderRadius: 20, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#ffffff10" },
  photoWrap: { marginRight: 12 },
  photo: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#1e2736" },
  photoFallback: { alignItems: "center", justifyContent: "center" },
  photoInitials: { fontSize: 18, fontWeight: "700", color: "#8899bb" },
  headerInfo: { flex: 1 },
  playerName: { fontSize: 16, fontWeight: "700", color: "#e8edf5" },
  tagRow: { flexDirection: "row", marginTop: 4, gap: 6 },
  teamTag: { backgroundColor: "#1e3050", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  teamTagText: { fontSize: 11, color: "#8899bb", fontWeight: "600" },
  posTag: { backgroundColor: "#d4af3722", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  posTagText: { fontSize: 11, color: "#d4af37", fontWeight: "700" },
  closeBtn: { padding: 8 },
  closeX: { fontSize: 16, color: "#5a7090" },
  hero: { alignItems: "center", paddingTop: 20, paddingBottom: 4 },
  heroValue: { fontSize: 42, fontWeight: "800", color: "#d4af37" },
  heroLabel: { fontSize: 11, color: "#5a7090", letterSpacing: 2, marginTop: 2 },
  divider: { height: 1, backgroundColor: "#ffffff10", marginHorizontal: 16, marginVertical: 14 },
  rankRow: { alignItems: "center", marginBottom: 14 },
  rankText: { fontSize: 13, color: "#d4af37", fontStyle: "italic", textAlign: "center", marginBottom: 14, paddingHorizontal: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8, marginBottom: 4 },
  cell: { width: "33.33%", alignItems: "center", paddingVertical: 12, paddingHorizontal: 4 },
  cellValue: { fontSize: 18, fontWeight: "700", color: "#e8edf5" },
  cellSub: { fontSize: 11, color: "#8899bb", fontWeight: "500", marginBottom: 2 },
  cellLabel: { fontSize: 9, color: "#5a7090", letterSpacing: 1, marginTop: 3, textAlign: "center" },
  sectionTitle: { fontSize: 10, color: "#5a7090", letterSpacing: 2, fontWeight: "700", paddingHorizontal: 16, marginBottom: 8 },
  statRows: { paddingHorizontal: 16, paddingBottom: 4 },
  statRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#ffffff08" },
  statRowLabel: { fontSize: 13, color: "#8899bb" },
  statRowValue: { fontSize: 13, color: "#e8edf5", fontWeight: "600" },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0d0f14" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#ffffff" },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  emptyWrap: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 28, textAlign: "center" },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: "#d4af37", letterSpacing: 2, textAlign: "center", marginBottom: 20 },
  emptyBody: { fontSize: 15, color: "#8899bb", textAlign: "center", lineHeight: 24, marginBottom: 28 },
  emptyDivRow: { width: 40, height: 2, backgroundColor: "#d4af37", borderRadius: 1, marginBottom: 20 },
  emptyDivLine: {},
  emptyDivStar: {},
  emptyLine: {},
  emptyCard: {},
  emptySub: { fontSize: 14, color: "#d4af37", fontStyle: "italic", textAlign: "center" },
  banner: { alignItems: "center", paddingTop: 24, paddingBottom: 12, marginBottom: 8, paddingHorizontal: 16 },
  bannerTitle: { fontSize: 22, fontWeight: "800", color: "#d4af37", letterSpacing: 3 },
  bannerDivider: { width: 60, height: 2, backgroundColor: "#c9a84c50", borderRadius: 1, marginVertical: 12 },
  bannerBody: { fontSize: 15, color: "#8899bb", textAlign: "center", lineHeight: 22 },
  bannerSub: { fontSize: 13, color: "#4a6080", textAlign: "center", lineHeight: 20, marginTop: 8, fontStyle: "italic" },
  bannerCountRow: { flexDirection: "row", alignItems: "center", marginTop: 16 },
  bannerCount: { fontSize: 13, color: "#5a7090" },
  bannerCountDot: { fontSize: 13, color: "#3a4a60" },
  bannerCountAccent: { fontSize: 13, color: "#d4af37", fontWeight: "600" },
  section: { marginBottom: 8 },
  sectionHead: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  sectionTitle: { fontSize: 12, color: "#8899bb", fontWeight: "700", letterSpacing: 2, marginHorizontal: 12 },
  sectionBar: { flex: 1, height: 1, backgroundColor: "#ffffff14" },
});
