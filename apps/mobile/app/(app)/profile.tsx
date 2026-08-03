import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/store/auth";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleSignOut() {
    await logout();
    router.replace("/(auth)/login");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Profile</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.username?.[0]?.toUpperCase() ?? "?"}</Text>
        </View>
        <Text style={styles.username}>@{user?.username}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0f14" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#2a3347", backgroundColor: "#161b24" },
  back: { fontSize: 14, color: "#8a95a8", width: 60 },
  title: { fontSize: 16, fontWeight: "700", color: "#e8eaf0" },
  content: { flex: 1, alignItems: "center", paddingTop: 48, paddingHorizontal: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#4f7cff", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  avatarText: { fontSize: 32, fontWeight: "800", color: "#fff" },
  username: { fontSize: 20, fontWeight: "700", color: "#e8eaf0", marginBottom: 4 },
  email: { fontSize: 14, color: "#8a95a8", marginBottom: 48 },
  signOutBtn: { backgroundColor: "#e63946", paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12, width: "100%" },
  signOutText: { color: "#fff", fontSize: 16, fontWeight: "700", textAlign: "center" },
});
