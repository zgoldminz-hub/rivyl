import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/store/auth";
import AuthLayout from "../../src/components/AuthLayout";
import Input from "../../src/components/Input";
import Button from "../../src/components/Button";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    const err = await login(form.email, form.password);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      router.replace("/(app)/dashboard");
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your Rivyl account">
      <Input
        label="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        value={form.email}
        onChangeText={(v) => setForm({ ...form, email: v })}
      />
      <Input
        label="Password"
        secureTextEntry
        value={form.password}
        onChangeText={(v) => setForm({ ...form, password: v })}
      />
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <Button onPress={handleLogin} loading={loading} style={{ marginTop: 8 }}>
        Sign in
      </Button>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account? </Text>
        <Pressable onPress={() => router.push("/(auth)/register")}>
          <Text style={styles.footerLink}>Create one</Text>
        </Pressable>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    color: "#8a95a8",
    fontSize: 13,
  },
  footerLink: {
    color: "#4f7cff",
    fontSize: 13,
  },
});
