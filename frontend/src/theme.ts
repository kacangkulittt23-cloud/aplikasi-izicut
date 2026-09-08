// E-IZICUT design tokens — Black & Gold (mewah & gagah). Dark is the primary,
// forced appearance per the design guidelines. Keys match the "color" block of
// /app/design_guidelines.json.

import { useMemo } from "react";
import { Appearance, StyleSheet } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  surface: "#050505",
  onSurface: "#E8E8E8",
  surfaceSecondary: "#141414",
  onSurfaceSecondary: "#D1D1D1",
  surfaceTertiary: "#1E1E1E",
  onSurfaceTertiary: "#A3A3A3",
  surfaceInverse: "#E8E8E8",
  onSurfaceInverse: "#050505",
  muted: "#8E8E8E",

  brand: "#D4AF37",
  onBrand: "#000000",
  brandPrimary: "#D4AF37",
  onBrandPrimary: "#000000",
  brandSecondary: "#B38F24",
  onBrandSecondary: "#000000",
  brandTertiary: "#3D3012",
  onBrandTertiary: "#F1E4BF",

  success: "#2E4F32",
  onSuccess: "#82C988",
  warning: "#5C4616",
  onWarning: "#E5B94E",
  error: "#5C2020",
  onError: "#E57A7A",
  info: "#1E3B4D",
  onInfo: "#71B7DE",

  border: "#2A2A2A",
  borderStrong: "#D4AF37",
  divider: "#1E1E1E",
};

const light = {
  surface: "#F8F9FA",
  onSurface: "#121212",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#2C2C2C",
  surfaceTertiary: "#F0F0F0",
  onSurfaceTertiary: "#4A4A4A",
  surfaceInverse: "#121212",
  onSurfaceInverse: "#FFFFFF",
  muted: "#757575",

  brand: "#C59B27",
  onBrand: "#FFFFFF",
  brandPrimary: "#C59B27",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#A68220",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#F4EBD4",
  onBrandTertiary: "#2C2C2C",

  success: "#E6F4EA",
  onSuccess: "#1E4620",
  warning: "#FEF7E0",
  onWarning: "#5C4000",
  error: "#FCE8E6",
  onError: "#A50E0E",
  info: "#E8F0FE",
  onInfo: "#174EA6",

  border: "#E0E0E0",
  borderStrong: "#C59B27",
  divider: "#F0F0F0",
};

export type ThemeColors = typeof dark;

// This app forces the luxe dark appearance.
export const defaultScheme: ColorScheme = "dark";

export const themes: { light: ThemeColors; dark: ThemeColors } = { light, dark };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme);
}

// Force dark chrome for native pickers/alerts too.
setColorScheme?.("dark");

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  return { scheme: "dark", colors: themes.dark };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

// Font family helpers — loaded in app/_layout.tsx.
export const fonts = {
  display: "Oswald",
  displayMedium: "Oswald",
  body: "DMSans",
};
