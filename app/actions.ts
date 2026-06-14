"use server";

import { revalidatePath } from "next/cache";
import { readDatabase, type DatabaseSchema } from "@/lib/db";
import { createPaper, updatePaper, deletePaper, isPaperAuthor, updateCreditedLecturer, updatePaperSubmissionStatus, getPaperById, listPaperTitles } from "@/lib/queries/papers";
import { createLecturer, updateLecturer, deleteLecturer, setLecturerKpiExcluded } from "@/lib/queries/lecturers";
import { setAlias } from "@/lib/queries/aliases";
import { listVenues, createCustomVenue, updateVenueByCode, deleteVenueByCode, ensureVenuesHydrated } from "@/lib/queries/venues";
import { getCurrentUser, requireManager, canManage } from "@/lib/dal";
import { logAction } from "@/lib/logger";
import { countsAsPublication } from "@/lib/data";
import type { Paper, Lecturer, SubmissionStatus } from "@/lib/data";
import type { Venue } from "@/lib/venues";

// Read-only snapshot — public (the home page + lecturer directory are public).
// Only ACCEPTED/PUBLISHED papers are public. In-progress submissions
// (submitted/under_review/rebuttal) and rejected (denied) papers are private:
// visible only to admins/head and the paper's own author. They are dropped here
// for everyone else so an un-accepted paper never reaches a public client (UI
// hiding alone would still ship it in the payload).
export async function getDatabase(): Promise<DatabaseSchema> {
  const db = readDatabase();
  const user = await getCurrentUser();
  const canSeeAll = !!user && (canManage(user) || user.role === "head");
  if (canSeeAll) return db;
  const myLecturerId = user?.lecturerId ?? null;
  const papers = db.papers.filter(
    (p) =>
      countsAsPublication(p.submissionStatus) ||
      (myLecturerId != null && p.lecturerIds.includes(myLecturerId))
  );
  return { ...db, papers };
}

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

// Minimal session info for the public navbar so it can show a "Trang của tôi"
// shortcut (routed by role) instead of the login button when signed in.
export async function getNavSession(): Promise<{ role: string; lecturerId: number | null } | null> {
  const u = await getCurrentUser();
  return u ? { role: u.role, lecturerId: u.lecturerId } : null;
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
  await logAction("paper.create", { paperId: paper.id, title: paper.title, venue: paper.venue, year: paper.year });
  // Paper data feeds KPI actuals, the dashboard and lecturer/faculty profiles —
  // all separate routes. Purge the cache so "Thực đạt" and every derived stat
  // refresh on the next visit instead of serving a stale render.
  revalidatePath("/", "layout");
  return readDatabase();
}

// Bulk insert — used by the Google Scholar importer after the user has reviewed
// the scanned drafts. One transaction's worth of inserts + a single cache purge
// (vs. one revalidate per paper) so a 50-paper import doesn't thrash the cache.
export async function addPapersBulkServer(papers: Paper[]): Promise<DatabaseSchema> {
  const user = await requireAuth();
  for (const paper of papers) {
    const p =
      user.role === "lecturer"
        ? (() => {
            if (!user.lecturerId) throw new Error("Tài khoản chưa liên kết giảng viên.");
            return { ...paper, lecturerIds: withSelf(paper.lecturerIds, user.lecturerId) };
          })()
        : paper;
    createPaper(p);
  }
  await logAction("paper.bulk_create", { count: papers.length });
  revalidatePath("/", "layout");
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
  await logAction("paper.update", { paperId: id, title: updatedPaper.title, status: updatedPaper.submissionStatus });
  revalidatePath("/", "layout");
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
  await logAction("paper.delete", { paperId: id });
  revalidatePath("/", "layout");
  return readDatabase();
}

// Lecturer-record management is manager-only.
export async function addLecturerServer(lecturer: Lecturer): Promise<DatabaseSchema> {
  await requireManager();
  createLecturer(lecturer);
  await logAction("lecturer.create", { lecturerId: lecturer.id, name: lecturer.name });
  return readDatabase();
}

export async function updateLecturerServer(id: number, updatedLecturer: Lecturer): Promise<DatabaseSchema> {
  await requireManager();
  updateLecturer(id, updatedLecturer);
  await logAction("lecturer.update", { lecturerId: id, name: updatedLecturer.name });
  return readDatabase();
}

export async function deleteLecturerServer(id: number): Promise<DatabaseSchema> {
  await requireManager();
  deleteLecturer(id);
  await logAction("lecturer.delete", { lecturerId: id });
  return readDatabase();
}

// Toggle whether a lecturer is excluded from every aggregate statistic. They stay
// fully visible; only the KPI/dashboard/report totals stop counting them.
export async function setLecturerKpiExcludedServer(id: number, excluded: boolean): Promise<DatabaseSchema> {
  await requireManager();
  setLecturerKpiExcluded(id, excluded);
  await logAction("lecturer.kpi_excluded", { lecturerId: id, excluded });
  // KPI/dashboard/report routes all derive from this.
  revalidatePath("/", "layout");
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
  await logAction("paper.credit", { paperId, creditedLecturerId: lecturerId });
  revalidatePath("/", "layout");
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
  await logAction("paper.status", { paperId, status });
  revalidatePath("/", "layout");
  return readDatabase();
}

// Author-alias mapping is used during BibTeX import by any signed-in user.
export async function saveAuthorAliasServer(rawName: string, lecturerId: number): Promise<DatabaseSchema> {
  await requireAuth();
  setAlias(rawName, lecturerId);
  await logAction("alias.set", { rawName, lecturerId });
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
  await logAction("venue.create", { code: v.code, nameEn: v.nameEn });
  // Refresh the server venue cache + derived stats: a venue's Scopus/rank flags
  // feed the KPI, so a new or changed venue can shift "Thực đạt" everywhere.
  ensureVenuesHydrated(true);
  revalidatePath("/", "layout");
  return listVenues();
}

export async function updateVenueServer(
  code: string,
  overrides: Partial<Omit<Venue, "id" | "code">>
): Promise<Venue[]> {
  await requireAuth();
  updateVenueByCode(code, overrides);
  await logAction("venue.update", { code, overrides });
  ensureVenuesHydrated(true);
  revalidatePath("/", "layout");
  return listVenues();
}

export async function deleteVenueServer(code: string): Promise<Venue[]> {
  await requireManager();
  deleteVenueByCode(code);
  await logAction("venue.delete", { code });
  ensureVenuesHydrated(true);
  revalidatePath("/", "layout");
  return listVenues();
}
