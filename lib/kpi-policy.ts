// Department KPI policy constants, taken from the Khoa KHMT action plan
// 2026-2030. Centralized so the targets the UI seeds/displays stay in one place.
import type { AcademicRank } from "./data";

// Per-person annual Scopus publication target by academic rank.
export const RANK_PUBLICATION_TARGET: Record<AcademicRank, number> = {
  "PGS.TS": 4,
  TS: 3,
  NCS: 3,
  ThS: 2,
  CN: 2,
};

// Faculty-wide annual targets.
export const FACULTY_SCOPUS_TARGET = 55; // ≥55 Scopus papers/year
export const FACULTY_Q1_TARGET = 17; // ≥30% Q1 → ≥17 Q1/year

// Faculty PhD-headcount milestones by calendar year (internal development).
export const PHD_MILESTONES: Record<number, number> = {
  2027: 12,
  2028: 15,
  2029: 18,
  2030: 20,
};

// Indicator codes used by the faculty-target panel / per-rank seeding.
export const INDICATOR_CODE = {
  scopus: "scopus_paper_count",
  q1: "q1_count",
  phd: "phd_count",
  paperCount: "paper_count",
  paperPoints: "paper_points",
} as const;

// Suggested faculty target for an indicator code, used to pre-fill the panel.
export function suggestedFacultyTarget(code: string, startYear: number): number | null {
  if (code === INDICATOR_CODE.scopus) return FACULTY_SCOPUS_TARGET;
  if (code === INDICATOR_CODE.q1) return FACULTY_Q1_TARGET;
  if (code === INDICATOR_CODE.phd) return PHD_MILESTONES[startYear] ?? null;
  return null;
}
