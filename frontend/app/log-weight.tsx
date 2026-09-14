import { useState } from "react";
import { View, Text } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiFetch } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { useAuth } from "@/src/auth";
import { makeStyles, spacing, useTheme } from "@/src/theme";
import { Header, Button, Input } from "@/src/components/ui";
import { clampNum } from "@/src/lib";

export default function LogWeight() {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [weight, setWeight] = useState(user?.profile?.weight ? String(user.profile.weight) : "");

  const mut = useMutation({
    mutationFn: (w: number) => apiFetch("/weight", { method: "POST", body: JSON.stringify({ weight: w }) }),
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["weight"] });
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
      router.back();
    },
  });

  return (
    <View style={s.root}>
      <Header title={t("dashboard.logWeight")} onBack={() => router.back()} />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }} bottomOffset={20}>
        <Text style={s.big}>{t("progress.weight")}</Text>
        <Input testID="weight-input" value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="75.0" label="kg" />
        <Button testID="save-weight" label={t("common.save")} onPress={() => mut.mutate(clampNum(weight))} loading={mut.isPending} disabled={!clampNum(weight)} style={{ marginTop: spacing.lg }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  big: { color: c.onSurface, fontSize: 24, fontWeight: "900", marginBottom: spacing.md },
}));
