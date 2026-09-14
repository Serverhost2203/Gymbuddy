import { useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { LineChart, BarChart } from "react-native-gifted-charts";
import { Trophy, Flame, Lightning, Ruler, Camera, Lock, Medal, Star } from "phosphor-react-native";

import { apiFetch } from "@/src/api";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { Card, Loading, ChipRow } from "@/src/components/ui";

export default function Progress() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const [view, setView] = useState("overview");

  const weightQ = useQuery({ queryKey: ["weight"], queryFn: () => apiFetch<any[]>("/weight") });
  const statsQ = useQuery({ queryKey: ["stats"], queryFn: () => apiFetch("/stats/overview") });
  const gamiQ = useQuery({ queryKey: ["gamification"], queryFn: () => apiFetch("/gamification") });
  const prQ = useQuery({ queryKey: ["prs"], queryFn: () => apiFetch<any[]>("/prs") });

  const refetchAll = () => { weightQ.refetch(); statsQ.refetch(); gamiQ.refetch(); prQ.refetch(); };

  if (weightQ.isLoading || statsQ.isLoading || gamiQ.isLoading) return <Loading />;

  const weightData = (weightQ.data || []).map((w) => ({ value: w.weight }));
  const stats = statsQ.data || {};
  const gami = gamiQ.data || {};
  const freqBars = (stats.weekly_frequency || []).map((f: any) => ({ value: f.count, frontColor: colors.brandPrimary }));
  const volSeries = (stats.volume_series || []).map((v: any) => ({ value: v.volume }));
  const xpProg = gami.xp_next_level > gami.xp_current_level ? (gami.xp - gami.xp_current_level) / (gami.xp_next_level - gami.xp_current_level) : 0;

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={s.headerTitle}>{t("tabs.progress")}</Text>
      </View>
      <View style={{ paddingVertical: spacing.md }}>
        <ChipRow
          items={[["overview", t("progress.weight")], ["stats", t("progress.statistics")], ["records", t("progress.personalRecords")], ["achievements", t("progress.achievements")]].map(([k, l]) => ({ key: k, label: l }))}
          selected={view}
          onSelect={setView}
          testIDPrefix="progress-tab"
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetchAll} tintColor={colors.brandPrimary} />}
      >
        {view === "overview" && (
          <>
            <Card testID="level-card-progress">
              <View style={s.levelHead}>
                <Lightning color={colors.warning} size={26} weight="fill" />
                <Text style={s.levelTitle}>{t("progress.level")} {gami.level}</Text>
                <View style={s.streakBadge}>
                  <Flame color={colors.brandPrimary} size={16} weight="fill" />
                  <Text style={s.streakText}>{gami.streak}</Text>
                </View>
              </View>
              <View style={s.xpTrack}><View style={[s.xpFill, { width: `${Math.min(100, xpProg * 100)}%` }]} /></View>
              <Text style={s.xpText}>{gami.xp} XP · {t("progress.bestStreak")}: {gami.best_streak}</Text>
            </Card>

            {weightData.length > 0 ? (
              <Card testID="weight-chart">
                <Text style={s.cardTitle}>{t("progress.weightHistory")}</Text>
                <View style={{ marginTop: spacing.md }}>
                  <LineChart data={weightData} height={160} color={colors.brandPrimary} thickness={2.5} areaChart startFillColor={colors.brandPrimary} endFillColor={colors.surfaceSecondary} startOpacity={0.4} endOpacity={0.05} hideDataPoints={weightData.length > 15} dataPointsColor={colors.brandPrimary} hideRules yAxisColor="transparent" xAxisColor={colors.border} yAxisTextStyle={{ color: colors.muted, fontSize: 10 }} noOfSections={4} adjustToWidth initialSpacing={8} />
                </View>
              </Card>
            ) : (
              <Card><Text style={s.empty}>{t("progress.noData")}</Text></Card>
            )}

            {(gami.challenges || []).map((c: any) => (
              <Card key={c.code} testID={`challenge-${c.code}`}>
                <View style={s.chalHead}>
                  <Text style={s.chalName}>{c.name}</Text>
                  <Text style={s.chalProg}>{Math.min(c.progress, c.target)}/{c.target}</Text>
                </View>
                <Text style={s.chalDesc}>{c.description}</Text>
                <View style={s.xpTrack}><View style={[s.xpFill, { width: `${Math.min(100, (c.progress / c.target) * 100)}%`, backgroundColor: colors.success }]} /></View>
              </Card>
            ))}

            <View style={s.linkRow}>
              <Pressable testID="open-measurements" style={s.linkCard} onPress={() => router.push("/progress/measurements")}>
                <Ruler color={colors.brandPrimary} size={24} weight="fill" />
                <Text style={s.linkText}>{t("progress.measurements")}</Text>
              </Pressable>
              <Pressable testID="open-photos" style={s.linkCard} onPress={() => router.push("/progress/photos")}>
                <Camera color={colors.macroCarbs} size={24} weight="fill" />
                <Text style={s.linkText}>{t("progress.photos")}</Text>
              </Pressable>
            </View>
          </>
        )}

        {view === "stats" && (
          <>
            <View style={s.statGrid}>
              <Card style={s.statCell}><Text style={s.statNum}>{stats.total_workouts}</Text><Text style={s.statLbl}>{t("progress.totalWorkouts")}</Text></Card>
              <Card style={s.statCell}><Text style={s.statNum}>{Math.round((stats.total_volume || 0) / 1000)}t</Text><Text style={s.statLbl}>{t("progress.totalVolume")}</Text></Card>
              <Card style={s.statCell}><Text style={s.statNum}>{stats.total_sets}</Text><Text style={s.statLbl}>{t("workout.sets")}</Text></Card>
              <Card style={s.statCell}><Text style={s.statNum}>{stats.pr_count}</Text><Text style={s.statLbl}>{t("progress.personalRecords")}</Text></Card>
            </View>
            <Card testID="frequency-chart">
              <Text style={s.cardTitle}>{t("progress.workoutFrequency")}</Text>
              <View style={{ marginTop: spacing.md }}>
                <BarChart data={freqBars} height={140} barWidth={20} spacing={16} roundedTop hideRules yAxisColor="transparent" xAxisColor={colors.border} yAxisTextStyle={{ color: colors.muted, fontSize: 10 }} noOfSections={3} />
              </View>
            </Card>
            {volSeries.length > 1 && (
              <Card testID="volume-chart">
                <Text style={s.cardTitle}>{t("progress.trainingVolume")}</Text>
                <View style={{ marginTop: spacing.md }}>
                  <LineChart data={volSeries} height={140} color={colors.macroFat} thickness={2.5} hideRules yAxisColor="transparent" xAxisColor={colors.border} yAxisTextStyle={{ color: colors.muted, fontSize: 10 }} noOfSections={3} adjustToWidth initialSpacing={8} />
                </View>
              </Card>
            )}
            <Card testID="muscle-groups">
              <Text style={s.cardTitle}>{t("progress.muscleGroups")}</Text>
              <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                {Object.entries(stats.muscle_groups || {}).sort((a: any, b: any) => b[1] - a[1]).map(([mg, count]: any) => {
                  const max = Math.max(...(Object.values(stats.muscle_groups || { x: 1 }) as number[]));
                  return (
                    <View key={mg} style={s.mgRow}>
                      <Text style={s.mgName}>{mg}</Text>
                      <View style={s.mgBarTrack}><View style={[s.mgBarFill, { width: `${(count / max) * 100}%` }]} /></View>
                      <Text style={s.mgCount}>{count}</Text>
                    </View>
                  );
                })}
                {Object.keys(stats.muscle_groups || {}).length === 0 && <Text style={s.empty}>{t("progress.noData")}</Text>}
              </View>
            </Card>
          </>
        )}

        {view === "records" && (
          <Card>
            <Text style={s.cardTitle}>{t("progress.personalRecords")}</Text>
            {(prQ.data || []).length === 0 ? (
              <Text style={s.empty}>{t("progress.noRecords")}</Text>
            ) : (
              (prQ.data || []).map((pr: any) => (
                <View key={pr.id} style={s.prRow} testID={`pr-${pr.exercise_name}`}>
                  <Trophy color={colors.warning} size={20} weight="fill" />
                  <Text style={s.prName}>{pr.exercise_name}</Text>
                  <Text style={s.prVal}>{pr.weight}kg × {pr.reps}</Text>
                </View>
              ))
            )}
          </Card>
        )}

        {view === "achievements" && (
          <View style={s.achGrid}>
            {(gami.achievements || []).map((a: any) => (
              <View key={a.code} testID={`ach-${a.code}`} style={[s.achCard, a.unlocked && s.achUnlocked]}>
                {a.unlocked ? <Medal color={colors.warning} size={30} weight="fill" /> : <Lock color={colors.muted} size={28} />}
                <Text style={[s.achName, !a.unlocked && { color: colors.muted }]}>{a.name}</Text>
                <Text style={s.achDesc} numberOfLines={2}>{a.description}</Text>
                {a.xp > 0 && <Text style={s.achXp}>+{a.xp} XP</Text>}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: { color: c.onSurface, fontSize: 26, fontWeight: "900" },
  levelHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  levelTitle: { color: c.onSurface, fontSize: 20, fontWeight: "900", flex: 1 },
  streakBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.brandTertiary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  streakText: { color: c.brandPrimary, fontWeight: "800", fontSize: 14 },
  xpTrack: { height: 10, borderRadius: 5, backgroundColor: c.surfaceTertiary, overflow: "hidden" },
  xpFill: { height: 10, borderRadius: 5, backgroundColor: c.warning },
  xpText: { color: c.muted, fontSize: 12, fontWeight: "600", marginTop: spacing.sm },
  cardTitle: { color: c.onSurface, fontSize: 16, fontWeight: "800" },
  empty: { color: c.muted, fontSize: 14, textAlign: "center", paddingVertical: spacing.lg },
  chalHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  chalName: { color: c.onSurface, fontSize: 15, fontWeight: "800" },
  chalProg: { color: c.success, fontSize: 14, fontWeight: "800" },
  chalDesc: { color: c.muted, fontSize: 13, marginBottom: spacing.sm },
  linkRow: { flexDirection: "row", gap: spacing.md },
  linkCard: { flex: 1, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, alignItems: "flex-start" },
  linkText: { color: c.onSurface, fontSize: 15, fontWeight: "700" },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  statCell: { width: "47%", flexGrow: 1, gap: 4 },
  statNum: { color: c.onSurface, fontSize: 28, fontWeight: "900", letterSpacing: -1 },
  statLbl: { color: c.muted, fontSize: 12, fontWeight: "600" },
  mgRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  mgName: { color: c.onSurfaceTertiary, fontSize: 13, fontWeight: "600", width: 70, textTransform: "capitalize" },
  mgBarTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: c.surfaceTertiary, overflow: "hidden" },
  mgBarFill: { height: 8, borderRadius: 4, backgroundColor: c.brandPrimary },
  mgCount: { color: c.muted, fontSize: 12, fontWeight: "700", width: 30, textAlign: "right" },
  prRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: c.divider },
  prName: { color: c.onSurface, fontSize: 15, fontWeight: "700", flex: 1 },
  prVal: { color: c.brandPrimary, fontSize: 15, fontWeight: "800" },
  achGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  achCard: { width: "47%", flexGrow: 1, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, opacity: 0.6 },
  achUnlocked: { opacity: 1, borderColor: c.warning },
  achName: { color: c.onSurface, fontSize: 15, fontWeight: "800" },
  achDesc: { color: c.muted, fontSize: 12, lineHeight: 16 },
  achXp: { color: c.warning, fontSize: 12, fontWeight: "800" },
}));
