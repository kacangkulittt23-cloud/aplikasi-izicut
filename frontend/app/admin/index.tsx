import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as Linking from "expo-linking";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, OnLeaveItem, Personnel } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { Icon } from "@/src/components/icon";
import { LEAVE_ORDER, metaFor } from "@/src/constants/leave";
import { useAuth } from "@/src/context/auth";
import { makeStyles, useTheme } from "@/src/theme";
import { formatDate, formatDateLong, initials } from "@/src/utils/format";

const HERO =
  "https://images.unsplash.com/photo-1741356474357-72188f76e801?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHwxfHxibGFjayUyMGFuZCUyMGdvbGQlMjBkYXJrJTIwYWJzdHJhY3QlMjBsdXh1cnklMjB0ZXh0dXJlfGVufDB8fHx8MTc4ODg0MjQ0MXww&ixlib=rb-4.1.0&q=85";

const ABS = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

export default function Dashboard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { ready, isAdmin, logout } = useAuth();

  const [q, setQ] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [satfung, setSatfung] = useState<string | null>(null);
  const [jenis, setJenis] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (ready && !isAdmin) router.replace("/admin/login");
  }, [ready, isAdmin, router]);

  const downloadTemplate = async () => {
    try {
      await Linking.openURL(api.templateUrl());
    } catch (e: any) {
      Alert.alert("Download gagal", e?.message || "Template belum dapat dibuka.");
    }
  };

  const uploadTemplate = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel.sheet.macroEnabled.12",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.length) return;
      const file = picked.assets[0];
      setImporting(true);
      const result = await api.importExcel(file.uri, file.name, file.mimeType, (file as any).file);
      Alert.alert(
        "Import berhasil",
        `Total data: ${result.total}\nDitambahkan: ${result.ditambahkan}\nDiperbarui: ${result.diperbarui}\nTahun: ${result.tahun.join(", ")}`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["years"] }),
        queryClient.invalidateQueries({ queryKey: ["personnel"] }),
        queryClient.invalidateQueries({ queryKey: ["stats"] }),
        queryClient.invalidateQueries({ queryKey: ["satfung"] }),
        queryClient.invalidateQueries({ queryKey: ["on-leave"] }),
      ]);
    } catch (e: any) {
      Alert.alert("Import gagal", e?.message || "File Excel tidak dapat diproses.");
    } finally {
      setImporting(false);
    }
  };

  const goToUserHome = () => router.replace("/");
  const exitAdmin = async () => {
    await logout();
    router.replace("/");
  };

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

  const browsing = q.trim().length > 0 || !!satfung || !!jenis;

  const personnelQ = useQuery({
    queryKey: ["personnel", activeYear, satfung, jenis, q.trim()],
    queryFn: () =>
      api.listPersonnel({
        tahun: activeYear ?? undefined,
        satfung: satfung ?? undefined,
        jenis: jenis ?? undefined,
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
      <View style={styles.adminTools}>
        <View style={styles.adminToolsTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.adminToolsTitle}>PANEL ADMIN</Text>
            <Text style={styles.adminToolsSubtitle}>Kelola data personil dan pembaruan tahunan</Text>
          </View>
          <Pressable testID="admin-home-button" onPress={goToUserHome} style={styles.adminNavButton}>
            <Icon name="ArrowLeft" size={16} color={colors.brandPrimary} />
            <Text style={styles.adminNavText}>Beranda</Text>
          </Pressable>
          <Pressable testID="admin-logout-button" onPress={exitAdmin} style={styles.adminNavButton}>
            <Icon name="SignOut" size={16} color={colors.onSurfaceSecondary} />
            <Text style={styles.adminNavText}>Keluar</Text>
          </Pressable>
        </View>
        <View style={styles.templateActions}>
          <Pressable testID="download-template-button" onPress={downloadTemplate} style={({ pressed }) => [styles.templateButton, styles.templateDownload, pressed && styles.pressed]}>
            <Icon name="DownloadSimple" size={19} color={colors.onBrandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.templateButtonTitle}>Download Template</Text>
              <Text style={styles.templateButtonSub}>Unduh format Excel resmi</Text>
            </View>
          </Pressable>
          <Pressable testID="upload-template-button" onPress={uploadTemplate} disabled={importing} style={({ pressed }) => [styles.templateButton, styles.templateUpload, pressed && styles.pressed, importing && { opacity: 0.6 }]}>
            {importing ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Icon name="UploadSimple" size={19} color={colors.onBrandPrimary} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.templateButtonTitle}>{importing ? "Mengimpor..." : "Upload Data Excel"}</Text>
              <Text style={styles.templateButtonSub}>Perbarui banyak personil sekaligus</Text>
            </View>
          </Pressable>
        </View>
      </View>
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
                setJenis(null);
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        style={styles.chipScroller}
      >
        <Pressable
          testID="jenis-chip-all"
          onPress={() => { Haptics.selectionAsync().catch(() => {}); setJenis(null); }}
          style={[styles.chip, !jenis && styles.chipActive]}
        >
          <Icon name="FunnelSimple" size={14} color={!jenis ? colors.onBrandTertiary : colors.muted} />
          <Text style={[styles.chipText, !jenis && styles.chipTextActive]}>Semua Jenis</Text>
        </Pressable>
        {LEAVE_ORDER.map((k) => {
          const meta = metaFor(k);
          const active = jenis === k;
          return (
            <Pressable
              key={k}
              testID={`jenis-chip-${k}`}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setJenis(active ? null : k); }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Icon name={meta.icon} size={14} color={active ? colors.brandPrimary : colors.muted} weight={active ? "fill" : "regular"} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{meta.short}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {!browsing ? (
        <DashboardBody
          stats={statsQ.data}
          loading={statsQ.isLoading}
          onOpen={openProfile}
          onRekap={() => router.push(`/rekap?tahun=${activeYear ?? ""}`)}
        />
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
  onRekap,
}: {
  stats?: import("@/src/api/client").Stats;
  loading: boolean;
  onOpen: (id: string) => void;
  onRekap: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (loading || !stats) {
    return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View>;
  }
  return (
    <View style={styles.dash}>
      <OnLeaveSection onOpen={onOpen} />

      <Pressable testID="rekap-button" onPress={onRekap} style={({ pressed }) => [styles.rekapBtn, pressed && styles.pressed]}>
        <View style={styles.rekapIcon}><Icon name="ChartBar" size={20} color={colors.brandPrimary} weight="fill" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rekapTitle}>Rekap Satfung</Text>
          <Text style={styles.rekapSub}>Ringkasan bulanan & satfung paling sering izin/cuti</Text>
        </View>
        <Icon name="CaretRight" size={18} color={colors.brandPrimary} />
      </Pressable>

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

const PREVIEW_COUNT = 5;

function OnLeaveSection({ onOpen }: { onOpen: (id: string) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const q = useQuery({
    queryKey: ["on-leave"],
    queryFn: () => api.onLeave(),
    refetchInterval: 5 * 60 * 1000,
  });
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});

  if (q.isLoading) {
    return <View style={styles.olLoading}><ActivityIndicator color={colors.brandPrimary} /></View>;
  }
  if (q.isError || !q.data) {
    return (
      <View style={styles.olEmpty}>
        <Text style={styles.olEmptyText}>Data izin/cuti hari ini belum bisa dimuat.</Text>
      </View>
    );
  }
  const d = q.data;

  const sisaText = (it: OnLeaveItem) => {
    if (it.sisa_hari == null) return "Kembali: belum diisi";
    if (it.sisa_hari === 1) return "Kembali besok";
    return `Sisa ${it.sisa_hari} hari`;
  };
  const akanText = (it: OnLeaveItem) =>
    it.berangkat_dalam === 1 ? "Berangkat besok" : `${it.berangkat_dalam} hari lagi`;

  const renderCard = (it: OnLeaveItem, badge: string, keyPrefix: string, key: string) => {
    const meta = metaFor(it.jenis);
    const accent = colors[meta.accent];
    return (
      <Pressable
        key={key}
        testID={`${keyPrefix}-${it.personnel_id}`}
        onPress={() => onOpen(it.personnel_id)}
        style={({ pressed }) => [styles.olCard, { borderLeftColor: accent }, pressed && styles.pressed]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.olName} numberOfLines={1}>{it.pangkat ? `${it.pangkat} ` : ""}{it.nama}</Text>
          <Text style={styles.olMeta} numberOfLines={1}>{it.label} • {it.satfung}</Text>
          <Text style={styles.olDates}>
            Berangkat {formatDate(it.tanggal)}
            {it.tanggal_kembali ? `  •  Kembali ${formatDate(it.tanggal_kembali)}` : ""}
          </Text>
          {it.alasan ? <Text style={styles.olReason} numberOfLines={1}>{it.alasan}</Text> : null}
        </View>
        <View style={[styles.olBadge, { borderColor: accent }]}>
          <Text style={[styles.olBadgeText, { color: accent }]}>{badge}</Text>
        </View>
      </Pressable>
    );
  };

  const renderGroup = (
    id: string, title: string, items: OnLeaveItem[], badge: (it: OnLeaveItem) => string,
  ) => {
    if (items.length === 0) return null;
    const open = !!showAll[id];
    const shown = open ? items : items.slice(0, PREVIEW_COUNT);
    return (
      <View key={id} style={{ marginBottom: 8 }}>
        <View style={styles.olHead}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <View style={styles.olCount}><Text style={styles.olCountText}>{items.length}</Text></View>
        </View>
        {shown.map((it, i) => renderCard(it, badge(it), id, `${id}-${it.personnel_id}-${it.tanggal}-${i}`))}
        {items.length > PREVIEW_COUNT ? (
          <Pressable testID={`${id}-toggle`} onPress={() => setShowAll({ ...showAll, [id]: !open })} style={styles.olMore}>
            <Text style={styles.olMoreText}>{open ? "Tampilkan lebih sedikit" : `Tampilkan semua (${items.length})`}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const none = d.sedang.length === 0 && d.kembali_hari_ini.length === 0 && d.akan.length === 0;

  return (
    <View testID="on-leave-section" style={{ marginBottom: 12 }}>
      <Text style={styles.olToday}>Hari ini • {formatDateLong(d.today)}</Text>
      {none ? (
        <View style={styles.olEmpty}>
          <Icon name="CheckCircle" size={28} color={colors.brandPrimary} />
          <Text style={styles.olEmptyText}>Tidak ada personil yang sedang izin/cuti atau akan berangkat dalam {d.akan_hari} hari ke depan.</Text>
        </View>
      ) : null}
      {renderGroup("sedang", "SEDANG IZIN / CUTI", d.sedang, sisaText)}
      {renderGroup("kembali", "KEMBALI HARI INI", d.kembali_hari_ini, () => "Kembali hari ini")}
      {renderGroup("akan", `AKAN BERANGKAT (${d.akan_hari} HARI)`, d.akan, akanText)}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  adminTools: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, backgroundColor: colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: colors.border },
  adminToolsTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  adminToolsTitle: { color: colors.onSurface, fontFamily: "Oswald", fontSize: 20, letterSpacing: 1 },
  adminToolsSubtitle: { color: colors.muted, fontFamily: "DMSans", fontSize: 11, marginTop: 2 },
  adminNavButton: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 9, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  adminNavText: { color: colors.onSurface, fontFamily: "DMSans", fontSize: 11, fontWeight: "600" },
  templateActions: { flexDirection: "row", gap: 10 },
  templateButton: { flex: 1, minHeight: 66, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 11 },
  templateDownload: { backgroundColor: colors.brandPrimary },
  templateUpload: { backgroundColor: colors.onInfo },
  templateButtonTitle: { color: colors.onBrandPrimary, fontFamily: "DMSans", fontSize: 12, fontWeight: "700" },
  templateButtonSub: { color: colors.onBrandPrimary, fontFamily: "DMSans", fontSize: 10, marginTop: 3, opacity: 0.9 },
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
  rekapBtn: {
    flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16,
    backgroundColor: "rgba(212,175,55,0.06)", borderRadius: 14, borderWidth: 1, borderColor: colors.brandPrimary, padding: 14,
  },
  rekapIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brandPrimary },
  rekapTitle: { color: colors.onSurface, fontFamily: "Oswald", fontSize: 18, letterSpacing: 0.5 },
  rekapSub: { color: colors.muted, fontFamily: "DMSans", fontSize: 12, marginTop: 1 },
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

  olToday: { color: colors.muted, fontFamily: "DMSans", fontSize: 13, marginBottom: 10 },
  olLoading: { paddingVertical: 24, alignItems: "center" },
  olEmpty: {
    alignItems: "center", gap: 8, padding: 18, marginBottom: 12, borderRadius: 14,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  olEmptyText: { color: colors.muted, fontFamily: "DMSans", fontSize: 13, textAlign: "center" },
  olHead: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  olCount: { backgroundColor: colors.brandPrimary, borderRadius: 12, minWidth: 26, height: 26, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  olCountText: { color: colors.onBrandPrimary, fontFamily: "DMSans", fontSize: 13, fontWeight: "700" },
  olCard: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceSecondary,
    borderRadius: 12, borderLeftWidth: 4, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  olName: { color: colors.onSurface, fontFamily: "DMSans", fontSize: 15, fontWeight: "700" },
  olMeta: { color: colors.muted, fontFamily: "DMSans", fontSize: 12, marginTop: 2 },
  olDates: { color: colors.onSurface, fontFamily: "DMSans", fontSize: 13, marginTop: 6 },
  olReason: { color: colors.muted, fontFamily: "DMSans", fontSize: 12, marginTop: 2, fontStyle: "italic" },
  olBadge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 110 },
  olBadgeText: { fontFamily: "DMSans", fontSize: 12, fontWeight: "700", textAlign: "center" },
  olMore: { alignSelf: "center", paddingVertical: 8, paddingHorizontal: 12 },
  olMoreText: { color: colors.brandPrimary, fontFamily: "DMSans", fontSize: 13, fontWeight: "600" },

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
