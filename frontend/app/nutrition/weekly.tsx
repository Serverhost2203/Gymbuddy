import { View, Text, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BarChart } from "react-native-gifted-charts";

import { apiFetch } from "@/src/api";
import { makeStyles, spacing, useTheme } from "@/src/theme";
import { Header, Card, Loading } from "@/src/components/ui";
import { shortDate } from "@/src/lib";

export default function WeeklyNutrition() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({ queryKey: ["nutrition-weekly"], queryFn: () => apiFetch<any[]>("/nutrition/weekly") });

  if (isLoading || !data) return <Loading />;

  const bars = data.map((d) => ({ value: d.calories, label: shortDate(d.date).split(" ")[1], frontColor: colors.brandPrimary }));
  const avg = Math.round(data.reduce((a, d) => a + d.calories, 0) / (data.length || 1));
  const avgP = Math.round(data.reduce((a, d) => a + d.protein, 0) / (data.length || 1));

  return (
    <View style={s.root}>
      <Header title={t("nutrition.weeklyOverview")} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        <Card>
          <Text style={s.title}>{t("nutrition.calories")}</Text>
          <View style={{ marginTop: spacing.md }}>
            <BarChart
              data={bars}
              height={160}
              barWidth={22}
              spacing={14}
              roundedTop
              hideRules
              yAxisColor="transparent"
              xAxisColor={colors.border}
              yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: colors.muted, fontSize: 10 }}
              noOfSections={3}
            />
          </View>
        </Card>
        <View style={s.row}>
          <Card style={s.stat}>
            <Text style={s.statLabel}>Ø {t("nutrition.calories")}</Text>
            <Text style={s.statVal}>{avg}</Text>
          </Card>
          <Card style={s.stat}>
            <Text style={s.statLabel}>Ø {t("dashboard.protein")}</Text>
            <Text style={s.statVal}>{avgP}g</Text>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  title: { color: c.onSurface, fontSize: 16, fontWeight: "800" },
  row: { flexDirection: "row", gap: spacing.md },
  stat: { flex: 1, gap: 4 },
  statLabel: { color: c.muted, fontSize: 13 },
  statVal: { color: c.onSurface, fontSize: 26, fontWeight: "900" },
}));
