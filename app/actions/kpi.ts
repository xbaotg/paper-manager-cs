"use server";

import { revalidatePath } from "next/cache";
import { requireManager, requireLecturer, requireHead } from "@/lib/dal";
import { getBoMonById } from "@/lib/queries/bo_mon";
import {
  listPeriods,
  getPeriodById,
  createPeriod,
  deletePeriod,
  listIndicators,
  listTargetsForPeriod,
  listTargetsForLecturer,
  upsertTarget,
  listFacultyTargets,
  upsertFacultyTarget,
  type FacultyTarget,
} from "@/lib/queries/kpi";
import { listPapers, listPapersNeedingCredit } from "@/lib/queries/papers";
import { ensureVenuesHydrated } from "@/lib/queries/venues";
import { listLecturers } from "@/lib/queries/lecturers";
import { listDevelopmentCompletedIds } from "@/lib/queries/development";
import { RANK_PUBLICATION_TARGET, INDICATOR_CODE } from "@/lib/kpi-policy";
import {
  academicYearLabel,
  computeKpiRow,
  computeFacultyRollup,
  computePipelineRow,
  type KpiPeriod,
  type KpiIndicator,
  type KpiTarget,
  type KpiRow,
  type KpiCell,
  type FacultyRollup,
  type LecturerRank,
  type PipelineRow,
} from "@/lib/kpi";
import type { AcademicRank } from "@/lib/data";

export interface LecturerLite {
  id: number;
  name: string;
  title: string;
  academicRank: AcademicRank;
  boMonId: number | null;
}

export interface ManagerKpiData {
  periods: KpiPeriod[];
  indicators: KpiIndicator[];
  lecturers: LecturerLite[];
  selectedPeriodId: number | null;
  targets: KpiTarget[];
  facultyTargets: FacultyTarget[];
  rows: KpiRow[];
  rollup: FacultyRollup[];
  pipeline: PipelineRow[];
  needsCreditCount: number;
}

function resolvePeriod(periodId?: number): { periods: KpiPeriod[]; selected: KpiPeriod | null } {
  const periods = listPeriods();
  let selected: KpiPeriod | null = null;
  if (periodId) selected = periods.find((p) => p.id === periodId) ?? null;
  if (!selected) selected = periods.find((p) => p.isActive) ?? periods[0] ?? null;
  return { periods, selected };
}

function toLecturerLite(l: ReturnType<typeof listLecturers>[number]): LecturerLite {
  return {
    id: l.id,
    name: l.name,
    title: l.title,
    academicRank: (l.academicRank ?? "ThS") as AcademicRank,
    boMonId: l.boMonId ?? null,
  };
}

// Faculty-scope targets (sentinel bo_mon_id = 0) reshaped for computeFacultyRollup.
function facultyScopeTargets(all: FacultyTarget[], boMonId: number) {
  return all
    .filter((t) => t.boMonId === boMonId)
    .map((t) => ({ indicatorId: t.indicatorId, targetValue: t.targetValue }));
}

export async function getManagerKpi(periodId?: number): Promise<ManagerKpiData> {
  await requireManager();
  ensureVenuesHydrated();
  const { periods, selected } = resolvePeriod(periodId);
  const indicators = listIndicators();
  const lecturers = listLecturers().map(toLecturerLite);

  if (!selected) {
    return {
      periods, indicators, lecturers, selectedPeriodId: null,
      targets: [], facultyTargets: [], rows: [], rollup: [], pipeline: [],
      needsCreditCount: listPapersNeedingCredit().length,
    };
  }

  const papers = listPapers();
  const targets = listTargetsForPeriod(selected.id);
  const facultyTargets = listFacultyTargets(selected.id);
  const phdCompleted = new Set(listDevelopmentCompletedIds());

  const ranks: LecturerRank[] = lecturers.map((l) => ({ id: l.id, academicRank: l.academicRank }));
  const rows: KpiRow[] = lecturers.map((l) =>
    computeKpiRow(l.id, selected, indicators, targets, papers)
  );
  const pipeline: PipelineRow[] = lecturers.map((l) =>
    computePipelineRow(l.id, selected, papers)
  );
  const rollup = computeFacultyRollup(
    ranks,
    selected,
    indicators,
    targets,
    facultyScopeTargets(facultyTargets, 0),
    papers,
    phdCompleted
  );

  return {
    periods, indicators, lecturers, selectedPeriodId: selected.id,
    targets, facultyTargets, rows, rollup, pipeline,
    needsCreditCount: listPapersNeedingCredit().length,
  };
}

export async function createPeriodAction(
  startYear: number
): Promise<{ ok: boolean; error?: string; data?: ManagerKpiData }> {
  await requireManager();
  if (!Number.isInteger(startYear) || startYear < 2000 || startYear > 2100) {
    return { ok: false, error: "Năm bắt đầu không hợp lệ." };
  }
  const label = academicYearLabel(startYear);
  if (listPeriods().some((p) => p.label === label)) {
    return { ok: false, error: "Kỳ KPI đã tồn tại." };
  }
  const id = createPeriod(label, startYear, startYear + 1);
  revalidatePath("/admin/kpi");
  return { ok: true, data: await getManagerKpi(id) };
}

export async function deletePeriodAction(
  periodId: number
): Promise<{ ok: boolean; data?: ManagerKpiData }> {
  await requireManager();
  deletePeriod(periodId);
  revalidatePath("/admin/kpi");
  return { ok: true, data: await getManagerKpi() };
}

