import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiFetch } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { makeStyles, spacing, useTheme } from "@/src/theme";
import { Header, Card, Button, Input, Loading } from "@/src/components/ui";
import { clampNum, shortDate } from "@/src/lib";

const FIELDS = ["waist", "chest", "arms", "legs", "hips", "shoulders"] as const;

export default function Measurements() {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({ queryKey: ["measurements"], queryFn: () => apiFetch<any[]>("/measurements") });
  const [vals, setVals] = useState<Record<string, string>>({});

  const mut = useMutation({
    mutationFn: () => {
      const body: any = {};
      FIELDS.forEach((f) => { if (vals[f]) body[f] = clampNum(vals[f]); });
      return apiFetch("/measurements", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["measurements"] });
      setVals({});
    },
  });

  if (isLoading) return <Loading />;
  const latest = data && data.length ? data[data.length - 1] : null;

  return (
    <View style={s.root}>
      <Header title={t("progress.measurements")} onBack={() => router.back()} />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }} bottomOffset={20}>
        {latest && (
          <Card>
            <Text style={s.cardTitle}>{shortDate(latest.date)}</Text>
            <View style={s.latestGrid}>
              {FIELDS.map((f) => latest[f] != null && (
                <View key={f} style={s.latestCell}>
                  <Text style={s.latestVal}>{latest[f]}<Text style={s.cm}> cm</Text></Text>
                  <Text style={s.latestLbl}>{t(`progress.${f}`)}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        <Card>
          <Text style={s.cardTitle}>{t("progress.addMeasurement")}</Text>
          <View style={s.grid}>
            {FIELDS.map((f) => (
              <Input key={f} testID={`m-${f}`} style={s.col} label={t(`progress.${f}`)} value={vals[f] || ""} onChangeText={(v) => setVals({ ...vals, [f]: v })} keyboardType="numeric" placeholder="cm" />
            ))}
          </View>
          <Button testID="save-measurement" label={t("common.save")} onPress={() => mut.mutate()} loading={mut.isPending} style={{ marginTop: spacing.md }} />
        </Card>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  cardTitle: { color: c.onSurface, fontSize: 16, fontWeight: "800", marginBottom: spacing.md },
  latestGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  latestCell: { width: "30%", flexGrow: 1 },
  latestVal: { color: c.onSurface, fontSize: 22, fontWeight: "900" },
  cm: { color: c.muted, fontSize: 13, fontWeight: "700" },
  latestLbl: { color: c.muted, fontSize: 12, textTransform: "capitalize" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  col: { width: "47%", flexGrow: 1 },
}));
