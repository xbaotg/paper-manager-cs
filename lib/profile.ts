import "server-only";
import type { Lecturer, Paper, AcademicRank } from "./data";
import type { Role } from "./session";
import {
  computeKpiRow,
  isCreditedTo,
  isPaperQ1,
  type KpiPeriod,
  type KpiIndicator,
  type KpiCell,
} from "./kpi";
import { getVenueRankBucket } from "./venues";
import { getLecturerById } from "./queries/lecturers";
import { getPapersByLecturer, listPapers } from "./queries/papers";
import { getBoMonById } from "./queries/bo_mon";
import { getUserByLecturerId } from "./queries/users";
import {
  listPeriods,
  listIndicators,
  listTargetsForLecturer,
} from "./queries/kpi";
import { getDevelopmentByLecturer, listProgress, type DevelopmentItem, type DevelopmentProgress } from "./queries/development";

export interface ProfilePaper extends Paper {
  credited: boolean; // credited to THIS lecturer (single-credit)
}

export interface ProfileKpiRow {
  period: KpiPeriod;
  cells: KpiCell[];
}

export interface LecturerProfile {
  lecturer: Lecturer;
  academicRank: AcademicRank;
  boMonName: string | null;
  account: { username: string; role: Role; isActive: boolean } | null;
  papers: ProfilePaper[];
  stats: {
    total: number;
    scopusIndexed: number;
    q1: number;
    byYear: Record<number, number>;
    rankBuckets: Record<string, number>;
  };
  indicators: KpiIndicator[];
  kpiByPeriod: ProfileKpiRow[];
  development: DevelopmentItem | null;
  progress: DevelopmentProgress[];
}

// Aggregate everything known about one lecturer for the profile page.
export function buildLecturerProfile(id: number): LecturerProfile | null {
  const lecturer = getLecturerById(id);
  if (!lecturer) return null;

  const academicRank = (lecturer.academicRank ?? "ThS") as AcademicRank;
  const boMonName = lecturer.boMonId != null ? getBoMonById(lecturer.boMonId)?.nameVi ?? null : null;

  const u = getUserByLecturerId(id);
  const account = u ? { username: u.username, role: u.role, isActive: !!u.is_active } : null;

  const own = getPapersByLecturer(id);
  const papers: ProfilePaper[] = own.map((p) => ({ ...p, credited: isCreditedTo(p, id) }));

  // Stats
  const byYear: Record<number, number> = {};
  const rankBuckets: Record<string, number> = {};
  let scopusIndexed = 0;
  let q1 = 0;
  for (const p of own) {
    byYear[p.year] = (byYear[p.year] || 0) + 1;
    const bucket = p.venue ? getVenueRankBucket(p.venue) : "Chưa phân loại";
    rankBuckets[bucket] = (rankBuckets[bucket] || 0) + 1;
    if (p.scopusIndexStatus === "indexed") {
      scopusIndexed += 1;
      if (isPaperQ1(p)) q1 += 1;
    }
  }

  // KPI per period (uses the global paper set for correct single-credit attribution).
  const allPapers = listPapers();
  const periods = listPeriods();
  const indicators = listIndicators();
  const kpiByPeriod: ProfileKpiRow[] = periods.map((period) => {
    const targets = listTargetsForLecturer(period.id, id);
    const row = computeKpiRow(id, period, indicators, targets, allPapers);
    return { period, cells: row.cells };
  });

  const development = getDevelopmentByLecturer(id);
  const progress = development ? listProgress(development.id) : [];

  return {
    lecturer,
    academicRank,
    boMonName,
    account,
    papers,
    stats: { total: own.length, scopusIndexed, q1, byYear, rankBuckets },
    indicators,
    kpiByPeriod,
    development,
    progress,
  };
}
