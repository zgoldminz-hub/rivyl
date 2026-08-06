import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "../src/store/auth";
import { ThemeProvider } from "../src/context/theme";

export default function RootLayout() {
  const { fetchMe } = useAuth();

  useEffect(() => {
    fetchMe();
  }, []);

  return (
    <ThemeProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
