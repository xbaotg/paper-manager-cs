import "server-only";
import fs from "fs";
import path from "path";
import { getCurrentUser } from "./dal";

// Append-only action/event log written to a file beside the SQLite DB. Rotates
// when the active file reaches 50MB (renamed to app-<timestamp>.log; a fresh
// app.log is started). Logging is best-effort and fully wrapped in try/catch so a
// filesystem problem can never break a request.

const MAX_BYTES = 50 * 1024 * 1024; // 50MB

const DB_FILE = process.env.DATABASE_FILE
  ? path.resolve(process.env.DATABASE_FILE)
  : path.join(process.cwd(), "app.db");
const LOG_DIR = process.env.LOG_DIR
  ? path.resolve(process.env.LOG_DIR)
  : path.join(path.dirname(DB_FILE), "logs");
const LOG_FILE = path.join(LOG_DIR, "app.log");

let dirReady = false;
function ensureDir() {
  if (dirReady) return;
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch {
    /* ignore — write will retry/fail silently */
  }
  dirReady = true;
}

// Roll the active log to a timestamped file once it crosses the size cap.
function rotateIfNeeded() {
  try {
    const st = fs.statSync(LOG_FILE);
    if (st.size >= MAX_BYTES) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      fs.renameSync(LOG_FILE, path.join(LOG_DIR, `app-${stamp}.log`));
    }
  } catch {
    /* file not created yet — nothing to rotate */
  }
}

export type LogLevel = "info" | "warn" | "error";

// Low-level: write one JSON line. Used for system/non-actor events.
export function writeLog(level: LogLevel, event: string, data?: Record<string, unknown>): void {
  try {
    ensureDir();
    rotateIfNeeded();
    const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...(data ?? {}) }) + "\n";
    fs.appendFileSync(LOG_FILE, line, "utf8");
  } catch {
    /* never let logging break the caller */
  }
}

// Action log: resolves the current user as the actor automatically, so call
// sites only pass what happened. Safe to await-and-forget.
export async function logAction(action: string, details?: Record<string, unknown>): Promise<void> {
  let actor = "anonymous";
  let role: string | undefined;
  let userId: number | undefined;
  try {
    const u = await getCurrentUser();
    if (u) {
      actor = u.username;
      role = u.role;
      userId = u.id;
    }
  } catch {
    /* unauthenticated or session lookup failed — log as anonymous */
  }
  writeLog("info", action, { actor, role, userId, ...(details ?? {}) });
}

// File listing for the admin "download logs" view.
export interface LogFileInfo {
  name: string;
  size: number;
  mtime: string;
}

export function listLogFiles(): LogFileInfo[] {
  try {
    ensureDir();
    return fs
      .readdirSync(LOG_DIR)
      .filter((f) => f.endsWith(".log"))
      .map((name) => {
        const st = fs.statSync(path.join(LOG_DIR, name));
        return { name, size: st.size, mtime: st.mtime.toISOString() };
      })
      .sort((a, b) => b.mtime.localeCompare(a.mtime));
  } catch {
    return [];
  }
}

// Read a single log file's contents (admin download). Guards against path
// traversal: only plain *.log names inside LOG_DIR are allowed.
export function readLogFile(name: string): string | null {
  if (!/^[A-Za-z0-9._-]+\.log$/.test(name)) return null;
  try {
    return fs.readFileSync(path.join(LOG_DIR, name), "utf8");
  } catch {
    return null;
  }
}
