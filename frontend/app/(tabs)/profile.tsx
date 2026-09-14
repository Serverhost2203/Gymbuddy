import { View, Text, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { UserGear, Barbell, GearSix, Translate, ShieldStar, SignOut, CaretRight, Target } from "phosphor-react-native";

import { useAuth } from "@/src/auth";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { shortDate } from "@/src/lib";

const COVER =
  "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000";

function Row({ icon, label, onPress, testID }: { icon: React.ReactNode; label: string; onPress: () => void; testID?: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} style={s.row}>
      <View style={s.iconBox}>{icon}</View>
      <Text style={s.rowLabel}>{label}</Text>
      <CaretRight color={colors.muted} size={18} />
    </Pressable>
  );
}

export default function Profile() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false}>
        <View style={s.cover}>
          <Image source={{ uri: COVER }} style={s.coverImg} contentFit="cover" />
          <LinearGradient colors={["rgba(12,12,14,0.4)", "#0C0C0E"]} style={s.coverScrim} />
          <View style={[s.coverContent, { paddingTop: insets.top + spacing.xl }]}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{(user?.profile?.name || user?.email || "U")[0].toUpperCase()}</Text>
            </View>
            <Text style={s.name}>{user?.profile?.name}</Text>
            <Text style={s.email}>{user?.email}</Text>
            {user?.created_at && <Text style={s.member}>{t("profile.memberSince")} {shortDate(user.created_at)}</Text>}
          </View>
        </View>

        <View style={s.body}>
          <Text style={s.section}>{t("profile.account")}</Text>
          <Row testID="row-edit" icon={<UserGear color={colors.brandPrimary} size={22} weight="fill" />} label={t("profile.goals")} onPress={() => router.push("/profile/edit")} />
          <Row testID="row-equipment" icon={<Barbell color={colors.brandPrimary} size={22} weight="fill" />} label={t("profile.equipment")} onPress={() => router.push("/profile/equipment")} />

          <Text style={s.section}>{t("profile.preferences")}</Text>
          <Row testID="row-settings" icon={<GearSix color={colors.brandPrimary} size={22} weight="fill" />} label={t("profile.settings")} onPress={() => router.push("/profile/settings")} />
          <Row testID="row-language" icon={<Translate color={colors.brandPrimary} size={22} weight="fill" />} label={t("profile.language")} onPress={() => router.push("/profile/settings")} />

          {user?.is_admin && (
            <>
              <Text style={s.section}>{t("admin.title")}</Text>
              <Row testID="row-admin" icon={<ShieldStar color={colors.warning} size={22} weight="fill" />} label={t("profile.adminPanel")} onPress={() => router.push("/admin")} />
            </>
          )}

          <Pressable testID="logout-btn" onPress={logout} style={s.logout}>
            <SignOut color={colors.error} size={20} weight="bold" />
            <Text style={s.logoutText}>{t("profile.logout")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  cover: { height: 260 },
  coverImg: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, height: 260 },
  coverScrim: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, height: 260 },
  coverContent: { flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: spacing.lg },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm, borderWidth: 3, borderColor: c.surface },
  avatarText: { color: c.onBrandPrimary, fontSize: 32, fontWeight: "900" },
  name: { color: c.onSurface, fontSize: 24, fontWeight: "900" },
  email: { color: c.onSurfaceTertiary, fontSize: 14 },
  member: { color: c.muted, fontSize: 12, marginTop: 2 },
  body: { padding: spacing.lg },
  section: { color: c.muted, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.lg, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  iconBox: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  rowLabel: { color: c.onSurface, fontSize: 16, fontWeight: "700", flex: 1 },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.xl, paddingVertical: spacing.md },
  logoutText: { color: c.error, fontSize: 16, fontWeight: "800" },
}));
