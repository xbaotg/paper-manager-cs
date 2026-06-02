import "server-only";
import { getDb } from "../sqlite";
import type { Role } from "../session";

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  role: Role;
  lecturer_id: number | null;
  is_active: number;
  created_at: string;
  bo_mon_id: number | null;
  is_admin: number;
}

// User joined with the linked lecturer's name, for the management list.
export interface UserListItem {
  id: number;
  username: string;
  role: Role;
  lecturerId: number | null;
  lecturerName: string | null;
  isActive: number;
  createdAt: string;
  boMonId: number | null;
  boMonName: string | null;
  isAdmin: number;
}

export function getUserByUsername(username: string): UserRow | undefined {
  return getDb()
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username) as UserRow | undefined;
}

export function getUserById(id: number): UserRow | undefined {
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export function getUserByLecturerId(lecturerId: number): UserRow | undefined {
  return getDb()
    .prepare("SELECT * FROM users WHERE lecturer_id = ?")
    .get(lecturerId) as UserRow | undefined;
}

export function countUsers(): number {
  return (getDb().prepare("SELECT count(*) AS n FROM users").get() as { n: number }).n;
}

// Used to prevent locking everyone out (deactivating/deleting the last manager).
export function countActiveManagers(): number {
  return (
    getDb()
      .prepare("SELECT count(*) AS n FROM users WHERE role = 'manager' AND is_active = 1")
      .get() as { n: number }
  ).n;
}

export function listUsers(): UserListItem[] {
  const rows = getDb()
    .prepare(
      `SELECT u.id, u.username, u.role, u.lecturer_id, u.is_active, u.created_at, u.bo_mon_id, u.is_admin,
              l.name AS lecturer_name, b.name_vi AS bo_mon_name
       FROM users u
       LEFT JOIN lecturers l ON l.id = u.lecturer_id
       LEFT JOIN bo_mon b ON b.id = u.bo_mon_id
       ORDER BY u.role, u.username`
    )
    .all() as (UserRow & { lecturer_name: string | null; bo_mon_name: string | null })[];
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    role: r.role,
    lecturerId: r.lecturer_id,
    lecturerName: r.lecturer_name,
    isActive: r.is_active,
    createdAt: r.created_at,
    boMonId: r.bo_mon_id,
    boMonName: r.bo_mon_name,
    isAdmin: r.is_admin,
  }));
}

export interface CreateUserInput {
  username: string;
  passwordHash: string;
  role: Role;
  lecturerId: number | null;
  boMonId: number | null;
  isAdmin?: boolean;
}

export function createUser(input: CreateUserInput): number {
  const info = getDb()
    .prepare(
      "INSERT INTO users (username, password_hash, role, lecturer_id, bo_mon_id, is_admin) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(input.username, input.passwordHash, input.role, input.lecturerId, input.boMonId, input.isAdmin ? 1 : 0);
  return Number(info.lastInsertRowid);
}

export function setUserActive(id: number, active: boolean): void {
  getDb().prepare("UPDATE users SET is_active = ? WHERE id = ?").run(active ? 1 : 0, id);
}

// Grant/revoke the admin elevation on a lecturer account.
export function setUserAdmin(id: number, isAdmin: boolean): void {
  getDb().prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(isAdmin ? 1 : 0, id);
}

export function updateUserPassword(id: number, passwordHash: string): void {
  getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id);
}

export function deleteUser(id: number): void {
  getDb().prepare("DELETE FROM users WHERE id = ?").run(id);
}

// Lecturers that do not yet have a linked account (for the create-account picker).
export function listUnlinkedLecturers(): { id: number; name: string }[] {
  return getDb()
    .prepare(
      `SELECT id, name FROM lecturers
       WHERE id NOT IN (SELECT lecturer_id FROM users WHERE lecturer_id IS NOT NULL)
       ORDER BY name`
    )
    .all() as { id: number; name: string }[];
}
