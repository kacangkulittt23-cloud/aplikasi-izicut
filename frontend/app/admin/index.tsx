import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Icon } from "@/src/components/icon";
import { Sheet } from "@/src/components/sheet";
import { DatePickerField } from "@/src/components/date-picker";
import { LEAVE_ORDER, metaFor } from "@/src/constants/leave";
import { useToast } from "@/src/components/toast";
import { useAuth } from "@/src/context/auth";
import { makeStyles, useTheme } from "@/src/theme";

export default function AdminHome() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAdmin, ready, username, logout } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (ready && !isAdmin) router.replace("/admin/login");
  }, [ready, isAdmin, router]);

  const yearsQ = useQuery({ queryKey: ["years"], queryFn: () => api.years() });
  const statsQ = useQuery({
    queryKey: ["stats", "all-admin"],
    queryFn: () => api.stats(),
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["years"] });
    qc.invalidateQueries({ queryKey: ["satfung"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    qc.invalidateQueries({ queryKey: ["personnel"] });
  };

  const upload = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      setUploading(true);
      const res = await api.importExcel(asset.uri, asset.name, asset.mimeType, (asset as any).file);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      refreshAll();
      toast(`Berhasil: ${res.ditambahkan} ditambahkan, ${res.diperbarui} diperbarui (Tahun ${res.tahun.join(", ")})`, "success");
    } catch (e: any) {
      toast(e.message || "Gagal upload", "error");
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      await WebBrowser.openBrowserAsync(api.templateUrl());
    } catch {
      toast("Tidak dapat membuka template", "error");
    }
  };

  if (!ready || !isAdmin) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator color={colors.brandPrimary} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={10} style={styles.headerBtn}>
          <Icon name="ArrowLeft" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>PANEL ADMIN</Text>
        <Pressable
          testID="logout-button"
          onPress={async () => { await logout(); router.replace("/"); }}
          hitSlop={10}
          style={styles.headerBtn}
        >
          <Icon name="SignOut" size={20} color={colors.onError} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeCard}>
          <Icon name="ShieldStar" size={26} color={colors.brandPrimary} weight="fill" />
          <View style={{ flex: 1 }}>
            <Text style={styles.welcomeName}>Selamat datang, {username}</Text>
            <Text style={styles.welcomeSub}>
              {statsQ.data ? `${statsQ.data.total_personil} personil • ${statsQ.data.total_pengajuan} catatan izin/cuti` : "Memuat…"}
            </Text>
          </View>
        </View>

        {/* Upload */}
        <Text style={styles.sectionTitle}>DATABASE EXCEL</Text>
        <Pressable testID="upload-excel-button" onPress={upload} disabled={uploading} style={styles.uploadCard}>
          {uploading ? (
            <ActivityIndicator color={colors.brandPrimary} />
          ) : (
            <Icon name="UploadSimple" size={34} color={colors.brandPrimary} weight="bold" />
          )}
          <Text style={styles.uploadTitle}>{uploading ? "Mengunggah & memproses…" : "Upload File Excel"}</Text>
          <Text style={styles.uploadHint}>
            Data digabung berdasarkan NRP & tahun. Sheet per tahun (mis. TAHUN 2025, TAHUN 2026).
          </Text>
        </Pressable>

        <Pressable testID="download-template-button" onPress={downloadTemplate} style={styles.templateBtn}>
          <Icon name="DownloadSimple" size={18} color={colors.brandPrimary} />
          <Text style={styles.templateText}>Unduh Template Excel (dengan kolom Alasan)</Text>
        </Pressable>

        {/* Manage */}
        <Text style={styles.sectionTitle}>KELOLA PERSONIL</Text>
        <Pressable testID="add-personnel-button" onPress={() => setAddOpen(true)} style={styles.actionRow}>
          <View style={styles.actionIcon}><Icon name="Plus" size={18} color={colors.brandPrimary} weight="bold" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Tambah Personil Baru</Text>
            <Text style={styles.actionSub}>Input manual satu personil</Text>
          </View>
          <Icon name="CaretRight" size={18} color={colors.muted} />
        </Pressable>
        <Pressable testID="search-personnel-button" onPress={() => router.push("/")} style={styles.actionRow}>
          <View style={styles.actionIcon}><Icon name="MagnifyingGlass" size={18} color={colors.brandPrimary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Cari & Edit Personil</Text>
            <Text style={styles.actionSub}>Buka profil untuk kelola izin / cuti</Text>
          </View>
          <Icon name="CaretRight" size={18} color={colors.muted} />
        </Pressable>

        {/* Laporan & Keamanan */}
        <Text style={styles.sectionTitle}>LAPORAN & KEAMANAN</Text>
        <Pressable testID="admin-rekap-button" onPress={() => router.push("/rekap")} style={styles.actionRow}>
          <View style={styles.actionIcon}><Icon name="ChartBar" size={18} color={colors.brandPrimary} weight="fill" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Rekap Satfung</Text>
            <Text style={styles.actionSub}>Ringkasan bulanan & peringkat izin/cuti</Text>
          </View>
          <Icon name="CaretRight" size={18} color={colors.muted} />
        </Pressable>
        <Pressable testID="change-password-button" onPress={() => setPwOpen(true)} style={styles.actionRow}>
          <View style={styles.actionIcon}><Icon name="Key" size={18} color={colors.brandPrimary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Ganti Password</Text>
            <Text style={styles.actionSub}>Ubah kata sandi admin Anda</Text>
          </View>
          <Icon name="CaretRight" size={18} color={colors.muted} />
        </Pressable>

        <View style={styles.tip}>
          <Icon name="Info" size={16} color={colors.muted} />
          <Text style={styles.tipText}>
            Tips: Untuk update rutin, cukup upload file Excel terbaru. Data lama otomatis diperbarui, catatan yang Anda tambahkan manual tetap tersimpan.
          </Text>
        </View>
      </ScrollView>

      {addOpen ? (
        <AddPersonnel
          defaultYear={Math.max(yearsQ.data?.[0] ?? 0, new Date().getFullYear())}
          onClose={() => setAddOpen(false)}
          onCreated={(id) => { setAddOpen(false); refreshAll(); router.push(`/personnel/${id}`); }}
        />
      ) : null}
      {pwOpen ? <ChangePassword onClose={() => setPwOpen(false)} /> : null}
    </View>
  );
}

