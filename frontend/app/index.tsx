import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Personnel } from "@/src/api/client";
import { Icon } from "@/src/components/icon";
import { metaFor } from "@/src/constants/leave";
import { useAuth } from "@/src/context/auth";
import { makeStyles, useTheme } from "@/src/theme";
import { formatDate, initials } from "@/src/utils/format";

const HERO =
  "https://images.unsplash.com/photo-1741356474357-72188f76e801?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHwxfHxibGFjayUyMGFuZCUyMGdvbGQlMjBkYXJrJTIwYWJzdHJhY3QlMjBsdXh1cnklMjB0ZXh0dXJlfGVufDB8fHx8MTc4ODg0MjQ0MXww&ixlib=rb-4.1.0&q=85";

const ABS = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

export default function Dashboard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAdmin } = useAuth();

  const [q, setQ] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [satfung, setSatfung] = useState<string | null>(null);

  const yearsQ = useQuery({ queryKey: ["years"], queryFn: () => api.years() });
  const activeYear = year ?? yearsQ.data?.[0] ?? null;

  const satfungQ = useQuery({
    queryKey: ["satfung", activeYear],
    queryFn: () => api.satfung(activeYear ?? undefined),
    enabled: activeYear != null,
  });

  const statsQ = useQuery({
    queryKey: ["stats", activeYear],
    queryFn: () => api.stats(activeYear ?? undefined),
    enabled: activeYear != null,
  });

  const browsing = q.trim().length > 0 || !!satfung;

  const personnelQ = useQuery({
    queryKey: ["personnel", activeYear, satfung, q.trim()],
    queryFn: () =>
      api.listPersonnel({
        tahun: activeYear ?? undefined,
        satfung: satfung ?? undefined,
        q: q.trim() || undefined,
      }),
    enabled: activeYear != null && browsing,
  });

  const openProfile = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push(`/personnel/${id}`);
  };

  const renderItem = ({ item }: { item: Personnel }) => (
    <Pressable
      testID={`personnel-row-${item.id}`}
      onPress={() => openProfile(item.id)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(item.nama)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName} numberOfLines={1}>{item.nama}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {item.pangkat}{item.nrp ? ` • ${item.nrp}` : ""}
        </Text>
        <Text style={styles.rowJab} numberOfLines={1}>{item.jabatan || item.satfung}</Text>
      </View>
      <View style={styles.rowRight}>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{item.leave_count ?? item.leaves?.length ?? 0}</Text>
        </View>
        <Icon name="CaretRight" size={18} color={colors.muted} />
      </View>
    </Pressable>
  );

  const Header = (
    <View>
      <View style={styles.hero}>
        <Image source={{ uri: HERO }} style={ABS} contentFit="cover" transition={300} />
        <LinearGradient
          colors={["rgba(5,5,5,0.35)", "rgba(5,5,5,0.75)", "#050505"]}
          locations={[0, 0.55, 1]}
          style={ABS}
        />
        <View style={[styles.heroContent, { paddingTop: insets.top + 12 }]}>
          <View style={styles.heroTop}>
            <View style={styles.badge}>
              <Icon name="ShieldStar" size={26} color={colors.brandPrimary} weight="fill" />
            </View>
            <Pressable
              testID="admin-entry-button"
              onPress={() => router.push(isAdmin ? "/admin" : "/admin/login")}
              style={({ pressed }) => [styles.adminBtn, pressed && styles.pressed]}
            >
              <Icon name={isAdmin ? "ShieldStar" : "Lock"} size={16} color={colors.brandPrimary} />
              <Text style={styles.adminBtnText}>Admin</Text>
            </Pressable>
          </View>
          <Text style={styles.brandTitle}>E-IZICUT</Text>
          <Text style={styles.brandSub}>Watpers Bag SDM • Polres Mimika</Text>

          <View style={styles.searchWrap} testID="search-bar">
            <Icon name="MagnifyingGlass" size={20} color={colors.brandPrimary} />
            <TextInput
              testID="search-input"
              value={q}
              onChangeText={setQ}
              placeholder="Cari nama atau NRP…"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {q.length > 0 ? (
              <Pressable testID="search-clear" onPress={() => setQ("")} hitSlop={10}>
                <Icon name="X" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        style={styles.chipScroller}
      >
        {(yearsQ.data ?? []).map((y) => {
          const active = activeYear === y;
          return (
            <Pressable
              key={y}
              testID={`year-chip-${y}`}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setYear(y);
                setSatfung(null);
              }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>Tahun {y}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        style={styles.chipScroller}
      >
        <Pressable
          testID="satfung-chip-all"
          onPress={() => { Haptics.selectionAsync().catch(() => {}); setSatfung(null); }}
          style={[styles.chip, !satfung && styles.chipActive]}
        >
          <Text style={[styles.chipText, !satfung && styles.chipTextActive]}>Semua Satfung</Text>
        </Pressable>
        {(satfungQ.data ?? []).map((s) => {
          const active = satfung === s.satfung;
          return (
            <Pressable
              key={s.satfung}
              testID={`satfung-chip-${s.satfung}`}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setSatfung(active ? null : s.satfung); }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.satfung}</Text>
              <View style={[styles.chipCount, active && styles.chipCountActive]}>
                <Text style={[styles.chipCountText, active && styles.chipCountTextActive]}>{s.count}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {!browsing ? (
        <DashboardBody stats={statsQ.data} loading={statsQ.isLoading} onOpen={openProfile} />
      ) : (
        <View style={styles.listHint}>
          <Text style={styles.listHintText}>
            {personnelQ.isFetching ? "Mencari…" : `${personnelQ.data?.length ?? 0} personil ditemukan`}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={browsing ? personnelQ.data ?? [] : []}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        ListHeaderComponent={Header}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        ListEmptyComponent={
          browsing ? (
            personnelQ.isLoading ? (
              <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View>
            ) : (
              <View style={styles.center}>
                <Icon name="MagnifyingGlass" size={40} color={colors.muted} />
                <Text style={styles.emptyText}>Tidak ada personil ditemukan</Text>
              </View>
            )
          ) : null
        }
      />
    </View>
  );
}

function DashboardBody({
  stats,
  loading,
  onOpen,
}: {
  stats?: import("@/src/api/client").Stats;
  loading: boolean;
  onOpen: (id: string) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (loading || !stats) {
    return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View>;
  }
  return (
    <View style={styles.dash}>
      <View style={styles.bentoRow}>
        <View style={[styles.bento, styles.bentoGold]} testID="stat-total-personil">
          <Icon name="Users" size={22} color={colors.onBrandPrimary} weight="fill" />
          <Text style={styles.bentoNumGold}>{stats.total_personil}</Text>
          <Text style={styles.bentoLabelGold}>Total Personil</Text>
        </View>
        <View style={styles.bentoCol}>
          <View style={styles.bentoSmall} testID="stat-satfung">
            <Text style={styles.bentoNum}>{stats.total_satfung}</Text>
            <Text style={styles.bentoLabel}>Satfung</Text>
          </View>
          <View style={styles.bentoSmall} testID="stat-pengajuan">
            <Text style={styles.bentoNum}>{stats.total_pengajuan}</Text>
            <Text style={styles.bentoLabel}>Total Izin & Cuti</Text>
          </View>
        </View>
      </View>

      <View style={styles.typeGrid}>
        {stats.per_type.map((t) => {
          const meta = metaFor(t.key);
          const accent = colors[meta.accent];
          return (
            <View key={t.key} style={styles.typeChip}>
              <Icon name={meta.icon} size={18} color={accent} weight="fill" />
              <Text style={styles.typeCount}>{t.count}</Text>
              <Text style={styles.typeLabel} numberOfLines={1}>{meta.short}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>AKTIVITAS TERBARU</Text>
      {stats.recent.length === 0 ? (
        <View style={styles.center}>
          <Icon name="ClipboardText" size={36} color={colors.muted} />
          <Text style={styles.emptyText}>Belum ada catatan izin/cuti</Text>
        </View>
      ) : (
        stats.recent.map((r, i) => {
          const meta = metaFor(r.jenis);
          const accent = colors[meta.accent];
          return (
            <Pressable
              key={`${r.personnel_id}-${i}`}
              testID={`recent-${i}`}
              onPress={() => onOpen(r.personnel_id)}
              style={({ pressed }) => [styles.recentCard, { borderLeftColor: accent }, pressed && styles.pressed]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.recentName} numberOfLines={1}>{r.nama}</Text>
                <Text style={styles.recentMeta} numberOfLines={1}>{meta.label} • {r.satfung}</Text>
              </View>
              <Text style={[styles.recentDate, { color: accent }]}>{formatDate(r.tanggal)}</Text>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 12 },
  emptyText: { color: colors.muted, fontFamily: "DMSans", fontSize: 14 },
  pressed: { opacity: 0.7 },

  hero: { height: 260, backgroundColor: colors.surface },
  heroContent: { flex: 1, paddingHorizontal: 20, paddingBottom: 16, justifyContent: "flex-end" },
  heroTop: { position: "absolute", top: 0, left: 20, right: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: {
    width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(212,175,55,0.12)", borderWidth: 1, borderColor: colors.brandPrimary,
  },
  adminBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1, borderColor: colors.brandPrimary, backgroundColor: "rgba(212,175,55,0.10)",
  },
  adminBtnText: { color: colors.brandPrimary, fontFamily: "DMSans", fontSize: 13, fontWeight: "600" },
  brandTitle: { color: colors.onSurface, fontFamily: "Oswald", fontSize: 40, letterSpacing: 2, marginBottom: 2 },
  brandSub: { color: colors.brandPrimary, fontFamily: "DMSans", fontSize: 13, letterSpacing: 0.5, marginBottom: 16 },

  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surfaceTertiary,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 52,
  },
  searchInput: { flex: 1, color: colors.onSurface, fontFamily: "DMSans", fontSize: 16, height: "100%" },

  chipScroller: { backgroundColor: colors.surface },
  chipRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: "row" },
  chip: {
    flexShrink: 0, height: 36, flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceTertiary, fontFamily: "DMSans", fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.onBrandTertiary },
  chipCount: { minWidth: 20, paddingHorizontal: 6, height: 18, borderRadius: 9, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  chipCountActive: { backgroundColor: colors.brandPrimary },
  chipCountText: { color: colors.muted, fontFamily: "DMSans", fontSize: 11, fontWeight: "700" },
  chipCountTextActive: { color: colors.onBrandPrimary },

  listHint: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  listHintText: { color: colors.muted, fontFamily: "DMSans", fontSize: 13 },

  dash: { paddingHorizontal: 16, paddingTop: 8 },
  bentoRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  bento: { flex: 1, borderRadius: 16, padding: 16, justifyContent: "space-between", minHeight: 132 },
  bentoGold: { backgroundColor: colors.brandPrimary },
  bentoNumGold: { color: colors.onBrandPrimary, fontFamily: "Oswald", fontSize: 40, marginTop: 8 },
  bentoLabelGold: { color: colors.onBrandPrimary, fontFamily: "DMSans", fontSize: 13, fontWeight: "600", opacity: 0.85 },
  bentoCol: { flex: 1, gap: 12 },
  bentoSmall: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, justifyContent: "center" },
  bentoNum: { color: colors.onSurface, fontFamily: "Oswald", fontSize: 26 },
  bentoLabel: { color: colors.muted, fontFamily: "DMSans", fontSize: 12 },

  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  typeChip: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
  },
  typeCount: { color: colors.onSurface, fontFamily: "Oswald", fontSize: 16 },
  typeLabel: { color: colors.muted, fontFamily: "DMSans", fontSize: 12 },

  sectionTitle: { color: colors.onSurface, fontFamily: "Oswald", fontSize: 20, letterSpacing: 1, marginBottom: 12 },
  recentCard: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceSecondary,
    borderRadius: 12, borderLeftWidth: 3, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  recentName: { color: colors.onSurface, fontFamily: "DMSans", fontSize: 15, fontWeight: "600" },
  recentMeta: { color: colors.muted, fontFamily: "DMSans", fontSize: 12, marginTop: 2 },
  recentDate: { fontFamily: "DMSans", fontSize: 13, fontWeight: "700" },

  row: {
    flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginBottom: 10,
    backgroundColor: colors.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.brandPrimary, fontFamily: "Oswald", fontSize: 17 },
  rowName: { color: colors.onSurface, fontFamily: "DMSans", fontSize: 15, fontWeight: "700" },
  rowSub: { color: colors.brandPrimary, fontFamily: "DMSans", fontSize: 12, marginTop: 1 },
  rowJab: { color: colors.muted, fontFamily: "DMSans", fontSize: 12, marginTop: 1 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  countPill: { minWidth: 26, height: 26, borderRadius: 13, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  countText: { color: colors.brandPrimary, fontFamily: "Oswald", fontSize: 14 },
}));
