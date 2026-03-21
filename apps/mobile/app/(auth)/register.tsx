import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/store/auth";
import AuthLayout from "../../src/components/AuthLayout";
import Input from "../../src/components/Input";
import Button from "../../src/components/Button";

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.email.includes("@")) e.email = "Enter a valid email";
    if (form.username.length < 3) e.username = "At least 3 characters";
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) e.username = "Letters, numbers, underscores only";
    if (form.password.length < 8) e.password = "At least 8 characters";
    return e;
  }

  async function handleRegister() {
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setServerError(null);
    setLoading(true);
    const err = await register(form.email, form.username, form.password);
    setLoading(false);
    if (err) {
      setServerError(err);
    } else {
      router.replace("/(app)/dashboard");
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Play fantasy. Win real money.">
      <Input
        label="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        value={form.email}
        onChangeText={(v) => setForm({ ...form, email: v })}
        error={errors.email}
      />
      <Input
        label="Username"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="e.g. gridiron_king"
        value={form.username}
        onChangeText={(v) => setForm({ ...form, username: v })}
        error={errors.username}
      />
      <Input
        label="Password"
        secureTextEntry
        value={form.password}
        onChangeText={(v) => setForm({ ...form, password: v })}
        error={errors.password}
      />
      {serverError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{serverError}</Text>
        </View>
      )}
      <Button onPress={handleRegister} loading={loading} style={{ marginTop: 8 }}>
        Create account
      </Button>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account? </Text>
        <Pressable onPress={() => router.push("/(auth)/login")}>
          <Text style={styles.footerLink}>Sign in</Text>
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
