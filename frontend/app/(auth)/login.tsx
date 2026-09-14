import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/src/auth";
import { Button, Input } from "@/src/components/ui";
import { makeStyles, spacing } from "@/src/theme";

const HERO =
  "https://images.unsplash.com/photo-1637430308606-86576d8fef3c?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function Login() {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      setError(t("error.required"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login(email.trim(), password);
      router.replace("/");
    } catch (e: any) {
      setError(t(e?.message || "auth.invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <Image source={{ uri: HERO }} style={s.hero} contentFit="cover" />
      <LinearGradient colors={["rgba(12,12,14,0.2)", "rgba(12,12,14,0.85)", "#0C0C0E"]} style={s.scrim} />
      <KeyboardAwareScrollView
        contentContainerStyle={[s.content, { paddingTop: insets.top + 120, paddingBottom: insets.bottom + spacing.xl }]}
        bottomOffset={20}
      >
        <Text style={s.brand}>FORGE</Text>
        <Text style={s.tagline}>{t("auth.tagline")}</Text>

        <View style={s.form}>
          <Input testID="login-email" label={t("auth.email")} value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" />
          <Input testID="login-password" label={t("auth.password")} value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
          {error ? <Text style={s.error} testID="login-error">{error}</Text> : null}
          <Button testID="login-submit" label={t("auth.signIn")} onPress={submit} loading={loading} style={{ marginTop: spacing.sm }} />
          <Pressable testID="go-register" onPress={() => router.push("/(auth)/register")} style={s.switch}>
            <Text style={s.switchText}>
              {t("auth.noAccount")} <Text style={s.switchLink}>{t("auth.signUp")}</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  hero: { position: "absolute", top: 0, left: 0, right: 0, height: 420 },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, height: 420 },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, justifyContent: "flex-end" },
  brand: { color: c.onSurface, fontSize: 52, fontWeight: "900", letterSpacing: 4 },
  tagline: { color: c.brandPrimary, fontSize: 16, fontWeight: "700", marginBottom: spacing.xxl },
  form: { gap: spacing.md },
  error: { color: c.error, fontSize: 14, fontWeight: "600" },
  switch: { marginTop: spacing.lg, alignItems: "center" },
  switchText: { color: c.muted, fontSize: 15 },
  switchLink: { color: c.brandPrimary, fontWeight: "800" },
}));
