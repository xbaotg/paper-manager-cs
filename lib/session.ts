// Stateless session token (signed JWT) helpers. Pure jose — no next/headers —
// so this is safe to import from proxy.ts (which runs before route rendering)
// as well as from server components/actions.
import { SignJWT, jwtVerify } from "jose";

export type Role = "manager" | "lecturer" | "head";

const ROLES: readonly Role[] = ["manager", "lecturer", "head"];

// Active view for a dual-capable user (admin grant + own lecturer profile).
// Stored in a separate cookie — a UI preference, not part of the identity token.
export type ViewMode = "admin" | "user";

export interface SessionPayload {
  userId: number;
  role: Role;
  lecturerId: number | null;
  boMonId: number | null; // scope for the 'head' role; null for manager/lecturer
  isAdmin: boolean; // elevated grant on a non-manager (lecturer promoted to admin)
  [key: string]: unknown; // jose JWTPayload index signature
}

export const SESSION_COOKIE = "session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

// In production SESSION_SECRET must be set (see docker-compose .env). The dev
// fallback only exists so local `next dev` works without extra setup.
const secretString =
  process.env.SESSION_SECRET || "dev-insecure-secret-change-me-in-production";
const secret = new TextEncoder().encode(secretString);

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret);
}

export async function decryptSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (typeof payload.userId !== "number" || !ROLES.includes(payload.role as Role)) {
      return null;
    }
    return {
      userId: payload.userId,
      role: payload.role as Role,
      lecturerId: (payload.lecturerId as number | null) ?? null,
      boMonId: (payload.boMonId as number | null) ?? null,
      isAdmin: payload.isAdmin === true,
    };
  } catch {
    return null;
  }
}

// Landing route for a user. Pure (no IO) so both proxy (cookie-only, optimistic)
// and the DAL (DB-backed, authoritative) can call it. A dual-capable user
// (admin grant + own lecturer profile) is routed by their active `mode`; a pure
// manager has no self-view so always lands in /admin regardless of mode.
export function homeFor(p: {
  role: Role;
  isAdmin: boolean;
  lecturerId: number | null;
  mode: ViewMode | null;
}): string {
  if (p.role === "head") return "/head";
  const canAdmin = p.role === "manager" || p.isAdmin;
  if (canAdmin) {
    if (p.lecturerId != null && p.mode === "user") return "/me";
    return "/admin";
  }
  // Plain lecturer (incl. one orphaned from its profile) → self-view. Never
  // return "/login" for an authenticated user: proxy redirects /login back to
  // home, so a "/login" home would loop.
  return "/me";
}

// Cookie attributes shared by login/logout. Scoped to the app's basePath. Read
// from BASE_PATH env (defaults to "/hub") so cookie + basePath always match —
// if they drift the browser drops the cookie on navigation and the user looks
// "logged out" on every page.
// `Secure` is opt-in via COOKIE_SECURE: browsers drop Secure cookies over plain
// HTTP, so it must stay off for HTTP deployments and be enabled only behind HTTPS.
export const COOKIE_PATH = process.env.BASE_PATH || "/hub";

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax" as const,
    path: COOKIE_PATH,
    maxAge: MAX_AGE_SECONDS,
  };
}

// Active-view preference for dual-capable users. Same attributes/scope as the
// session cookie so the two never drift; cleared on logout.
export const VIEW_MODE_COOKIE = "view_mode";

export function viewModeCookieOptions() {
  return sessionCookieOptions();
}
