"use server";

import { requireLecturer } from "@/lib/dal";
import { getLlkh, saveLlkh } from "@/lib/queries/llkh";
import { getPapersByLecturer } from "@/lib/queries/papers";
import { getLecturerById } from "@/lib/queries/lecturers";
import { normalizeLlkh, type LlkhProfile } from "@/lib/llkh";
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
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không lưu được." };
  }
}
