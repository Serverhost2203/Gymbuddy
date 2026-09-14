import { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CaretDown, Trophy } from "phosphor-react-native";

import { apiFetch } from "@/src/api";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { Header, Card, Loading } from "@/src/components/ui";
import { shortDate } from "@/src/lib";

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

  const { data, isLoading } = useQuery({ queryKey: ["admin-user", id], queryFn: () => apiFetch(`/admin/users/${id}/detail`) });
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
      <Header title={p.name || data.user.email} onBack={() => router.back()} />
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
}));
