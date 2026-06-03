"use server";

import { readDatabase, type DatabaseSchema } from "@/lib/db";
import { createPaper, updatePaper, deletePaper, isPaperAuthor, updateCreditedLecturer, updatePaperSubmissionStatus, getPaperById, listPaperTitles } from "@/lib/queries/papers";
import { createLecturer, updateLecturer, deleteLecturer } from "@/lib/queries/lecturers";
import { setAlias } from "@/lib/queries/aliases";
import { listVenues, createCustomVenue, updateVenueByCode, deleteVenueByCode } from "@/lib/queries/venues";
import { getCurrentUser, requireManager, canManage } from "@/lib/dal";
import type { Paper, Lecturer, SubmissionStatus } from "@/lib/data";
import type { Venue } from "@/lib/venues";

// Read-only snapshot — public (the home page + lecturer directory are public).
// Rejected ("denied") papers are private: only admins/head and the paper's own
// author may see them. They are dropped here for everyone else so the rejected
// status never reaches a public client (UI hiding alone would still ship it in
// the payload). Other in-progress statuses (submitted/under_review/rebuttal/
// accepted) stay visible.
export async function getDatabase(): Promise<DatabaseSchema> {
  const db = readDatabase();
  const user = await getCurrentUser();
  const canSeeAll = !!user && (canManage(user) || user.role === "head");
  if (canSeeAll) return db;
  const myLecturerId = user?.lecturerId ?? null;
  const papers = db.papers.filter(
    (p) =>
      p.submissionStatus !== "denied" ||
      (myLecturerId != null && p.lecturerIds.includes(myLecturerId))
  );
  return { ...db, papers };
}

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

// Ensure a lecturer remains attached to their own paper.
function withSelf(lecturerIds: number[] | undefined, lecturerId: number): number[] {
  return Array.from(new Set([...(lecturerIds ?? []), lecturerId]));
}

// id+title of every paper, for the add-paper form's fuzzy duplicate-title
// warning. Auth-gated (only signed-in users reach the paper forms).
export async function listPaperTitlesServer(): Promise<{ id: number; title: string }[]> {
  await requireAuth();
  return listPaperTitles();
}

export async function addPaperServer(paper: Paper): Promise<DatabaseSchema> {
  const user = await requireAuth();
  if (user.role === "lecturer") {
    if (!user.lecturerId) throw new Error("Tài khoản chưa liên kết giảng viên.");
    paper = { ...paper, lecturerIds: withSelf(paper.lecturerIds, user.lecturerId) };
  }
  createPaper(paper);
  return readDatabase();
}

export async function updatePaperServer(id: number, updatedPaper: Paper): Promise<DatabaseSchema> {
  const user = await requireAuth();
  if (user.role === "lecturer") {
    if (!user.lecturerId || !isPaperAuthor(id, user.lecturerId)) {
      throw new Error("Bạn chỉ có thể sửa bài báo của mình.");
    }
    // Keep the owner attached so they don't accidentally orphan themselves.
    updatedPaper = { ...updatedPaper, lecturerIds: withSelf(updatedPaper.lecturerIds, user.lecturerId) };
  }
  updatePaper(id, updatedPaper);
  return readDatabase();
}

export async function deletePaperServer(id: number): Promise<DatabaseSchema> {
  const user = await requireAuth();
  if (user.role === "lecturer") {
    if (!user.lecturerId || !isPaperAuthor(id, user.lecturerId)) {
      throw new Error("Bạn chỉ có thể xoá bài báo của mình.");
    }
  }
  deletePaper(id);
  return readDatabase();
}

// Lecturer-record management is manager-only.
export async function addLecturerServer(lecturer: Lecturer): Promise<DatabaseSchema> {
  await requireManager();
  createLecturer(lecturer);
  return readDatabase();
}

export async function updateLecturerServer(id: number, updatedLecturer: Lecturer): Promise<DatabaseSchema> {
  await requireManager();
  updateLecturer(id, updatedLecturer);
  return readDatabase();
}

export async function deleteLecturerServer(id: number): Promise<DatabaseSchema> {
  await requireManager();
  deleteLecturer(id);
  return readDatabase();
}

// Quickly reassign which internal author gets KPI credit for a paper. The new
// lecturer must be an existing internal author of the paper; null clears credit
// (the "needs credit" badge will reappear). Manager or any internal author may
// change it.
export async function updateCreditedAuthorServer(
  paperId: number,
  lecturerId: number | null
): Promise<DatabaseSchema> {
  const user = await requireAuth();
  const paper = getPaperById(paperId);
  if (!paper) throw new Error("Bài báo không tồn tại.");

  if (user.role === "lecturer") {
    if (!user.lecturerId || !paper.lecturerIds.includes(user.lecturerId)) {
      throw new Error("Bạn chỉ có thể chỉnh sửa bài báo của mình.");
    }
  }
  if (lecturerId != null && !paper.lecturerIds.includes(lecturerId)) {
    throw new Error("Giảng viên được chọn không thuộc nhóm tác giả của bài báo.");
  }

  updateCreditedLecturer(paperId, lecturerId);
  return readDatabase();
}

// Quick submission-status change from the list view (manage un-accepted papers
// without opening the full editor). Manager or any internal author of the paper.
export async function updatePaperStatusServer(
  paperId: number,
  status: SubmissionStatus
): Promise<DatabaseSchema> {
  const user = await requireAuth();
  const paper = getPaperById(paperId);
  if (!paper) throw new Error("Bài báo không tồn tại.");
  if (user.role === "lecturer") {
    if (!user.lecturerId || !paper.lecturerIds.includes(user.lecturerId)) {
      throw new Error("Bạn chỉ có thể chỉnh sửa bài báo của mình.");
    }
  }
  updatePaperSubmissionStatus(paperId, status);
  return readDatabase();
}

// Author-alias mapping is used during BibTeX import by any signed-in user.
export async function saveAuthorAliasServer(rawName: string, lecturerId: number): Promise<DatabaseSchema> {
  await requireAuth();
  setAlias(rawName, lecturerId);
  return readDatabase();
}

// Venue catalog — DB-backed. The full list is public (paper forms render it
// for everyone), but mutations require auth so anonymous visitors cannot grow
// the catalog. The picker/admin page replace their local copy with the result.
export async function listVenuesServer(): Promise<Venue[]> {
  return listVenues();
}

export async function addCustomVenueServer(v: Omit<Venue, "id">): Promise<Venue[]> {
  await requireAuth();
  createCustomVenue(v);
  return listVenues();
}

export async function updateVenueServer(
  code: string,
  overrides: Partial<Omit<Venue, "id" | "code">>
): Promise<Venue[]> {
  await requireAuth();
  updateVenueByCode(code, overrides);
  return listVenues();
}

export async function deleteVenueServer(code: string): Promise<Venue[]> {
  await requireManager();
  deleteVenueByCode(code);
  return listVenues();
}
