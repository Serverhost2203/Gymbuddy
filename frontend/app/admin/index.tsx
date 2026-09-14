import { useState } from "react";
import { View, Text, ScrollView, Pressable, FlatList, TextInput } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Trash, PencilSimple, MagnifyingGlass, ShieldStar } from "phosphor-react-native";

import { apiFetch, SUPER_ADMIN_EMAIL } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { Header, Card, Loading, ChipRow, Button, Input } from "@/src/components/ui";

type Field = { key: string; label: string; numeric?: boolean };
const FORMS: Record<string, Field[]> = {
  exercises: [
    { key: "name", label: "Name" },
    { key: "muscle_group", label: "Muscle group (e.g. chest)" },
    { key: "equipment", label: "Equipment (comma separated)" },
    { key: "instructions", label: "Instructions" },
  ],
  foods: [
    { key: "name", label: "Name" },
    { key: "brand", label: "Brand" },
    { key: "calories", label: "Calories /100g", numeric: true },
    { key: "protein", label: "Protein", numeric: true },
    { key: "carbs", label: "Carbs", numeric: true },
    { key: "fat", label: "Fat", numeric: true },
  ],
  achievements: [
    { key: "code", label: "Code (unique)" },
    { key: "name", label: "Name" },
    { key: "description", label: "Description" },
    { key: "icon", label: "Icon (e.g. Trophy)" },
    { key: "xp", label: "XP", numeric: true },
    { key: "category", label: "Category" },
  ],
};

