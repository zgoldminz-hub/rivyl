import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "dark" | "light" | "system";

export const DARK = {
  bg: "#0d0f14", surface: "#161b24", border: "#2a3347",
  text: "#e8eaf0", textSub: "#8a95a8", accent: "#4f7cff",
};
export const LIGHT = {
  bg: "#f1f5f9", surface: "#ffffff", border: "#e2e8f0",
  text: "#0f172a", textSub: "#64748b", accent: "#4f7cff",
};

export type Colors = typeof DARK;

interface ThemeContextValue { mode: ThemeMode; colors: Colors; setMode: (m: ThemeMode) => void; }
const ThemeContext = createContext<ThemeContextValue>({ mode: "dark", colors: DARK, setMode: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    AsyncStorage.getItem("theme_mode").then((val) => {
      if (val === "dark" || val === "light" || val === "system") setModeState(val as ThemeMode);
    });
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem("theme_mode", m);
  };

  const colors = mode === "system" ? (system === "light" ? LIGHT : DARK) : mode === "light" ? LIGHT : DARK;

  return <ThemeContext.Provider value={{ mode, colors, setMode }}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }
