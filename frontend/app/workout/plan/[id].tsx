import { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Trash } from "phosphor-react-native";

import { apiFetch } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { Header, Card, Button, Loading } from "@/src/components/ui";

export default function PlanDetail() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [dayIdx, setDayIdx] = useState(0);

  const { data: plan, isLoading } = useQuery({ queryKey: ["plan", id], queryFn: () => apiFetch(`/plans/${id}`) });
  const delMut = useMutation({
    mutationFn: () => apiFetch(`/plans/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      router.back();
    },
  });

  if (isLoading || !plan) return <Loading />;
  const day = plan.days?.[dayIdx];

  return (
    <View style={s.root}>
      <Header
        title={plan.name}
        onBack={() => router.back()}
        right={!plan.is_template ? (
          <Pressable testID="delete-plan" onPress={() => delMut.mutate()}><Trash color={colors.error} size={20} /></Pressable>
        ) : null}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100, gap: spacing.md }}>
        <Text style={s.desc}>{plan.description}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {plan.days?.map((d: any, i: number) => (
            <Pressable key={i} testID={`day-tab-${i}`} onPress={() => setDayIdx(i)} style={[s.dayChip, i === dayIdx && s.dayChipActive]}>
              <Text style={[s.dayChipText, i === dayIdx && { color: colors.onBrandPrimary }]}>{d.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {day?.exercises?.map((ex: any, i: number) => (
          <Card key={i} style={s.exRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.exName}>{ex.exercise_name}</Text>
              <Text style={s.exMeta}>{ex.sets} {t("workout.sets")} × {ex.reps} · {t("workout.rest")} {ex.rest}s</Text>
            </View>
          </Card>
        ))}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button testID="start-plan-day" label={`${t("workout.startThisPlan")} · ${day?.name || ""}`} onPress={() => router.push(`/workout/session?planId=${id}&dayIndex=${dayIdx}`)} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  desc: { color: c.muted, fontSize: 14, lineHeight: 20 },
  dayChip: { paddingHorizontal: spacing.lg, height: 40, borderRadius: radius.pill, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  dayChipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  dayChipText: { color: c.onSurfaceTertiary, fontSize: 14, fontWeight: "700" },
  exRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md },
  exName: { color: c.onSurface, fontSize: 16, fontWeight: "700" },
  exMeta: { color: c.muted, fontSize: 13, marginTop: 2 },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: c.divider, backgroundColor: c.surface },
}));
