import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiFetch } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { useAuth } from "@/src/auth";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { Header, Button, Input } from "@/src/components/ui";
import { clampNum } from "@/src/lib";

const GOALS = ["muscle_gain", "fat_loss", "maintenance", "strength"];
const ACTIVITIES = ["sedentary", "light", "moderate", "active", "very_active"];
const GENDERS = ["male", "female", "other"];

export default function EditProfile() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const p = user?.profile || {};

  const [name, setName] = useState(p.name || "");
  const [age, setAge] = useState(p.age ? String(p.age) : "");
  const [gender, setGender] = useState(p.gender || "male");
  const [height, setHeight] = useState(p.height ? String(p.height) : "");
  const [weight, setWeight] = useState(p.weight ? String(p.weight) : "");
  const [target, setTarget] = useState(p.target_weight ? String(p.target_weight) : "");
  const [goal, setGoal] = useState(p.goal || "maintenance");
  const [activity, setActivity] = useState(p.activity_level || "moderate");
  const [birthdate, setBirthdate] = useState(p.birthdate || "");

  const mut = useMutation({
    mutationFn: () =>
      apiFetch("/profile", {
        method: "PUT",
        body: JSON.stringify({ name, age: parseInt(age) || 25, gender, height: clampNum(height), weight: clampNum(weight), target_weight: clampNum(target), goal, activity_level: activity, birthdate }),
      }),
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries();
      router.back();
    },
  });

  const Opt = ({ k, label, active, on }: any) => (
    <Pressable key={k} onPress={on} testID={`opt-${k}`} style={[s.opt, active ? s.optActive : s.optInactive]}>
      <Text style={[s.optText, active ? { color: colors.onBrandPrimary } : { color: colors.onSurfaceTertiary }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={s.root}>
      <Header title={t("profile.goals")} onBack={() => router.back()} />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }} bottomOffset={20}>
        <Input testID="edit-name" label={t("auth.name")} value={name} onChangeText={setName} />
        <View style={s.two}>
          <Input testID="edit-age" style={s.col} label={t("onboarding.age")} value={age} onChangeText={setAge} keyboardType="numeric" />
          <Input testID="edit-height" style={s.col} label={t("onboarding.height")} value={height} onChangeText={setHeight} keyboardType="numeric" />
        </View>
        <Input testID="edit-birthdate" label="Geb. (YYYY-MM-DD)" value={birthdate} onChangeText={setBirthdate} placeholder="1995-06-15" style={{ marginTop: spacing.md }} />
        <View style={s.two}>
          <Input testID="edit-weight" style={s.col} label={t("onboarding.weight")} value={weight} onChangeText={setWeight} keyboardType="numeric" />
          <Input testID="edit-target" style={s.col} label={t("onboarding.targetWeight")} value={target} onChangeText={setTarget} keyboardType="numeric" />
        </View>

        <Text style={s.label}>{t("onboarding.gender")}</Text>
        <View style={s.wrap}>{GENDERS.map((g) => <Opt key={g} k={g} label={t(`onboarding.${g}`)} active={gender === g} on={() => setGender(g)} />)}</View>
        <Text style={s.label}>{t("onboarding.goal")}</Text>
        <View style={s.wrap}>{GOALS.map((g) => <Opt key={g} k={g} label={t(`goal.${g}`)} active={goal === g} on={() => setGoal(g)} />)}</View>
        <Text style={s.label}>{t("onboarding.activityLevel")}</Text>
        <View style={s.wrap}>{ACTIVITIES.map((a) => <Opt key={a} k={a} label={t(`activity.${a}`)} active={activity === a} on={() => setActivity(a)} />)}</View>

        <Button testID="save-profile" label={t("common.save")} onPress={() => mut.mutate()} loading={mut.isPending} style={{ marginTop: spacing.xl }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  two: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  col: { flex: 1 },
  label: { color: c.onSurfaceTertiary, fontSize: 14, fontWeight: "700", marginTop: spacing.lg, marginBottom: spacing.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  opt: { paddingHorizontal: spacing.lg, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  optActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  optInactive: { backgroundColor: c.surfaceSecondary, borderColor: c.border },
  optText: { fontSize: 14, fontWeight: "700" },
}));
