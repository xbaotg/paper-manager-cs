// KPI calculation. Pure functions reusing the venue scoring helpers.
import { isVenueQ1, isVenueScopus } from "./venues";
import type { Paper, AcademicRank } from "./data";
import { isPendingSubmission, countsAsPublication } from "./data";

// The KPI action plan runs 2026–2030; papers before 2026 are intentionally
// outside every KPI period (see the project decision). Credit/attribution nudges
// are therefore only meaningful from this year on.
export const KPI_PLAN_START_YEAR = 2026;

export interface KpiPeriod {
  id: number;
  label: string;      // "2024-2025"
  startYear: number;
  endYear: number;
  isActive: number;
}

export interface KpiIndicator {
  id: number;
  code: string;       // 'paper_count' | 'scopus_paper_count' | 'q1_count' | 'phd_count'
  nameVi: string;
  unit: string;       // 'bài' | 'người'
  agg: string;        // 'count' | 'scopus_count' | 'q1_count' | 'phd_count'
}

export interface KpiTarget {
  id: number;
  periodId: number;
  indicatorId: number;
  lecturerId: number;
  targetValue: number;
  note: string | null;
}

// Academic-year attribution. Papers only store a calendar `year`, so the
// default rule is: a paper of calendar year Y counts toward the academic year
// starting in Y (label "Y-Y+1"). When pub_month is known, Aug+ stays in Y/Y+1,
// otherwise it shifts to Y-1/Y. (pub_month is not yet captured in the UI.)
export function paperInPeriod(
  paper: Paper & { pubMonth?: number | null },
  period: KpiPeriod
): boolean {
  const month = paper.pubMonth ?? null;
  if (month != null) {
    const startYear = month >= 8 ? paper.year : paper.year - 1;
    return startYear === period.startYear;
  }
  return paper.year === period.startYear;
}

// Single-credit attribution: one paper counts for exactly one person. A paper
// with a credited lecturer counts only for them. Un-credited papers fall back to
// the FIRST attached internal author (lecturerIds preserves attach order) — not
// every co-author — so a paper shared by two faculty is never counted twice in
// the faculty rollup before a manager assigns explicit credit. This matches the
// "tạm tính theo tác giả đầu tiên" note and the listPapersNeedingCredit nudge.
export function isCreditedTo(paper: Paper, lecturerId: number): boolean {
  if (paper.creditedLecturerId != null) return paper.creditedLecturerId === lecturerId;
  return (paper.lecturerIds?.[0] ?? null) === lecturerId;
}

// A paper counts toward the Scopus / Q1 KPI when its venue is Scopus-indexed and
// its submission has been accepted (accepted or published). It is attributed to
// the year the conference/journal ran — the paper's own `year` (via
// paperInPeriod), never a separate index year.
export function scopusCountedInPeriod(paper: Paper, period: KpiPeriod): boolean {
  return (
    isVenueScopus(paper.venue) &&
    countsAsPublication(paper.submissionStatus) &&
    paperInPeriod(paper, period)
  );
}

export function isPaperQ1(paper: Paper): boolean {
  if (paper.quartile) return paper.quartile.toUpperCase().includes("Q1");
  return isVenueQ1(paper.venue);
}

// Actual value for one lecturer / period / indicator, computed from papers.
export function computeActual(
  lecturerId: number,
  period: KpiPeriod,
  indicator: KpiIndicator,
  papers: Paper[]
): number {
  // PhD headcount is a faculty-level metric, not derived from a lecturer's
  // papers; it is computed in the faculty/bộ-môn rollup.
  if (indicator.agg === "phd_count") return 0;

  if (indicator.agg === "scopus_count" || indicator.agg === "q1_count") {
    const own = papers.filter(
      (p) =>
        isCreditedTo(p, lecturerId) &&
        scopusCountedInPeriod(p, period) &&
        (indicator.agg === "scopus_count" || isPaperQ1(p))
    );
    return own.length;
  }

  // Legacy indicators attribute by publication year.
  const own = papers.filter((p) => isCreditedTo(p, lecturerId) && paperInPeriod(p, period));
  return own.length;
}

// Per-lecturer publication funnel for one period, attributed by conference year.
// A narrowing funnel (each is a subset of the previous, except in-progress which
// is disjoint):
//   inProgress — submitted / under_review / rebuttal (not yet accepted)
//   accepted   — accepted or published, at any venue
//   scopus     — of accepted, those at a Scopus venue  (== the Scopus KPI actual)
//   q1         — of scopus, those that are Q1           (== the Q1 KPI actual)
// Denied papers count toward none.
export interface PipelineCounts {
  inProgress: number;
  accepted: number;
  scopus: number;
  q1: number;
}

export interface PipelineRow extends PipelineCounts {
  lecturerId: number;
}

