import "server-only";
import { getDb } from "../sqlite";

export type DevelopmentStatus = "planned" | "in_progress" | "completed" | "paused";

export interface DevelopmentItem {
  id: number;
  lecturerId: number;
  lecturerName: string;
  boMonId: number | null;
  boMonName: string | null;
  academicRank: string;
  currentDegree: string;
  targetDegree: string;
  expectedYear: number | null;
  mentorId: number | null;
  mentorName: string | null;
  status: DevelopmentStatus;
  notes: string | null;
  updatedAt: string;
}

export interface DevelopmentProgress {
  id: number;
  developmentId: number;
  year: number;
  quarter: number;
  note: string;
  status: string | null;
  recordedAt: string;
}

const SELECT_DEV = `
  SELECT d.*, l.name AS lecturer_name, l.academic_rank, l.bo_mon_id,
         b.name_vi AS bo_mon_name, m.name AS mentor_name
  FROM faculty_development d
  JOIN lecturers l ON l.id = d.lecturer_id
  LEFT JOIN bo_mon b ON b.id = l.bo_mon_id
  LEFT JOIN lecturers m ON m.id = d.mentor_id
`;

interface DevRow {
  id: number;
  lecturer_id: number;
  lecturer_name: string;
  academic_rank: string;
  bo_mon_id: number | null;
  bo_mon_name: string | null;
  current_degree: string;
  target_degree: string;
  expected_year: number | null;
  mentor_id: number | null;
  mentor_name: string | null;
  status: string;
  notes: string | null;
  updated_at: string;
}

function toDev(r: DevRow): DevelopmentItem {
  return {
    id: r.id,
    lecturerId: r.lecturer_id,
    lecturerName: r.lecturer_name,
    boMonId: r.bo_mon_id,
    boMonName: r.bo_mon_name,
    academicRank: r.academic_rank,
    currentDegree: r.current_degree,
    targetDegree: r.target_degree,
    expectedYear: r.expected_year,
    mentorId: r.mentor_id,
    mentorName: r.mentor_name,
    status: r.status as DevelopmentStatus,
    notes: r.notes,
    updatedAt: r.updated_at,
  };
}

export function listDevelopment(): DevelopmentItem[] {
  const rows = getDb().prepare(`${SELECT_DEV} ORDER BY d.expected_year, l.name`).all() as DevRow[];
  return rows.map(toDev);
}

export function listDevelopmentByBoMon(boMonId: number): DevelopmentItem[] {
  const rows = getDb()
    .prepare(`${SELECT_DEV} WHERE l.bo_mon_id = ? ORDER BY d.expected_year, l.name`)
    .all(boMonId) as DevRow[];
  return rows.map(toDev);
}

export function getDevelopmentByLecturer(lecturerId: number): DevelopmentItem | null {
  const r = getDb().prepare(`${SELECT_DEV} WHERE d.lecturer_id = ?`).get(lecturerId) as DevRow | undefined;
  return r ? toDev(r) : null;
}

// Lecturer ids whose roadmap is completed — counted toward the PhD milestone.
export function listDevelopmentCompletedIds(): number[] {
  return (
    getDb()
      .prepare("SELECT lecturer_id FROM faculty_development WHERE status = 'completed'")
      .all() as { lecturer_id: number }[]
  ).map((r) => r.lecturer_id);
}

export interface UpsertDevelopmentInput {
  lecturerId: number;
  currentDegree: string;
  targetDegree: string;
  expectedYear: number | null;
  mentorId: number | null;
  status: DevelopmentStatus;
  notes: string | null;
}

export function upsertDevelopment(input: UpsertDevelopmentInput): void {
  getDb()
    .prepare(
      `INSERT INTO faculty_development
         (lecturer_id, current_degree, target_degree, expected_year, mentor_id, status, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(lecturer_id) DO UPDATE SET
         current_degree = excluded.current_degree,
         target_degree  = excluded.target_degree,
         expected_year  = excluded.expected_year,
         mentor_id      = excluded.mentor_id,
         status         = excluded.status,
         notes          = excluded.notes,
         updated_at     = datetime('now')`
    )
    .run(
      input.lecturerId,
      input.currentDegree,
      input.targetDegree,
      input.expectedYear,
      input.mentorId,
      input.status,
      input.notes
    );
}

export function deleteDevelopment(id: number): void {
  getDb().prepare("DELETE FROM faculty_development WHERE id = ?").run(id);
}

// Mentee count per mentor — for the "each PGS.TS/TS mentors ≥1" check.
export function getMentorLoad(): Map<number, number> {
  const rows = getDb()
    .prepare("SELECT mentor_id, count(*) AS n FROM faculty_development WHERE mentor_id IS NOT NULL GROUP BY mentor_id")
    .all() as { mentor_id: number; n: number }[];
  return new Map(rows.map((r) => [r.mentor_id, r.n]));
}

export function listProgress(developmentId: number): DevelopmentProgress[] {
  const rows = getDb()
    .prepare("SELECT * FROM development_progress WHERE development_id = ? ORDER BY year DESC, quarter DESC")
    .all(developmentId) as {
    id: number; development_id: number; year: number; quarter: number; note: string; status: string | null; recorded_at: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    developmentId: r.development_id,
    year: r.year,
    quarter: r.quarter,
    note: r.note,
    status: r.status,
    recordedAt: r.recorded_at,
  }));
}

export function upsertProgress(input: {
  developmentId: number;
  year: number;
  quarter: number;
  note: string;
  status: string | null;
  recordedBy: number | null;
}): void {
  getDb()
    .prepare(
      `INSERT INTO development_progress (development_id, year, quarter, note, status, recorded_by, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(development_id, year, quarter) DO UPDATE SET
         note = excluded.note, status = excluded.status,
         recorded_by = excluded.recorded_by, recorded_at = datetime('now')`
    )
    .run(input.developmentId, input.year, input.quarter, input.note, input.status, input.recordedBy);
}

export function deleteProgress(id: number): void {
  getDb().prepare("DELETE FROM development_progress WHERE id = ?").run(id);
}
