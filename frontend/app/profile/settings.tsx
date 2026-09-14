import { useState } from "react";
import { View, Text, Pressable, Switch } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check } from "phosphor-react-native";

import { apiFetch } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { useAuth } from "@/src/auth";
import { setLanguage, LANGUAGES } from "@/src/i18n";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { Header, Card, Input } from "@/src/components/ui";
import { clampNum } from "@/src/lib";

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
  const [restTime, setRestTime] = useState<number>(user?.settings?.default_rest ?? 90);
  const [autoRest, setAutoRest] = useState<boolean>(user?.settings?.rest_autostart !== false);
  const [waterGoal, setWaterGoal] = useState<string>(String(user?.settings?.water_goal ?? 2500));

  const saveMut = useMutation({
    mutationFn: (body: any) => apiFetch("/settings", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => { refreshUser(); queryClient.invalidateQueries({ queryKey: ["diary"] }); },
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
  const chooseRest = (sec: number) => { setRestTime(sec); saveMut.mutate({ default_rest: sec }); };
  const toggleAutoRest = () => { const v = !autoRest; setAutoRest(v); saveMut.mutate({ rest_autostart: v }); };
  const saveWaterGoal = () => saveMut.mutate({ water_goal: Math.round(clampNum(waterGoal)) || 2500 });

  const REST_OPTS = [60, 90, 120, 180];

  return (
    <View style={s.root}>
      <Header title={t("profile.settings")} onBack={() => router.back()} />
      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
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
          <Text style={s.cardTitle}>{t("settings.training")}</Text>
          <Text style={s.fieldLabel}>{t("settings.restTime")}</Text>
          <View style={s.restRow}>
            {REST_OPTS.map((sec) => (
              <Pressable key={sec} testID={`rest-${sec}`} onPress={() => chooseRest(sec)} style={[s.restChip, restTime === sec && s.restChipActive]}>
                <Text style={[s.restChipText, restTime === sec && { color: colors.onBrandPrimary }]}>{sec}s</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.notifRow}>
            <Text style={s.notifLabel}>{t("settings.autoStartRest")}</Text>
            <Switch testID="auto-rest" value={autoRest} onValueChange={toggleAutoRest} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} thumbColor={colors.onSurface} />
          </View>
          <Input testID="water-goal" label={t("settings.waterGoal")} value={waterGoal} onChangeText={setWaterGoal} keyboardType="numeric" style={{ marginTop: spacing.sm }} />
          <Pressable testID="save-water-goal" onPress={saveWaterGoal} style={s.saveInline}><Text style={s.saveInlineText}>{t("common.save")}</Text></Pressable>
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
      </KeyboardAwareScrollView>
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
  fieldLabel: { color: c.onSurfaceTertiary, fontSize: 13, fontWeight: "700", marginBottom: spacing.sm },
  restRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  restChip: { flex: 1, height: 42, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
  restChipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  restChipText: { color: c.onSurfaceTertiary, fontSize: 14, fontWeight: "800" },
  saveInline: { alignSelf: "flex-end", marginTop: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: c.brandTertiary },
  saveInlineText: { color: c.brandPrimary, fontWeight: "800", fontSize: 14 },
}));
