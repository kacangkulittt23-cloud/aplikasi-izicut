import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Icon } from "@/src/components/icon";
import { makeStyles, useTheme } from "@/src/theme";

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export default function RekapScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ tahun?: string }>();

  const yearsQ = useQuery({ queryKey: ["years"], queryFn: () => api.years() });
  const [year, setYear] = useState<number | null>(params.tahun ? Number(params.tahun) : null);
  const activeYear = year ?? yearsQ.data?.[0] ?? null;
  const [satfung, setSatfung] = useState<string | null>(null);

  const satfungQ = useQuery({
    queryKey: ["satfung", activeYear],
    queryFn: () => api.satfung(activeYear ?? undefined),
    enabled: activeYear != null,
  });

  const recapQ = useQuery({
    queryKey: ["recap", activeYear, satfung],
    queryFn: () => api.recap(activeYear ?? undefined, satfung ?? undefined),
    enabled: activeYear != null,
  });

  const recap = recapQ.data;
  const maxMonth = Math.max(1, ...(recap?.monthly.map((m) => Math.max(m.izin, m.cuti)) ?? [1]));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="rekap-back" onPress={() => router.back()} hitSlop={10} style={styles.headerBtn}>
          <Icon name="ArrowLeft" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>REKAP SATFUNG</Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Year chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={styles.chipScroller}>
        {(yearsQ.data ?? []).map((y) => {
          const active = activeYear === y;
          return (
            <Pressable
              key={y}
              testID={`rekap-year-${y}`}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setYear(y); setSatfung(null); }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>Tahun {y}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Satfung filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={styles.chipScroller}>
        <Pressable testID="rekap-satfung-all" onPress={() => { Haptics.selectionAsync().catch(() => {}); setSatfung(null); }} style={[styles.chip, !satfung && styles.chipActive]}>
          <Text style={[styles.chipText, !satfung && styles.chipTextActive]}>Semua Satfung</Text>
        </Pressable>
        {(satfungQ.data ?? []).map((s) => {
          const active = satfung === s.satfung;
          return (
            <Pressable
              key={s.satfung}
              testID={`rekap-satfung-${s.satfung}`}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setSatfung(active ? null : s.satfung); }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.satfung}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {recapQ.isLoading || !recap ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          {/* Monthly chart */}
          <Text style={styles.blockTitle}>PER BULAN {satfung ? `• ${satfung}` : ""}</Text>
          <Text style={styles.blockSub}>Jumlah yang sedang izin & cuti tiap bulan</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.onInfo }]} /><Text style={styles.legendText}>Izin</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.brandPrimary }]} /><Text style={styles.legendText}>Cuti</Text></View>
          </View>
          <View style={styles.chartCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chart}>
                {recap.monthly.map((m) => (
                  <View key={m.bulan} style={styles.monthCol} testID={`month-${m.bulan}`}>
                    <View style={styles.barsRow}>
                      <View style={styles.barTrack}>
                        <View style={[styles.bar, { height: `${(m.izin / maxMonth) * 100}%`, backgroundColor: colors.onInfo }]} />
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.bar, { height: `${(m.cuti / maxMonth) * 100}%`, backgroundColor: colors.brandPrimary }]} />
                      </View>
                    </View>
                    <Text style={styles.monthTotal}>{m.izin + m.cuti}</Text>
                    <Text style={styles.monthLabel}>{BULAN[m.bulan - 1]}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Top personnel */}
          <Text style={styles.blockTitle}>PALING SERING IZIN & CUTI</Text>
          <Text style={styles.blockSub}>{satfung ? satfung : "Seluruh satfung"} • Tahun {activeYear}</Text>
          {recap.top.length === 0 ? (
            <View style={styles.emptyBox}><Text style={styles.emptyText}>Belum ada data</Text></View>
          ) : (
            recap.top.map((t, i) => (
              <Pressable
                key={t.personnel_id}
                testID={`top-${i}`}
                onPress={() => router.push(`/personnel/${t.personnel_id}`)}
                style={({ pressed }) => [styles.topRow, pressed && styles.pressed]}
              >
                <View style={[styles.rankBadge, i < 3 && styles.rankBadgeTop]}>
                  <Text style={[styles.rankText, i < 3 && styles.rankTextTop]}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.topName} numberOfLines={1}>{t.nama}</Text>
                  <Text style={styles.topMeta} numberOfLines={1}>{t.satfung}</Text>
                </View>
                <View style={styles.topStats}>
                  <Text style={[styles.topStat, { color: colors.onInfo }]}>{t.izin} izin</Text>
                  <Text style={[styles.topStat, { color: colors.brandPrimary }]}>{t.cuti} cuti</Text>
                </View>
                <View style={styles.totalPill}><Text style={styles.totalPillText}>{t.total}</Text></View>
              </Pressable>
            ))
          )}

          {/* Satfung ranking */}
          {!satfung ? (
            <>
              <Text style={styles.blockTitle}>RINGKASAN TIAP SATFUNG</Text>
              <Text style={styles.blockSub}>Diurutkan dari yang terbanyak pengajuan</Text>
              {recap.satfung.map((s, i) => (
                <Pressable
                  key={s.satfung}
                  testID={`recap-sf-${i}`}
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setSatfung(s.satfung); }}
                  style={({ pressed }) => [styles.sfCard, pressed && styles.pressed]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sfName} numberOfLines={1}>{s.satfung}</Text>
                    <Text style={styles.sfMeta}>{s.total_personil} personil • {s.izin} izin • {s.cuti} cuti</Text>
                  </View>
                  <View style={styles.sfCountBox}>
                    <Text style={styles.sfCount}>{s.total_pengajuan}</Text>
                    <Text style={styles.sfCountLabel}>pengajuan</Text>
                  </View>
                </Pressable>
              ))}
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7 },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontFamily: "Oswald", fontSize: 18, letterSpacing: 1.5 },

  chipScroller: { backgroundColor: colors.surface, flexGrow: 0 },
  chipRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: "row" },
  chip: {
    flexShrink: 0, height: 36, flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceTertiary, fontFamily: "DMSans", fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.onBrandTertiary },

  blockTitle: { color: colors.onSurface, fontFamily: "Oswald", fontSize: 18, letterSpacing: 1, marginTop: 22 },
  blockSub: { color: colors.muted, fontFamily: "DMSans", fontSize: 12, marginTop: 2, marginBottom: 12 },

  legendRow: { flexDirection: "row", gap: 16, marginBottom: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { color: colors.onSurfaceSecondary, fontFamily: "DMSans", fontSize: 12 },

  chartCard: {
    backgroundColor: colors.surfaceSecondary, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    padding: 14,
  },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 14, height: 180, paddingHorizontal: 4 },
  monthCol: { alignItems: "center", width: 34 },
  barsRow: { flexDirection: "row", gap: 3, alignItems: "flex-end", height: 130 },
  barTrack: { width: 10, height: "100%", justifyContent: "flex-end", backgroundColor: colors.surfaceTertiary, borderRadius: 4, overflow: "hidden" },
  bar: { width: "100%", borderRadius: 4, minHeight: 2 },
  monthTotal: { color: colors.onSurface, fontFamily: "Oswald", fontSize: 13, marginTop: 6 },
  monthLabel: { color: colors.muted, fontFamily: "DMSans", fontSize: 11, marginTop: 1 },

  emptyBox: { paddingVertical: 24, alignItems: "center" },
  emptyText: { color: colors.muted, fontFamily: "DMSans", fontSize: 14 },

  topRow: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surfaceSecondary,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 8,
  },
  rankBadge: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  rankBadgeTop: { backgroundColor: colors.brandPrimary },
  rankText: { color: colors.muted, fontFamily: "Oswald", fontSize: 14 },
  rankTextTop: { color: colors.onBrandPrimary },
  topName: { color: colors.onSurface, fontFamily: "DMSans", fontSize: 14, fontWeight: "700" },
  topMeta: { color: colors.muted, fontFamily: "DMSans", fontSize: 12, marginTop: 1 },
  topStats: { alignItems: "flex-end", gap: 2 },
  topStat: { fontFamily: "DMSans", fontSize: 11, fontWeight: "600" },
  totalPill: { minWidth: 30, height: 30, borderRadius: 15, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  totalPillText: { color: colors.brandPrimary, fontFamily: "Oswald", fontSize: 14 },

  sfCard: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceSecondary,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8,
  },
  sfName: { color: colors.onSurface, fontFamily: "DMSans", fontSize: 15, fontWeight: "700" },
  sfMeta: { color: colors.muted, fontFamily: "DMSans", fontSize: 12, marginTop: 2 },
  sfCountBox: { alignItems: "center" },
  sfCount: { color: colors.brandPrimary, fontFamily: "Oswald", fontSize: 22 },
  sfCountLabel: { color: colors.muted, fontFamily: "DMSans", fontSize: 10 },
}));
