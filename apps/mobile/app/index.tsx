import { Redirect } from "expo-router";
import { useAuth } from "../src/store/auth";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0d0f14" }}>
        <ActivityIndicator color="#4f7cff" />
      </View>
    );
  }

  return user ? <Redirect href="/(app)/dashboard" /> : <Redirect href="/(auth)/login" />;
}
