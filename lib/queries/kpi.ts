import "server-only";
import { getDb } from "../sqlite";
import type { KpiPeriod, KpiIndicator, KpiTarget } from "../kpi";

interface PeriodRow {
  id: number;
  label: string;
  start_year: number;
  end_year: number;
  is_active: number;
}
interface IndicatorRow {
  id: number;
  code: string;
  name_vi: string;
  unit: string;
  agg: string;
}
interface TargetRow {
  id: number;
  period_id: number;
  indicator_id: number;
  lecturer_id: number;
  target_value: number;
  note: string | null;
}

export function listPeriods(): KpiPeriod[] {
  const rows = getDb()
    .prepare("SELECT * FROM kpi_periods ORDER BY start_year DESC")
    .all() as PeriodRow[];
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    startYear: r.start_year,
    endYear: r.end_year,
    isActive: r.is_active,
  }));
}

export function getPeriodById(id: number): KpiPeriod | null {
  const r = getDb().prepare("SELECT * FROM kpi_periods WHERE id = ?").get(id) as PeriodRow | undefined;
  return r
    ? { id: r.id, label: r.label, startYear: r.start_year, endYear: r.end_year, isActive: r.is_active }
    : null;
}

export function createPeriod(label: string, startYear: number, endYear: number): number {
  const info = getDb()
    .prepare("INSERT INTO kpi_periods (label, start_year, end_year) VALUES (?, ?, ?)")
    .run(label, startYear, endYear);
  return Number(info.lastInsertRowid);
}

export function deletePeriod(id: number): void {
  getDb().prepare("DELETE FROM kpi_periods WHERE id = ?").run(id);
}

export function listIndicators(): KpiIndicator[] {
  const rows = getDb()
    .prepare("SELECT * FROM kpi_indicators WHERE is_active = 1 ORDER BY id")
    .all() as IndicatorRow[];
  return rows.map((r) => ({ id: r.id, code: r.code, nameVi: r.name_vi, unit: r.unit, agg: r.agg }));
}

function mapTarget(r: TargetRow): KpiTarget {
  return {
    id: r.id,
    periodId: r.period_id,
    indicatorId: r.indicator_id,
    lecturerId: r.lecturer_id,
    targetValue: r.target_value,
    note: r.note,
  };
}

export function listTargetsForPeriod(periodId: number): KpiTarget[] {
  const rows = getDb()
    .prepare("SELECT * FROM kpi_targets WHERE period_id = ?")
    .all(periodId) as TargetRow[];
  return rows.map(mapTarget);
}

export function listTargetsForLecturer(periodId: number, lecturerId: number): KpiTarget[] {
  const rows = getDb()
    .prepare("SELECT * FROM kpi_targets WHERE period_id = ? AND lecturer_id = ?")
    .all(periodId, lecturerId) as TargetRow[];
  return rows.map(mapTarget);
}

// Insert or update a target. A value <= 0 removes the target (no goal set).
export function upsertTarget(
  periodId: number,
  indicatorId: number,
  lecturerId: number,
  value: number,
  setBy: number | null
): void {
  const db = getDb();
  if (value <= 0) {
    db.prepare(
      "DELETE FROM kpi_targets WHERE period_id = ? AND indicator_id = ? AND lecturer_id = ?"
    ).run(periodId, indicatorId, lecturerId);
    return;
  }
  db.prepare(
    `INSERT INTO kpi_targets (period_id, indicator_id, lecturer_id, target_value, set_by, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(period_id, indicator_id, lecturer_id)
     DO UPDATE SET target_value = excluded.target_value, set_by = excluded.set_by, updated_at = datetime('now')`
  ).run(periodId, indicatorId, lecturerId, value, setBy);
}

// ---- Faculty- / bộ-môn-level targets (kpi_faculty_targets) ----
// bo_mon_id = 0 is the whole-faculty sentinel.

export interface FacultyTarget {
  id: number;
  periodId: number;
  indicatorId: number;
  boMonId: number; // 0 = whole faculty
  targetValue: number;
}

interface FacultyTargetRow {
  id: number;
  period_id: number;
  indicator_id: number;
  bo_mon_id: number;
  target_value: number;
}

export function listFacultyTargets(periodId: number): FacultyTarget[] {
  const rows = getDb()
    .prepare("SELECT * FROM kpi_faculty_targets WHERE period_id = ?")
    .all(periodId) as FacultyTargetRow[];
  return rows.map((r) => ({
    id: r.id,
    periodId: r.period_id,
    indicatorId: r.indicator_id,
    boMonId: r.bo_mon_id,
    targetValue: r.target_value,
  }));
}

// Insert/update a faculty (or bộ-môn) target. value <= 0 removes it.
export function upsertFacultyTarget(
  periodId: number,
  indicatorId: number,
  boMonId: number,
  value: number,
  setBy: number | null
): void {
  const db = getDb();
  if (value <= 0) {
    db.prepare(
      "DELETE FROM kpi_faculty_targets WHERE period_id = ? AND indicator_id = ? AND bo_mon_id = ?"
    ).run(periodId, indicatorId, boMonId);
    return;
  }
  db.prepare(
    `INSERT INTO kpi_faculty_targets (period_id, indicator_id, bo_mon_id, target_value, set_by, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(period_id, indicator_id, bo_mon_id)
     DO UPDATE SET target_value = excluded.target_value, set_by = excluded.set_by, updated_at = datetime('now')`
  ).run(periodId, indicatorId, boMonId, value, setBy);
}