function ChangePassword({ onClose }: { onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const mut = useMutation({
    mutationFn: () => {
      if (next.length < 6) throw new Error("Password baru minimal 6 karakter");
      if (next !== confirm) throw new Error("Konfirmasi password tidak cocok");
      return api.changePassword(current, next);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast("Password berhasil diubah", "success");
      onClose();
    },
    onError: (e: any) => toast(e.message, "error"),
  });

  return (
    <Sheet visible onClose={onClose} title="Ganti Password" testID="change-password-sheet">
      <Field label="Password Lama" value={current} onChange={setCurrent} testID="pw-current" secure />
      <Field label="Password Baru (min. 6 karakter)" value={next} onChange={setNext} testID="pw-new" secure />
      <Field label="Ulangi Password Baru" value={confirm} onChange={setConfirm} testID="pw-confirm" secure />
      <Pressable testID="save-change-password" onPress={() => mut.mutate()} style={styles.saveBtn} disabled={mut.isPending}>
        {mut.isPending ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.saveText}>Simpan Password Baru</Text>}
      </Pressable>
      <Pressable testID="cancel-change-password" onPress={onClose} style={styles.cancelBtn} disabled={mut.isPending}>
        <Icon name="ArrowLeft" size={16} color={colors.onSurfaceSecondary} />
        <Text style={styles.cancelText}>Batal</Text>
      </Pressable>
    </Sheet>
  );
}

function AddPersonnel({
  defaultYear, onClose, onCreated,
}: { defaultYear: number; onClose: () => void; onCreated: (id: string) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [nama, setNama] = useState("");
  const [pangkat, setPangkat] = useState("");
  const [nrp, setNrp] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [satfung, setSatfung] = useState("");
  const [tahun, setTahun] = useState(String(defaultYear));
  // optional first leave
  const [jenis, setJenis] = useState<string | null>(null);
  const [tanggal, setTanggal] = useState("");
  const [alasan, setAlasan] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      if (!nama.trim()) throw new Error("Nama wajib diisi");
      const yr = Number(tahun);
      if (!yr || yr < 2000 || yr > 2100) throw new Error("Tahun tidak valid (mis. 2027)");
      const p: any = await api.createPersonnel({
        nama: nama.trim(), pangkat, nrp, jabatan,
        satfung: satfung.trim() || "LAINNYA",
        tahun: yr,
      });
      if (jenis && tanggal) {
        await api.addLeave(p.id, { jenis, tanggal, alasan });
      }
      return p;
    },
    onSuccess: (p: any) => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); onCreated(p.id); },
    onError: (e: any) => toast(e.message, "error"),
  });

  return (
    <Sheet visible onClose={onClose} title="Tambah Personil" testID="add-personnel-sheet">
      <Field label="Nama Lengkap" value={nama} onChange={setNama} testID="add-nama" />
      <Field label="Pangkat" value={pangkat} onChange={setPangkat} testID="add-pangkat" />
      <Field label="NRP / NIP" value={nrp} onChange={setNrp} testID="add-nrp" keyboard="numbers-and-punctuation" />
      <Field label="Jabatan" value={jabatan} onChange={setJabatan} testID="add-jabatan" />
      <Field label="Satfung (mis. BAG SDM)" value={satfung} onChange={setSatfung} testID="add-satfung" />
      <Field label="Tahun (bisa ketik tahun baru, mis. 2027)" value={tahun} onChange={setTahun} testID="add-tahun" keyboard="number-pad" />

      <View style={styles.optDivider}>
        <Text style={styles.optTitle}>Izin / Cuti (opsional)</Text>
        <Text style={styles.optHint}>Isi bila anggota ini sedang izin/cuti sekarang</Text>
      </View>
      <View style={styles.jenisWrap}>
        {LEAVE_ORDER.map((k) => {
          const meta = metaFor(k);
          const active = jenis === k;
          return (
            <Pressable
              key={k}
              testID={`add-jenis-${k}`}
              onPress={() => setJenis(active ? null : k)}
              style={[styles.jenisChip, active && { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary }]}
            >
              <Icon name={meta.icon} size={14} color={active ? colors.brandPrimary : colors.muted} weight={active ? "fill" : "regular"} />
              <Text style={[styles.jenisText, active && { color: colors.onBrandTertiary }]}>{meta.short}</Text>
            </Pressable>
          );
        })}
      </View>
      {jenis ? (
        <>
          <Text style={styles.fieldLabel}>Tanggal</Text>
          <DatePickerField testID="add-leave-date" value={tanggal} onChange={setTanggal} placeholder="Ketuk untuk pilih tanggal" />
          <View style={{ height: 12 }} />
          <Field label="Alasan / Keterangan" value={alasan} onChange={setAlasan} testID="add-leave-alasan" />
        </>
      ) : null}

      <Pressable testID="save-add-personnel" onPress={() => mut.mutate()} style={styles.saveBtn} disabled={mut.isPending}>
        {mut.isPending ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.saveText}>Simpan</Text>}
      </Pressable>
      <Pressable testID="cancel-add-personnel" onPress={onClose} style={styles.cancelBtn} disabled={mut.isPending}>
        <Icon name="ArrowLeft" size={16} color={colors.onSurfaceSecondary} />
        <Text style={styles.cancelText}>Batal</Text>
      </Pressable>
    </Sheet>
  );
}

