import { useState } from "react";
import { View, Text, Pressable, Linking } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Barcode } from "phosphor-react-native";

import { apiFetch } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { Header, Button, Input, ChipRow } from "@/src/components/ui";
import { clampNum } from "@/src/lib";

export default function Scan() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [food, setFood] = useState<any>(null);
  const [error, setError] = useState("");
  const [grams, setGrams] = useState("100");
  const [meal, setMeal] = useState("snack");

  const addMut = useMutation({
    mutationFn: (body: any) => apiFetch("/diary", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      router.back();
    },
  });

  const onScan = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setError("");
    try {
      const f = await apiFetch(`/foods/barcode/${data}`);
      setFood(f);
    } catch {
      setError(t("nutrition.notFound"));
    }
  };

  const add = () => {
    const g = clampNum(grams) || 100;
    const factor = g / 100;
    addMut.mutate({
      meal,
      name: food.name,
      quantity: g,
      calories: Math.round(food.calories * factor),
      protein: +(food.protein * factor).toFixed(1),
      carbs: +(food.carbs * factor).toFixed(1),
      fat: +(food.fat * factor).toFixed(1),
      food_id: food.id,
    });
  };

  if (!permission) return <View style={s.root} />;

  if (!permission.granted) {
    return (
      <View style={s.root}>
        <Header title={t("nutrition.scanBarcode")} onBack={() => router.back()} />
        <View style={s.center}>
          <Barcode color={colors.brandPrimary} size={56} />
          <Text style={s.permText}>{t("nutrition.scanPrompt")}</Text>
          {permission.canAskAgain ? (
            <Button testID="grant-camera" label={t("common.continue")} onPress={requestPermission} />
          ) : (
            <Button testID="open-settings" label={t("profile.settings")} onPress={() => Linking.openSettings()} variant="secondary" />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Header title={t("nutrition.scanBarcode")} onBack={() => router.back()} />
      <View style={s.cameraWrap}>
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"] }}
          onBarcodeScanned={onScan}
        />
        <View style={s.reticle} pointerEvents="none" />
        {!food && <Text style={s.hint}>{t("nutrition.scanPrompt")}</Text>}
      </View>

      {(food || error) && (
        <View style={[s.result, { paddingBottom: insets.bottom + spacing.lg }]}>
          {error ? (
            <>
              <Text style={s.errorText}>{error}</Text>
              <Button testID="scan-again" label={t("common.retry")} onPress={() => { setScanned(false); setError(""); }} />
            </>
          ) : (
            <>
              <Text style={s.foodName}>{food.name}</Text>
              <Text style={s.foodMeta}>{Math.round(food.calories)} kcal · P{Math.round(food.protein)} C{Math.round(food.carbs)} F{Math.round(food.fat)} /100g</Text>
              <ChipRow items={["breakfast", "lunch", "dinner", "snack"].map((m) => ({ key: m, label: t(`nutrition.${m}`) }))} selected={meal} onSelect={setMeal} />
              <Input testID="scan-grams" label={t("nutrition.quantity")} value={grams} onChangeText={setGrams} keyboardType="numeric" style={{ marginTop: spacing.sm }} />
              <View style={s.resultBtns}>
                <Button testID="scan-add" label={t("common.add")} onPress={add} loading={addMut.isPending} style={{ flex: 1 }} />
                <Button testID="scan-rescan" label={t("common.retry")} variant="secondary" onPress={() => { setScanned(false); setFood(null); }} style={{ flex: 1 }} />
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, padding: spacing.xl },
  permText: { color: c.onSurfaceTertiary, fontSize: 15, textAlign: "center" },
  cameraWrap: { flex: 1, position: "relative" },
  reticle: { position: "absolute", top: "35%", left: "12%", right: "12%", height: 120, borderWidth: 3, borderColor: c.brandPrimary, borderRadius: radius.md },
  hint: { position: "absolute", bottom: spacing.xl, alignSelf: "center", color: c.onSurface, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, fontSize: 14, fontWeight: "600" },
  result: { backgroundColor: c.surfaceSecondary, padding: spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderColor: c.border },
  foodName: { color: c.onSurface, fontSize: 20, fontWeight: "800" },
  foodMeta: { color: c.muted, fontSize: 13, marginBottom: spacing.sm },
  errorText: { color: c.error, fontSize: 15, fontWeight: "700", marginBottom: spacing.sm },
  resultBtns: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
}));
