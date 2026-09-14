import { useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, CalendarBlank, Lightning, CaretRight } from "phosphor-react-native";

import { apiFetch } from "@/src/api";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { Card, Loading } from "@/src/components/ui";

const PLAN_IMG =
  "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?crop=entropy&cs=srgb&fm=jpg&q=85&w=800";

export default function Workout() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const [matchEquip, setMatchEquip] = useState(false);

  const eqQ = useQuery({ queryKey: ["equipment-list"], queryFn: () => apiFetch("/equipment") });
  const plansQ = useQuery({
    queryKey: ["plans", matchEquip],
    queryFn: () => apiFetch(`/plans?match_equipment=${matchEquip}`),
  });

  if (eqQ.isLoading || plansQ.isLoading) return <Loading />;

  const muscleGroups = eqQ.data?.muscle_groups || [];
  const templates = (plansQ.data || []).filter((p: any) => p.is_template);
  const myPlans = (plansQ.data || []).filter((p: any) => !p.is_template);

  const levelColor = (lvl: string) =>
    lvl === "beginner" ? colors.success : lvl === "intermediate" ? colors.warning : colors.brandPrimary;

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={s.headerTitle}>{t("tabs.workout")}</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={plansQ.isRefetching} onRefresh={plansQ.refetch} tintColor={colors.brandPrimary} />}
      >
        {/* Primary actions */}
        <View style={s.actionRow}>
          <Pressable testID="start-empty" style={s.actionPrimary} onPress={() => router.push("/workout/session")}>
            <Lightning color={colors.onBrandPrimary} size={22} weight="fill" />
            <Text style={s.actionPrimaryText}>{t("workout.startEmpty")}</Text>
          </Pressable>
          <Pressable testID="open-cycle" style={s.actionSecondary} onPress={() => router.push("/workout/cycle")}>
            <CalendarBlank color={colors.onSurface} size={22} weight="fill" />
            <Text style={s.actionSecondaryText}>{t("workout.weeklyCycle")}</Text>
          </Pressable>
        </View>

        {/* Muscle groups */}
        <View>
          <Text style={s.section}>{t("workout.muscleGroups")}</Text>
          <View style={s.mgGrid}>
            {muscleGroups.map((mg: any) => (
              <Pressable key={mg.code} testID={`mg-${mg.code}`} style={s.mgTile} onPress={() => router.push(`/workout/exercises?mg=${mg.code}`)}>
                <Text style={s.mgText}>{mg.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Plans */}
        <View>
          <View style={s.sectionRow}>
            <Text style={s.section}>{t("workout.plans")}</Text>
            <Pressable testID="toggle-equip" onPress={() => setMatchEquip(!matchEquip)} style={[s.toggle, matchEquip && s.toggleActive]}>
              <Text style={[s.toggleText, matchEquip && { color: colors.onBrandPrimary }]}>{t("workout.equipmentMatch")}</Text>
            </Pressable>
          </View>
          {templates.map((p: any) => (
            <Pressable key={p.id} testID={`plan-${p.id}`} style={s.planCard} onPress={() => router.push(`/workout/plan/${p.id}`)}>
              <Image source={{ uri: PLAN_IMG }} style={s.planImg} contentFit="cover" />
              <LinearGradient colors={["rgba(12,12,14,0.3)", "rgba(12,12,14,0.9)"]} style={s.planScrim} />
              <View style={s.planInfo}>
                <View style={[s.levelBadge, { backgroundColor: levelColor(p.level) }]}>
                  <Text style={s.levelText}>{t(`workout.${p.level}`)}</Text>
                </View>
                <Text style={s.planName}>{p.name}</Text>
                <Text style={s.planMeta}>{t(`split.${p.split}`)} · {p.days?.length} {t("workout.days")}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* My plans */}
        <View>
          <View style={s.sectionRow}>
            <Text style={s.section}>{t("workout.myPlans")}</Text>
            <Pressable testID="create-plan-btn" onPress={() => router.push("/workout/create-plan")} style={s.createBtn}>
              <Plus color={colors.brandPrimary} size={18} weight="bold" />
              <Text style={s.createText}>{t("workout.createPlan")}</Text>
            </Pressable>
          </View>
          {myPlans.length === 0 ? (
            <Card><Text style={s.emptyText}>{t("workout.createPlan")}</Text></Card>
          ) : (
            myPlans.map((p: any) => (
              <Card key={p.id} testID={`myplan-${p.id}`} onPress={() => router.push(`/workout/plan/${p.id}`)} style={s.myPlanRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.myPlanName}>{p.name}</Text>
                  <Text style={s.myPlanMeta}>{p.days?.length} {t("workout.days")}</Text>
                </View>
                <CaretRight color={colors.muted} size={20} />
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  headerTitle: { color: c.onSurface, fontSize: 26, fontWeight: "900" },
  actionRow: { flexDirection: "row", gap: spacing.md },
  actionPrimary: { flex: 1, backgroundColor: c.brandPrimary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  actionPrimaryText: { color: c.onBrandPrimary, fontSize: 15, fontWeight: "800" },
  actionSecondary: { flex: 1, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  actionSecondaryText: { color: c.onSurface, fontSize: 15, fontWeight: "800" },
  section: { color: c.onSurface, fontSize: 20, fontWeight: "800", marginBottom: spacing.md },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  mgGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  mgTile: { backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minWidth: "30%", flexGrow: 1, alignItems: "center" },
  mgText: { color: c.onSurfaceSecondary, fontSize: 14, fontWeight: "700" },
  toggle: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, marginBottom: spacing.md },
  toggleActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  toggleText: { color: c.muted, fontSize: 12, fontWeight: "700" },
  planCard: { height: 150, borderRadius: radius.lg, overflow: "hidden", marginBottom: spacing.md },
  planImg: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, bottom: 0 },
  planScrim: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, bottom: 0 },
  planInfo: { flex: 1, justifyContent: "flex-end", padding: spacing.lg, gap: 4 },
  levelBadge: { alignSelf: "flex-start", paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm, marginBottom: 4 },
  levelText: { color: "#000", fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  planName: { color: "#fff", fontSize: 22, fontWeight: "900" },
  planMeta: { color: "#E0E0E0", fontSize: 13, fontWeight: "600" },
  createBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: spacing.md },
  createText: { color: c.brandPrimary, fontSize: 14, fontWeight: "700" },
  emptyText: { color: c.muted, fontSize: 14, textAlign: "center" },
  myPlanRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  myPlanName: { color: c.onSurface, fontSize: 16, fontWeight: "700" },
  myPlanMeta: { color: c.muted, fontSize: 13 },
}));
