import "server-only";
import { getDb } from "../sqlite";
import {
  normalizeLlkh,
  type LlkhProfile,
  type LlkhDaoTao,
  type LlkhCongTac,
  type LlkhDeTai,
  type LlkhHuongDan,
} from "../llkh";

// Assemble a lecturer's LLKH profile: scalars + CV-only arrays (ngoaiNgu, sách,
// giải thưởng) come from the JSON blob; the four activity sections (education,
// work history, projects, supervision) are normalized rows read from their own
// tables, overlaid onto the profile in sort order. Defaults when nothing is saved.
export function getLlkh(lecturerId: number): LlkhProfile {
  const db = getDb();
  const row = db
    .prepare("SELECT data_json FROM lecturer_llkh WHERE lecturer_id = ?")
    .get(lecturerId) as { data_json: string } | undefined;

  let blob: unknown = {};
  if (row) {
    try {
      blob = JSON.parse(row.data_json);
    } catch {
      blob = {};
    }
  }
  const base = normalizeLlkh(blob);

  const daoTao = db
    .prepare(
      `SELECT bac, thoi_gian AS thoiGian, noi, nganh, luan_an AS luanAn
       FROM lecturer_education WHERE lecturer_id = ? ORDER BY sort_order, id`
    )
    .all(lecturerId) as LlkhDaoTao[];
  const congTac = db
    .prepare(
      `SELECT from_time AS "from", to_time AS "to", noi, chuc_vu AS chucVu
       FROM lecturer_work_history WHERE lecturer_id = ? ORDER BY sort_order, id`
    )
    .all(lecturerId) as LlkhCongTac[];
  const deTai = db
    .prepare(
      `SELECT ten, ma_so AS maSo, thoi_gian AS thoiGian, kinh_phi AS kinhPhi,
              vai_tro AS vaiTro, ngay_nghiem_thu AS ngayNghiemThu, ket_qua AS ketQua
       FROM lecturer_projects WHERE lecturer_id = ? ORDER BY sort_order, id`
    )
    .all(lecturerId) as LlkhDeTai[];
  const huongDan = db
    .prepare(
      `SELECT ten, luan_an AS luanAn, nam_tn AS namTN, bac, san_pham AS sanPham
       FROM lecturer_supervision WHERE lecturer_id = ? ORDER BY sort_order, id`
    )
    .all(lecturerId) as LlkhHuongDan[];

  return { ...base, daoTao, congTac, deTai, huongDan };
}

// Persist a profile: scalars + CV-only arrays into the blob (with the four
// activity arrays stripped so the blob is never a stale second source), and the
// activity rows replaced (delete-all + re-insert with sort_order) in their tables.
// All in one transaction.
export function saveLlkh(lecturerId: number, profile: LlkhProfile): void {
  const db = getDb();
  const p = normalizeLlkh(profile);

  const tx = db.transaction(() => {
    const blobObj: LlkhProfile = { ...p, daoTao: [], congTac: [], deTai: [], huongDan: [] };
    db.prepare(
      `INSERT INTO lecturer_llkh (lecturer_id, data_json, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(lecturer_id) DO UPDATE SET data_json = excluded.data_json, updated_at = datetime('now')`
    ).run(lecturerId, JSON.stringify(blobObj));

    db.prepare("DELETE FROM lecturer_education WHERE lecturer_id = ?").run(lecturerId);
    db.prepare("DELETE FROM lecturer_work_history WHERE lecturer_id = ?").run(lecturerId);
    db.prepare("DELETE FROM lecturer_projects WHERE lecturer_id = ?").run(lecturerId);
    db.prepare("DELETE FROM lecturer_supervision WHERE lecturer_id = ?").run(lecturerId);

    const insEdu = db.prepare(
      `INSERT INTO lecturer_education (lecturer_id, sort_order, bac, thoi_gian, noi, nganh, luan_an)
       VALUES (?,?,?,?,?,?,?)`
    );
    p.daoTao.forEach((d, i) => insEdu.run(lecturerId, i, d.bac, d.thoiGian, d.noi, d.nganh, d.luanAn));

    const insWork = db.prepare(
      `INSERT INTO lecturer_work_history (lecturer_id, sort_order, from_time, to_time, noi, chuc_vu)
       VALUES (?,?,?,?,?,?)`
    );
    p.congTac.forEach((c, i) => insWork.run(lecturerId, i, c.from, c.to, c.noi, c.chucVu));

    const insProj = db.prepare(
      `INSERT INTO lecturer_projects
         (lecturer_id, sort_order, ten, ma_so, thoi_gian, kinh_phi, vai_tro, ngay_nghiem_thu, ket_qua)
       VALUES (?,?,?,?,?,?,?,?,?)`
    );
    p.deTai.forEach((d, i) =>
      insProj.run(lecturerId, i, d.ten, d.maSo, d.thoiGian, d.kinhPhi, d.vaiTro, d.ngayNghiemThu, d.ketQua)
    );

    const insSup = db.prepare(
      `INSERT INTO lecturer_supervision (lecturer_id, sort_order, ten, luan_an, nam_tn, bac, san_pham)
       VALUES (?,?,?,?,?,?,?)`
    );
    p.huongDan.forEach((h, i) => insSup.run(lecturerId, i, h.ten, h.luanAn, h.namTN, h.bac, h.sanPham));
  });
  tx();
}

// ---------- Aggregate (cross-lecturer) reads for the admin report surface ----------

export interface LlkhProjectRow {
  id: number;
  lecturerId: number;
  lecturerName: string;
  ten: string;
  maSo: string;
  thoiGian: string;
  kinhPhi: string;
  vaiTro: string;
  ngayNghiemThu: string;
  ketQua: string;
}

export interface LlkhSupervisionRow {
  id: number;
  lecturerId: number;
  lecturerName: string;
  ten: string;
  luanAn: string;
  namTN: string;
  bac: string;
  sanPham: string;
}

export function listAllProjects(): LlkhProjectRow[] {
  return getDb()
    .prepare(
      `SELECT p.id, p.lecturer_id AS lecturerId, l.name AS lecturerName,
              p.ten, p.ma_so AS maSo, p.thoi_gian AS thoiGian, p.kinh_phi AS kinhPhi,
              p.vai_tro AS vaiTro, p.ngay_nghiem_thu AS ngayNghiemThu, p.ket_qua AS ketQua
       FROM lecturer_projects p
       JOIN lecturers l ON l.id = p.lecturer_id
       ORDER BY l.name, p.sort_order, p.id`
    )
    .all() as LlkhProjectRow[];
}

export function listAllSupervision(): LlkhSupervisionRow[] {
  return getDb()
    .prepare(
      `SELECT s.id, s.lecturer_id AS lecturerId, l.name AS lecturerName,
              s.ten, s.luan_an AS luanAn, s.nam_tn AS namTN, s.bac, s.san_pham AS sanPham
       FROM lecturer_supervision s
       JOIN lecturers l ON l.id = s.lecturer_id
       ORDER BY l.name, s.sort_order, s.id`
    )
    .all() as LlkhSupervisionRow[];
}
