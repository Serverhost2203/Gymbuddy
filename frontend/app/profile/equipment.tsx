import { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check } from "phosphor-react-native";

import { apiFetch } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { useAuth } from "@/src/auth";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { Header, Button, Loading } from "@/src/components/ui";

export default function Equipment() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["equipment-list"], queryFn: () => apiFetch("/equipment") });
  const [selected, setSelected] = useState<string[]>(user?.equipment || []);

  useEffect(() => { if (user?.equipment) setSelected(user.equipment); }, [user]);

  const mut = useMutation({
    mutationFn: () => apiFetch("/profile/equipment", { method: "PUT", body: JSON.stringify({ equipment: selected }) }),
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      router.back();
    },
  });

  const toggle = (code: string) => setSelected((prev) => (prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]));

  if (isLoading) return <Loading />;

  return (
    <View style={s.root}>
      <Header title={t("profile.equipment")} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100 }}>
        <Text style={s.hint}>{t("profile.selectEquipment")}</Text>
        <View style={s.grid}>
          {(data?.equipment || []).map((eq: any) => {
            const on = selected.includes(eq.code);
            return (
              <Pressable key={eq.code} testID={`equip-${eq.code}`} onPress={() => toggle(eq.code)} style={[s.tile, on && s.tileOn]}>
                {on && <View style={s.check}><Check color={colors.onBrandPrimary} size={14} weight="bold" /></View>}
                <Text style={[s.tileText, on && { color: colors.onSurface }]}>{eq.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button testID="save-equipment" label={t("common.save")} onPress={() => mut.mutate()} loading={mut.isPending} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  hint: { color: c.muted, fontSize: 14, marginBottom: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  tile: { width: "47%", flexGrow: 1, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.lg, minHeight: 70, justifyContent: "center" },
  tileOn: { borderColor: c.brandPrimary, backgroundColor: c.brandTertiary },
  check: { position: "absolute", top: spacing.sm, right: spacing.sm, width: 22, height: 22, borderRadius: 11, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  tileText: { color: c.onSurfaceTertiary, fontSize: 15, fontWeight: "700" },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: c.divider },
}));
