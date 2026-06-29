"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/dal";
import { logAction } from "@/lib/logger";
import { createPaper } from "@/lib/queries/papers";
import {
  createSubmission,
  getSubmissionByToken,
  getSubmissionById,
  listSubmissions,
  countPendingSubmissions,
  updateSubmissionByToken,
  setSubmissionStatus,
  getOrCreateStudentPoolLecturerId,
} from "@/lib/queries/submissions";
import type { PaperSubmission, Paper, StudentSubmissionInput, SubmissionReviewStatus } from "@/lib/data";

const LIMIT = { title: 300, name: 200, venue: 200, link: 500, abstract: 5000, email: 200, authors: 50 };

// Validate + sanitize the public form payload. This is an UNAUTHENTICATED trust
// boundary (the action is reachable by direct POST, not just our UI), so every
// field is checked and capped here — never trust the client. Throws on the first
// problem; the message is shown to the student. The honeypot + the admin-approval
// gate are the only spam controls.
// ponytail: no captcha / rate-limit yet — a pending submission is invisible
// (not public, not counted) until a manager approves, so spam stays contained.
// Add a rate limit or captcha here when the queue actually gets abused.
function clean(input: StudentSubmissionInput) {
  if ((input.website ?? "").trim()) throw new Error("Gửi không hợp lệ."); // honeypot tripped

  const title = (input.title ?? "").trim();
  if (!title) throw new Error("Vui lòng nhập tên bài báo.");
  if (title.length > LIMIT.title) throw new Error("Tên bài báo quá dài.");

  const year = Number(input.year);
  const maxYear = new Date().getFullYear() + 1;
  if (!Number.isInteger(year) || year < 1990 || year > maxYear) throw new Error("Năm công bố không hợp lệ.");

  const authorNames = (input.authors ?? []).map((a) => (a ?? "").trim()).filter(Boolean);
  if (authorNames.length === 0) throw new Error("Vui lòng nhập ít nhất một tác giả.");
  if (authorNames.length > LIMIT.authors) throw new Error("Quá nhiều tác giả.");
  if (authorNames.some((a) => a.length > LIMIT.name)) throw new Error("Tên tác giả quá dài.");

  const submitterName = (input.submitterName ?? "").trim();
  if (!submitterName) throw new Error("Vui lòng nhập tên người gửi.");
  if (submitterName.length > LIMIT.name) throw new Error("Tên người gửi quá dài.");

  const submitterEmail = (input.submitterEmail ?? "").trim();
  if (submitterEmail.length > LIMIT.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(submitterEmail)) {
    throw new Error("Email không hợp lệ.");
  }

  const venue = (input.venue ?? "").trim().slice(0, LIMIT.venue);
  const doi = (input.doi ?? "").trim().slice(0, LIMIT.link) || undefined;
  const url = (input.url ?? "").trim().slice(0, LIMIT.link) || undefined;
  const abstract = (input.abstract ?? "").trim().slice(0, LIMIT.abstract) || undefined;
  // The student reports a real publication; the journal stage is fixed to
  // "published" and a manager can adjust it after approval via the paper editor.
  const submissionStatus = input.submissionStatus ?? "published";

  return { title, year, venue, authors: authorNames.join(", "), doi, url, abstract, submissionStatus, submitterName, submitterEmail };
}

// ---- Public (no auth): the token is the only key the student holds. ----------

export async function submitStudentPaperServer(input: StudentSubmissionInput): Promise<{ token: string }> {
  const v = clean(input);
  const token = crypto.randomUUID();
  createSubmission({ token, ...v });
  await logAction("submission.create", { token, title: v.title, by: v.submitterEmail });
  return { token };
}

export async function getSubmissionByTokenServer(token: string): Promise<PaperSubmission | null> {
  if (!token) return null;
  return getSubmissionByToken(token);
}

export async function updateStudentPaperServer(
  token: string,
  input: StudentSubmissionInput
): Promise<{ ok: boolean }> {
  const existing = getSubmissionByToken(token);
  if (!existing) throw new Error("Không tìm thấy bài nộp.");
  if (existing.status !== "pending") throw new Error("Bài đã được xử lý, không thể chỉnh sửa.");
  const v = clean(input);
  const ok = updateSubmissionByToken(token, v);
  if (!ok) throw new Error("Không thể cập nhật (bài có thể vừa được duyệt).");
  await logAction("submission.update", { token });
  return { ok };
}

// ---- Admin (manager only). ---------------------------------------------------

export async function listSubmissionsServer(status?: SubmissionReviewStatus): Promise<PaperSubmission[]> {
  await requireManager();
  return listSubmissions(status);
}

export async function countPendingSubmissionsServer(): Promise<number> {
  await requireManager();
  return countPendingSubmissions();
}

export async function approveSubmissionServer(id: number): Promise<{ ok: boolean; paperId: number }> {
  await requireManager();
  const sub = getSubmissionById(id);
  if (!sub) throw new Error("Không tìm thấy bài nộp.");
  if (sub.status !== "pending") throw new Error("Bài nộp đã được xử lý.");

  // Credit the faculty "student pool" so the KPI still rolls up to the Khoa even
  // though no real lecturer is on the byline. Authors stay as external names.
  const poolId = getOrCreateStudentPoolLecturerId();
  const authorLinks = sub.authors
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
    .map((name) => ({ name, lecturerId: null as number | null }));

  const paper: Paper = {
    id: Date.now(),
    title: sub.title,
    year: sub.year,
    venue: sub.venue,
    authors: sub.authors,
    authorLinks,
    lecturerIds: [poolId],
    creditedLecturerId: poolId,
    submissionStatus: sub.submissionStatus,
    ...(sub.doi ? { doi: sub.doi } : {}),
    ...(sub.url ? { url: sub.url } : {}),
    ...(sub.abstract ? { abstract: sub.abstract } : {}),
  };
  createPaper(paper);
  setSubmissionStatus(id, "approved", { paperId: paper.id });
  await logAction("submission.approve", { id, paperId: paper.id });
  revalidatePath("/", "layout");
  return { ok: true, paperId: paper.id };
}

export async function rejectSubmissionServer(id: number, note: string): Promise<{ ok: boolean }> {
  await requireManager();
  const sub = getSubmissionById(id);
  if (!sub) throw new Error("Không tìm thấy bài nộp.");
  if (sub.status !== "pending") throw new Error("Bài nộp đã được xử lý.");
  setSubmissionStatus(id, "rejected", { note: (note ?? "").trim().slice(0, 2000) || null });
  await logAction("submission.reject", { id });
  return { ok: true };
}