export async function upsertTargetAction(
  periodId: number,
  indicatorId: number,
  lecturerId: number,
  value: number
): Promise<{ ok: boolean; error?: string; data?: ManagerKpiData }> {
  const me = await requireManager();
  if (!getPeriodById(periodId)) return { ok: false, error: "Kỳ KPI không tồn tại." };
  if (value < 0 || !Number.isFinite(value)) return { ok: false, error: "Giá trị không hợp lệ." };
  upsertTarget(periodId, indicatorId, lecturerId, value, me.id);
  revalidatePath("/admin/kpi");
  return { ok: true, data: await getManagerKpi(periodId) };
}

// Faculty- (bo_mon_id = 0) or bộ-môn-level target.
export async function upsertFacultyTargetAction(
  periodId: number,
  indicatorId: number,
  boMonId: number,
  value: number
): Promise<{ ok: boolean; error?: string; data?: ManagerKpiData }> {
  const me = await requireManager();
  if (!getPeriodById(periodId)) return { ok: false, error: "Kỳ KPI không tồn tại." };
  if (value < 0 || !Number.isFinite(value)) return { ok: false, error: "Giá trị không hợp lệ." };
  upsertFacultyTarget(periodId, indicatorId, boMonId, value, me.id);
  revalidatePath("/admin/kpi");
  return { ok: true, data: await getManagerKpi(periodId) };
}

// Apply the per-rank publication targets (PGS.TS=4, TS=3, NCS=3, ThS=2, CN=2)
// to every lecturer for the Scopus indicator in this period.
export async function seedRankTargetsAction(
  periodId: number
): Promise<{ ok: boolean; error?: string; data?: ManagerKpiData }> {
  const me = await requireManager();
  if (!getPeriodById(periodId)) return { ok: false, error: "Kỳ KPI không tồn tại." };
  const scopus = listIndicators().find((i) => i.code === INDICATOR_CODE.scopus);
  if (!scopus) return { ok: false, error: "Chưa có chỉ tiêu 'Số bài Scopus'." };

  for (const l of listLecturers()) {
    const rank = (l.academicRank ?? "ThS") as AcademicRank;
    const target = RANK_PUBLICATION_TARGET[rank] ?? 0;
    if (target > 0) upsertTarget(periodId, scopus.id, l.id, target, me.id);
  }
  revalidatePath("/admin/kpi");
  return { ok: true, data: await getManagerKpi(periodId) };
}

// Resolve a period by its calendar startYear (dashboard year tabs key on year).
export async function getKpiByYear(year: number): Promise<ManagerKpiData> {
  await requireManager();
  const period = listPeriods().find((p) => p.startYear === year);
  return getManagerKpi(period?.id);
}

// ---- Head (Trưởng bộ môn) scoped, read-only view ----

export interface HeadKpiData {
  boMonName: string;
  periods: KpiPeriod[];
  indicators: KpiIndicator[];
  lecturers: LecturerLite[];
  selectedPeriodId: number | null;
  targets: KpiTarget[];
  facultyTargets: FacultyTarget[];
  rows: KpiRow[];
  rollup: FacultyRollup[];
}

export async function getHeadKpi(periodId?: number): Promise<HeadKpiData> {
  const me = await requireHead();
  ensureVenuesHydrated();
  const boMonId = me.boMonId!;
  const bm = getBoMonById(boMonId);
  const { periods, selected } = resolvePeriod(periodId);
  const indicators = listIndicators();
  const lecturers = listLecturers()
    .filter((l) => (l.boMonId ?? null) === boMonId)
    .map(toLecturerLite);

  if (!selected) {
    return {
      boMonName: bm?.nameVi ?? "Bộ môn", periods, indicators, lecturers,
      selectedPeriodId: null, targets: [], facultyTargets: [], rows: [], rollup: [],
    };
  }

  const papers = listPapers();
  const targets = listTargetsForPeriod(selected.id);
  const facultyTargets = listFacultyTargets(selected.id);
  const phdCompleted = new Set(listDevelopmentCompletedIds());
  const ranks: LecturerRank[] = lecturers.map((l) => ({ id: l.id, academicRank: l.academicRank }));
  const rows = lecturers.map((l) => computeKpiRow(l.id, selected, indicators, targets, papers));
  const rollup = computeFacultyRollup(
    ranks, selected, indicators, targets, facultyScopeTargets(facultyTargets, boMonId), papers, phdCompleted
  );

  return {
    boMonName: bm?.nameVi ?? "Bộ môn", periods, indicators, lecturers,
    selectedPeriodId: selected.id, targets, facultyTargets, rows, rollup,
  };
}

// ---- Lecturer (GV) self view ----

export interface MyKpiData {
  periods: KpiPeriod[];
  indicators: KpiIndicator[];
  selectedPeriodId: number | null;
  cells: KpiCell[];
}

export async function getMyKpi(periodId?: number): Promise<MyKpiData> {
  const me = await requireLecturer();
  ensureVenuesHydrated();
  const { periods, selected } = resolvePeriod(periodId);
  // PhD headcount is a faculty metric, not a personal one — hide it here.
  const indicators = listIndicators().filter((i) => i.agg !== "phd_count");
  if (!selected || !me.lecturerId) {
    return { periods, indicators, selectedPeriodId: selected?.id ?? null, cells: [] };
  }
  const papers = listPapers();
  const targets = listTargetsForLecturer(selected.id, me.lecturerId);
  const row = computeKpiRow(me.lecturerId, selected, indicators, targets, papers);
  return { periods, indicators, selectedPeriodId: selected.id, cells: row.cells };
}
