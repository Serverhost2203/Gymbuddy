import { ScrollView, View, Text, Pressable, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Flame, Barbell, ForkKnife, Scales, Lightning, Play } from "phosphor-react-native";
import { LineChart } from "react-native-gifted-charts";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { ProgressRing } from "@/src/components/ProgressRing";
import { Card, Loading } from "@/src/components/ui";
import { bmiCategory, DAY_KEYS } from "@/src/lib";

const HERO =
  "https://images.unsplash.com/photo-1637430308606-86576d8fef3c?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

function MacroRing({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: 6 }}>
      <ProgressRing progress={goal ? value / goal : 0} size={78} strokeWidth={8} color={color} trackColor={colors.surfaceTertiary}>
        <Text style={s.macroVal}>{Math.round(value)}</Text>
        <Text style={s.macroUnit}>/{goal}g</Text>
      </ProgressRing>
      <Text style={s.macroLabel}>{label}</Text>
    </View>
  );
}

export default function Dashboard() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch("/dashboard"),
  });

  if (isLoading || !data) return <Loading />;

  const m = data.metrics || {};
  const tot = data.nutrition?.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const macros = m.macros || { protein: 0, carbs: 0, fat: 0 };
  const calTarget = m.calorie_target || 0;
  const calRemaining = Math.max(0, Math.round(calTarget - tot.calories));
  const weightData = (data.weight_series || []).map((w: any) => ({ value: w.weight }));
  const todayPlan = data.today_plan;
  const isWorkout = todayPlan?.type === "workout" || todayPlan?.type === "cardio";

  const startToday = () => {
    if (isWorkout && todayPlan?.plan_id) {
      router.push(`/workout/session?planId=${todayPlan.plan_id}&dayIndex=${todayPlan.day_index ?? 0}`);
    } else {
      router.push("/(tabs)/workout");
    }
  };

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
      >
        {/* Hero */}
        <View style={s.hero}>
          <Image source={{ uri: HERO }} style={s.heroImg} contentFit="cover" />
          <LinearGradient colors={["rgba(12,12,14,0.55)", "rgba(12,12,14,0.35)", "rgba(12,12,14,0.95)"]} style={s.heroScrim} />
          <View style={[s.heroContent, { paddingTop: insets.top + spacing.md }]}>
            <View style={s.heroTop}>
              <Text style={s.greeting}>{t("dashboard.greeting")}, {user?.profile?.name || ""} 👋</Text>
              <View style={s.streakPill}>
                <Flame color={colors.brandPrimary} size={16} weight="fill" />
                <Text style={s.streakText}>{data.gamification?.streak || 0}</Text>
              </View>
            </View>

            <View style={s.todayCard}>
              <Text style={s.todayLabel}>{t("dashboard.todaysWorkout")}</Text>
              <Text style={s.todayName} testID="today-workout-name">
                {isWorkout ? todayPlan?.plan_name || t("cycle.workout") : t("dashboard.restDay")}
              </Text>
              <Pressable testID="start-workout-btn" onPress={startToday} style={s.startBtn}>
                <Play color={colors.onBrandPrimary} size={18} weight="fill" />
                <Text style={s.startText}>{t("dashboard.startWorkout")}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={s.body}>
          {/* Level bar */}
          <Card style={s.levelCard} testID="level-card">
            <Lightning color={colors.warning} size={22} weight="fill" />
            <View style={{ flex: 1 }}>
              <Text style={s.levelText}>{t("progress.level")} {data.gamification?.level || 1}</Text>
              <Text style={s.levelXp}>{data.gamification?.xp || 0} XP</Text>
            </View>
            <Text style={s.weekWorkouts}>{data.workouts_this_week} {t("dashboard.weekWorkouts")}</Text>
          </Card>

          {/* Bento stats */}
          <View style={s.bento}>
            <Card style={s.bentoItem} testID="stat-weight">
              <Text style={s.statLabel}>{t("dashboard.currentWeight")}</Text>
              <Text style={s.statValue}>{data.profile?.weight ?? "—"}<Text style={s.statUnit}> kg</Text></Text>
              <Text style={s.statSub}>{t("dashboard.targetWeight")}: {data.profile?.target_weight ?? "—"} kg</Text>
            </Card>
            <Card style={s.bentoItem} testID="stat-bmi">
              <Text style={s.statLabel}>{t("dashboard.bmi")}</Text>
              <Text style={s.statValue}>{m.bmi ?? "—"}</Text>
              <Text style={[s.statSub, { color: colors.brandPrimary }]}>{m.bmi ? t(bmiCategory(m.bmi)) : ""}</Text>
            </Card>
          </View>

          {/* Calories ring */}
          <Card testID="calorie-card" style={s.calCard}>
            <ProgressRing progress={calTarget ? tot.calories / calTarget : 0} size={110} strokeWidth={12} color={colors.brandPrimary} trackColor={colors.surfaceTertiary}>
              <Text style={s.calRemain}>{calRemaining}</Text>
              <Text style={s.calRemainLabel}>{t("dashboard.remaining")}</Text>
            </ProgressRing>
            <View style={{ flex: 1, gap: spacing.sm }}>
              <Text style={s.calTitle}>{t("dashboard.calories")}</Text>
              <Text style={s.calDetail}>{Math.round(tot.calories)} / {calTarget} kcal</Text>
            </View>
          </Card>

          {/* Macro trio */}
          <Card testID="macro-trio">
            <View style={s.macroTrio}>
              <MacroRing label={t("dashboard.protein")} value={tot.protein} goal={macros.protein} color={colors.macroProtein} />
              <MacroRing label={t("dashboard.carbs")} value={tot.carbs} goal={macros.carbs} color={colors.macroCarbs} />
              <MacroRing label={t("dashboard.fat")} value={tot.fat} goal={macros.fat} color={colors.macroFat} />
            </View>
          </Card>

          {/* Weekly dots */}
          <Card testID="weekly-progress">
            <Text style={s.cardTitle}>{t("dashboard.weeklyProgress")}</Text>
            <View style={s.dotsRow}>
              {DAY_KEYS.map((d, i) => {
                const active = i < (data.workouts_this_week || 0);
                return (
                  <View key={d} style={s.dotCol}>
                    <View style={[s.dot, active ? s.dotActive : s.dotInactive]} />
                    <Text style={s.dotLabel}>{t(`cycle.${d}`)}</Text>
                  </View>
                );
              })}
            </View>
          </Card>

          {/* Weight trend */}
          {weightData.length > 1 && (
            <Card testID="weight-trend">
              <Text style={s.cardTitle}>{t("dashboard.weightTrend")}</Text>
              <View style={{ marginTop: spacing.md, marginLeft: -spacing.sm }}>
                <LineChart
                  data={weightData}
                  height={120}
                  areaChart
                  color={colors.brandPrimary}
                  startFillColor={colors.brandPrimary}
                  endFillColor={colors.surfaceSecondary}
                  startOpacity={0.4}
                  endOpacity={0.05}
                  thickness={2.5}
                  hideDataPoints
                  hideRules
                  yAxisColor="transparent"
                  xAxisColor={colors.border}
                  yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
                  noOfSections={3}
                  adjustToWidth
                  initialSpacing={8}
                />
              </View>
            </Card>
          )}

          {/* Quick actions */}
          <Text style={s.sectionTitle}>{t("dashboard.quickActions")}</Text>
          <View style={s.quickRow}>
            <Pressable testID="qa-workout" style={s.quick} onPress={() => router.push("/(tabs)/workout")}>
              <Barbell color={colors.brandPrimary} size={26} weight="fill" />
              <Text style={s.quickText}>{t("tabs.workout")}</Text>
            </Pressable>
            <Pressable testID="qa-food" style={s.quick} onPress={() => router.push("/nutrition/add?meal=snack")}>
              <ForkKnife color={colors.macroCarbs} size={26} weight="fill" />
              <Text style={s.quickText}>{t("dashboard.logFood")}</Text>
            </Pressable>
            <Pressable testID="qa-weight" style={s.quick} onPress={() => router.push("/log-weight")}>
              <Scales color={colors.macroFat} size={26} weight="fill" />
              <Text style={s.quickText}>{t("dashboard.logWeight")}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  hero: { height: 320 },
  heroImg: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, height: 320 },
  heroScrim: { position: "absolute", top: 0, left: 0, right: 0, height: 320 },
  heroContent: { flex: 1, paddingHorizontal: spacing.lg, justifyContent: "space-between", paddingBottom: spacing.lg },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting: { color: c.onSurface, fontSize: 20, fontWeight: "800", flex: 1 },
  streakPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border },
  streakText: { color: c.onSurface, fontWeight: "800", fontSize: 15 },
  todayCard: { gap: spacing.sm },
  todayLabel: { color: c.brandPrimary, fontSize: 13, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  todayName: { color: c.onSurface, fontSize: 30, fontWeight: "900", letterSpacing: -0.5 },
  startBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: c.brandPrimary, height: 50, borderRadius: radius.md, marginTop: spacing.sm },
  startText: { color: c.onBrandPrimary, fontSize: 16, fontWeight: "800" },

  body: { padding: spacing.lg, gap: spacing.md, marginTop: -spacing.sm },
  levelCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  levelText: { color: c.onSurface, fontSize: 16, fontWeight: "800" },
  levelXp: { color: c.muted, fontSize: 13 },
  weekWorkouts: { color: c.brandPrimary, fontSize: 13, fontWeight: "800" },

  bento: { flexDirection: "row", gap: spacing.md },
  bentoItem: { flex: 1, gap: 4 },
  statLabel: { color: c.muted, fontSize: 13, fontWeight: "600" },
  statValue: { color: c.onSurface, fontSize: 30, fontWeight: "900", letterSpacing: -1 },
  statUnit: { fontSize: 15, color: c.muted, fontWeight: "700" },
  statSub: { color: c.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },

  calCard: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  calRemain: { color: c.onSurface, fontSize: 24, fontWeight: "900" },
  calRemainLabel: { color: c.muted, fontSize: 11 },
  calTitle: { color: c.onSurface, fontSize: 18, fontWeight: "800" },
  calDetail: { color: c.muted, fontSize: 13, fontWeight: "600" },
  macroRow: { display: "none" },

  macroTrio: { flexDirection: "row", justifyContent: "space-around" },
  macroVal: { color: c.onSurface, fontSize: 18, fontWeight: "900" },
  macroUnit: { color: c.muted, fontSize: 10 },
  macroLabel: { color: c.onSurfaceTertiary, fontSize: 12, fontWeight: "700" },

  cardTitle: { color: c.onSurface, fontSize: 16, fontWeight: "800", marginBottom: spacing.xs },
  dotsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md },
  dotCol: { alignItems: "center", gap: 6 },
  dot: { width: 26, height: 26, borderRadius: 13 },
  dotActive: { backgroundColor: c.brandPrimary },
  dotInactive: { backgroundColor: c.surfaceTertiary },
  dotLabel: { color: c.muted, fontSize: 11, fontWeight: "600" },

  sectionTitle: { color: c.onSurface, fontSize: 20, fontWeight: "800", marginTop: spacing.sm },
  quickRow: { flexDirection: "row", gap: spacing.md },
  quick: { flex: 1, backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", paddingVertical: spacing.lg, gap: spacing.sm },
  quickText: { color: c.onSurface, fontSize: 13, fontWeight: "700" },
}));
