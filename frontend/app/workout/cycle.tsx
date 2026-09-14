import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCircle, X } from "phosphor-react-native";

import { apiFetch } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { Header, Button, Loading } from "@/src/components/ui";
import { DAY_KEYS, mondayOf } from "@/src/lib";

const TYPES = ["rest", "workout", "cardio"];

export default function Cycle() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const weekStart = mondayOf();

  const cycleQ = useQuery({ queryKey: ["cycle", weekStart], queryFn: () => apiFetch(`/cycle?week_start=${weekStart}`) });
  const plansQ = useQuery({ queryKey: ["plans", false], queryFn: () => apiFetch("/plans") });
  const [days, setDays] = useState<Record<string, any>>({});
  const [pickerDay, setPickerDay] = useState<string | null>(null);

  useEffect(() => {
    if (cycleQ.data?.days) setDays(cycleQ.data.days);
  }, [cycleQ.data]);

  const saveMut = useMutation({
    mutationFn: () => apiFetch("/cycle", { method: "PUT", body: JSON.stringify({ week_start: weekStart, days }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cycle"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      router.back();
    },
  });

  if (cycleQ.isLoading) return <Loading />;

  const cycleType = (dk: string) => {
    const cur = days[dk]?.type || "rest";
    const next = TYPES[(TYPES.indexOf(cur) + 1) % TYPES.length];
    if (next === "workout") { setPickerDay(dk); }
    setDays((prev) => ({ ...prev, [dk]: { ...(prev[dk] || {}), type: next } }));
  };

  const assignPlan = (dk: string, plan: any, dayIdx: number) => {
    setDays((prev) => ({ ...prev, [dk]: { type: "workout", plan_id: plan.id, day_index: dayIdx, plan_name: `${plan.name} · ${plan.days[dayIdx].name}` } }));
    setPickerDay(null);
  };

  const typeColor = (ty: string) => (ty === "workout" ? colors.brandPrimary : ty === "cardio" ? colors.macroCarbs : colors.surfaceTertiary);

  return (
    <View style={s.root}>
      <Header title={t("workout.weeklyCycle")} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100, gap: spacing.sm }}>
        {DAY_KEYS.map((dk) => {
          const day = days[dk] || { type: "rest" };
          const completed = cycleQ.data?.completed?.[dk];
          return (
            <View key={dk} style={s.dayRow}>
              <View style={[s.dayBadge, { backgroundColor: typeColor(day.type) }]}>
                <Text style={[s.dayBadgeText, { color: day.type === "rest" ? colors.onSurfaceTertiary : "#000" }]}>{t(`cycle.${dk}`)}</Text>
              </View>
              <Pressable testID={`cycle-day-${dk}`} style={{ flex: 1 }} onPress={() => cycleType(dk)}>
                <Text style={s.dayType}>{t(`cycle.${day.type === "rest" ? "restDay" : day.type}`)}</Text>
                {day.type === "workout" && day.plan_name ? <Text style={s.dayPlan} numberOfLines={1}>{day.plan_name}</Text> : null}
              </Pressable>
              {completed ? <CheckCircle color={colors.success} size={24} weight="fill" /> : null}
            </View>
          );
        })}
        <Text style={s.hint}>{t("cycle.selectType" as any) || "Tap a day to change type"}</Text>
        <Button testID="save-cycle" label={t("common.save")} onPress={() => saveMut.mutate()} loading={saveMut.isPending} style={{ marginTop: spacing.md }} />
      </ScrollView>

      {pickerDay && (
        <View style={s.pickerOverlay}>
          <View style={[s.pickerSheet, { paddingTop: insets.top + spacing.md }]}>
            <View style={s.pickerHead}>
              <Text style={s.pickerTitle}>{t("workout.plans")}</Text>
              <Pressable testID="close-cycle-picker" onPress={() => setPickerDay(null)}><X color={colors.onSurface} size={24} /></Pressable>
            </View>
            <FlatList
              data={plansQ.data || []}
              keyExtractor={(it) => it.id}
              contentContainerStyle={{ padding: spacing.lg }}
              renderItem={({ item }) => (
                <View style={s.planBlock}>
                  <Text style={s.planName}>{item.name}</Text>
                  <View style={s.dayChips}>
                    {item.days?.map((d: any, i: number) => (
                      <Pressable key={i} testID={`assign-${item.id}-${i}`} style={s.dayChip} onPress={() => assignPlan(pickerDay, item, i)}>
                        <Text style={s.dayChipText}>{d.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
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
  dayRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md },
  dayBadge: { width: 52, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  dayBadgeText: { fontSize: 13, fontWeight: "900" },
  dayType: { color: c.onSurface, fontSize: 16, fontWeight: "700" },
  dayPlan: { color: c.brandPrimary, fontSize: 13, fontWeight: "600", marginTop: 2 },
  hint: { color: c.muted, fontSize: 13, textAlign: "center", marginTop: spacing.sm },
  pickerOverlay: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)" },
  pickerSheet: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.surface },
  pickerHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg },
  pickerTitle: { color: c.onSurface, fontSize: 22, fontWeight: "900" },
  planBlock: { marginBottom: spacing.lg },
  planName: { color: c.onSurface, fontSize: 16, fontWeight: "800", marginBottom: spacing.sm },
  dayChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  dayChip: { paddingHorizontal: spacing.md, height: 38, borderRadius: radius.pill, backgroundColor: c.brandTertiary, borderWidth: 1, borderColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  dayChipText: { color: c.brandPrimary, fontSize: 13, fontWeight: "700" },
}));
