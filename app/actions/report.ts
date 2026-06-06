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
  computeKpiRow, computeFacultyRollup, paperInPeriod,
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

// Per-bộ-môn (department) KPI rollup for the by-department breakdown.
export interface BoMonRollup {
  boMonId: number;
  boMonName: string;
  headcount: number;
  rollup: FacultyRollup[];
}

// Submission-pipeline snapshot for the period: distinct papers grouped by stage.
export interface PipelineSummary {
  submitted: number;
  underReview: number;
  rebuttal: number;
  accepted: number;
  published: number;
  denied: number;
  inProgress: number;   // submitted + under_review + rebuttal
  publications: number; // accepted + published (count toward KPI when Scopus)
  total: number;
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
  boMonRollups: BoMonRollup[];
  pipeline: PipelineSummary;
  lecturers: ReportLecturer[];
  papers: Paper[];
  development: DevelopmentItem[];
  phdActual: number;
  phdMilestones: { year: number; target: number }[];
}

const EMPTY_PIPELINE: PipelineSummary = {
  submitted: 0, underReview: 0, rebuttal: 0, accepted: 0, published: 0, denied: 0,
  inProgress: 0, publications: 0, total: 0,
};

// Group a paper set into pipeline-stage counts (each paper counted once).
function computePipeline(papers: Paper[]): PipelineSummary {
  const c = { ...EMPTY_PIPELINE };
  for (const p of papers) {
    const s = p.submissionStatus ?? "submitted";
    if (s === "submitted") c.submitted += 1;
    else if (s === "under_review") c.underReview += 1;
    else if (s === "rebuttal") c.rebuttal += 1;
    else if (s === "accepted") c.accepted += 1;
    else if (s === "published") c.published += 1;
    else if (s === "denied") c.denied += 1;
  }
  c.inProgress = c.submitted + c.underReview + c.rebuttal;
  c.publications = c.accepted + c.published;
  c.total = papers.length;
  return c;
}

export async function getReportData(periodId?: number): Promise<ReportData> {
  await requireManager();
  ensureVenuesHydrated();

  const periods = listPeriods();
  // Default to the period covering the current calendar year (e.g. 2026 ->
  // "2026-2027"), falling back to the active/first period.
  const currentYear = new Date().getFullYear();
  const period = (periodId ? periods.find((p) => p.id === periodId) : null)
    ?? periods.find((p) => p.startYear === currentYear)
    ?? periods.find((p) => p.isActive) ?? periods[0] ?? null;
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
  let boMonRollups: BoMonRollup[] = [];
  let pipeline: PipelineSummary = EMPTY_PIPELINE;
  const lecturers: ReportLecturer[] = [];

  if (period) {
    const targets = listTargetsForPeriod(period.id);
    const allFacultyTargets = listFacultyTargets(period.id);
    const facultyTargets = allFacultyTargets
      .filter((t) => t.boMonId === 0)
      .map((t) => ({ indicatorId: t.indicatorId, targetValue: t.targetValue }));
    const completed = new Set(listDevelopmentCompletedIds());
    rollup = computeFacultyRollup(ranks, period, indicators, targets, facultyTargets, papers, completed);

    // Per-department rollups (skip departments with no lecturers).
    boMonRollups = boMon
      .map((bm) => {
        const bmLecturers = allLecturers.filter((l) => (l.boMonId ?? null) === bm.id);
        const bmRanks: LecturerRank[] = bmLecturers.map((l) => ({ id: l.id, academicRank: (l.academicRank ?? "ThS") as AcademicRank }));
        const bmFt = allFacultyTargets
          .filter((t) => t.boMonId === bm.id)
          .map((t) => ({ indicatorId: t.indicatorId, targetValue: t.targetValue }));
        return {
          boMonId: bm.id,
          boMonName: bm.nameVi,
          headcount: bmLecturers.length,
          rollup: computeFacultyRollup(bmRanks, period, indicators, targets, bmFt, papers, completed),
        };
      })
      .filter((b) => b.headcount > 0);

    // Submission pipeline for papers attributed to this period (conference year).
    pipeline = computePipeline(papers.filter((p) => paperInPeriod(p, period)));

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
    boMonRollups,
    pipeline,
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
    // Per-department breakdown is year-mode only; pipeline summed across the range.
    boMonRollups: [],
    pipeline: computePipeline(papers),
    lecturers,
    papers,
    development,
    phdActual,
    phdMilestones: Object.entries(PHD_MILESTONES).map(([y, t]) => ({ year: Number(y), target: t })).sort((a, b) => a.year - b.year),
  };
}