export function computePipelineRow(
  lecturerId: number,
  period: KpiPeriod,
  papers: Paper[]
): PipelineRow {
  let inProgress = 0;
  let accepted = 0;
  let scopus = 0;
  let q1 = 0;
  for (const p of papers) {
    if (!isCreditedTo(p, lecturerId)) continue;
    if (!paperInPeriod(p, period)) continue;
    if (isPendingSubmission(p.submissionStatus)) {
      inProgress += 1;
    } else if (countsAsPublication(p.submissionStatus)) {
      accepted += 1;
      if (isVenueScopus(p.venue)) {
        scopus += 1;
        if (isPaperQ1(p)) q1 += 1;
      }
    }
  }
  return { lecturerId, inProgress, accepted, scopus, q1 };
}

export interface KpiCell {
  indicatorId: number;
  target: number | null;
  actual: number;
  pct: number | null; // null when no target set
}

export interface KpiRow {
  lecturerId: number;
  cells: KpiCell[];
}

function pct(actual: number, target: number | null): number | null {
  if (target == null || target <= 0) return null;
  return Math.round((actual / target) * 100);
}

// One lecturer's row across all indicators.
export function computeKpiRow(
  lecturerId: number,
  period: KpiPeriod,
  indicators: KpiIndicator[],
  targets: KpiTarget[],
  papers: Paper[]
): KpiRow {
  const cells = indicators.map((ind) => {
    const t = targets.find(
      (x) => x.lecturerId === lecturerId && x.indicatorId === ind.id && x.periodId === period.id
    );
    const target = t ? t.targetValue : null;
    const actual = computeActual(lecturerId, period, ind, papers);
    return { indicatorId: ind.id, target, actual, pct: pct(actual, target) };
  });
  return { lecturerId, cells };
}

export interface LecturerRank {
  id: number;
  academicRank: AcademicRank;
}

// PhD headcount: lecturers already holding a doctorate (PGS.TS/TS) plus those
// whose development roadmap is marked completed.
export function computePhdActual(
  lecturers: LecturerRank[],
  phdCompletedIds?: Set<number>
): number {
  return lecturers.filter(
    (l) => l.academicRank === "PGS.TS" || l.academicRank === "TS" || (phdCompletedIds?.has(l.id) ?? false)
  ).length;
}

export interface FacultyRollup {
  indicatorId: number;
  totalActual: number;
  facultyTarget: number | null; // from kpi_faculty_targets (55 / 17 / PhD milestone)
  facultyPct: number | null;    // totalActual / facultyTarget
  avgActualPerHead: number;
  personalTargetSum: number;    // sum of per-person targets (informational)
  withTarget: number;           // lecturers that have a per-person target
  metCount: number;             // lecturers who reached their per-person target
}

// Aggregates per indicator for a scope (whole faculty or one bộ môn). The
// caller passes the scoped lecturer list + the matching faculty target rows.
export function computeFacultyRollup(
  lecturers: LecturerRank[],
  period: KpiPeriod,
  indicators: KpiIndicator[],
  targets: KpiTarget[],
  facultyTargets: { indicatorId: number; targetValue: number }[],
  papers: Paper[],
  phdCompletedIds?: Set<number>
): FacultyRollup[] {
  const headcount = lecturers.length || 1;
  return indicators.map((ind) => {
    const facultyTarget = facultyTargets.find((ft) => ft.indicatorId === ind.id)?.targetValue ?? null;

    let totalActual = 0;
    let personalTargetSum = 0;
    let withTarget = 0;
    let metCount = 0;

    if (ind.agg === "phd_count") {
      totalActual = computePhdActual(lecturers, phdCompletedIds);
    } else {
      for (const l of lecturers) {
        const actual = computeActual(l.id, period, ind, papers);
        totalActual += actual;
        const t = targets.find(
          (x) => x.lecturerId === l.id && x.indicatorId === ind.id && x.periodId === period.id
        );
        if (t && t.targetValue > 0) {
          personalTargetSum += t.targetValue;
          withTarget += 1;
          if (actual >= t.targetValue) metCount += 1;
        }
      }
    }

    return {
      indicatorId: ind.id,
      totalActual: Number(totalActual.toFixed(2)),
      facultyTarget,
      facultyPct: facultyTarget && facultyTarget > 0 ? Math.round((totalActual / facultyTarget) * 100) : null,
      avgActualPerHead: Number((totalActual / headcount).toFixed(2)),
      personalTargetSum: Number(personalTargetSum.toFixed(2)),
      withTarget,
      metCount,
    };
  });
}

// Default academic-year label + bounds for a given start year.
export function academicYearLabel(startYear: number): string {
  return `${startYear}-${startYear + 1}`;
}
