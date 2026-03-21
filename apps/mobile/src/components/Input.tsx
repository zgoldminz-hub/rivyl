import React from "react";
import { View, Text, TextInput, StyleSheet, TextInputProps } from "react-native";

interface Props extends TextInputProps {
  label: string;
  error?: string;
}

export default function Input({ label, error, ...props }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        placeholderTextColor="#8a95a8"
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "#8a95a8",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#1e2535",
    borderWidth: 1,
    borderColor: "#2a3347",
    borderRadius: 10,
    padding: 12,
    color: "#e8eaf0",
    fontSize: 15,
  },
  inputError: {
    borderColor: "#ef4444",
  },
  error: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 4,
  },
});
