import { useState } from "react";
import { View, Text, Pressable, FlatList, TextInput } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Trash, X } from "phosphor-react-native";

import { apiFetch } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { Header, Button, Input, ChipRow } from "@/src/components/ui";

type PEx = { exercise_name: string; sets: string; reps: string; rest: string };
type PDay = { name: string; exercises: PEx[] };

export default function CreatePlan() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();

  const [name, setName] = useState("");
  const [level, setLevel] = useState("beginner");
  const [goal, setGoal] = useState("general_fitness");
  const [split, setSplit] = useState("custom");
  const [days, setDays] = useState<PDay[]>([{ name: "Day 1", exercises: [] }]);
  const [picker, setPicker] = useState<number | null>(null);

  const exListQ = useQuery({ queryKey: ["exercises", "all"], queryFn: () => apiFetch<any[]>("/exercises"), enabled: picker !== null });

  const saveMut = useMutation({
    mutationFn: () =>
      apiFetch("/plans", {
        method: "POST",
        body: JSON.stringify({
          name: name || "My Plan",
          level, goal, split, description: "",
          days: days.map((d) => ({
            name: d.name,
            exercises: d.exercises.map((e) => ({ exercise_name: e.exercise_name, sets: parseInt(e.sets) || 3, reps: e.reps || "10", weight: 0, rest: parseInt(e.rest) || 90 })),
          })),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      router.back();
    },
  });

  const addExercise = (dayIdx: number, ex: any) => {
    setDays((prev) => prev.map((d, i) => (i === dayIdx ? { ...d, exercises: [...d.exercises, { exercise_name: ex.name, sets: "3", reps: "10", rest: "90" }] } : d)));
    setPicker(null);
  };
  const updateEx = (di: number, ei: number, key: keyof PEx, v: string) => {
    setDays((prev) => prev.map((d, i) => (i === di ? { ...d, exercises: d.exercises.map((e, j) => (j === ei ? { ...e, [key]: v } : e)) } : d)));
  };
  const removeEx = (di: number, ei: number) => setDays((prev) => prev.map((d, i) => (i === di ? { ...d, exercises: d.exercises.filter((_, j) => j !== ei) } : d)));

  return (
    <View style={s.root}>
      <Header title={t("workout.createPlan")} onBack={() => router.back()} />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100, gap: spacing.md }} bottomOffset={80}>
        <Input testID="plan-name" label={t("workout.planName")} value={name} onChangeText={setName} placeholder="Push Day" />

        <Text style={s.label}>{t("workout.beginner")}</Text>
        <ChipRow items={["beginner", "intermediate", "advanced"].map((k) => ({ key: k, label: t(`workout.${k}`) }))} selected={level} onSelect={setLevel} />
        <Text style={s.label}>{t("onboarding.goal")}</Text>
        <ChipRow items={["general_fitness", "muscle_building", "strength", "fat_loss"].map((k) => ({ key: k, label: t(`goal.${k}`) }))} selected={goal} onSelect={setGoal} />

        {days.map((day, di) => (
          <View key={di} style={s.dayCard}>
            <View style={s.dayHead}>
              <TextInput testID={`day-name-${di}`} value={day.name} onChangeText={(v) => setDays((prev) => prev.map((d, i) => (i === di ? { ...d, name: v } : d)))} style={s.dayNameInput} />
              {days.length > 1 && (
                <Pressable testID={`remove-day-${di}`} onPress={() => setDays((prev) => prev.filter((_, i) => i !== di))}><Trash color={colors.error} size={18} /></Pressable>
              )}
            </View>
            {day.exercises.map((ex, ei) => (
              <View key={ei} style={s.exItem}>
                <View style={s.exItemHead}>
                  <Text style={s.exItemName}>{ex.exercise_name}</Text>
                  <Pressable testID={`remove-planex-${di}-${ei}`} onPress={() => removeEx(di, ei)}><X color={colors.muted} size={16} /></Pressable>
                </View>
                <View style={s.exInputs}>
                  <View style={s.miniField}><Text style={s.miniLabel}>{t("workout.sets")}</Text><TextInput value={ex.sets} onChangeText={(v) => updateEx(di, ei, "sets", v)} keyboardType="numeric" style={s.miniInput} /></View>
                  <View style={s.miniField}><Text style={s.miniLabel}>{t("workout.reps")}</Text><TextInput value={ex.reps} onChangeText={(v) => updateEx(di, ei, "reps", v)} style={s.miniInput} /></View>
                  <View style={s.miniField}><Text style={s.miniLabel}>{t("workout.rest")}</Text><TextInput value={ex.rest} onChangeText={(v) => updateEx(di, ei, "rest", v)} keyboardType="numeric" style={s.miniInput} /></View>
                </View>
              </View>
            ))}
            <Pressable testID={`add-planex-${di}`} onPress={() => setPicker(di)} style={s.addExBtn}>
              <Plus color={colors.brandPrimary} size={16} weight="bold" />
              <Text style={s.addExText}>{t("workout.addExercise")}</Text>
            </Pressable>
          </View>
        ))}

        <Pressable testID="add-day" onPress={() => setDays((prev) => [...prev, { name: `Day ${prev.length + 1}`, exercises: [] }])} style={s.addDay}>
          <Plus color={colors.onSurface} size={18} weight="bold" />
          <Text style={s.addDayText}>{t("workout.days")}</Text>
        </Pressable>

        <Button testID="save-plan" label={t("common.save")} onPress={() => saveMut.mutate()} loading={saveMut.isPending} disabled={!name} style={{ marginTop: spacing.md }} />
      </KeyboardAwareScrollView>

      {picker !== null && (
        <View style={s.pickerOverlay}>
          <View style={[s.pickerSheet, { paddingTop: insets.top + spacing.md }]}>
            <View style={s.pickerHead}>
              <Text style={s.pickerTitle}>{t("workout.addExercise")}</Text>
              <Pressable testID="close-picker" onPress={() => setPicker(null)}><X color={colors.onSurface} size={24} /></Pressable>
            </View>
            <FlatList
              data={exListQ.data || []}
              keyExtractor={(it) => it.id}
              contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
              renderItem={({ item }) => (
                <Pressable testID={`pick-${item.id}`} style={s.pickRow} onPress={() => addExercise(picker, item)}>
                  <Text style={s.pickName}>{item.name}</Text>
                  <Text style={s.pickMg}>{item.muscle_group}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  label: { color: c.onSurfaceTertiary, fontSize: 13, fontWeight: "700", marginLeft: spacing.lg },
  dayCard: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg, gap: spacing.sm },
  dayHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayNameInput: { color: c.onSurface, fontSize: 17, fontWeight: "800", flex: 1 },
  exItem: { backgroundColor: c.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  exItemHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  exItemName: { color: c.onSurface, fontSize: 15, fontWeight: "700", flex: 1 },
  exInputs: { flexDirection: "row", gap: spacing.sm },
  miniField: { flex: 1, gap: 2 },
  miniLabel: { color: c.muted, fontSize: 11, fontWeight: "600" },
  miniInput: { backgroundColor: c.surface, borderRadius: radius.sm, height: 40, textAlign: "center", color: c.onSurface, fontWeight: "700" },
  addExBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: spacing.sm },
  addExText: { color: c.brandPrimary, fontSize: 14, fontWeight: "700" },
  addDay: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, height: 50 },
  addDayText: { color: c.onSurface, fontSize: 15, fontWeight: "700" },
  pickerOverlay: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)" },
  pickerSheet: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.surface },
  pickerHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg },
  pickerTitle: { color: c.onSurface, fontSize: 22, fontWeight: "900" },
  pickRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  pickName: { color: c.onSurface, fontSize: 16, fontWeight: "700" },
  pickMg: { color: c.muted, fontSize: 13 },
}));
