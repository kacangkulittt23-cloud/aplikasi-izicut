import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/icon";
import { useToast } from "@/src/components/toast";
import { useAuth } from "@/src/context/auth";
import { makeStyles, useTheme } from "@/src/theme";

export default function AdminLogin() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();
  const toast = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) {
      toast("Isi username dan password", "error");
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace("/admin");
    } catch (e: any) {
      toast(e.message || "Login gagal", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={10} style={styles.headerBtn}>
          <Icon name="ArrowLeft" size={22} color={colors.onSurface} />
        </Pressable>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.body}>
        <View style={styles.badge}>
          <Icon name="ShieldStar" size={44} color={colors.brandPrimary} weight="fill" />
        </View>
        <Text style={styles.title}>LOGIN ADMIN</Text>
        <Text style={styles.subtitle}>Khusus Watpers Bag SDM Polres Mimika</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            testID="login-username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholder="username"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            testID="login-password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            style={styles.input}
            onSubmitEditing={submit}
            returnKeyType="go"
          />
          <Pressable testID="login-submit" onPress={submit} style={styles.btn} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.btnText}>Masuk</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 12, paddingBottom: 8 },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, paddingHorizontal: 24, alignItems: "center", justifyContent: "center" },
  badge: {
    width: 88, height: 88, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(212,175,55,0.10)", borderWidth: 1, borderColor: colors.brandPrimary, marginBottom: 20,
  },
  title: { color: colors.onSurface, fontFamily: "Oswald", fontSize: 30, letterSpacing: 2 },
  subtitle: { color: colors.brandPrimary, fontFamily: "DMSans", fontSize: 13, marginTop: 4, marginBottom: 28 },
  form: { alignSelf: "stretch" },
  label: { color: colors.onSurfaceSecondary, fontFamily: "DMSans", fontSize: 13, fontWeight: "600", marginBottom: 8 },
  input: {
    backgroundColor: colors.surfaceTertiary, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    color: colors.onSurface, fontFamily: "DMSans", fontSize: 16, paddingHorizontal: 16, height: 52, marginBottom: 16,
  },
  btn: { backgroundColor: colors.brandPrimary, height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 6 },
  btnText: { color: colors.onBrandPrimary, fontFamily: "DMSans", fontSize: 16, fontWeight: "700" },
}));
