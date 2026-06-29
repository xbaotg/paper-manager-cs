import "server-only";
import { getDb } from "../sqlite";
import type { PaperSubmission, SubmissionReviewStatus, SubmissionStatus } from "../data";

// A faculty-wide placeholder "lecturer" that owns every approved student paper.
// Student papers have no real lecturer byline, but the KPI rollup is entirely
// lecturer-driven (credited_lecturer_id -> bo_mon_id -> faculty total), so we
// credit them to this synthetic member. bo_mon_id = NULL keeps the credit at the
// whole-Khoa level (not any one bộ môn); excluded_from_kpi = 0 so it counts in
// the faculty total; hidden_from_hub = 1 so it never shows in the public dir.
// Found by its reserved email so a second one is never created.
const STUDENT_POOL_EMAIL = "cong-trinh-sv@khoa.local";
const STUDENT_POOL_NAME = "Công trình sinh viên (Khoa)";

interface SubmissionRow {
  id: number;
  token: string;
  title: string;
  year: number;
  venue_code: string;
  authors: string;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  submission_status: string;
  submitter_name: string;
  submitter_email: string;
  status: string;
  reviewer_note: string | null;
  paper_id: number | null;
  created_at: string;
  updated_at: string;
}

function toSubmission(r: SubmissionRow): PaperSubmission {
  return {
    id: r.id,
    token: r.token,
    title: r.title,
    year: r.year,
    venue: r.venue_code,
    authors: r.authors,
    submissionStatus: (r.submission_status as SubmissionStatus) ?? "published",
    submitterName: r.submitter_name,
    submitterEmail: r.submitter_email,
    status: (r.status as SubmissionReviewStatus) ?? "pending",
    paperId: r.paper_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    ...(r.doi ? { doi: r.doi } : {}),
    ...(r.url ? { url: r.url } : {}),
    ...(r.abstract ? { abstract: r.abstract } : {}),
    ...(r.reviewer_note ? { reviewerNote: r.reviewer_note } : {}),
  };
}

export interface NewSubmission {
  token: string;
  title: string;
  year: number;
  venue: string;
  authors: string;
  doi?: string;
  url?: string;
  abstract?: string;
  submissionStatus: SubmissionStatus;
  submitterName: string;
  submitterEmail: string;
}

export function createSubmission(s: NewSubmission): PaperSubmission {
  const db = getDb();
  // ponytail: timestamp id, like the paper forms. Two submissions in the same
  // millisecond would collide on the PK; fine for a low-volume student form.
  const id = Date.now();
  db.prepare(
    `INSERT INTO paper_submissions
       (id, token, title, year, venue_code, authors, doi, url, abstract,
        submission_status, submitter_name, submitter_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, s.token, s.title, s.year, s.venue, s.authors,
    s.doi ?? null, s.url ?? null, s.abstract ?? null,
    s.submissionStatus, s.submitterName, s.submitterEmail
  );
  return getSubmissionById(id)!;
}

export function getSubmissionById(id: number): PaperSubmission | null {
  const r = getDb().prepare("SELECT * FROM paper_submissions WHERE id = ?").get(id) as SubmissionRow | undefined;
  return r ? toSubmission(r) : null;
}

export function getSubmissionByToken(token: string): PaperSubmission | null {
  const r = getDb().prepare("SELECT * FROM paper_submissions WHERE token = ?").get(token) as SubmissionRow | undefined;
  return r ? toSubmission(r) : null;
}

export function listSubmissions(status?: SubmissionReviewStatus): PaperSubmission[] {
  const db = getDb();
  const rows = (
    status
      ? db.prepare("SELECT * FROM paper_submissions WHERE status = ? ORDER BY created_at DESC, id DESC").all(status)
      : db.prepare("SELECT * FROM paper_submissions ORDER BY created_at DESC, id DESC").all()
  ) as SubmissionRow[];
  return rows.map(toSubmission);
}

export function countPendingSubmissions(): number {
  const r = getDb()
    .prepare("SELECT COUNT(*) AS n FROM paper_submissions WHERE status = 'pending'")
    .get() as { n: number };
  return r.n;
}

// Edit by token — only while still pending. Returns false if the row is missing
// or already moderated, so the public editor can never change a decided one.
export function updateSubmissionByToken(token: string, s: Omit<NewSubmission, "token">): boolean {
  const info = getDb()
    .prepare(
      `UPDATE paper_submissions SET
         title = ?, year = ?, venue_code = ?, authors = ?, doi = ?, url = ?, abstract = ?,
         submission_status = ?, submitter_name = ?, submitter_email = ?, updated_at = datetime('now')
       WHERE token = ? AND status = 'pending'`
    )
    .run(
      s.title, s.year, s.venue, s.authors, s.doi ?? null, s.url ?? null, s.abstract ?? null,
      s.submissionStatus, s.submitterName, s.submitterEmail, token
    );
  return info.changes > 0;
}

export function setSubmissionStatus(
  id: number,
  status: SubmissionReviewStatus,
  opts?: { note?: string | null; paperId?: number | null }
): void {
  getDb()
    .prepare(
      `UPDATE paper_submissions
         SET status = ?, reviewer_note = ?, paper_id = COALESCE(?, paper_id), updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(status, opts?.note ?? null, opts?.paperId ?? null, id);
}

export function getOrCreateStudentPoolLecturerId(): number {
  const db = getDb();
  const found = db
    .prepare("SELECT id FROM lecturers WHERE email = ? LIMIT 1")
    .get(STUDENT_POOL_EMAIL) as { id: number } | undefined;
  if (found) return found.id;
  const id = Date.now();
  // ponytail: a placeholder "lecturer" is the lazy way to credit student papers
  // to the Khoa — it reuses the whole lecturer-driven KPI rollup with zero
  // changes to kpi.ts. It DOES show as one row in the admin leaderboard; if that
  // ever reads as noise, filter this id out of the per-lecturer `rows` in
  // app/actions/kpi.ts (keep it in the faculty `rollup`).
  db.prepare(
    `INSERT INTO lecturers (id, name, email, title, department, academic_rank, bo_mon_id, excluded_from_kpi, hidden_from_hub)
     VALUES (?, ?, ?, 'CN', 'Sinh viên', 'CN', NULL, 0, 1)`
  ).run(id, STUDENT_POOL_NAME, STUDENT_POOL_EMAIL);
  return id;
}
