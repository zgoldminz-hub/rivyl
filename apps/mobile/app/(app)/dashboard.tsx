import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/store/auth";
import Button from "../../src/components/Button";

export default function DashboardScreen() {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.logo}>Rivyl</Text>
        <Text style={styles.username}>@{user?.username}</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.heading}>My Leagues</Text>
        <Text style={styles.empty}>You're not in any leagues yet.</Text>
        <Button style={{ marginTop: 16 }}>+ Create League</Button>
      </View>

      <View style={styles.footer}>
        <Button variant="ghost" onPress={logout}>
          Sign out
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0d0f14",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#2a3347",
    backgroundColor: "#161b24",
  },
  logo: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4f7cff",
    letterSpacing: -0.5,
  },
  username: {
    fontSize: 14,
    color: "#8a95a8",
  },
  body: {
    flex: 1,
    padding: 24,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#e8eaf0",
    marginBottom: 8,
  },
  empty: {
    fontSize: 14,
    color: "#8a95a8",
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#2a3347",
  },
});
