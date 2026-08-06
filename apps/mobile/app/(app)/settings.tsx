import React from "react";
import { View, Image, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTheme, ThemeMode } from "../../src/context/theme";

const OPTIONS: { label: string; value: ThemeMode }[] = [
  { label: "Dark", value: "dark" },
  { label: "Light", value: "light" },
  { label: "System Default", value: "system" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { mode, colors, setMode } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient
        colors={["#C81A1A", "#7520CC", "#1834D4"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 10, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
      >
        <TouchableOpacity activeOpacity={0.75} onPress={() => router.replace("/(app)/dashboard" as any)}>
          <Image
            source={require("../../assets/RV.png")}
            style={{ width: 118, height: 27, tintColor: "#ffffff" }}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>Settings</Text>
        <View style={{ width: 118 }} />
      </LinearGradient>

      <View style={{ padding: 20 }}>
        <Text style={[styles.sectionLabel, { color: colors.textSub }]}>APPEARANCE</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {OPTIONS.map((opt, i) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.row, i < OPTIONS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              onPress={() => setMode(opt.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowLabel, { color: colors.text }]}>{opt.label}</Text>
              <View style={[styles.radio, { borderColor: mode === opt.value ? colors.accent : colors.border }]}>
                {mode === opt.value && <View style={[styles.radioDot, { backgroundColor: colors.accent }]} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, marginBottom: 10, marginLeft: 4 },
  card:         { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  row:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  rowLabel:     { fontSize: 15, fontWeight: "500" },
  radio:        { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot:     { width: 10, height: 10, borderRadius: 5 },
});
