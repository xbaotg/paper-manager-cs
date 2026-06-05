"use server";

import { requireManager } from "@/lib/dal";
import { listLecturers } from "@/lib/queries/lecturers";
import { listPapers } from "@/lib/queries/papers";
import { ensureVenuesHydrated } from "@/lib/queries/venues";
import { listBoMon } from "@/lib/queries/bo_mon";
import { listDevelopment, listDevelopmentCompletedIds } from "@/lib/queries/development";
import {
  listPeriods, listIndicators, listTargetsForPeriod, listFacultyTargets,
} from "@/lib/queries/kpi";
import {
  computeKpiRow, computeFacultyRollup,
  type KpiPeriod, type KpiIndicator, type KpiCell, type FacultyRollup, type LecturerRank,
} from "@/lib/kpi";
import { PHD_MILESTONES } from "@/lib/kpi-policy";
import type { AcademicRank, Paper } from "@/lib/data";
import type { DevelopmentItem } from "@/lib/queries/development";

export interface ReportLecturer {
  id: number;
  name: string;
  title: string;
  academicRank: AcademicRank;
  boMonName: string;
  cells: KpiCell[];
}

export interface ReportData {
  generatedAt: string;
  /** Header / CSV-filename label: kỳ label for a single year, "Y1-Y2" for a range. */
  label: string;
  period: KpiPeriod | null;
  range: { from: number; to: number } | null;
  periods: KpiPeriod[];
  indicators: KpiIndicator[];
  rollup: FacultyRollup[];
  lecturers: ReportLecturer[];
  papers: Paper[];
  development: DevelopmentItem[];
  phdActual: number;
  phdMilestones: { year: number; target: number }[];
}

