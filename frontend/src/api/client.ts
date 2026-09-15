import { storage } from "@/src/utils/storage";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
export const TOKEN_KEY = "eizicut_token";

async function authHeaders(): Promise<Record<string, string>> {
  const token = await storage.secureGet<string>(TOKEN_KEY, "");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle(res: Response) {
  if (!res.ok) {
    let detail = "Terjadi kesalahan";
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // ignore
    }
    const err = new Error(detail) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export type LeaveEntry = {
  id: string;
  jenis: string;
  tanggal: string;
  alasan: string;
  source?: string;
};

export type Personnel = {
  id: string;
  nama: string;
  pangkat: string;
  nrp: string;
  jabatan: string;
  satfung: string;
  tahun: number;
  order?: number;
  leaves: LeaveEntry[];
  leave_count?: number;
};

export type Stats = {
  total_personil: number;
  total_satfung: number;
  total_pengajuan: number;
  per_type: { key: string; label: string; count: number }[];
  recent: {
    personnel_id: string;
    nama: string;
    pangkat: string;
    satfung: string;
    jenis: string;
    tanggal: string;
    alasan: string;
  }[];
};

export type Recap = {
  tahun: number | null;
  satfung_filter: string | null;
  monthly: { bulan: number; izin: number; cuti: number }[];
  satfung: { satfung: string; total_personil: number; total_pengajuan: number; izin: number; cuti: number }[];
  top: { personnel_id: string; nama: string; pangkat: string; satfung: string; izin: number; cuti: number; total: number }[];
};

export const api = {
  async login(username: string, password: string) {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    return handle(res) as Promise<{ access_token: string; username: string }>;
  },

  async changePassword(current_password: string, new_password: string) {
    return handle(await fetch(`${BASE}/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ current_password, new_password }),
    }));
  },

  async years(): Promise<number[]> {
    return handle(await fetch(`${BASE}/years`));
  },

  async satfung(tahun?: number): Promise<{ satfung: string; count: number }[]> {
    const qs = tahun ? `?tahun=${tahun}` : "";
    return handle(await fetch(`${BASE}/satfung${qs}`));
  },

  async stats(tahun?: number): Promise<Stats> {
    const qs = tahun ? `?tahun=${tahun}` : "";
    return handle(await fetch(`${BASE}/stats${qs}`));
  },

  async recap(tahun?: number, satfung?: string): Promise<Recap> {
    const sp = new URLSearchParams();
    if (tahun) sp.set("tahun", String(tahun));
    if (satfung) sp.set("satfung", satfung);
    return handle(await fetch(`${BASE}/recap?${sp.toString()}`));
  },

  async listPersonnel(params: { tahun?: number; satfung?: string; q?: string; jenis?: string }): Promise<Personnel[]> {
    const sp = new URLSearchParams();
    if (params.tahun) sp.set("tahun", String(params.tahun));
    if (params.satfung) sp.set("satfung", params.satfung);
    if (params.q) sp.set("q", params.q);
    if (params.jenis) sp.set("jenis", params.jenis);
    return handle(await fetch(`${BASE}/personnel?${sp.toString()}`));
  },

  async getPersonnel(id: string): Promise<Personnel> {
    return handle(await fetch(`${BASE}/personnel/${id}`));
  },

  async leaveTypes(): Promise<{ key: string; label: string }[]> {
    return handle(await fetch(`${BASE}/leave-types`));
  },

  // ---- admin writes ----
  async createPersonnel(data: Partial<Personnel>) {
    return handle(await fetch(`${BASE}/personnel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify(data),
    }));
  },

  async updatePersonnel(id: string, data: Partial<Personnel>) {
    return handle(await fetch(`${BASE}/personnel/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify(data),
    }));
  },

  async deletePersonnel(id: string) {
    return handle(await fetch(`${BASE}/personnel/${id}`, {
      method: "DELETE",
      headers: { ...(await authHeaders()) },
    }));
  },

  async addLeave(pid: string, data: { jenis: string; tanggal: string; alasan: string }) {
    return handle(await fetch(`${BASE}/personnel/${pid}/leaves`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify(data),
    }));
  },

  async updateLeave(pid: string, lid: string, data: Partial<LeaveEntry>) {
    return handle(await fetch(`${BASE}/personnel/${pid}/leaves/${lid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify(data),
    }));
  },

  async deleteLeave(pid: string, lid: string) {
    return handle(await fetch(`${BASE}/personnel/${pid}/leaves/${lid}`, {
      method: "DELETE",
      headers: { ...(await authHeaders()) },
    }));
  },

  async importExcel(fileUri: string, name: string, mimeType?: string, webFile?: any) {
    const form = new FormData();
    if (webFile) {
      form.append("file", webFile);
    } else {
      form.append("file", {
        uri: fileUri,
        name,
        type: mimeType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      } as any);
    }
    const res = await fetch(`${BASE}/import`, {
      method: "POST",
      headers: { ...(await authHeaders()) },
      body: form,
    });
    return handle(res) as Promise<{
      ok: boolean;
      total: number;
      ditambahkan: number;
      diperbarui: number;
      tahun: number[];
    }>;
  },

  templateUrl() {
    return `${BASE}/template`;
  },
};
