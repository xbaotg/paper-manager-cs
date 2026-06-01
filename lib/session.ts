// Stateless session token (signed JWT) helpers. Pure jose — no next/headers —
// so this is safe to import from proxy.ts (which runs before route rendering)
// as well as from server components/actions.
import { SignJWT, jwtVerify } from "jose";

export type Role = "manager" | "lecturer" | "head";

const ROLES: readonly Role[] = ["manager", "lecturer", "head"];

export interface SessionPayload {
  userId: number;
  role: Role;
  lecturerId: number | null;
  boMonId: number | null; // scope for the 'head' role; null for manager/lecturer
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
    };
  } catch {
    return null;
  }
}

// Cookie attributes shared by login/logout. Scoped to the app's basePath. Read
// from BASE_PATH env (defaults to "/kpi") so cookie + basePath always match —
// if they drift the browser drops the cookie on navigation and the user looks
// "logged out" on every page.
// `Secure` is opt-in via COOKIE_SECURE: browsers drop Secure cookies over plain
// HTTP, so it must stay off for HTTP deployments and be enabled only behind HTTPS.
export const COOKIE_PATH = process.env.BASE_PATH || "/kpi";

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax" as const,
    path: COOKIE_PATH,
    maxAge: MAX_AGE_SECONDS,
  };
}
