import React from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
  StyleProp,
  ViewStyle,
  TextStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CaretLeft } from "phosphor-react-native";

import { makeStyles, useTheme, spacing, radius } from "@/src/theme";

function haptic() {
  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

// ------------------------------- Button -------------------------------
export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  testID,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useButtonStyles();
  const { colors } = useTheme();
  const bg =
    variant === "primary"
      ? s.primary
      : variant === "secondary"
      ? s.secondary
      : variant === "danger"
      ? s.danger
      : s.ghost;
  const txt =
    variant === "primary"
      ? { color: colors.onBrandPrimary }
      : variant === "danger"
      ? { color: colors.onError }
      : variant === "secondary"
      ? { color: colors.onSurfaceSecondary }
      : { color: colors.onBrandTertiary };

  return (
    <Pressable
      testID={testID}
      onPress={() => {
        if (disabled || loading) return;
        haptic();
        onPress();
      }}
      style={({ pressed }) => [s.base, bg, (disabled || loading) && s.disabled, pressed && s.pressed, style]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "danger" ? colors.onBrandPrimary : colors.brandPrimary} />
      ) : (
        <View style={s.row}>
          {icon}
          <Text style={[s.label, txt]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const useButtonStyles = makeStyles((c) => ({
  base: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  primary: { backgroundColor: c.brandPrimary },
  secondary: { backgroundColor: c.surfaceTertiary },
  danger: { backgroundColor: c.error },
  ghost: { backgroundColor: c.brandTertiary },
  label: { fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
}));

// ------------------------------- Card -------------------------------
export function Card({
  children,
  style,
  onPress,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
}) {
  const s = useCardStyles();
  if (onPress) {
    return (
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[s.card, style]}>
      {children}
    </View>
  );
}

const useCardStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
  },
}));

// ------------------------------- Input -------------------------------
export function Input({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  label,
  testID,
  autoCapitalize,
  style,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: any;
  secureTextEntry?: boolean;
  label?: string;
  testID?: string;
  autoCapitalize?: any;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useInputStyles();
  const { colors } = useTheme();
  return (
    <View style={style}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        style={s.input}
      />
    </View>
  );
}

const useInputStyles = makeStyles((c) => ({
  label: { color: c.onSurfaceTertiary, fontSize: 13, marginBottom: spacing.xs, fontWeight: "600" },
  input: {
    backgroundColor: c.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 52,
    color: c.onSurface,
    fontSize: 16,
    borderWidth: 1,
    borderColor: c.border,
  },
}));

// ------------------------------- SectionTitle -------------------------------
export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const s = useSectionStyles();
  return (
    <View style={s.row}>
      <Text style={s.title}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction}>
          <Text style={s.action}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useSectionStyles = makeStyles((c) => ({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  title: { color: c.onSurface, fontSize: 20, fontWeight: "800", letterSpacing: 0.3 },
  action: { color: c.brandPrimary, fontSize: 14, fontWeight: "700" },
}));

// ------------------------------- Chip row -------------------------------
export function ChipRow({
  items,
  selected,
  onSelect,
  testIDPrefix,
}: {
  items: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
  testIDPrefix?: string;
}) {
  const s = useChipStyles();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.container}
      style={s.scroll}
    >
      {items.map((it) => {
        const active = it.key === selected;
        return (
          <Pressable
            key={it.key}
            testID={testIDPrefix ? `${testIDPrefix}-${it.key}` : undefined}
            onPress={() => onSelect(it.key)}
            style={[s.chip, active ? s.chipActive : s.chipInactive]}
          >
            <Text style={[s.chipText, active ? s.chipTextActive : s.chipTextInactive]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useChipStyles = makeStyles((c) => ({
  scroll: { flexGrow: 0 },
  container: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  chip: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    flexShrink: 0,
  },
  chipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  chipInactive: { backgroundColor: c.surfaceSecondary, borderColor: c.border },
  chipText: { fontSize: 14, fontWeight: "700" },
  chipTextActive: { color: c.onBrandPrimary },
  chipTextInactive: { color: c.onSurfaceTertiary },
}));

// ------------------------------- EmptyState -------------------------------
export function EmptyState({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: React.ReactNode }) {
  const s = useEmptyStyles();
  return (
    <View style={s.wrap}>
      {icon}
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const useEmptyStyles = makeStyles((c) => ({
  wrap: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxl, gap: spacing.sm },
  title: { color: c.onSurface, fontSize: 17, fontWeight: "700", textAlign: "center" },
  subtitle: { color: c.muted, fontSize: 14, textAlign: "center", paddingHorizontal: spacing.xl },
}));

// ------------------------------- Loading -------------------------------
export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
      <ActivityIndicator color={colors.brandPrimary} size="large" />
    </View>
  );
}

// ------------------------------- Header -------------------------------
export function Header({ title, right, onBack }: { title: string; right?: React.ReactNode; onBack?: () => void }) {
  const s = useHeaderStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.wrap, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable testID="header-back" onPress={onBack} hitSlop={12} style={s.backBtn}>
        <CaretLeft color={colors.onSurface} size={24} weight="bold" />
      </Pressable>
      <Text style={s.title} numberOfLines={1}>{title}</Text>
      <View style={s.right}>{right}</View>
    </View>
  );
}

const useHeaderStyles = makeStyles((c) => ({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
    gap: spacing.sm,
  },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, color: c.onSurface, fontSize: 20, fontWeight: "800" },
  right: { minWidth: 32, alignItems: "flex-end" },
}));

// ------------------------------- Metric text -------------------------------
export function Metric({ value, unit, style }: { value: string | number; unit?: string; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return (
    <Text style={[{ color: colors.onSurface, fontSize: 30, fontWeight: "900", letterSpacing: -0.5 }, style]}>
      {value}
      {unit ? <Text style={{ fontSize: 15, fontWeight: "700", color: colors.muted }}> {unit}</Text> : null}
    </Text>
  );
}
