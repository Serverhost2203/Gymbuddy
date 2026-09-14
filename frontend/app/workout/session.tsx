import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, TextInput, FlatList, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { Check, Plus, Minus, Trash, X, TrendUp } from "phosphor-react-native";

import { apiFetch } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { useAuth } from "@/src/auth";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { Header, Button, Loading } from "@/src/components/ui";
import { ProgressRing } from "@/src/components/ProgressRing";

type SetRow = { reps: string; weight: string; done: boolean };
type Ex = { exercise_name: string; muscle_group?: string; rest: number; sets: SetRow[] };

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Session() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { planId, dayIndex } = useLocalSearchParams<{ planId?: string; dayIndex?: string }>();
  const { user } = useAuth();
  const defaultRest = user?.settings?.default_rest ?? 90;
  const autoStartRest = user?.settings?.rest_autostart !== false;

  const [exercises, setExercises] = useState<Ex[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [rest, setRest] = useState<{ total: number; left: number } | null>(null);
  const [picker, setPicker] = useState(false);
  const [prResult, setPrResult] = useState<any[] | null>(null);
  const [sessionName, setSessionName] = useState(t("workout.activeSession"));
  const started = useRef(false);

  const planQ = useQuery({ queryKey: ["plan", planId], queryFn: () => apiFetch(`/plans/${planId}`), enabled: !!planId });
  const exListQ = useQuery({ queryKey: ["exercises", "all"], queryFn: () => apiFetch<any[]>("/exercises"), enabled: picker });

  const names = useMemo(() => exercises.map((e) => e.exercise_name), [exercises]);
  const suggQ = useQuery({
    queryKey: ["suggestions", names.join("|")],
    queryFn: () => apiFetch<Record<string, any>>("/exercises/suggestions", { method: "POST", body: JSON.stringify({ names }) }),
    enabled: names.length > 0,
  });

  useEffect(() => {
    if (planId && planQ.data && !started.current) {
      started.current = true;
      const day = planQ.data.days?.[parseInt(dayIndex || "0")];
      if (day) {
        setSessionName(`${planQ.data.name} · ${day.name}`);
        setExercises(
          day.exercises.map((e: any) => ({
            exercise_name: e.exercise_name,
            rest: e.rest || 90,
            sets: Array.from({ length: e.sets || 3 }, () => ({ reps: String(e.reps || "").replace(/\D/g, "") || "10", weight: "", done: false })),
          }))
        );
      }
    }
  }, [planQ.data, planId, dayIndex]);

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!rest) return;
    if (rest.left <= 0) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setRest(null);
      return;
    }
    const id = setTimeout(() => setRest({ ...rest, left: rest.left - 1 }), 1000);
    return () => clearTimeout(id);
  }, [rest]);

  const saveMut = useMutation({
    mutationFn: () =>
      apiFetch("/sessions", {
        method: "POST",
        body: JSON.stringify({
          name: sessionName,
          plan_id: planId || null,
          duration: elapsed,
          exercises: exercises.map((e) => ({
            exercise_name: e.exercise_name,
            muscle_group: e.muscle_group,
            sets: e.sets.map((st) => ({ reps: parseFloat(st.reps) || 0, weight: parseFloat(st.weight) || 0, done: st.done })),
          })),
        }),
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries();
      if (res.new_prs?.length) setPrResult(res.new_prs);
      else router.back();
    },
  });

  const toggleSet = (ei: number, si: number) => {
    setExercises((prev) => {
      const copy = prev.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x })) }));
      const set = copy[ei].sets[si];
      set.done = !set.done;
      if (set.done) {
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        if (autoStartRest) setRest({ total: copy[ei].rest, left: copy[ei].rest });
      }
      return copy;
    });
  };
  const changeRest = (ei: number, delta: number) => {
    setExercises((prev) => {
      const copy = prev.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x })) }));
      copy[ei].rest = Math.max(15, (copy[ei].rest || 90) + delta);
      return copy;
    });
  };
  const applySuggestion = (ei: number, sg: { weight: number; reps: number }) => {
    setExercises((prev) => {
      const copy = prev.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x })) }));
      copy[ei].sets = copy[ei].sets.map((st) => ({ ...st, weight: String(sg.weight), reps: String(sg.reps) }));
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      return copy;
    });
  };
  const updateSet = (ei: number, si: number, key: "reps" | "weight", v: string) => {
    setExercises((prev) => {
      const copy = prev.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x })) }));
      copy[ei].sets[si][key] = v;
      return copy;
    });
  };
  const addSet = (ei: number) => {
    setExercises((prev) => {
      const copy = prev.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x })) }));
      const last = copy[ei].sets[copy[ei].sets.length - 1];
      copy[ei].sets.push({ reps: last?.reps || "10", weight: last?.weight || "", done: false });
      return copy;
    });
  };
  const addExercise = (ex: any) => {
    setExercises((prev) => [...prev, { exercise_name: ex.name, muscle_group: ex.muscle_group, rest: defaultRest, sets: [{ reps: "10", weight: "", done: false }] }]);
    setPicker(false);
  };
  const removeExercise = (ei: number) => setExercises((prev) => prev.filter((_, i) => i !== ei));

  if (planId && planQ.isLoading) return <Loading />;

  return (
    <View style={s.root}>
      <Header title={sessionName} onBack={() => router.back()} right={<Text style={s.timer}>{fmt(elapsed)}</Text>} />

      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100, gap: spacing.md }} bottomOffset={80}>
        {exercises.map((ex, ei) => {
          const sg = suggQ.data?.[ex.exercise_name];
          return (
          <View key={ei} style={s.exCard} testID={`session-ex-${ei}`}>
            <View style={s.exHead}>
              <Text style={s.exName}>{ex.exercise_name}</Text>
              <Pressable testID={`remove-ex-${ei}`} onPress={() => removeExercise(ei)} hitSlop={8}><Trash color={colors.muted} size={18} /></Pressable>
            </View>

            {sg?.last ? (
              <View style={s.sugg} testID={`sugg-${ei}`}>
                <TrendUp color={colors.success} size={16} weight="bold" />
                <Text style={s.suggText}>
                  {t("workout.lastTime")}: {sg.last.weight}kg × {sg.last.reps}
                  {sg.suggestion ? `  ·  ${t("workout.target")}: ${sg.suggestion.weight}kg × ${sg.suggestion.reps}` : ""}
                </Text>
                {sg.suggestion ? (
                  <Pressable testID={`apply-sugg-${ei}`} onPress={() => applySuggestion(ei, sg.suggestion)} style={s.applyBtn}>
                    <Text style={s.applyText}>{t("workout.apply")}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View style={s.restCtrl}>
              <Text style={s.restLabelSmall}>{t("workout.rest")}</Text>
              <Pressable testID={`rest-minus-${ei}`} onPress={() => changeRest(ei, -15)} style={s.restStep}><Minus color={colors.onSurface} size={14} weight="bold" /></Pressable>
              <Text style={s.restVal}>{ex.rest}s</Text>
              <Pressable testID={`rest-plus-${ei}`} onPress={() => changeRest(ei, 15)} style={s.restStep}><Plus color={colors.onSurface} size={14} weight="bold" /></Pressable>
            </View>

            <View style={s.setHeader}>
              <Text style={[s.setHeaderText, { width: 40 }]}>{t("workout.sets").toUpperCase()}</Text>
              <Text style={[s.setHeaderText, { flex: 1 }]}>KG</Text>
              <Text style={[s.setHeaderText, { flex: 1 }]}>{t("workout.reps").toUpperCase()}</Text>
              <View style={{ width: 48 }} />
            </View>
            {ex.sets.map((st, si) => (
              <View key={si} style={[s.setRow, st.done && s.setRowDone]}>
                <View style={s.setNumBadge}><Text style={s.setNum}>{si + 1}</Text></View>
                <View style={s.inputWrap}>
                  <TextInput testID={`set-weight-${ei}-${si}`} value={st.weight} onChangeText={(v) => updateSet(ei, si, "weight", v)} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} style={s.setInput} />
                </View>
                <View style={s.inputWrap}>
                  <TextInput testID={`set-reps-${ei}-${si}`} value={st.reps} onChangeText={(v) => updateSet(ei, si, "reps", v)} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} style={s.setInput} />
                </View>
                <Pressable testID={`set-done-${ei}-${si}`} onPress={() => toggleSet(ei, si)} style={[s.doneBtn, st.done && { backgroundColor: colors.success, borderColor: colors.success }]}>
                  <Check color={st.done ? colors.onSuccess : colors.muted} size={20} weight="bold" />
                </Pressable>
              </View>
            ))}
            <Pressable testID={`add-set-${ei}`} onPress={() => addSet(ei)} style={s.addSet}>
              <Plus color={colors.brandPrimary} size={16} weight="bold" />
              <Text style={s.addSetText}>{t("workout.addSet")}</Text>
            </Pressable>
          </View>
          );
        })}

        <Pressable testID="add-exercise-btn" onPress={() => setPicker(true)} style={s.addEx}>
          <Plus color={colors.onSurface} size={18} weight="bold" />
          <Text style={s.addExText}>{t("workout.addExercise")}</Text>
        </Pressable>
      </KeyboardAwareScrollView>

      {exercises.length > 0 && (
        <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button testID="finish-session" label={t("workout.finishSession")} onPress={() => saveMut.mutate()} loading={saveMut.isPending} />
        </View>
      )}

      {/* Rest timer overlay */}
      {rest && (
        <Pressable testID="rest-overlay" style={s.restOverlay} onPress={() => setRest(null)}>
          <View style={s.restCard}>
            <ProgressRing progress={1 - rest.left / rest.total} size={160} strokeWidth={12} color={colors.brandPrimary} trackColor={colors.surfaceTertiary}>
              <Text style={s.restTime}>{fmt(rest.left)}</Text>
              <Text style={s.restLabel}>{t("workout.restTimer")}</Text>
            </ProgressRing>
            <Button testID="skip-rest" label={t("workout.skip")} variant="secondary" onPress={() => setRest(null)} style={{ marginTop: spacing.lg, minWidth: 160 }} />
          </View>
        </Pressable>
      )}

      {/* Exercise picker */}
      {picker && (
        <View style={s.pickerOverlay}>
          <View style={[s.pickerSheet, { paddingTop: insets.top + spacing.md }]}>
            <View style={s.pickerHead}>
              <Text style={s.pickerTitle}>{t("workout.addExercise")}</Text>
              <Pressable testID="close-picker" onPress={() => setPicker(false)}><X color={colors.onSurface} size={24} /></Pressable>
            </View>
            <FlatList
              data={exListQ.data || []}
              keyExtractor={(it) => it.id}
              contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
              renderItem={({ item }) => (
                <Pressable testID={`pick-${item.id}`} style={s.pickRow} onPress={() => addExercise(item)}>
                  <Text style={s.pickName}>{item.name}</Text>
                  <Text style={s.pickMg}>{item.muscle_group}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      )}

      {/* PR result */}
      {prResult && (
        <View style={s.pickerOverlay}>
          <View style={s.prCard}>
            <Text style={s.prTitle}>🏆 {t("workout.prAchieved")}</Text>
            {prResult.map((pr, i) => (
              <Text key={i} style={s.prLine}>{pr.exercise_name}: {pr.weight}kg × {pr.reps}</Text>
            ))}
            <Button testID="pr-done" label={t("common.done")} onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
          </View>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  timer: { color: c.brandPrimary, fontSize: 18, fontWeight: "900", fontVariant: ["tabular-nums"] },
  exCard: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg },
  exHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  exName: { color: c.onSurface, fontSize: 17, fontWeight: "800", flex: 1 },
  sugg: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "rgba(50,215,75,0.10)", borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.md },
  suggText: { color: c.onSurfaceSecondary, fontSize: 12, fontWeight: "600", flex: 1 },
  applyBtn: { backgroundColor: c.success, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.sm },
  applyText: { color: c.onSuccess, fontSize: 12, fontWeight: "800" },
  restCtrl: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  restLabelSmall: { color: c.muted, fontSize: 12, fontWeight: "700", flex: 1 },
  restStep: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  restVal: { color: c.onSurface, fontSize: 14, fontWeight: "800", minWidth: 44, textAlign: "center" },
  setHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm, paddingHorizontal: 2 },
  setHeaderText: { color: c.muted, fontSize: 11, fontWeight: "800", textAlign: "center", letterSpacing: 0.5 },
  setRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  setRowDone: { opacity: 1 },
  setNumBadge: { width: 40, height: 48, borderRadius: radius.sm, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  setNum: { color: c.onSurfaceSecondary, fontSize: 16, fontWeight: "800" },
  inputWrap: { flex: 1 },
  setInput: { backgroundColor: c.surfaceTertiary, borderRadius: radius.sm, height: 48, textAlign: "center", color: c.onSurface, fontSize: 18, fontWeight: "800", borderWidth: 1, borderColor: c.border },
  doneBtn: { width: 48, height: 48, borderRadius: radius.sm, borderWidth: 1.5, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center" },
  addSet: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: spacing.xs },
  addSetText: { color: c.brandPrimary, fontSize: 14, fontWeight: "700" },
  addEx: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, height: 52 },
  addExText: { color: c.onSurface, fontSize: 15, fontWeight: "700" },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: c.divider, backgroundColor: c.surface },
  restOverlay: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(12,12,14,0.92)", alignItems: "center", justifyContent: "center" },
  restCard: { alignItems: "center" },
  restTime: { color: c.onSurface, fontSize: 40, fontWeight: "900", fontVariant: ["tabular-nums"] },
  restLabel: { color: c.muted, fontSize: 13, fontWeight: "700" },
  pickerOverlay: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)" },
  pickerSheet: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.surface },
  pickerHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg },
  pickerTitle: { color: c.onSurface, fontSize: 22, fontWeight: "900" },
  pickRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  pickName: { color: c.onSurface, fontSize: 16, fontWeight: "700" },
  pickMg: { color: c.muted, fontSize: 13 },
  prCard: { position: "absolute", top: "30%", left: spacing.xl, right: spacing.xl, backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: c.brandPrimary },
  prTitle: { color: c.onSurface, fontSize: 24, fontWeight: "900", marginBottom: spacing.md, textAlign: "center" },
  prLine: { color: c.onSurfaceSecondary, fontSize: 15, fontWeight: "600", textAlign: "center", marginBottom: 4 },
}));
