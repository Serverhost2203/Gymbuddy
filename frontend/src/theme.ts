// Forge Fitness — dark premium "Charcoal & Voltage" palette.
// Single dark scheme (the app is dark-only by design). All color literals in
// components must come from here via makeStyles()/useTheme().

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  // Surfaces
  surface: "#0C0C0E",
  onSurface: "#FFFFFF",
  surfaceSecondary: "#16161A",
  onSurfaceSecondary: "#E0E0E0",
  surfaceTertiary: "#222226",
  onSurfaceTertiary: "#B0B0B0",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#0C0C0E",
  muted: "#8A8A93",

  // Brand — voltage ember
  brand: "#FF3D00",
  onBrand: "#FFFFFF",
  brandPrimary: "#FF3D00",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#CC3100",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "rgba(255, 61, 0, 0.12)",
  onBrandTertiary: "#FF3D00",

  // Status
  success: "#32D74B",
  onSuccess: "#000000",
  warning: "#FFD60A",
  onWarning: "#000000",
  error: "#FF453A",
  onError: "#FFFFFF",
  info: "#A3A3B5",
  onInfo: "#000000",

  // Lines
  border: "#2C2C35",
  borderStrong: "#444452",
  divider: "#1E1E24",

  // Macro accents
  macroProtein: "#FF3D00",
  macroCarbs: "#32D74B",
  macroFat: "#FFD60A",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;

// App is dark-only: expose the dark palette under both keys so useColorScheme
// can never fall back to an undefined light theme.
export const themes: { light: ThemeColors; dark: ThemeColors } = { light: dark, dark };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme);
}

setColorScheme?.("dark");

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.dark };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

// Shared layout tokens
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };
