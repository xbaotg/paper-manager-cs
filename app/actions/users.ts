"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireManager, requireUser } from "@/lib/dal";
import type { Role } from "@/lib/session";
import {
  listUsers,
  listUnlinkedLecturers,
  getUserById,
  getUserByUsername,
  createUser,
  setUserActive,
  setUserAdmin,
  updateUserPassword,
  updateUsername,
  deleteUser,
  countActiveManagers,
  type UserListItem,
} from "@/lib/queries/users";
import { listBoMon, type BoMon } from "@/lib/queries/bo_mon";
import { generateLecturerUsername } from "@/lib/data";

export interface UsersSnapshot {
  users: UserListItem[];
  unlinked: { id: number; name: string }[];
  boMon: BoMon[];
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  data?: UsersSnapshot;
}

function snapshot(): UsersSnapshot {
  return { users: listUsers(), unlinked: listUnlinkedLecturers(), boMon: listBoMon() };
}

export async function getUsersSnapshot(): Promise<UsersSnapshot> {
  await requireManager();
  return snapshot();
}

export async function createUserAction(input: {
  username: string;
  password: string;
  role: Role;
  lecturerId: number | null;
  boMonId: number | null;
  isAdmin?: boolean;
}): Promise<ActionResult> {
  await requireManager();

  const username = input.username.trim();
  if (!username || !input.password) {
    return { ok: false, error: "Thiếu tên đăng nhập hoặc mật khẩu." };
  }
  if (input.password.length < 6) {
    return { ok: false, error: "Mật khẩu tối thiểu 6 ký tự." };
  }
  if (input.role === "lecturer" && !input.lecturerId) {
    return { ok: false, error: "Chọn giảng viên để liên kết tài khoản." };
  }
  if (input.role === "head" && !input.boMonId) {
    return { ok: false, error: "Chọn bộ môn cho tài khoản Trưởng bộ môn." };
  }
  if (getUserByUsername(username)) {
    return { ok: false, error: "Tên đăng nhập đã tồn tại." };
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  try {
    createUser({
      username,
      passwordHash,
      role: input.role,
      lecturerId: input.role === "lecturer" ? input.lecturerId : null,
      boMonId: input.role === "head" ? input.boMonId : null,
      // admin elevation only applies to lecturer accounts (managers are already
      // admins; heads are a separate read-only role).
      isAdmin: input.role === "lecturer" ? !!input.isAdmin : false,
    });
  } catch {
    return { ok: false, error: "Không tạo được tài khoản (giảng viên có thể đã được liên kết)." };
  }

  revalidatePath("/admin/users");
  return { ok: true, data: snapshot() };
}

export interface GeneratedAccount {
  lecturerId: number;
  lecturerName: string;
  username: string;
  password: string;
}
export interface GenerateAccountsResult {
  ok: boolean;
  data: UsersSnapshot;
  created: GeneratedAccount[];
  skipped: { lecturerId: number; lecturerName: string; reason: string }[];
}

// Create a lecturer account for every lecturer that does not yet have one,
// using `generateLecturerUsername(name)` + password = username + "123".
// Idempotent — already-linked lecturers are skipped. Returns the credentials
// so the manager can hand them out.
export async function generateLecturerAccountsAction(): Promise<GenerateAccountsResult> {
  await requireManager();
  const unlinked = listUnlinkedLecturers();
  const existing = new Set(listUsers().map((u) => u.username.toLowerCase()));
  const created: GeneratedAccount[] = [];
  const skipped: { lecturerId: number; lecturerName: string; reason: string }[] = [];

  for (const l of unlinked) {
    const base = generateLecturerUsername(l.name);
    if (!base) { skipped.push({ lecturerId: l.id, lecturerName: l.name, reason: "Tên trống / không hợp lệ" }); continue; }
    let username = base;
    let i = 2;
    while (existing.has(username)) {
      username = `${base}${i++}`;
      if (i > 999) { username = `${base}_${Date.now()}`; break; }
    }
    const password = username + "123";
    try {
      const hash = await bcrypt.hash(password, 10);
      createUser({ username, passwordHash: hash, role: "lecturer", lecturerId: l.id, boMonId: null });
      existing.add(username);
      created.push({ lecturerId: l.id, lecturerName: l.name, username, password });
    } catch (e) {
      skipped.push({ lecturerId: l.id, lecturerName: l.name, reason: e instanceof Error ? e.message : "unknown" });
    }
  }

  revalidatePath("/admin/users");
  return { ok: true, data: snapshot(), created, skipped };
}

// Rename a login (manager-only). The session is keyed by user id, not username,
// so renaming never logs anyone out — including the manager renaming their own.
export async function updateUsernameAction(id: number, newUsername: string): Promise<ActionResult> {
  await requireManager();
  const username = newUsername.trim();
  const target = getUserById(id);
  if (!target) return { ok: false, error: "Tài khoản không tồn tại." };
  if (!username) return { ok: false, error: "Tên đăng nhập không được để trống." };
  if (/\s/.test(username)) return { ok: false, error: "Tên đăng nhập không được chứa khoảng trắng." };
  if (username.length < 3) return { ok: false, error: "Tên đăng nhập tối thiểu 3 ký tự." };
  if (username === target.username) return { ok: true, data: snapshot() }; // no change
  // Case-insensitive uniqueness so "Thanh" / "thanh" can't both exist.
  const taken = listUsers().some(
    (u) => u.id !== id && u.username.toLowerCase() === username.toLowerCase()
  );
  if (taken) return { ok: false, error: "Tên đăng nhập đã tồn tại." };
  try {
    updateUsername(id, username);
  } catch {
    return { ok: false, error: "Không đổi được tên đăng nhập (có thể đã tồn tại)." };
  }
  revalidatePath("/admin/users");
  return { ok: true, data: snapshot() };
}

export async function resetPasswordAction(id: number, newPassword: string): Promise<ActionResult> {
  await requireManager();
  if (newPassword.length < 6) {
    return { ok: false, error: "Mật khẩu tối thiểu 6 ký tự." };
  }
  if (!getUserById(id)) return { ok: false, error: "Tài khoản không tồn tại." };
  updateUserPassword(id, await bcrypt.hash(newPassword, 10));
  return { ok: true };
}

export async function setUserActiveAction(id: number, active: boolean): Promise<ActionResult> {
  const me = await requireManager();
  const target = getUserById(id);
  if (!target) return { ok: false, error: "Tài khoản không tồn tại." };

  if (!active) {
    if (id === me.id) return { ok: false, error: "Không thể tự vô hiệu hoá tài khoản của bạn." };
    if (target.role === "manager" && countActiveManagers() <= 1) {
      return { ok: false, error: "Phải còn ít nhất một quản lý đang hoạt động." };
    }
  }

  setUserActive(id, active);
  revalidatePath("/admin/users");
  return { ok: true, data: snapshot() };
}

// Promote a lecturer to admin (or revoke). Only lecturer accounts are eligible:
// managers are already admins, heads are a distinct role. The promoted lecturer
// keeps their /me self-view and can switch between admin/user mode.
export async function setUserAdminAction(id: number, isAdmin: boolean): Promise<ActionResult> {
  await requireManager();
  const target = getUserById(id);
  if (!target) return { ok: false, error: "Tài khoản không tồn tại." };
  if (target.role !== "lecturer") {
    return { ok: false, error: "Chỉ có thể cấp quyền quản trị cho tài khoản giảng viên." };
  }
  setUserAdmin(id, isAdmin);
  revalidatePath("/admin/users");
  return { ok: true, data: snapshot() };
}

// Self-service password change — any authenticated user changes their own
// password after presenting the current one. Distinct from the manager-only
// resetPasswordAction (which doesn't require the current password).
export async function changeMyPasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionResult> {
  const me = await requireUser();
  if (!input.newPassword || input.newPassword.length < 6) {
    return { ok: false, error: "Mật khẩu mới tối thiểu 6 ký tự." };
  }
  const u = getUserById(me.id);
  if (!u) return { ok: false, error: "Tài khoản không tồn tại." };
  const ok = await bcrypt.compare(input.currentPassword ?? "", u.password_hash);
  if (!ok) return { ok: false, error: "Mật khẩu hiện tại không đúng." };
  updateUserPassword(me.id, await bcrypt.hash(input.newPassword, 10));
  return { ok: true };
}

export async function deleteUserAction(id: number): Promise<ActionResult> {
  const me = await requireManager();
  const target = getUserById(id);
  if (!target) return { ok: false, error: "Tài khoản không tồn tại." };
  if (id === me.id) return { ok: false, error: "Không thể xoá tài khoản của bạn." };
  if (target.role === "manager" && target.is_active && countActiveManagers() <= 1) {
    return { ok: false, error: "Phải còn ít nhất một quản lý đang hoạt động." };
  }

  deleteUser(id);
  revalidatePath("/admin/users");
  return { ok: true, data: snapshot() };
}
