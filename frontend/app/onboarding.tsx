import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/src/auth";
import { apiFetch } from "@/src/api";
import { Button, Input } from "@/src/components/ui";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { clampNum } from "@/src/lib";

const GOALS = ["muscle_gain", "fat_loss", "maintenance", "strength"];
const ACTIVITIES = ["sedentary", "light", "moderate", "active", "very_active"];
const GENDERS = ["male", "female", "other"];

function Option({ label, active, onPress, testID }: { label: string; active: boolean; onPress: () => void; testID?: string }) {
  const s = useStyles();
  return (
    <Pressable testID={testID} onPress={onPress} style={[s.option, active ? s.optionActive : s.optionInactive]}>
      <Text style={[s.optionText, active ? s.optionTextActive : s.optionTextInactive]}>{label}</Text>
    </Pressable>
  );
}

export default function Onboarding() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { refreshUser } = useAuth();

  const [age, setAge] = useState("");
  const [gender, setGender] = useState("male");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [target, setTarget] = useState("");
  const [goal, setGoal] = useState("muscle_gain");
  const [activity, setActivity] = useState("moderate");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await apiFetch("/profile", {
        method: "PUT",
        body: JSON.stringify({
          age: parseInt(age) || 25,
          gender,
          height: clampNum(height) || 175,
          weight: clampNum(weight) || 75,
          target_weight: clampNum(target) || clampNum(weight) || 75,
          goal,
          activity_level: activity,
          onboarded: true,
        }),
      });
      await refreshUser();
      router.replace("/(tabs)");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 100 }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.title}>{t("onboarding.title")}</Text>
        <Text style={s.subtitle}>{t("onboarding.subtitle")}</Text>

        <Text style={s.label}>{t("onboarding.gender")}</Text>
        <View style={s.rowWrap}>
          {GENDERS.map((g) => (
            <Option key={g} testID={`gender-${g}`} label={t(`onboarding.${g}`)} active={gender === g} onPress={() => setGender(g)} />
          ))}
        </View>

        <View style={s.twoCol}>
          <Input testID="ob-age" style={s.col} label={t("onboarding.age")} value={age} onChangeText={setAge} keyboardType="numeric" placeholder="25" />
          <Input testID="ob-height" style={s.col} label={t("onboarding.height")} value={height} onChangeText={setHeight} keyboardType="numeric" placeholder="175" />
        </View>
        <View style={s.twoCol}>
          <Input testID="ob-weight" style={s.col} label={t("onboarding.weight")} value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="75" />
          <Input testID="ob-target" style={s.col} label={t("onboarding.targetWeight")} value={target} onChangeText={setTarget} keyboardType="numeric" placeholder="70" />
        </View>

        <Text style={s.label}>{t("onboarding.goal")}</Text>
        <View style={s.rowWrap}>
          {GOALS.map((g) => (
            <Option key={g} testID={`goal-${g}`} label={t(`goal.${g}`)} active={goal === g} onPress={() => setGoal(g)} />
          ))}
        </View>

        <Text style={s.label}>{t("onboarding.activityLevel")}</Text>
        <View style={s.rowWrap}>
          {ACTIVITIES.map((a) => (
            <Option key={a} testID={`activity-${a}`} label={t(`activity.${a}`)} active={activity === a} onPress={() => setActivity(a)} />
          ))}
        </View>

        <Button testID="ob-finish" label={t("onboarding.finish")} onPress={submit} loading={loading} style={{ marginTop: spacing.xl }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  title: { color: c.onSurface, fontSize: 28, fontWeight: "900", marginTop: spacing.md },
  subtitle: { color: c.muted, fontSize: 15, marginTop: spacing.xs, marginBottom: spacing.xl },
  label: { color: c.onSurfaceTertiary, fontSize: 14, fontWeight: "700", marginTop: spacing.lg, marginBottom: spacing.sm },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  option: { paddingHorizontal: spacing.lg, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  optionActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  optionInactive: { backgroundColor: c.surfaceSecondary, borderColor: c.border },
  optionText: { fontSize: 14, fontWeight: "700" },
  optionTextActive: { color: c.onBrandPrimary },
  optionTextInactive: { color: c.onSurfaceTertiary },
  twoCol: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  col: { flex: 1 },
}));
