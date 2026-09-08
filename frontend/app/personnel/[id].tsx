import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, LeaveEntry, Personnel } from "@/src/api/client";
import { Icon } from "@/src/components/icon";
import { Sheet } from "@/src/components/sheet";
import { useToast } from "@/src/components/toast";
import { LEAVE_ORDER, LeaveKey, metaFor } from "@/src/constants/leave";
import { useAuth } from "@/src/context/auth";
import { makeStyles, useTheme } from "@/src/theme";
import { dmyToIso, formatDateLong, initials, isoToDmy } from "@/src/utils/format";

export default function Profile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["personnel-detail", id],
    queryFn: () => api.getPersonnel(id!),
    enabled: !!id,
  });

  const [leaveSheet, setLeaveSheet] = useState<{ open: boolean; edit?: LeaveEntry; jenis?: LeaveKey }>({ open: false });
  const [personSheet, setPersonSheet] = useState(false);
  const [confirm, setConfirm] = useState<{ open: boolean; leave?: LeaveEntry }>({ open: false });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["personnel-detail", id] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    qc.invalidateQueries({ queryKey: ["personnel"] });
  };

  const grouped = useMemo(() => {
    const map: Record<string, LeaveEntry[]> = {};
    (data?.leaves ?? []).forEach((lv) => {
      (map[lv.jenis] ??= []).push(lv);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || "")));
    return map;
  }, [data]);

  const deleteLeaveMut = useMutation({
    mutationFn: (lid: string) => api.deleteLeave(id!, lid),
    onSuccess: () => {
      invalidate();
      setConfirm({ open: false });
      toast("Entri dihapus", "success");
    },
    onError: (e: any) => toast(e.message, "error"),
  });

  if (isLoading || !data) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  const sectionsToShow: LeaveKey[] = isAdmin
    ? LEAVE_ORDER
    : LEAVE_ORDER.filter((k) => (grouped[k]?.length ?? 0) > 0);

  return (
    <View style={styles.container}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={10} style={styles.headerBtn}>
          <Icon name="ArrowLeft" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>PROFIL PERSONIL</Text>
        {isAdmin ? (
          <Pressable testID="edit-person-button" onPress={() => setPersonSheet(true)} hitSlop={10} style={styles.headerBtn}>
            <Icon name="PencilSimple" size={20} color={colors.brandPrimary} />
          </Pressable>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {/* Identity */}
        <View style={styles.identity}>
          <View style={styles.bigAvatar}>
            <Text style={styles.bigAvatarText}>{initials(data.nama)}</Text>
          </View>
          <Text style={styles.name} testID="profile-name">{data.nama}</Text>
          <View style={styles.pangkatPill}>
            <Text style={styles.pangkatText}>{data.pangkat || "—"}</Text>
          </View>

          <View style={styles.infoCard}>
            <InfoRow icon="IdentificationCard" label="NRP / NIP" value={data.nrp || "—"} />
            <View style={styles.infoDivider} />
            <InfoRow icon="Briefcase" label="Jabatan" value={data.jabatan || "—"} />
            <View style={styles.infoDivider} />
            <InfoRow icon="Users" label="Satfung" value={data.satfung} />
            <View style={styles.infoDivider} />
            <InfoRow icon="ClipboardText" label="Tahun Data" value={String(data.tahun)} />
          </View>
        </View>

        {/* Leave sections */}
        {sectionsToShow.map((key) => {
          const meta = metaFor(key);
          const accent = colors[meta.accent];
          const items = grouped[key] ?? [];
          if (!isAdmin && items.length === 0) return null;
          return (
            <View key={key} style={styles.section}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionTitleWrap}>
                  <Icon name={meta.icon} size={18} color={accent} weight="fill" />
                  <Text style={styles.sectionTitle}>{meta.label}</Text>
                  <View style={styles.sectionCount}><Text style={styles.sectionCountText}>{items.length}</Text></View>
                </View>
                {isAdmin ? (
                  <Pressable
                    testID={`add-leave-${key}`}
                    onPress={() => setLeaveSheet({ open: true, jenis: key })}
                    hitSlop={8}
                    style={styles.addBtn}
                  >
                    <Icon name="Plus" size={16} color={colors.brandPrimary} />
                  </Pressable>
                ) : null}
              </View>

              {items.length === 0 ? (
                <Text style={styles.noneText}>Belum ada catatan</Text>
              ) : (
                items.map((lv) => (
                  <View key={lv.id} style={[styles.leaveCard, { borderLeftColor: accent }]} testID={`leave-${lv.id}`}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.leaveDate}>{formatDateLong(lv.tanggal)}</Text>
                      {lv.alasan ? <Text style={styles.leaveReason}>{lv.alasan}</Text> : <Text style={styles.leaveReasonMuted}>Tanpa keterangan</Text>}
                    </View>
                    {isAdmin ? (
                      <View style={styles.leaveActions}>
                        <Pressable testID={`edit-leave-${lv.id}`} onPress={() => setLeaveSheet({ open: true, edit: lv, jenis: key })} hitSlop={8}>
                          <Icon name="PencilSimple" size={18} color={colors.muted} />
                        </Pressable>
                        <Pressable testID={`del-leave-${lv.id}`} onPress={() => setConfirm({ open: true, leave: lv })} hitSlop={8}>
                          <Icon name="Trash" size={18} color={colors.onError} />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          );
        })}

        {!isAdmin && sectionsToShow.length === 0 ? (
          <View style={styles.center}>
            <Icon name="ClipboardText" size={40} color={colors.muted} />
            <Text style={styles.noneText}>Belum ada riwayat izin / cuti</Text>
          </View>
        ) : null}
      </ScrollView>

      {isAdmin ? (
        <View style={[styles.fabWrap, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            testID="add-leave-fab"
            onPress={() => setLeaveSheet({ open: true, jenis: "IZIN" })}
            style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
          >
            <Icon name="Plus" size={20} color={colors.onBrandPrimary} weight="bold" />
            <Text style={styles.fabText}>Tambah Izin / Cuti</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Leave form */}
      {leaveSheet.open ? (
        <LeaveForm
          person={data}
          edit={leaveSheet.edit}
          initialJenis={leaveSheet.jenis ?? "IZIN"}
          onClose={() => setLeaveSheet({ open: false })}
          onSaved={() => { invalidate(); setLeaveSheet({ open: false }); toast("Data tersimpan", "success"); }}
        />
      ) : null}

      {/* Person form */}
      {personSheet ? (
        <PersonForm
          person={data}
          onClose={() => setPersonSheet(false)}
          onSaved={() => { invalidate(); setPersonSheet(false); toast("Data personil diperbarui", "success"); }}
        />
      ) : null}

      {/* Confirm delete */}
      <Sheet visible={confirm.open} onClose={() => setConfirm({ open: false })} title="Hapus Entri" testID="confirm-sheet">
        <Text style={styles.confirmText}>Hapus catatan {formatDateLong(confirm.leave?.tanggal)} ? Tindakan ini tidak bisa dibatalkan.</Text>
        <Pressable
          testID="confirm-delete"
          onPress={() => confirm.leave && deleteLeaveMut.mutate(confirm.leave.id)}
          style={[styles.dangerBtn]}
        >
          {deleteLeaveMut.isPending ? <ActivityIndicator color={colors.onError} /> : <Text style={styles.dangerBtnText}>Ya, Hapus</Text>}
        </Pressable>
      </Sheet>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.infoRow}>
      <Icon name={icon} size={18} color={colors.brandPrimary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function LeaveForm({
  person,
  edit,
  initialJenis,
  onClose,
  onSaved,
}: {
  person: Personnel;
  edit?: LeaveEntry;
  initialJenis: LeaveKey;
  onClose: () => void;
  onSaved: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [jenis, setJenis] = useState<LeaveKey>((edit?.jenis as LeaveKey) ?? initialJenis);
  const [tanggal, setTanggal] = useState(edit ? isoToDmy(edit.tanggal) : "");
  const [alasan, setAlasan] = useState(edit?.alasan ?? "");

  const mut = useMutation({
    mutationFn: async () => {
      const iso = dmyToIso(tanggal);
      if (!iso) throw new Error("Format tanggal harus DD-MM-YYYY");
      if (edit) {
        return api.updateLeave(person.id, edit.id, { jenis, tanggal: iso, alasan });
      }
      return api.addLeave(person.id, { jenis, tanggal: iso, alasan });
    },
    onSuccess: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); onSaved(); },
    onError: (e: any) => toast(e.message, "error"),
  });

  return (
    <Sheet visible onClose={onClose} title={edit ? "Edit Catatan" : "Tambah Izin / Cuti"} testID="leave-form">
      <Text style={styles.fieldLabel}>Jenis</Text>
      <View style={styles.jenisWrap}>
        {LEAVE_ORDER.map((k) => {
          const meta = metaFor(k);
          const active = jenis === k;
          return (
            <Pressable
              key={k}
              testID={`jenis-${k}`}
              onPress={() => setJenis(k)}
              style={[styles.jenisChip, active && { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary }]}
            >
              <Icon name={meta.icon} size={15} color={active ? colors.brandPrimary : colors.muted} weight={active ? "fill" : "regular"} />
              <Text style={[styles.jenisText, active && { color: colors.onBrandTertiary }]}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.fieldLabel}>Tanggal (DD-MM-YYYY)</Text>
      <TextInput
        testID="leave-date-input"
        value={tanggal}
        onChangeText={setTanggal}
        placeholder="cth: 15-06-2026"
        placeholderTextColor={colors.muted}
        keyboardType="numbers-and-punctuation"
        style={styles.input}
      />
      <Pressable
        onPress={() => {
          const d = new Date();
          setTanggal(`${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`);
        }}
        style={styles.todayBtn}
      >
        <Text style={styles.todayText}>Isi tanggal hari ini</Text>
      </Pressable>

      <Text style={styles.fieldLabel}>Alasan / Keterangan</Text>
      <TextInput
        testID="leave-reason-input"
        value={alasan}
        onChangeText={setAlasan}
        placeholder="cth: Acara keluarga, sakit, dinas luar…"
        placeholderTextColor={colors.muted}
        multiline
        style={[styles.input, styles.textarea]}
      />

      <Pressable testID="save-leave-button" onPress={() => mut.mutate()} style={styles.primaryBtn} disabled={mut.isPending}>
        {mut.isPending ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryBtnText}>Simpan</Text>}
      </Pressable>
    </Sheet>
  );
}

function PersonForm({ person, onClose, onSaved }: { person: Personnel; onClose: () => void; onSaved: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [nama, setNama] = useState(person.nama);
  const [pangkat, setPangkat] = useState(person.pangkat);
  const [nrp, setNrp] = useState(person.nrp);
  const [jabatan, setJabatan] = useState(person.jabatan);
  const [satfung, setSatfung] = useState(person.satfung);

  const mut = useMutation({
    mutationFn: () => api.updatePersonnel(person.id, { nama, pangkat, nrp, jabatan, satfung }),
    onSuccess: onSaved,
    onError: (e: any) => toast(e.message, "error"),
  });

  return (
    <Sheet visible onClose={onClose} title="Edit Data Personil" testID="person-form">
      <Field label="Nama" value={nama} onChange={setNama} testID="person-nama" />
      <Field label="Pangkat" value={pangkat} onChange={setPangkat} testID="person-pangkat" />
      <Field label="NRP / NIP" value={nrp} onChange={setNrp} testID="person-nrp" keyboard="numbers-and-punctuation" />
      <Field label="Jabatan" value={jabatan} onChange={setJabatan} testID="person-jabatan" />
      <Field label="Satfung" value={satfung} onChange={setSatfung} testID="person-satfung" />
      <Pressable testID="save-person-button" onPress={() => mut.mutate()} style={styles.primaryBtn} disabled={mut.isPending}>
        {mut.isPending ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryBtnText}>Simpan Perubahan</Text>}
      </Pressable>
    </Sheet>
  );
}

function Field({
  label, value, onChange, testID, keyboard,
}: { label: string; value: string; onChange: (s: string) => void; testID?: string; keyboard?: any }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholderTextColor={colors.muted}
        keyboardType={keyboard}
        style={styles.input}
      />
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center", flexGrow: 1, gap: 12, paddingVertical: 40 },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingBottom: 12, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontFamily: "Oswald", fontSize: 18, letterSpacing: 1.5 },

  identity: { alignItems: "center", paddingHorizontal: 20, paddingTop: 20 },
  bigAvatar: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brandTertiary,
    borderWidth: 2, borderColor: colors.brandPrimary, alignItems: "center", justifyContent: "center",
  },
  bigAvatarText: { color: colors.brandPrimary, fontFamily: "Oswald", fontSize: 36 },
  name: { color: colors.onSurface, fontFamily: "Oswald", fontSize: 26, textAlign: "center", marginTop: 14, letterSpacing: 0.5 },
  pangkatPill: {
    marginTop: 8, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999,
    backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brandPrimary,
  },
  pangkatText: { color: colors.onBrandTertiary, fontFamily: "DMSans", fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },

  infoCard: {
    alignSelf: "stretch", marginTop: 20, backgroundColor: colors.surfaceSecondary,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  infoLabel: { color: colors.muted, fontFamily: "DMSans", fontSize: 13, width: 92 },
  infoValue: { color: colors.onSurface, fontFamily: "DMSans", fontSize: 14, fontWeight: "600", flex: 1, textAlign: "right" },
  infoDivider: { height: 1, backgroundColor: colors.divider },

  section: { marginTop: 22, paddingHorizontal: 16 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { color: colors.onSurface, fontFamily: "Oswald", fontSize: 17, letterSpacing: 0.5 },
  sectionCount: { minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  sectionCountText: { color: colors.brandPrimary, fontFamily: "Oswald", fontSize: 12 },
  addBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(212,175,55,0.10)" },

  noneText: { color: colors.muted, fontFamily: "DMSans", fontSize: 13, fontStyle: "italic" },
  leaveCard: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surfaceSecondary,
    borderRadius: 10, borderLeftWidth: 3, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8,
  },
  leaveDate: { color: colors.onSurface, fontFamily: "DMSans", fontSize: 15, fontWeight: "700" },
  leaveReason: { color: colors.onSurfaceSecondary, fontFamily: "DMSans", fontSize: 13, marginTop: 2 },
  leaveReasonMuted: { color: colors.muted, fontFamily: "DMSans", fontSize: 13, marginTop: 2, fontStyle: "italic" },
  leaveActions: { flexDirection: "row", gap: 16, alignItems: "center" },

  fabWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, backgroundColor: "transparent" },
  fab: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.brandPrimary, height: 54, borderRadius: 14,
  },
  fabText: { color: colors.onBrandPrimary, fontFamily: "DMSans", fontSize: 16, fontWeight: "700" },

  // form
  fieldLabel: { color: colors.onSurfaceSecondary, fontFamily: "DMSans", fontSize: 13, fontWeight: "600", marginBottom: 8, marginTop: 6 },
  input: {
    backgroundColor: colors.surfaceTertiary, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    color: colors.onSurface, fontFamily: "DMSans", fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
  },
  textarea: { minHeight: 84, textAlignVertical: "top" },
  jenisWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  jenisChip: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border,
  },
  jenisText: { color: colors.onSurfaceTertiary, fontFamily: "DMSans", fontSize: 12, fontWeight: "600" },
  todayBtn: { alignSelf: "flex-start", marginBottom: 6 },
  todayText: { color: colors.brandPrimary, fontFamily: "DMSans", fontSize: 13, textDecorationLine: "underline" },
  primaryBtn: { backgroundColor: colors.brandPrimary, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 12 },
  primaryBtnText: { color: colors.onBrandPrimary, fontFamily: "DMSans", fontSize: 16, fontWeight: "700" },
  confirmText: { color: colors.onSurfaceSecondary, fontFamily: "DMSans", fontSize: 15, lineHeight: 22, marginBottom: 20 },
  dangerBtn: { backgroundColor: colors.error, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  dangerBtnText: { color: colors.onError, fontFamily: "DMSans", fontSize: 16, fontWeight: "700" },
}));
