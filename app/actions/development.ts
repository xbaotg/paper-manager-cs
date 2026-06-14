"use server";

import { revalidatePath } from "next/cache";
import { requireManager, requireLecturer, requireHead } from "@/lib/dal";
import { listLecturers } from "@/lib/queries/lecturers";
import {
  listDevelopment,
  listDevelopmentByBoMon,
  getDevelopmentByLecturer,
  upsertDevelopment,
  deleteDevelopment,
  getMentorLoad,
  listProgress,
  upsertProgress,
  deleteProgress,
  type DevelopmentItem,
  type DevelopmentProgress,
  type DevelopmentStatus,
} from "@/lib/queries/development";
import { computePhdActual, type LecturerRank } from "@/lib/kpi";
import { PHD_MILESTONES } from "@/lib/kpi-policy";
import { logAction } from "@/lib/logger";
import type { AcademicRank } from "@/lib/data";

export interface DevLecturer {
  id: number;
  name: string;
  title: string;
  academicRank: AcademicRank;
  boMonId: number | null;
}

export interface MentorLoad {
  mentorId: number;
  mentorName: string;
  menteeCount: number;
}

export interface DevelopmentSnapshot {
  items: DevelopmentItem[];
  lecturers: DevLecturer[];      // mentee candidates (whole scope)
  mentors: MentorLoad[];         // PGS.TS/TS with their mentee counts (flags 0)
  phdActual: number;
  milestones: { year: number; target: number }[];
}

const MILESTONES = Object.entries(PHD_MILESTONES)
  .map(([year, target]) => ({ year: Number(year), target }))
  .sort((a, b) => a.year - b.year);

function buildSnapshot(boMonId?: number): DevelopmentSnapshot {
  const allLecturers = listLecturers();
  const scoped = boMonId == null ? allLecturers : allLecturers.filter((l) => l.boMonId === boMonId);

  const lecturers: DevLecturer[] = scoped.map((l) => ({
    id: l.id,
    name: l.name,
    title: l.title,
    academicRank: (l.academicRank ?? "ThS") as AcademicRank,
    boMonId: l.boMonId ?? null,
  }));

  const items = boMonId == null ? listDevelopment() : listDevelopmentByBoMon(boMonId);

  const load = getMentorLoad();
  const mentors: MentorLoad[] = scoped
    .filter((l) => l.academicRank === "PGS.TS" || l.academicRank === "TS")
    .map((l) => ({ mentorId: l.id, mentorName: l.name, menteeCount: load.get(l.id) ?? 0 }));

  // PhD headcount is faculty-wide regardless of scope (the milestone is a Khoa total).
  const ranks: LecturerRank[] = allLecturers.map((l) => ({
    id: l.id,
    academicRank: (l.academicRank ?? "ThS") as AcademicRank,
  }));
  const completed = new Set(items.filter((i) => i.status === "completed").map((i) => i.lecturerId));
  const phdActual = computePhdActual(ranks, completed);

  return { items, lecturers, mentors, phdActual, milestones: MILESTONES };
}

export async function getDevelopmentSnapshot(): Promise<DevelopmentSnapshot> {
  await requireManager();
  return buildSnapshot();
}

// Head (Trưởng bộ môn): scoped, read-only snapshot of their bộ môn.
export async function getHeadDevelopment(): Promise<DevelopmentSnapshot> {
  const me = await requireHead();
  return buildSnapshot(me.boMonId!);
}

export interface DevResult {
  ok: boolean;
  error?: string;
  data?: DevelopmentSnapshot;
}

export async function upsertDevelopmentAction(input: {
  lecturerId: number;
  currentDegree: string;
  targetDegree: string;
  expectedYear: number | null;
  mentorId: number | null;
  status: DevelopmentStatus;
  notes: string | null;
}): Promise<DevResult> {
  await requireManager();
  if (!input.lecturerId) return { ok: false, error: "Chọn giảng viên." };
  if (!["NCS", "ThS", "CN"].includes(input.currentDegree)) {
    return { ok: false, error: "Trình độ hiện tại không hợp lệ." };
  }
  upsertDevelopment(input);
  await logAction("development.upsert", { lecturerId: input.lecturerId });
  revalidatePath("/admin/development");
  return { ok: true, data: buildSnapshot() };
}

export async function deleteDevelopmentAction(id: number): Promise<DevResult> {
  await requireManager();
  deleteDevelopment(id);
  await logAction("development.delete", { id });
  revalidatePath("/admin/development");
  return { ok: true, data: buildSnapshot() };
}

export async function getProgressAction(developmentId: number): Promise<DevelopmentProgress[]> {
  await requireManager();
  return listProgress(developmentId);
}

export async function upsertProgressAction(input: {
  developmentId: number;
  year: number;
  quarter: number;
  note: string;
  status: string | null;
}): Promise<{ ok: boolean; error?: string; data?: DevelopmentProgress[] }> {
  const me = await requireManager();
  if (input.quarter < 1 || input.quarter > 4) return { ok: false, error: "Quý phải từ 1 đến 4." };
  if (!Number.isInteger(input.year)) return { ok: false, error: "Năm không hợp lệ." };
  upsertProgress({ ...input, recordedBy: me.id });
  await logAction("development.progress_upsert", { developmentId: input.developmentId });
  return { ok: true, data: listProgress(input.developmentId) };
}

export async function deleteProgressAction(
  id: number,
  developmentId: number
): Promise<{ ok: boolean; data?: DevelopmentProgress[] }> {
  await requireManager();
  deleteProgress(id);
  await logAction("development.progress_delete", { id });
  return { ok: true, data: listProgress(developmentId) };
}

// ---- Lecturer self-view ----
export interface MyDevelopment {
  item: DevelopmentItem | null;
  progress: DevelopmentProgress[];
}

export async function getMyDevelopment(): Promise<MyDevelopment> {
  const me = await requireLecturer();
  if (!me.lecturerId) return { item: null, progress: [] };
  const item = getDevelopmentByLecturer(me.lecturerId);
  return { item, progress: item ? listProgress(item.id) : [] };
}
