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
  "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function Register() {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { register } = useAuth();
  const [name, setName] = useState("");
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
      await register(email.trim(), password, name.trim());
      router.replace("/");
    } catch (e: any) {
      setError(t(e?.message || "error.generic"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <Image source={{ uri: HERO }} style={s.hero} contentFit="cover" />
      <LinearGradient colors={["rgba(12,12,14,0.2)", "rgba(12,12,14,0.85)", "#0C0C0E"]} style={s.scrim} />
      <KeyboardAwareScrollView
        contentContainerStyle={[s.content, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + spacing.xl }]}
        bottomOffset={20}
      >
        <Text style={s.brand}>{t("auth.register")}</Text>
        <View style={s.form}>
          <Input testID="reg-name" label={t("auth.name")} value={name} onChangeText={setName} placeholder="Alex" />
          <Input testID="reg-email" label={t("auth.email")} value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" />
          <Input testID="reg-password" label={t("auth.password")} value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
          {error ? <Text style={s.error} testID="reg-error">{error}</Text> : null}
          <Button testID="reg-submit" label={t("auth.signUp")} onPress={submit} loading={loading} style={{ marginTop: spacing.sm }} />
          <Pressable testID="go-login" onPress={() => router.back()} style={s.switch}>
            <Text style={s.switchText}>
              {t("auth.haveAccount")} <Text style={s.switchLink}>{t("auth.signIn")}</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  hero: { position: "absolute", top: 0, left: 0, right: 0, height: 360 },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, height: 360 },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, justifyContent: "flex-end" },
  brand: { color: c.onSurface, fontSize: 34, fontWeight: "900", letterSpacing: 0.5, marginBottom: spacing.xl },
  form: { gap: spacing.md },
  error: { color: c.error, fontSize: 14, fontWeight: "600" },
  switch: { marginTop: spacing.lg, alignItems: "center" },
  switchText: { color: c.muted, fontSize: 15 },
  switchLink: { color: c.brandPrimary, fontWeight: "800" },
}));
