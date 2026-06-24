"use server";

import { requireLecturer, requireManager } from "@/lib/dal";
import {
  getLlkh,
  saveLlkh,
  listAllProjects,
  listAllSupervision,
  type LlkhProjectRow,
  type LlkhSupervisionRow,
} from "@/lib/queries/llkh";
import { getPapersByLecturer } from "@/lib/queries/papers";
import { getLecturerById } from "@/lib/queries/lecturers";
import { normalizeLlkh, type LlkhProfile } from "@/lib/llkh";
import { logAction } from "@/lib/logger";
import type { Paper } from "@/lib/data";

export interface MyLlkhData {
  profile: LlkhProfile;
  lecturerName: string;
  lecturerTitle: string;
  papers: Paper[];
}

// Load the signed-in lecturer's LLKH profile + their papers (for the auto
// publication list in the export).
export async function getMyLlkh(): Promise<MyLlkhData> {
  const user = await requireLecturer();
  const lecturerId = user.lecturerId!;
  const me = getLecturerById(lecturerId);
  return {
    profile: getLlkh(lecturerId),
    lecturerName: me?.name ?? user.username,
    lecturerTitle: me?.title ?? "",
    papers: getPapersByLecturer(lecturerId),
  };
}

export interface SaveLlkhResult {
  ok: boolean;
  error?: string;
}

// Persist the signed-in lecturer's LLKH profile.
export async function saveMyLlkh(profile: LlkhProfile): Promise<SaveLlkhResult> {
  const user = await requireLecturer();
  try {
    saveLlkh(user.lecturerId!, normalizeLlkh(profile));
    await logAction("llkh.save_self", { lecturerId: user.lecturerId });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không lưu được." };
  }
}

// Manager-only: load any lecturer's LLKH profile + papers (admin export/edit).
export async function getLlkhForLecturer(lecturerId: number): Promise<MyLlkhData> {
  await requireManager();
  const lec = getLecturerById(lecturerId);
  if (!lec) throw new Error("Không tìm thấy giảng viên.");
  return {
    profile: getLlkh(lecturerId),
    lecturerName: lec.name,
    lecturerTitle: lec.title ?? "",
    papers: getPapersByLecturer(lecturerId),
  };
}

export interface LlkhAggregate {
  projects: LlkhProjectRow[];
  supervision: LlkhSupervisionRow[];
}

// Manager-only: every lecturer's research projects + student supervision, for the
// admin aggregate/report surface. Read-only — edits go through the per-lecturer
// LLKH wizard (the single writer), which each row deep-links to.
export async function getLlkhAggregate(): Promise<LlkhAggregate> {
  await requireManager();
  return { projects: listAllProjects(), supervision: listAllSupervision() };
}

// Manager-only: persist any lecturer's LLKH profile (admin edit before export).
export async function saveLlkhForLecturer(
  lecturerId: number,
  profile: LlkhProfile
): Promise<SaveLlkhResult> {
  await requireManager();
  try {
    if (!getLecturerById(lecturerId)) return { ok: false, error: "Không tìm thấy giảng viên." };
    saveLlkh(lecturerId, normalizeLlkh(profile));
    await logAction("llkh.save_for_lecturer", { lecturerId });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không lưu được." };
  }
}
