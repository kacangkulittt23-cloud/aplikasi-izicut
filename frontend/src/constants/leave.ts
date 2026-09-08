import type { ThemeColors } from "@/src/theme";

export type LeaveKey =
  | "IZIN"
  | "EMERGENCY"
  | "CUTI_TAHUNAN"
  | "CUTI_BEROBAT"
  | "CUTI_IBADAH_UMROH"
  | "CUTI_IBADAH_HAJI"
  | "CUTI_IBADAH_LAINNYA";

export type LeaveMeta = {
  key: LeaveKey;
  label: string;
  short: string;
  icon: string; // phosphor icon name
  accent: keyof ThemeColors;
  group: "IZIN" | "CUTI";
};

export const LEAVE_META: Record<LeaveKey, LeaveMeta> = {
  IZIN: { key: "IZIN", label: "Izin", short: "Izin", icon: "CalendarCheck", accent: "onInfo", group: "IZIN" },
  EMERGENCY: { key: "EMERGENCY", label: "Izin Emergency", short: "Emergency", icon: "WarningCircle", accent: "onError", group: "IZIN" },
  CUTI_TAHUNAN: { key: "CUTI_TAHUNAN", label: "Cuti Tahunan", short: "Cuti", icon: "Umbrella", accent: "brandPrimary", group: "CUTI" },
  CUTI_BEROBAT: { key: "CUTI_BEROBAT", label: "Cuti Berobat", short: "Berobat", icon: "FirstAid", accent: "onSuccess", group: "CUTI" },
  CUTI_IBADAH_UMROH: { key: "CUTI_IBADAH_UMROH", label: "Cuti Ibadah Umroh", short: "Umroh", icon: "MoonStars", accent: "onWarning", group: "CUTI" },
  CUTI_IBADAH_HAJI: { key: "CUTI_IBADAH_HAJI", label: "Cuti Ibadah Haji", short: "Haji", icon: "Star", accent: "onWarning", group: "CUTI" },
  CUTI_IBADAH_LAINNYA: { key: "CUTI_IBADAH_LAINNYA", label: "Cuti Ibadah Lainnya", short: "Ibadah", icon: "HandsPraying", accent: "onSurfaceTertiary", group: "CUTI" },
};

export const LEAVE_ORDER: LeaveKey[] = [
  "IZIN",
  "EMERGENCY",
  "CUTI_TAHUNAN",
  "CUTI_BEROBAT",
  "CUTI_IBADAH_UMROH",
  "CUTI_IBADAH_HAJI",
  "CUTI_IBADAH_LAINNYA",
];

export function metaFor(key: string): LeaveMeta {
  return LEAVE_META[key as LeaveKey] ?? LEAVE_META.IZIN;
}
