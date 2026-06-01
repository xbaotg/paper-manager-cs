import "server-only";
import { getDb } from "../sqlite";

export interface BoMon {
  id: number;
  code: string;
  nameVi: string;
  nameEn: string;
  isActive: number;
}

interface BoMonRow {
  id: number;
  code: string;
  name_vi: string;
  name_en: string;
  is_active: number;
}

function toBoMon(r: BoMonRow): BoMon {
  return { id: r.id, code: r.code, nameVi: r.name_vi, nameEn: r.name_en, isActive: r.is_active };
}

export function listBoMon(): BoMon[] {
  const rows = getDb().prepare("SELECT * FROM bo_mon ORDER BY code").all() as BoMonRow[];
  return rows.map(toBoMon);
}

export function getBoMonById(id: number): BoMon | null {
  const r = getDb().prepare("SELECT * FROM bo_mon WHERE id = ?").get(id) as BoMonRow | undefined;
  return r ? toBoMon(r) : null;
}

export function createBoMon(input: { code: string; nameVi: string; nameEn?: string }): number {
  const info = getDb()
    .prepare("INSERT INTO bo_mon (code, name_vi, name_en) VALUES (?, ?, ?)")
    .run(input.code, input.nameVi, input.nameEn ?? "");
  return Number(info.lastInsertRowid);
}

export function updateBoMon(
  id: number,
  input: { code: string; nameVi: string; nameEn?: string; isActive?: boolean }
): void {
  getDb()
    .prepare("UPDATE bo_mon SET code = ?, name_vi = ?, name_en = ?, is_active = ? WHERE id = ?")
    .run(input.code, input.nameVi, input.nameEn ?? "", input.isActive === false ? 0 : 1, id);
}

export function deleteBoMon(id: number): void {
  // Lecturers' bo_mon_id is ON DELETE SET NULL; the next boot re-backfills nulls
  // to the default unit.
  getDb().prepare("DELETE FROM bo_mon WHERE id = ?").run(id);
}

// Count of lecturers in each bộ môn, for the management list.
export function countLecturersByBoMon(): Map<number, number> {
  const rows = getDb()
    .prepare("SELECT bo_mon_id, count(*) AS n FROM lecturers WHERE bo_mon_id IS NOT NULL GROUP BY bo_mon_id")
    .all() as { bo_mon_id: number; n: number }[];
  return new Map(rows.map((r) => [r.bo_mon_id, r.n]));
}

// Lecturer ids belonging to a bộ môn — the authoritative scope for a head.
export function listLecturerIdsByBoMon(boMonId: number): number[] {
  const rows = getDb()
    .prepare("SELECT id FROM lecturers WHERE bo_mon_id = ?")
    .all(boMonId) as { id: number }[];
  return rows.map((r) => r.id);
}
