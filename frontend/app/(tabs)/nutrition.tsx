import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Trash, Drop, Barcode, ForkKnife, Minus } from "phosphor-react-native";

import { apiFetch } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { Card, Loading, EmptyState } from "@/src/components/ui";
import { MEALS } from "@/src/lib";

function MacroBar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const s = useStyles();
  const pct = goal ? Math.min(1, value / goal) : 0;
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <View style={s.macroLabelRow}>
        <Text style={s.macroBarLabel}>{label}</Text>
        <Text style={s.macroBarVal}>{Math.round(value)}/{goal}g</Text>
      </View>
      <View style={s.track}>
        <View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function Nutrition() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["diary", "today"],
    queryFn: () => apiFetch("/diary"),
  });
  const { data: metrics } = useQuery({ queryKey: ["metrics"], queryFn: () => apiFetch("/profile/metrics") });

  const waterMut = useMutation({
    mutationFn: (ml: number) => apiFetch("/water", { method: "POST", body: JSON.stringify({ ml }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["diary"] }),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/diary/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["diary"] }),
  });

  if (isLoading || !data) return <Loading />;

  const tot = data.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const goals = metrics?.macros || { protein: 0, carbs: 0, fat: 0 };
  const calGoal = metrics?.calorie_target || 0;
  const water = data.water_ml || 0;
  const waterGoal = 2500;

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={s.headerTitle}>{t("nutrition.diary")}</Text>
        <Pressable testID="scan-barcode-btn" onPress={() => router.push("/nutrition/scan")} style={s.scanBtn}>
          <Barcode color={colors.onSurface} size={22} weight="bold" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
      >
        {/* Calories + macros */}
        <Card testID="nutrition-summary">
          <View style={s.calHeader}>
            <View>
              <Text style={s.calBig}>{Math.round(tot.calories)}</Text>
              <Text style={s.calSub}>/ {calGoal} kcal</Text>
            </View>
            <Text style={s.remain}>{Math.max(0, Math.round(calGoal - tot.calories))} {t("dashboard.remaining")}</Text>
          </View>
          <View style={s.macroBars}>
            <MacroBar label={t("dashboard.protein")} value={tot.protein} goal={goals.protein} color={colors.macroProtein} />
            <MacroBar label={t("dashboard.carbs")} value={tot.carbs} goal={goals.carbs} color={colors.macroCarbs} />
            <MacroBar label={t("dashboard.fat")} value={tot.fat} goal={goals.fat} color={colors.macroFat} />
          </View>
        </Card>

        {/* Water */}
        <Card testID="water-card">
          <View style={s.waterRow}>
            <Drop color={colors.info} size={22} weight="fill" />
            <Text style={s.waterTitle}>{t("nutrition.water")}</Text>
            <Text style={s.waterVal}>{water} / {waterGoal} ml</Text>
          </View>
          <View style={s.waterCtrl}>
            <Pressable testID="water-minus" onPress={() => waterMut.mutate(-250)} style={s.waterBtn}>
              <Minus color={colors.onSurface} size={18} weight="bold" />
            </Pressable>
            <View style={s.waterTrack}>
              <View style={[s.waterFill, { width: `${Math.min(100, (water / waterGoal) * 100)}%` }]} />
            </View>
            <Pressable testID="water-plus" onPress={() => waterMut.mutate(250)} style={[s.waterBtn, { backgroundColor: colors.info }]}>
              <Plus color={colors.onInfo} size={18} weight="bold" />
            </Pressable>
          </View>
        </Card>

        {/* Meals */}
        {MEALS.map((meal) => {
          const entries = (data.entries || []).filter((e: any) => e.meal === meal);
          const mealCals = entries.reduce((a: number, e: any) => a + (e.calories || 0), 0);
          return (
            <Card key={meal} testID={`meal-${meal}`}>
              <View style={s.mealHeader}>
                <Text style={s.mealTitle}>{t(`nutrition.${meal}`)}</Text>
                <Text style={s.mealCals}>{Math.round(mealCals)} kcal</Text>
              </View>
              {entries.map((e: any) => (
                <View key={e.id} style={s.entryRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.entryName} numberOfLines={1}>{e.name}</Text>
                    <Text style={s.entryMeta}>{Math.round(e.quantity)}g · P{Math.round(e.protein)} C{Math.round(e.carbs)} F{Math.round(e.fat)}</Text>
                  </View>
                  <Text style={s.entryCals}>{Math.round(e.calories)}</Text>
                  <Pressable testID={`del-entry-${e.id}`} onPress={() => delMut.mutate(e.id)} hitSlop={8} style={{ marginLeft: spacing.sm }}>
                    <Trash color={colors.muted} size={18} />
                  </Pressable>
                </View>
              ))}
              <Pressable testID={`add-${meal}`} onPress={() => router.push(`/nutrition/add?meal=${meal}`)} style={s.addRow}>
                <Plus color={colors.brandPrimary} size={18} weight="bold" />
                <Text style={s.addText}>{t("nutrition.addFood")}</Text>
              </Pressable>
            </Card>
          );
        })}

        <Pressable testID="weekly-overview" onPress={() => router.push("/nutrition/weekly")} style={s.weeklyBtn}>
          <ForkKnife color={colors.onSurfaceTertiary} size={18} />
          <Text style={s.weeklyText}>{t("nutrition.weeklyOverview")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  headerTitle: { color: c.onSurface, fontSize: 26, fontWeight: "900" },
  scanBtn: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },

  calHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: spacing.md },
  calBig: { color: c.onSurface, fontSize: 38, fontWeight: "900", letterSpacing: -1 },
  calSub: { color: c.muted, fontSize: 13, fontWeight: "600" },
  remain: { color: c.brandPrimary, fontSize: 15, fontWeight: "800" },
  macroBars: { gap: spacing.md },
  macroLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  macroBarLabel: { color: c.onSurfaceTertiary, fontSize: 13, fontWeight: "700" },
  macroBarVal: { color: c.muted, fontSize: 12, fontWeight: "600" },
  track: { height: 8, borderRadius: 4, backgroundColor: c.surfaceTertiary, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },

  waterRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  waterTitle: { color: c.onSurface, fontSize: 16, fontWeight: "800", flex: 1 },
  waterVal: { color: c.muted, fontSize: 13, fontWeight: "600" },
  waterCtrl: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  waterBtn: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  waterTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: c.surfaceTertiary, overflow: "hidden" },
  waterFill: { height: 10, borderRadius: 5, backgroundColor: c.info },

  mealHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  mealTitle: { color: c.onSurface, fontSize: 17, fontWeight: "800" },
  mealCals: { color: c.muted, fontSize: 13, fontWeight: "700" },
  entryRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: c.divider },
  entryName: { color: c.onSurface, fontSize: 15, fontWeight: "600" },
  entryMeta: { color: c.muted, fontSize: 12 },
  entryCals: { color: c.onSurfaceSecondary, fontSize: 15, fontWeight: "800" },
  addRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: c.divider, marginTop: spacing.xs },
  addText: { color: c.brandPrimary, fontSize: 14, fontWeight: "700" },

  weeklyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md },
  weeklyText: { color: c.onSurfaceTertiary, fontSize: 14, fontWeight: "700" },
}));
