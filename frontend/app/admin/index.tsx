import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiFetch } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { Header, Card, Loading } from "@/src/components/ui";

export default function Admin() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();

  const statsQ = useQuery({ queryKey: ["admin-stats"], queryFn: () => apiFetch("/admin/stats") });
  const usersQ = useQuery({ queryKey: ["admin-users"], queryFn: () => apiFetch<any[]>("/admin/users") });

  const updMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => apiFetch(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  if (statsQ.isLoading || usersQ.isLoading) return <Loading />;
  const st = statsQ.data || {};

  const statCards = [
    ["totalUsers", st.users], ["activeUsers", st.active_users],
    ["exercises", st.exercises], ["plans", st.plans],
    ["foods", st.foods], ["achievements", st.achievements],
  ];

  return (
    <View style={s.root}>
      <Header title={t("profile.admin")} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        <Text style={s.section}>{t("admin.statistics")}</Text>
        <View style={s.grid}>
          {statCards.map(([key, val]) => (
            <Card key={key as string} style={s.statCell} testID={`admin-stat-${key}`}>
              <Text style={s.statNum}>{val ?? 0}</Text>
              <Text style={s.statLbl}>{t(`admin.${key}` as any) || key}</Text>
            </Card>
          ))}
        </View>
        <Card style={s.wide} testID="admin-stat-sessions">
          <Text style={s.statNum}>{st.sessions ?? 0}</Text>
          <Text style={s.statLbl}>{t("progress.totalWorkouts")} · {st.diary_entries ?? 0} {t("nutrition.diary")}</Text>
        </Card>

        <Text style={s.section}>{t("admin.users")}</Text>
        {(usersQ.data || []).map((u) => (
          <Card key={u.id} testID={`admin-user-${u.id}`} style={s.userRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.userEmail} numberOfLines={1}>{u.email}</Text>
              <Text style={s.userMeta}>{u.profile?.name || "—"}{u.is_admin ? " · admin" : ""}{u.disabled ? " · disabled" : ""}</Text>
            </View>
            <Pressable testID={`toggle-disable-${u.id}`} onPress={() => updMut.mutate({ id: u.id, body: { disabled: !u.disabled } })} style={[s.miniBtn, { borderColor: u.disabled ? colors.success : colors.error }]}>
              <Text style={[s.miniBtnText, { color: u.disabled ? colors.success : colors.error }]}>{u.disabled ? t("admin.enable") : t("admin.disable")}</Text>
            </Pressable>
            <Pressable testID={`toggle-admin-${u.id}`} onPress={() => updMut.mutate({ id: u.id, body: { is_admin: !u.is_admin } })} style={[s.miniBtn, { borderColor: colors.brandPrimary }]}>
              <Text style={[s.miniBtnText, { color: colors.brandPrimary }]}>{u.is_admin ? t("admin.removeAdmin") : t("admin.makeAdmin")}</Text>
            </Pressable>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  section: { color: c.onSurface, fontSize: 20, fontWeight: "800", marginTop: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  statCell: { width: "30%", flexGrow: 1, gap: 4 },
  wide: { gap: 4 },
  statNum: { color: c.brandPrimary, fontSize: 26, fontWeight: "900" },
  statLbl: { color: c.muted, fontSize: 12, fontWeight: "600" },
  userRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  userEmail: { color: c.onSurface, fontSize: 14, fontWeight: "700" },
  userMeta: { color: c.muted, fontSize: 12 },
  miniBtn: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1 },
  miniBtnText: { fontSize: 11, fontWeight: "800" },
}));
