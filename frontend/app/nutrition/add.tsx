import { useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MagnifyingGlass, Plus } from "phosphor-react-native";

import { apiFetch } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { Header, Button, Input, ChipRow, EmptyState } from "@/src/components/ui";
import { clampNum } from "@/src/lib";

type Food = { id?: string | null; name: string; brand?: string; calories: number; protein: number; carbs: number; fat: number; quantity?: number };

export default function AddFood() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ meal?: string }>();
  const [meal, setMeal] = useState(params.meal || "snack");
  const [tab, setTab] = useState("search");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Food | null>(null);
  const [grams, setGrams] = useState("100");
  const [manual, setManual] = useState(false);
  const [mf, setMf] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "" });
  const [saveCustom, setSaveCustom] = useState(true);

  const searchQ = useQuery({
    queryKey: ["food-search", q],
    queryFn: () => apiFetch<Food[]>(`/foods/search?q=${encodeURIComponent(q)}`),
    enabled: tab === "search",
  });
  const recentQ = useQuery({ queryKey: ["food-recent"], queryFn: () => apiFetch<Food[]>("/foods/recent"), enabled: tab === "recent" });
  const customQ = useQuery({ queryKey: ["food-custom"], queryFn: () => apiFetch<Food[]>("/foods/custom"), enabled: tab === "custom" });

  const addMut = useMutation({
    mutationFn: (body: any) => apiFetch("/diary", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      router.back();
    },
  });
  const createFoodMut = useMutation({
    mutationFn: (body: any) => apiFetch("/foods", { method: "POST", body: JSON.stringify(body) }),
  });

  const confirmAdd = async () => {
    if (!selected) return;
    const g = clampNum(grams) || 100;
    // recent items store macros for their logged quantity; normalize to per-100g
    const per100 = selected.quantity ? selected.quantity / 100 : 1;
    const f = g / 100 / per100;
    addMut.mutate({
      meal,
      name: selected.name,
      quantity: g,
      calories: Math.round(selected.calories * f),
      protein: +(selected.protein * f).toFixed(1),
      carbs: +(selected.carbs * f).toFixed(1),
      fat: +(selected.fat * f).toFixed(1),
      food_id: selected.id,
    });
  };

  const submitManual = async () => {
    const food = {
      name: mf.name || "Food",
      calories: clampNum(mf.calories),
      protein: clampNum(mf.protein),
      carbs: clampNum(mf.carbs),
      fat: clampNum(mf.fat),
    };
    if (saveCustom) await createFoodMut.mutateAsync({ ...food, brand: "Custom" });
    addMut.mutate({ meal, name: food.name, quantity: 100, ...food });
  };

  const renderItem = ({ item }: { item: Food }) => (
    <Pressable testID={`food-item-${item.name}`} style={s.foodRow} onPress={() => { setSelected(item); setGrams(String(item.quantity || 100)); }}>
      <View style={{ flex: 1 }}>
        <Text style={s.foodName} numberOfLines={1}>{item.name}</Text>
        <Text style={s.foodMeta} numberOfLines={1}>{item.brand} · {Math.round(item.calories)} kcal{item.quantity ? "" : " /100g"}</Text>
      </View>
      <Text style={s.foodMacro}>P{Math.round(item.protein)} C{Math.round(item.carbs)} F{Math.round(item.fat)}</Text>
    </Pressable>
  );

  const list = tab === "search" ? searchQ.data : tab === "recent" ? recentQ.data : customQ.data;
  const loading = tab === "search" ? searchQ.isFetching : tab === "recent" ? recentQ.isLoading : customQ.isLoading;

  return (
    <View style={s.root}>
      <Header title={t("nutrition.addFood")} onBack={() => router.back()} />

      <View style={s.mealChips}>
        <ChipRow
          items={["breakfast", "lunch", "dinner", "snack"].map((mkey) => ({ key: mkey, label: t(`nutrition.${mkey}`) }))}
          selected={meal}
          onSelect={setMeal}
          testIDPrefix="meal-chip"
        />
      </View>

      <View style={s.tabs}>
        {[["search", t("common.search")], ["recent", t("nutrition.recent")], ["custom", t("nutrition.customFoods")]].map(([k, label]) => (
          <Pressable key={k} testID={`tab-${k}`} onPress={() => setTab(k)} style={[s.tab, tab === k && s.tabActive]}>
            <Text style={[s.tabText, tab === k && s.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "search" && (
        <View style={s.searchWrap}>
          <MagnifyingGlass color={colors.muted} size={20} />
          <Input testID="food-search-input" value={q} onChangeText={setQ} placeholder={t("nutrition.searchFood")} style={{ flex: 1 }} autoCapitalize="none" />
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={list || []}
          keyExtractor={(it, i) => `${it.name}-${i}`}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100 }}
          ListEmptyComponent={<EmptyState title={t("nutrition.noEntries")} />}
        />
      )}

      <Pressable testID="manual-add-btn" onPress={() => setManual(true)} style={[s.fab, { bottom: insets.bottom + spacing.lg }]}>
        <Plus color={colors.onBrandPrimary} size={20} weight="bold" />
        <Text style={s.fabText}>{t("nutrition.manualAdd")}</Text>
      </Pressable>

      {/* Quantity modal */}
      {selected && (
        <View style={s.overlay}>
          <Pressable style={s.overlayBg} onPress={() => setSelected(null)} />
          <View style={[s.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={s.sheetTitle}>{selected.name}</Text>
            <Text style={s.sheetMeta}>{Math.round(selected.calories)} kcal /100g</Text>
            <Input testID="grams-input" label={t("nutrition.quantity")} value={grams} onChangeText={setGrams} keyboardType="numeric" />
            <Button testID="confirm-add-food" label={`${t("nutrition.addToMeal")} ${t(`nutrition.${meal}`)}`} onPress={confirmAdd} loading={addMut.isPending} style={{ marginTop: spacing.md }} />
          </View>
        </View>
      )}

      {/* Manual add modal */}
      {manual && (
        <View style={s.overlay}>
          <Pressable style={s.overlayBg} onPress={() => setManual(false)} />
          <KeyboardAwareScrollView bottomOffset={20} style={s.sheetScroll} contentContainerStyle={[s.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={s.sheetTitle}>{t("nutrition.manualAdd")}</Text>
            <Input testID="mf-name" label={t("nutrition.foodName")} value={mf.name} onChangeText={(v) => setMf({ ...mf, name: v })} />
            <View style={s.mfGrid}>
              <Input testID="mf-cal" style={s.mfCol} label={t("nutrition.calories")} value={mf.calories} onChangeText={(v) => setMf({ ...mf, calories: v })} keyboardType="numeric" />
              <Input testID="mf-p" style={s.mfCol} label={t("dashboard.protein")} value={mf.protein} onChangeText={(v) => setMf({ ...mf, protein: v })} keyboardType="numeric" />
            </View>
            <View style={s.mfGrid}>
              <Input testID="mf-c" style={s.mfCol} label={t("dashboard.carbs")} value={mf.carbs} onChangeText={(v) => setMf({ ...mf, carbs: v })} keyboardType="numeric" />
              <Input testID="mf-f" style={s.mfCol} label={t("dashboard.fat")} value={mf.fat} onChangeText={(v) => setMf({ ...mf, fat: v })} keyboardType="numeric" />
            </View>
            <Pressable testID="save-custom-toggle" onPress={() => setSaveCustom(!saveCustom)} style={s.checkRow}>
              <View style={[s.checkbox, saveCustom && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]} />
              <Text style={s.checkLabel}>{t("nutrition.saveCustom")}</Text>
            </Pressable>
            <Button testID="submit-manual" label={t("common.add")} onPress={submitManual} loading={addMut.isPending} style={{ marginTop: spacing.md }} />
          </KeyboardAwareScrollView>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  mealChips: { paddingVertical: spacing.md },
  tabs: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: "center", backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  tabActive: { backgroundColor: c.brandTertiary, borderColor: c.brandPrimary },
  tabText: { color: c.muted, fontSize: 13, fontWeight: "700" },
  tabTextActive: { color: c.brandPrimary },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
  foodRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider, gap: spacing.md },
  foodName: { color: c.onSurface, fontSize: 15, fontWeight: "700" },
  foodMeta: { color: c.muted, fontSize: 12 },
  foodMacro: { color: c.onSurfaceTertiary, fontSize: 12, fontWeight: "700" },
  fab: { position: "absolute", right: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.brandPrimary, paddingHorizontal: spacing.lg, height: 50, borderRadius: radius.pill },
  fabText: { color: c.onBrandPrimary, fontWeight: "800", fontSize: 15 },
  overlay: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-end" },
  overlayBg: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)" },
  sheetScroll: { maxHeight: "85%" },
  sheet: { backgroundColor: c.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderColor: c.border },
  sheetTitle: { color: c.onSurface, fontSize: 20, fontWeight: "800" },
  sheetMeta: { color: c.muted, fontSize: 13, marginBottom: spacing.sm },
  mfGrid: { flexDirection: "row", gap: spacing.md },
  mfCol: { flex: 1 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: c.borderStrong },
  checkLabel: { color: c.onSurfaceSecondary, fontSize: 14, fontWeight: "600" },
}));
