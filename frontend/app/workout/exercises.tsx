import { useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CaretDown } from "phosphor-react-native";

import { apiFetch } from "@/src/api";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { Header, ChipRow, Loading, EmptyState } from "@/src/components/ui";

export default function Exercises() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ mg?: string }>();
  const [mg, setMg] = useState(params.mg || "all");
  const [equipOnly, setEquipOnly] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const eqQ = useQuery({ queryKey: ["equipment-list"], queryFn: () => apiFetch("/equipment") });
  const exQ = useQuery({
    queryKey: ["exercises", mg, equipOnly],
    queryFn: () => apiFetch<any[]>(`/exercises?${mg !== "all" ? `muscle_group=${mg}&` : ""}equipment_only=${equipOnly}`),
  });

  const groups = [{ code: "all", name: t("workout.library") }, ...(eqQ.data?.muscle_groups || [])];

  return (
    <View style={s.root}>
      <Header
        title={t("workout.browseExercises")}
        onBack={() => router.back()}
        right={
          <Pressable testID="toggle-equip-only" onPress={() => setEquipOnly(!equipOnly)} style={[s.eqToggle, equipOnly && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
            <Text style={[s.eqToggleText, equipOnly && { color: colors.onBrandPrimary }]}>{t("workout.equipment")}</Text>
          </Pressable>
        }
      />
      <View style={{ paddingVertical: spacing.md }}>
        <ChipRow items={groups.map((g: any) => ({ key: g.code, label: g.name }))} selected={mg} onSelect={setMg} testIDPrefix="mg-chip" />
      </View>
      {exQ.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={exQ.data || []}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          ListEmptyComponent={<EmptyState title={t("workout.noExercises")} />}
          renderItem={({ item }) => {
            const open = expanded === item.id;
            return (
              <Pressable testID={`ex-${item.id}`} style={s.card} onPress={() => setExpanded(open ? null : item.id)}>
                <View style={s.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.exName}>{item.name}</Text>
                    <View style={s.tags}>
                      {(item.equipment || []).map((e: string) => (
                        <View key={e} style={s.tag}><Text style={s.tagText}>{e}</Text></View>
                      ))}
                    </View>
                  </View>
                  <CaretDown color={colors.muted} size={18} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
                </View>
                {open && <Text style={s.instr}>{item.instructions}</Text>}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  eqToggle: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border },
  eqToggleText: { color: c.muted, fontSize: 12, fontWeight: "700" },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.lg, marginBottom: spacing.sm },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  exName: { color: c.onSurface, fontSize: 16, fontWeight: "700" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  tag: { backgroundColor: c.surfaceTertiary, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  tagText: { color: c.onSurfaceTertiary, fontSize: 11, fontWeight: "600" },
  instr: { color: c.muted, fontSize: 14, lineHeight: 20, marginTop: spacing.md },
}));
