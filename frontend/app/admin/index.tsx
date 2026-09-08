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

        <View style={styles.tip}>
          <Icon name="Info" size={16} color={colors.muted} />
          <Text style={styles.tipText}>
            Tips: Untuk update rutin, cukup upload file Excel terbaru. Data lama otomatis diperbarui, catatan yang Anda tambahkan manual tetap tersimpan.
          </Text>
        </View>
      </ScrollView>

      {addOpen ? (
        <AddPersonnel
          defaultYear={yearsQ.data?.[0] ?? new Date().getFullYear()}
          onClose={() => setAddOpen(false)}
          onCreated={(id) => { setAddOpen(false); refreshAll(); router.push(`/personnel/${id}`); }}
        />
      ) : null}
    </View>
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

  const mut = useMutation({
    mutationFn: () => {
      if (!nama.trim()) throw new Error("Nama wajib diisi");
      return api.createPersonnel({
        nama: nama.trim(), pangkat, nrp, jabatan,
        satfung: satfung.trim() || "LAINNYA",
        tahun: Number(tahun) || defaultYear,
      });
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
      <Field label="Tahun" value={tahun} onChange={setTahun} testID="add-tahun" keyboard="number-pad" />
      <Pressable testID="save-add-personnel" onPress={() => mut.mutate()} style={styles.saveBtn} disabled={mut.isPending}>
        {mut.isPending ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.saveText}>Simpan</Text>}
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
}));