export default function Admin() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const [view, setView] = useState("stats");
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [userSearch, setUserSearch] = useState("");

  const statsQ = useQuery({ queryKey: ["admin-stats"], queryFn: () => apiFetch("/admin/stats") });
  const usersQ = useQuery({ queryKey: ["admin-users"], queryFn: () => apiFetch<any[]>("/admin/users"), enabled: view === "users" });
  const exQ = useQuery({ queryKey: ["admin-ex"], queryFn: () => apiFetch<any[]>("/admin/exercises"), enabled: view === "exercises" });
  const foodQ = useQuery({ queryKey: ["admin-food"], queryFn: () => apiFetch<any[]>("/admin/foods"), enabled: view === "foods" });
  const achQ = useQuery({ queryKey: ["admin-ach"], queryFn: () => apiFetch<any[]>("/admin/achievements"), enabled: view === "achievements" });

  const userMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => apiFetch(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const body: any = {};
      FORMS[view].forEach((f) => {
        let v: any = form[f.key] ?? "";
        if (f.numeric) v = parseFloat(v) || 0;
        else if (f.key === "equipment") v = v.split(",").map((x: string) => x.trim()).filter(Boolean);
        body[f.key] = v;
      });
      if (view === "exercises") {
        if (editing?.id) return apiFetch(`/admin/exercises/${editing.id}`, { method: "PUT", body: JSON.stringify(body) });
        return apiFetch("/admin/exercises", { method: "POST", body: JSON.stringify(body) });
      }
      if (view === "foods") return apiFetch("/admin/foods", { method: "POST", body: JSON.stringify(body) });
      return apiFetch("/admin/achievements", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`admin-${view === "exercises" ? "ex" : view === "foods" ? "food" : "ach"}`] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      setEditing(null);
      setForm({});
    },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => {
      const path = view === "exercises" ? `/admin/exercises/${id}` : view === "foods" ? `/admin/foods/${id}` : `/admin/achievements/${id}`;
      return apiFetch(path, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`admin-${view === "exercises" ? "ex" : view === "foods" ? "food" : "ach"}`] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  const openNew = () => { setEditing({}); setForm({}); };
  const openEdit = (item: any) => {
    setEditing(item);
    const f: Record<string, string> = {};
    FORMS[view].forEach((fld) => { f[fld.key] = Array.isArray(item[fld.key]) ? item[fld.key].join(", ") : String(item[fld.key] ?? ""); });
    setForm(f);
  };

  if (statsQ.isLoading) return <Loading />;
  const st = statsQ.data || {};
  const statCards = [["totalUsers", st.users], ["activeUsers", st.active_users], ["exercises", st.exercises], ["plans", st.plans], ["foods", st.foods], ["achievements", st.achievements]];

  const listData = view === "exercises" ? exQ.data : view === "foods" ? foodQ.data : view === "achievements" ? achQ.data : [];
  const listLoading = view === "exercises" ? exQ.isLoading : view === "foods" ? foodQ.isLoading : achQ.isLoading;
  const idKey = view === "achievements" ? "code" : "id";

  return (
    <View style={s.root}>
      <Header title={t("profile.adminPanel")} onBack={() => router.back()} right={FORMS[view] ? <Pressable testID="admin-add" onPress={openNew}><Plus color={colors.brandPrimary} size={24} weight="bold" /></Pressable> : null} />
      <View style={{ paddingVertical: spacing.md }}>
        <ChipRow
          items={[["stats", t("admin.statistics")], ["users", t("admin.users")], ["exercises", t("admin.exercises")], ["foods", t("admin.foods")], ["achievements", t("admin.achievements")]].map(([k, l]) => ({ key: k, label: l }))}
          selected={view}
          onSelect={(k) => { setView(k); setEditing(null); }}
          testIDPrefix="admin-tab"
        />
      </View>

      {view === "stats" && (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
          <View style={s.grid}>
            {statCards.map(([key, val]) => (
              <Card key={key as string} style={s.statCell} testID={`admin-stat-${key}`}>
                <Text style={s.statNum}>{val ?? 0}</Text>
                <Text style={s.statLbl}>{t(`admin.${key}` as any) || key}</Text>
              </Card>
            ))}
          </View>
          <Card testID="admin-stat-sessions"><Text style={s.statNum}>{st.sessions ?? 0}</Text><Text style={s.statLbl}>{t("progress.totalWorkouts")} · {st.diary_entries ?? 0} {t("nutrition.diary")}</Text></Card>
        </ScrollView>
      )}

      {view === "users" && (
        <View style={{ flex: 1 }}>
          <View style={s.searchWrap}>
            <MagnifyingGlass color={colors.muted} size={18} />
            <TextInput
              testID="user-search"
              value={userSearch}
              onChangeText={setUserSearch}
              placeholder={`${t("common.search")}…`}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={s.searchInput}
            />
          </View>
          <FlatList
            data={(usersQ.data || []).filter((u) => {
              const q = userSearch.trim().toLowerCase();
              if (!q) return true;
              return (u.email || "").toLowerCase().includes(q) || (u.profile?.name || "").toLowerCase().includes(q);
            })}
            keyExtractor={(u) => u.id}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.sm }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: u }) => {
              const isOwner = u.email === SUPER_ADMIN_EMAIL;
              return (
                <Card testID={`admin-user-${u.id}`} style={s.userRow}>
                  <Pressable testID={`open-user-${u.id}`} style={{ flex: 1 }} onPress={() => router.push(`/admin/user/${u.id}`)}>
                    <Text style={s.userEmail} numberOfLines={1}>{u.email}</Text>
                    <Text style={s.userMeta}>{u.profile?.name || "—"}{u.is_admin ? " · admin" : ""}{u.disabled ? " · disabled" : ""}</Text>
                  </Pressable>
                  {isOwner ? (
                    <View style={s.ownerBadge}><ShieldStar color={colors.warning} size={14} weight="fill" /><Text style={s.ownerText}>Owner</Text></View>
                  ) : (
                    <>
                      <Pressable testID={`toggle-disable-${u.id}`} onPress={() => userMut.mutate({ id: u.id, body: { disabled: !u.disabled } })} style={[s.miniBtn, { borderColor: u.disabled ? colors.success : colors.error }]}>
                        <Text style={[s.miniBtnText, { color: u.disabled ? colors.success : colors.error }]}>{u.disabled ? t("admin.enable") : t("admin.disable")}</Text>
                      </Pressable>
                      <Pressable testID={`toggle-admin-${u.id}`} onPress={() => userMut.mutate({ id: u.id, body: { is_admin: !u.is_admin } })} style={[s.miniBtn, { borderColor: colors.brandPrimary }]}>
                        <Text style={[s.miniBtnText, { color: colors.brandPrimary }]}>{u.is_admin ? t("admin.removeAdmin") : t("admin.makeAdmin")}</Text>
                      </Pressable>
                    </>
                  )}
                </Card>
              );
            }}
          />
        </View>
      )}

      {["exercises", "foods", "achievements"].includes(view) && (
        listLoading ? <Loading /> : (
          <FlatList
            data={listData || []}
            keyExtractor={(it) => it[idKey]}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.sm }}
            renderItem={({ item }) => (
              <Card testID={`admin-item-${item[idKey]}`} style={s.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName}>{item.name}</Text>
                  <Text style={s.itemMeta} numberOfLines={1}>
                    {view === "exercises" ? `${item.muscle_group} · ${(item.equipment || []).join(", ")}` : view === "foods" ? `${item.calories} kcal · P${item.protein} C${item.carbs} F${item.fat}` : `${item.category} · +${item.xp} XP`}
                  </Text>
                </View>
                {view === "exercises" && (
                  <Pressable testID={`edit-${item[idKey]}`} onPress={() => openEdit(item)} hitSlop={8}><PencilSimple color={colors.brandPrimary} size={18} /></Pressable>
                )}
                <Pressable testID={`del-${item[idKey]}`} onPress={() => delMut.mutate(item[idKey])} hitSlop={8}><Trash color={colors.error} size={18} /></Pressable>
              </Card>
            )}
          />
        )
      )}

      {/* Add/Edit modal */}
      {editing && FORMS[view] && (
        <View style={s.overlay}>
          <Pressable style={s.overlayBg} onPress={() => setEditing(null)} />
          <KeyboardAwareScrollView bottomOffset={20} style={s.sheetScroll} contentContainerStyle={[s.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={s.sheetTitle}>{editing.id || editing.code ? t("common.edit") : t("common.add")}</Text>
            {FORMS[view].map((f) => (
              <Input key={f.key} testID={`form-${f.key}`} label={f.label} value={form[f.key] || ""} onChangeText={(v) => setForm({ ...form, [f.key]: v })} keyboardType={f.numeric ? "numeric" : undefined} />
            ))}
            <Button testID="admin-save" label={t("common.save")} onPress={() => saveMut.mutate()} loading={saveMut.isPending} style={{ marginTop: spacing.md }} />
          </KeyboardAwareScrollView>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  statCell: { width: "30%", flexGrow: 1, gap: 4 },
  statNum: { color: c.brandPrimary, fontSize: 26, fontWeight: "900" },
  statLbl: { color: c.muted, fontSize: 12, fontWeight: "600" },
  userRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.lg, marginBottom: spacing.sm, paddingHorizontal: spacing.md, height: 46, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  searchInput: { flex: 1, color: c.onSurface, fontSize: 15, height: 46 },
  ownerBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.brandTertiary, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.sm },
  ownerText: { color: c.warning, fontSize: 11, fontWeight: "800" },
  userEmail: { color: c.onSurface, fontSize: 14, fontWeight: "700" },
  userMeta: { color: c.muted, fontSize: 12 },
  miniBtn: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1 },
  miniBtnText: { fontSize: 11, fontWeight: "800" },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  itemName: { color: c.onSurface, fontSize: 15, fontWeight: "700" },
  itemMeta: { color: c.muted, fontSize: 12, textTransform: "capitalize" },
  overlay: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-end" },
  overlayBg: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)" },
  sheetScroll: { maxHeight: "88%" },
  sheet: { backgroundColor: c.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.md, borderTopWidth: 1, borderColor: c.border },
  sheetTitle: { color: c.onSurface, fontSize: 20, fontWeight: "800" },
}));
