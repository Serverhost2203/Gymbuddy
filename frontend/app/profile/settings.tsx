import { useState } from "react";
import { View, Text, Pressable, ScrollView, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check } from "phosphor-react-native";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { setLanguage, LANGUAGES } from "@/src/i18n";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { Header, Card } from "@/src/components/ui";

const NOTIF_KEYS = ["workout", "meal", "water", "weight", "rest", "pr"];
const NOTIF_LABELS: Record<string, string> = {
  workout: "settings.workoutReminders",
  meal: "settings.mealReminders",
  water: "settings.waterReminders",
  weight: "settings.weightReminders",
  rest: "settings.restNotifications",
  pr: "settings.prNotifications",
};

export default function Settings() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [lang, setLang] = useState(i18n.language);
  const [notifs, setNotifs] = useState<Record<string, boolean>>(user?.settings?.notifications || {});

  const saveMut = useMutation({
    mutationFn: (body: any) => apiFetch("/settings", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => refreshUser(),
  });

  const chooseLang = async (code: string) => {
    setLang(code);
    await setLanguage(code);
    saveMut.mutate({ language: code });
  };
  const toggleNotif = (key: string) => {
    const next = { ...notifs, [key]: !notifs[key] };
    setNotifs(next);
    saveMut.mutate({ notifications: next });
  };

  return (
    <View style={s.root}>
      <Header title={t("profile.settings")} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        <Card>
          <Text style={s.cardTitle}>{t("profile.language")}</Text>
          {LANGUAGES.map((l) => (
            <Pressable key={l.code} testID={`lang-${l.code}`} onPress={() => chooseLang(l.code)} style={s.langRow}>
              <Text style={s.flag}>{l.flag}</Text>
              <Text style={s.langLabel}>{l.label}</Text>
              {lang === l.code && <Check color={colors.brandPrimary} size={20} weight="bold" />}
            </Pressable>
          ))}
        </Card>

        <Card>
          <Text style={s.cardTitle}>{t("settings.notifications")}</Text>
          {NOTIF_KEYS.map((k) => (
            <View key={k} style={s.notifRow}>
              <Text style={s.notifLabel}>{t(NOTIF_LABELS[k])}</Text>
              <Switch
                testID={`notif-${k}`}
                value={!!notifs[k]}
                onValueChange={() => toggleNotif(k)}
                trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }}
                thumbColor={colors.onSurface}
              />
            </View>
          ))}
          <Text style={s.notifHint}>Notifications activate after you publish and build the app.</Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  cardTitle: { color: c.onSurface, fontSize: 16, fontWeight: "800", marginBottom: spacing.sm },
  langRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: c.divider },
  flag: { fontSize: 22 },
  langLabel: { color: c.onSurface, fontSize: 16, fontWeight: "600", flex: 1 },
  notifRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: c.divider },
  notifLabel: { color: c.onSurfaceSecondary, fontSize: 15, fontWeight: "600", flex: 1 },
  notifHint: { color: c.muted, fontSize: 12, marginTop: spacing.sm },
}));
