import { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CaretDown, Trophy, PencilSimple } from "phosphor-react-native";

import { apiFetch } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { Header, Card, Loading, Button, Input, ChipRow } from "@/src/components/ui";
import { shortDate, clampNum } from "@/src/lib";

const GENDERS = ["male", "female", "other"];
const GOALS = ["muscle_gain", "fat_loss", "maintenance", "strength"];

function dur(sec: number) {
  if (!sec) return "—";
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function AdminUserDetail() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({ queryKey: ["admin-user", id], queryFn: () => apiFetch(`/admin/users/${id}/detail`) });

  const editMut = useMutation({
    mutationFn: () =>
      apiFetch(`/admin/users/${id}/profile`, {
        method: "PUT",
        body: JSON.stringify({
          name: form.name,
          birthdate: form.birthdate,
          age: parseInt(form.age) || undefined,
          gender: form.gender,
          height: clampNum(form.height) || undefined,
          weight: clampNum(form.weight) || undefined,
          target_weight: clampNum(form.target_weight) || undefined,
          goal: form.goal,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditing(false);
    },
  });

  const openEdit = () => {
    const p = data.user.profile || {};
    setForm({
      name: p.name || "", birthdate: p.birthdate || "", age: p.age ? String(p.age) : "",
      gender: p.gender || "male", height: p.height ? String(p.height) : "",
      weight: p.weight ? String(p.weight) : "", target_weight: p.target_weight ? String(p.target_weight) : "",
      goal: p.goal || "maintenance",
    });
    setEditing(true);
  };

  if (isLoading || !data) return <Loading />;

  const p = data.user.profile || {};
  const m = data.metrics || {};
  const info = [
    ["auth.name", p.name],
    ["auth.email", data.user.email],
    ["profile birthdate", p.birthdate],
    ["onboarding.age", p.age],
    ["onboarding.gender", p.gender ? t(`onboarding.${p.gender}`) : null],
    ["onboarding.height", p.height ? `${p.height} cm` : null],
    ["onboarding.weight", p.weight ? `${p.weight} kg` : null],
    ["onboarding.targetWeight", p.target_weight ? `${p.target_weight} kg` : null],
    ["onboarding.goal", p.goal ? t(`goal.${p.goal}`) : null],
    ["dashboard.bmi", m.bmi],
    ["nutrition.calories", m.calorie_target ? `${m.calorie_target} kcal` : null],
  ];

  return (
    <View style={s.root}>
      <Header title={p.name || data.user.email} onBack={() => router.back()} right={<Pressable testID="edit-user" onPress={openEdit}><PencilSimple color={colors.brandPrimary} size={22} weight="fill" /></Pressable>} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        {/* Totals */}
        <View style={s.totalsRow}>
          <Card style={s.totalCell}><Text style={s.totalNum}>{data.totals.workouts}</Text><Text style={s.totalLbl}>{t("progress.totalWorkouts")}</Text></Card>
          <Card style={s.totalCell}><Text style={s.totalNum}>{Math.round(data.totals.volume / 1000)}t</Text><Text style={s.totalLbl}>{t("progress.totalVolume")}</Text></Card>
          <Card style={s.totalCell}><Text style={s.totalNum}>{dur(data.totals.duration)}</Text><Text style={s.totalLbl}>{t("workout.duration")}</Text></Card>
        </View>

        {/* Profile */}
        <Card testID="user-profile-card">
          <Text style={s.cardTitle}>{t("profile.account")}</Text>
          {info.filter(([, v]) => v != null && v !== "").map(([k, v]) => (
            <View key={k as string} style={s.infoRow}>
              <Text style={s.infoLabel}>{k === "profile birthdate" ? "Geb." : t(k as any)}</Text>
              <Text style={s.infoVal}>{String(v)}</Text>
            </View>
          ))}
        </Card>

        {/* Training history */}
        <Card testID="user-training-card">
          <Text style={s.cardTitle}>{t("workout.activeSession")} · {data.sessions.length}</Text>
          {data.sessions.length === 0 ? (
            <Text style={s.empty}>{t("progress.noData")}</Text>
          ) : (
            data.sessions.map((sess: any) => {
              const isOpen = open === sess.id;
              return (
                <View key={sess.id} style={s.sessRow}>
                  <Pressable testID={`sess-${sess.id}`} style={s.sessHead} onPress={() => setOpen(isOpen ? null : sess.id)}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.sessName}>{sess.name}</Text>
                      <Text style={s.sessMeta}>{shortDate(sess.date)} · {dur(sess.duration)} · {Math.round(sess.volume)}kg · {sess.total_sets} {t("workout.sets")}</Text>
                    </View>
                    <CaretDown color={colors.muted} size={16} style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }} />
                  </Pressable>
                  {isOpen && sess.exercises?.map((ex: any, i: number) => (
                    <View key={i} style={s.exBlock}>
                      <Text style={s.exName}>{ex.exercise_name}</Text>
                      {(ex.sets || []).map((st: any, j: number) => (
                        <Text key={j} style={s.setLine}>{j + 1}. {st.weight}kg × {st.reps}{st.done ? " ✓" : ""}</Text>
                      ))}
                    </View>
                  ))}
                </View>
              );
            })
          )}
        </Card>

        {/* PRs */}
        {data.prs.length > 0 && (
          <Card testID="user-pr-card">
            <Text style={s.cardTitle}>{t("progress.personalRecords")}</Text>
            {data.prs.map((pr: any) => (
              <View key={pr.id} style={s.prRow}>
                <Trophy color={colors.warning} size={18} weight="fill" />
                <Text style={s.prName}>{pr.exercise_name}</Text>
                <Text style={s.prVal}>{pr.weight}kg × {pr.reps}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Weight history */}
        {data.weight.length > 0 && (
          <Card testID="user-weight-card">
            <Text style={s.cardTitle}>{t("progress.weightHistory")}</Text>
            {data.weight.slice(-12).reverse().map((w: any) => (
              <View key={w.id} style={s.infoRow}>
                <Text style={s.infoLabel}>{shortDate(w.date)}</Text>
                <Text style={s.infoVal}>{w.weight} kg</Text>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      {editing && (
        <View style={s.overlay}>
          <Pressable style={s.overlayBg} onPress={() => setEditing(false)} />
          <KeyboardAwareScrollView bottomOffset={20} style={s.sheetScroll} contentContainerStyle={[s.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={s.sheetTitle}>{t("profile.editProfile")}</Text>
            <Input testID="au-name" label={t("auth.name")} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
            <Input testID="au-birthdate" label="Geb. (YYYY-MM-DD)" value={form.birthdate} onChangeText={(v) => setForm({ ...form, birthdate: v })} placeholder="1995-06-15" />
            <View style={s.two}>
              <Input testID="au-age" style={s.col} label={t("onboarding.age")} value={form.age} onChangeText={(v) => setForm({ ...form, age: v })} keyboardType="numeric" />
              <Input testID="au-height" style={s.col} label={t("onboarding.height")} value={form.height} onChangeText={(v) => setForm({ ...form, height: v })} keyboardType="numeric" />
            </View>
            <View style={s.two}>
              <Input testID="au-weight" style={s.col} label={t("onboarding.weight")} value={form.weight} onChangeText={(v) => setForm({ ...form, weight: v })} keyboardType="numeric" />
              <Input testID="au-target" style={s.col} label={t("onboarding.targetWeight")} value={form.target_weight} onChangeText={(v) => setForm({ ...form, target_weight: v })} keyboardType="numeric" />
            </View>
            <Text style={s.formLabel}>{t("onboarding.gender")}</Text>
            <ChipRow items={GENDERS.map((g) => ({ key: g, label: t(`onboarding.${g}`) }))} selected={form.gender} onSelect={(v) => setForm({ ...form, gender: v })} />
            <Text style={s.formLabel}>{t("onboarding.goal")}</Text>
            <ChipRow items={GOALS.map((g) => ({ key: g, label: t(`goal.${g}`) }))} selected={form.goal} onSelect={(v) => setForm({ ...form, goal: v })} />
            <Button testID="au-save" label={t("common.save")} onPress={() => editMut.mutate()} loading={editMut.isPending} style={{ marginTop: spacing.md }} />
          </KeyboardAwareScrollView>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  totalsRow: { flexDirection: "row", gap: spacing.md },
  totalCell: { flex: 1, gap: 4, alignItems: "flex-start" },
  totalNum: { color: c.brandPrimary, fontSize: 20, fontWeight: "900" },
  totalLbl: { color: c.muted, fontSize: 11, fontWeight: "600" },
  cardTitle: { color: c.onSurface, fontSize: 16, fontWeight: "800", marginBottom: spacing.sm },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: c.divider },
  infoLabel: { color: c.muted, fontSize: 14, fontWeight: "600" },
  infoVal: { color: c.onSurface, fontSize: 14, fontWeight: "700" },
  empty: { color: c.muted, fontSize: 14, textAlign: "center", paddingVertical: spacing.md },
  sessRow: { borderTopWidth: 1, borderTopColor: c.divider },
  sessHead: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, gap: spacing.sm },
  sessName: { color: c.onSurface, fontSize: 15, fontWeight: "700" },
  sessMeta: { color: c.muted, fontSize: 12, marginTop: 2 },
  exBlock: { backgroundColor: c.surfaceTertiary, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.sm },
  exName: { color: c.onSurfaceSecondary, fontSize: 14, fontWeight: "800", marginBottom: 4 },
  setLine: { color: c.muted, fontSize: 13, lineHeight: 20 },
  prRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: c.divider },
  prName: { color: c.onSurface, fontSize: 14, fontWeight: "700", flex: 1 },
  prVal: { color: c.brandPrimary, fontSize: 14, fontWeight: "800" },
  overlay: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-end" },
  overlayBg: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)" },
  sheetScroll: { maxHeight: "90%" },
  sheet: { backgroundColor: c.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.md, borderTopWidth: 1, borderColor: c.border },
  sheetTitle: { color: c.onSurface, fontSize: 20, fontWeight: "800" },
  two: { flexDirection: "row", gap: spacing.md },
  col: { flex: 1 },
  formLabel: { color: c.onSurfaceTertiary, fontSize: 13, fontWeight: "700" },
}));
