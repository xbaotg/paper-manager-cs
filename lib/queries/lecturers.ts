import "server-only";
import { getDb } from "../sqlite";
import { academicRankFromTitle, type Lecturer, type AcademicRank } from "../data";

interface LecturerRow {
  id: number;
  name: string;
  email: string;
  title: string;
  department: string;
  phone: string | null;
  academic_rank: string | null;
  bo_mon_id: number | null;
  avatar_url: string | null;
}

function toLecturer(r: LecturerRow): Lecturer {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    title: r.title as Lecturer["title"],
    department: r.department,
    ...(r.phone ? { phone: r.phone } : {}),
    academicRank: (r.academic_rank as AcademicRank | null) ?? academicRankFromTitle(r.title),
    boMonId: r.bo_mon_id,
    avatarUrl: r.avatar_url,
  };
}

export function listLecturers(): Lecturer[] {
  const rows = getDb()
    .prepare("SELECT * FROM lecturers ORDER BY rowid DESC")
    .all() as LecturerRow[];
  return rows.map(toLecturer);
}

export function getLecturerById(id: number): Lecturer | null {
  const r = getDb().prepare("SELECT * FROM lecturers WHERE id = ?").get(id) as LecturerRow | undefined;
  return r ? toLecturer(r) : null;
}

export function createLecturer(l: Lecturer): void {
  getDb()
    .prepare(
      "INSERT INTO lecturers (id, name, email, title, department, phone, academic_rank, bo_mon_id, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      l.id,
      l.name,
      l.email,
      l.title,
      l.department,
      l.phone ?? null,
      l.academicRank ?? academicRankFromTitle(l.title),
      l.boMonId ?? null,
      l.avatarUrl ?? null
    );
}

export function updateLecturer(id: number, l: Lecturer): void {
  getDb()
    .prepare(
      // avatar_url via COALESCE: the lecturer edit form does not carry it, so a
      // null arg preserves the photo backfilled by migration instead of wiping it.
      "UPDATE lecturers SET name = ?, email = ?, title = ?, department = ?, phone = ?, academic_rank = ?, bo_mon_id = ?, avatar_url = COALESCE(?, avatar_url) WHERE id = ?"
    )
    .run(
      l.name,
      l.email,
      l.title,
      l.department,
      l.phone ?? null,
      l.academicRank ?? academicRankFromTitle(l.title),
      l.boMonId ?? null,
      l.avatarUrl ?? null,
      id
    );
}

export function deleteLecturer(id: number): void {
  getDb().prepare("DELETE FROM lecturers WHERE id = ?").run(id);
}