export async function getReportData(periodId?: number): Promise<ReportData> {
  await requireManager();
  ensureVenuesHydrated();

  const periods = listPeriods();
  const period = (periodId ? periods.find((p) => p.id === periodId) : null) ?? periods.find((p) => p.isActive) ?? periods[0] ?? null;
  const indicators = listIndicators();
  const allLecturers = listLecturers();
  const boMonName = new Map<number, string>();
  const boMon = listBoMon();
  boMon.forEach((b) => boMonName.set(b.id, b.nameVi));

  const papers = listPapers();
  const development = listDevelopment();

  const ranks: LecturerRank[] = allLecturers.map((l) => ({ id: l.id, academicRank: (l.academicRank ?? "ThS") as AcademicRank }));
  const phdActual = ranks.filter((r) => r.academicRank === "PGS.TS" || r.academicRank === "TS").length
    + listDevelopmentCompletedIds().filter((id) => {
        const r = ranks.find((x) => x.id === id);
        return r && r.academicRank !== "PGS.TS" && r.academicRank !== "TS";
      }).length;

  let rollup: FacultyRollup[] = [];
  const lecturers: ReportLecturer[] = [];

  if (period) {
    const targets = listTargetsForPeriod(period.id);
    const facultyTargets = listFacultyTargets(period.id)
      .filter((t) => t.boMonId === 0)
      .map((t) => ({ indicatorId: t.indicatorId, targetValue: t.targetValue }));
    const completed = new Set(listDevelopmentCompletedIds());
    rollup = computeFacultyRollup(ranks, period, indicators, targets, facultyTargets, papers, completed);

    for (const l of allLecturers) {
      const row = computeKpiRow(l.id, period, indicators, targets, papers);
      lecturers.push({
        id: l.id,
        name: l.name,
        title: l.title,
        academicRank: (l.academicRank ?? "ThS") as AcademicRank,
        boMonName: l.boMonId != null ? boMonName.get(l.boMonId) ?? "" : "",
        cells: row.cells,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    label: period?.label ?? "—",
    period,
    range: null,
    periods,
    indicators,
    rollup,
    lecturers,
    papers,
    development,
    phdActual,
    phdMilestones: Object.entries(PHD_MILESTONES).map(([y, t]) => ({ year: Number(y), target: t })).sort((a, b) => a.year - b.year),
  };
}

// Range report — sums per-indicator and per-lecturer cells across every kỳ
// whose startYear is in [from, to]. Faculty targets are summed too so totals
// represent "Σ chỉ tiêu trong giai đoạn".
export async function getReportRangeData(from: number, to: number): Promise<ReportData> {
  await requireManager();
  ensureVenuesHydrated();
  if (from > to) [from, to] = [to, from];

  const periodsAll = listPeriods();
  const periods = periodsAll.filter((p) => p.startYear >= from && p.startYear <= to);
  const indicators = listIndicators();
  const allLecturers = listLecturers();
  const boMonName = new Map<number, string>();
  listBoMon().forEach((b) => boMonName.set(b.id, b.nameVi));
  const allPapers = listPapers();
  const development = listDevelopment();

  const ranks: LecturerRank[] = allLecturers.map((l) => ({
    id: l.id, academicRank: (l.academicRank ?? "ThS") as AcademicRank,
  }));
  const completed = new Set(listDevelopmentCompletedIds());
  const phdActual = ranks.filter((r) => r.academicRank === "PGS.TS" || r.academicRank === "TS").length
    + Array.from(completed).filter((id) => {
        const r = ranks.find((x) => x.id === id);
        return r && r.academicRank !== "PGS.TS" && r.academicRank !== "TS";
      }).length;

  // Sum rollup + per-lecturer cells across periods.
  const aggRollup = indicators.map((i) => ({
    indicatorId: i.id,
    totalActual: 0,
    facultyTarget: null as number | null,
    facultyPct: null as number | null,
    avgActualPerHead: 0,
    personalTargetSum: 0,
    withTarget: 0,
    metCount: 0,
  }));
  const lecturerCells = new Map<number, Map<number, { actual: number; target: number | null }>>();

  for (const period of periods) {
    const targets = listTargetsForPeriod(period.id);
    const ft = listFacultyTargets(period.id)
      .filter((t) => t.boMonId === 0)
      .map((t) => ({ indicatorId: t.indicatorId, targetValue: t.targetValue }));
    const r = computeFacultyRollup(ranks, period, indicators, targets, ft, allPapers, completed);
    r.forEach((rr) => {
      const a = aggRollup.find((x) => x.indicatorId === rr.indicatorId)!;
      a.totalActual += rr.totalActual;
      if (rr.facultyTarget != null) a.facultyTarget = (a.facultyTarget ?? 0) + rr.facultyTarget;
    });
    for (const l of allLecturers) {
      const row = computeKpiRow(l.id, period, indicators, targets, allPapers);
      const map = lecturerCells.get(l.id) ?? new Map<number, { actual: number; target: number | null }>();
      row.cells.forEach((c) => {
        const cur = map.get(c.indicatorId) ?? { actual: 0, target: null };
        cur.actual += c.actual;
        if (c.target != null) cur.target = (cur.target ?? 0) + c.target;
        map.set(c.indicatorId, cur);
      });
      lecturerCells.set(l.id, map);
    }
  }
  aggRollup.forEach((a) => {
    a.facultyPct =
      a.facultyTarget && a.facultyTarget > 0 ? Math.round((a.totalActual / a.facultyTarget) * 100) : null;
  });

  const lecturers: ReportLecturer[] = allLecturers.map((l) => {
    const cmap = lecturerCells.get(l.id);
    const cells = indicators.map((i) => {
      const cur = cmap?.get(i.id);
      return {
        indicatorId: i.id,
        actual: cur?.actual ?? 0,
        target: cur?.target ?? null,
        pct: cur?.target && cur.target > 0 ? Math.round(((cur.actual ?? 0) / cur.target) * 100) : null,
      };
    });
    return {
      id: l.id,
      name: l.name,
      title: l.title,
      academicRank: (l.academicRank ?? "ThS") as AcademicRank,
      boMonName: l.boMonId != null ? boMonName.get(l.boMonId) ?? "" : "",
      cells,
    };
  });

  const papers = allPapers.filter((p) => p.year >= from && p.year <= to);

  return {
    generatedAt: new Date().toISOString(),
    label: from === to ? String(from) : `${from}-${to}`,
    period: null,
    range: { from, to },
    periods: periodsAll,
    indicators,
    rollup: aggRollup,
    lecturers,
    papers,
    development,
    phdActual,
    phdMilestones: Object.entries(PHD_MILESTONES).map(([y, t]) => ({ year: Number(y), target: t })).sort((a, b) => a.year - b.year),
  };
}
