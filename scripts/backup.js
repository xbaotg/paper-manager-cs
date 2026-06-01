// Online SQLite backup sidecar. Loops forever, snapshots DATABASE_FILE to
// BACKUP_DIR using better-sqlite3's `db.backup()` (online, consistent — safe
// while the app is writing), then prunes the oldest beyond BACKUP_KEEP.
//
// Env:
//   DATABASE_FILE             default /app/data/app.db
//   BACKUP_DIR                default /backups
//   BACKUP_INTERVAL_SECONDS   default 21600 (6h)
//   BACKUP_KEEP               default 60 snapshots
//   BACKUP_COMPRESS           "1" to gzip after backup (saves ~70% on text-heavy SQLite)
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const SRC = process.env.DATABASE_FILE || "/app/data/app.db";
const DEST_DIR = process.env.BACKUP_DIR || "/backups";
const INTERVAL_MS = (Number(process.env.BACKUP_INTERVAL_SECONDS) || 21600) * 1000;
const KEEP = Number(process.env.BACKUP_KEEP) || 60;
const COMPRESS = process.env.BACKUP_COMPRESS === "1";

fs.mkdirSync(DEST_DIR, { recursive: true });

function ts() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function snapshot() {
  if (!fs.existsSync(SRC)) {
    console.log(`[backup] source not present yet: ${SRC}`);
    return;
  }
  const name = `app-${ts()}.db`;
  const dest = path.join(DEST_DIR, name);
  const db = new Database(SRC, { readonly: true, fileMustExist: true });
  try {
    await db.backup(dest);
  } finally {
    db.close();
  }
  let final = dest;
  if (COMPRESS) {
    const r = spawnSync("gzip", ["-9", dest]);
    if (r.status === 0) final = `${dest}.gz`;
    else console.warn(`[backup] gzip failed (status ${r.status}); keeping uncompressed`);
  }
  const sizeKb = (fs.statSync(final).size / 1024).toFixed(1);
  console.log(`[backup] ${final} (${sizeKb} KB)`);

  // Rotate: keep newest KEEP, drop the rest.
  const files = fs
    .readdirSync(DEST_DIR)
    .filter((f) => /^app-.*\.db(\.gz)?$/.test(f))
    .sort()
    .reverse();
  for (const f of files.slice(KEEP)) {
    fs.unlinkSync(path.join(DEST_DIR, f));
    console.log(`[backup] rotated out ${f}`);
  }
}

async function loop() {
  console.log(`[backup] sidecar started — src=${SRC} dest=${DEST_DIR} every ${INTERVAL_MS / 1000}s, keep ${KEEP}${COMPRESS ? ", gzip" : ""}`);
  // Take one snapshot immediately on boot so a fresh deploy isn't empty until
  // the first interval elapses.
  while (true) {
    try {
      await snapshot();
    } catch (e) {
      console.error("[backup] error:", e instanceof Error ? e.message : e);
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

// Clean exit on SIGTERM (docker stop) so the next snapshot doesn't run mid-shutdown.
process.on("SIGTERM", () => { console.log("[backup] SIGTERM, exiting"); process.exit(0); });
process.on("SIGINT", () => { console.log("[backup] SIGINT, exiting"); process.exit(0); });

loop();