function Field({
  label, value, onChange, testID, keyboard, secure,
}: { label: string; value: string; onChange: (s: string) => void; testID?: string; keyboard?: any; secure?: boolean }) {
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
        secureTextEntry={secure}
        autoCapitalize="none"
        style={styles.input}
      />
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontFamily: "Oswald", fontSize: 18, letterSpacing: 1.5 },

  welcomeCard: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceSecondary,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 8,
  },
  welcomeName: { color: colors.onSurface, fontFamily: "Oswald", fontSize: 18 },
  welcomeSub: { color: colors.muted, fontFamily: "DMSans", fontSize: 13, marginTop: 2 },

  sectionTitle: { color: colors.onSurface, fontFamily: "Oswald", fontSize: 16, letterSpacing: 1.5, marginTop: 22, marginBottom: 12 },

  uploadCard: {
    alignItems: "center", gap: 8, backgroundColor: "rgba(212,175,55,0.06)",
    borderRadius: 16, borderWidth: 2, borderColor: colors.brandPrimary, borderStyle: "dashed", padding: 24,
  },
  uploadTitle: { color: colors.onSurface, fontFamily: "Oswald", fontSize: 20, letterSpacing: 0.5 },
  uploadHint: { color: colors.muted, fontFamily: "DMSans", fontSize: 12, textAlign: "center", lineHeight: 18 },

  templateBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 12, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary,
  },
  templateText: { color: colors.brandPrimary, fontFamily: "DMSans", fontSize: 14, fontWeight: "600" },

  actionRow: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceSecondary,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10,
  },
  actionIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brandPrimary },
  actionTitle: { color: colors.onSurface, fontFamily: "DMSans", fontSize: 15, fontWeight: "700" },
  actionSub: { color: colors.muted, fontFamily: "DMSans", fontSize: 12, marginTop: 1 },

  tip: { flexDirection: "row", gap: 10, marginTop: 20, backgroundColor: colors.surfaceTertiary, borderRadius: 12, padding: 14 },
  tipText: { color: colors.onSurfaceTertiary, fontFamily: "DMSans", fontSize: 12, lineHeight: 18, flex: 1 },

  fieldLabel: { color: colors.onSurfaceSecondary, fontFamily: "DMSans", fontSize: 13, fontWeight: "600", marginBottom: 8, marginTop: 6 },
  input: {
    backgroundColor: colors.surfaceTertiary, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    color: colors.onSurface, fontFamily: "DMSans", fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
  },
  saveBtn: { backgroundColor: colors.brandPrimary, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 12 },
  saveText: { color: colors.onBrandPrimary, fontFamily: "DMSans", fontSize: 16, fontWeight: "700" },
  cancelBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    height: 50, borderRadius: 12, marginTop: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTertiary,
  },
  cancelText: { color: colors.onSurfaceSecondary, fontFamily: "DMSans", fontSize: 15, fontWeight: "600" },

  optDivider: { marginTop: 10, marginBottom: 6, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 14 },
  optTitle: { color: colors.onSurface, fontFamily: "Oswald", fontSize: 16, letterSpacing: 0.5 },
  optHint: { color: colors.muted, fontFamily: "DMSans", fontSize: 12, marginTop: 2 },
  jenisWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  jenisChip: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border,
  },
  jenisText: { color: colors.onSurfaceTertiary, fontFamily: "DMSans", fontSize: 12, fontWeight: "600" },
}));
