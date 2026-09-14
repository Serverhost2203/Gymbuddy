import { useState } from "react";
import { View, Text, Pressable, FlatList, Platform, Linking } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Camera, Image as ImageIcon, Trash, Plus } from "phosphor-react-native";

import { apiFetch, apiUpload, fileUrl } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { useAuth } from "@/src/auth";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { Header, Loading, EmptyState } from "@/src/components/ui";
import { shortDate } from "@/src/lib";

export default function Photos() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { token } = useAuth();
  const [showOptions, setShowOptions] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["photos"], queryFn: () => apiFetch<any[]>("/photos") });

  const delMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/photos/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["photos"] }),
  });

  const upload = async (uri: string) => {
    setUploading(true);
    try {
      const name = `photo_${Date.now()}.jpg`;
      const form = new FormData();
      if (Platform.OS === "web") {
        const blob = await (await fetch(uri)).blob();
        form.append("file", blob, name);
      } else {
        form.append("file", { uri, name, type: "image/jpeg" } as any);
      }
      form.append("date_str", new Date().toISOString().slice(0, 10));
      await apiUpload("/photos", form);
      queryClient.invalidateQueries({ queryKey: ["photos"] });
    } finally {
      setUploading(false);
      setShowOptions(false);
    }
  };

  const fromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) Linking.openSettings();
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
    if (!res.canceled && res.assets?.[0]) upload(res.assets[0].uri);
  };
  const fromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) Linking.openSettings();
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!res.canceled && res.assets?.[0]) upload(res.assets[0].uri);
  };

  if (isLoading) return <Loading />;

  return (
    <View style={s.root}>
      <Header title={t("progress.photos")} onBack={() => router.back()} />
      <FlatList
        data={data || []}
        keyExtractor={(it) => it.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100, gap: spacing.md }}
        ListEmptyComponent={<EmptyState title={t("progress.noPhotos")} icon={<Camera color={colors.muted} size={44} />} />}
        renderItem={({ item }) => (
          <View style={s.photoCard} testID={`photo-${item.id}`}>
            <Image
              source={{ uri: fileUrl(item.id, token), headers: token ? { Authorization: `Bearer ${token}` } : undefined }}
              style={s.photo}
              contentFit="cover"
            />
            <View style={s.photoFooter}>
              <Text style={s.photoDate}>{shortDate(item.date)}</Text>
              <Pressable testID={`del-photo-${item.id}`} onPress={() => delMut.mutate(item.id)} hitSlop={8}><Trash color={colors.error} size={16} /></Pressable>
            </View>
          </View>
        )}
      />

      <Pressable testID="add-photo-fab" onPress={() => setShowOptions(true)} style={[s.fab, { bottom: insets.bottom + spacing.lg }]}>
        <Plus color={colors.onBrandPrimary} size={24} weight="bold" />
      </Pressable>

      {showOptions && (
        <View style={s.overlay}>
          <Pressable style={s.overlayBg} onPress={() => setShowOptions(false)} />
          <View style={[s.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={s.sheetTitle}>{t("progress.addPhoto")}</Text>
            <Pressable testID="photo-camera" onPress={fromCamera} style={s.option} disabled={uploading}>
              <Camera color={colors.brandPrimary} size={24} weight="fill" />
              <Text style={s.optionText}>{t("progress.takePhoto")}</Text>
            </Pressable>
            <Pressable testID="photo-library" onPress={fromLibrary} style={s.option} disabled={uploading}>
              <ImageIcon color={colors.brandPrimary} size={24} weight="fill" />
              <Text style={s.optionText}>{t("progress.choosePhoto")}</Text>
            </Pressable>
            {uploading && <Text style={s.uploading}>{t("common.loading")}</Text>}
          </View>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  photoCard: { flex: 1, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: c.border },
  photo: { width: "100%", height: 180 },
  photoFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.sm },
  photoDate: { color: c.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },
  fab: { position: "absolute", right: spacing.lg, width: 58, height: 58, borderRadius: 29, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  overlay: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-end" },
  overlayBg: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { backgroundColor: c.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  sheetTitle: { color: c.onSurface, fontSize: 20, fontWeight: "800", marginBottom: spacing.sm },
  option: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  optionText: { color: c.onSurface, fontSize: 16, fontWeight: "600" },
  uploading: { color: c.brandPrimary, textAlign: "center", fontWeight: "700" },
}));
