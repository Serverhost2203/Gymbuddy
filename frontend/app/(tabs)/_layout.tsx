import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { House, Barbell, ForkKnife, ChartLineUp, User } from "phosphor-react-native";

import { useTheme } from "@/src/theme";

const isIOS26 = Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (isIOS26) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NativeTabs, Icon, Label } = require("expo-router/unstable-native-tabs");
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <Icon sf="house.fill" />
          <Label>{t("tabs.dashboard")}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="workout">
          <Icon sf="dumbbell.fill" />
          <Label>{t("tabs.workout")}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="nutrition">
          <Icon sf="fork.knife" />
          <Label>{t("tabs.nutrition")}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="progress">
          <Icon sf="chart.line.uptrend.xyaxis" />
          <Label>{t("tabs.progress")}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <Icon sf="person.fill" />
          <Label>{t("tabs.profile")}</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.dashboard"), tabBarIcon: ({ color, size }) => <House color={color} size={size} weight="fill" /> }} />
      <Tabs.Screen name="workout" options={{ title: t("tabs.workout"), tabBarIcon: ({ color, size }) => <Barbell color={color} size={size} weight="fill" /> }} />
      <Tabs.Screen name="nutrition" options={{ title: t("tabs.nutrition"), tabBarIcon: ({ color, size }) => <ForkKnife color={color} size={size} weight="fill" /> }} />
      <Tabs.Screen name="progress" options={{ title: t("tabs.progress"), tabBarIcon: ({ color, size }) => <ChartLineUp color={color} size={size} weight="fill" /> }} />
      <Tabs.Screen name="profile" options={{ title: t("tabs.profile"), tabBarIcon: ({ color, size }) => <User color={color} size={size} weight="fill" /> }} />
    </Tabs>
  );
}
