// Diagnose / repair lecturer avatars on a live datastore.
//
// Reuses the better-sqlite3 native addon shipped in the image (same as
// backup.js). Run it INSIDE the app container so DATABASE_FILE points at the
// mounted volume DB — it does NOT need the app to be stopped:
//
//   # report only (no writes): how many avatars are set, what would match
//   docker compose exec app node scripts/backfill-avatars.js
//
//   # actually backfill empty avatars (idempotent, never overwrites a photo)
//   docker compose exec app node scripts/backfill-avatars.js --apply
//
// Matching is by @uit.edu.vn email first, then a diacritic-insensitive name
// compare, so production rows whose email differs from the scraped directory
// still get matched. Safe to re-run.
//
// NOTE: the AVATARS list is an inlined copy of lib/lecturer-avatars.ts (this
// script runs as plain node, outside the Next build). Keep the two in sync.
const Database = require("better-sqlite3");

const DB_FILE = process.env.DATABASE_FILE || "/app/data/app.db";
const APPLY = process.argv.includes("--apply");

const AVATARS = [
  { email: "chinhnt@uit.edu.vn", name: "Nguyễn Trọng Chỉnh", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00502-267x400.jpg" },
  { email: "diemntn@uit.edu.vn", name: "Nguyễn Thị Ngọc Diễm", url: "https://cs.uit.edu.vn/wp-content/uploads/2022/12/DiemNTN-267x400.jpg" },
  { email: "dungmt@uit.edu.vn", name: "Mai Tiến Dũng", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00295-267x400.jpg" },
  { email: "duyld@uit.edu.vn", name: "Lê Đình Duy", url: "https://cs.uit.edu.vn/wp-content/uploads/2022/12/DuyLD-267x400.jpg" },
  { email: "duyvnl@uit.edu.vn", name: "Võ Nguyễn Lê Duy", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00341-267x400.jpg" },
  { email: "hangdv@uit.edu.vn", name: "Dương Việt Hằng", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00419-267x400.jpg" },
  { email: "hiennd@uit.edu.vn", name: "Nguyễn Đình Hiển", url: "https://cs.uit.edu.vn/wp-content/uploads/2022/12/LD_00303-267x400.jpg" },
  { email: "hoangln@uit.edu.vn", name: "Lương Ngọc Hoàng", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00323-267x400.jpg" },
  { email: "khangtd@uit.edu.vn", name: "Trần Đình Khang", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00384-267x400.jpg" },
  { email: "khiemltt@uit.edu.vn", name: "Lê Trần Trọng Khiêm", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00392-267x400.jpg" },
  { email: "kietnt@uit.edu.vn", name: "Ngô Tuấn Kiệt", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00361-267x400.jpg" },
  { email: "thangcpd@uit.edu.vn", name: "Cáp Phạm Đình Thăng", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00310-267x400.jpg" },
  { email: "thanhnd@uit.edu.vn", name: "Ngô Đức Thành", url: "https://cs.uit.edu.vn/wp-content/uploads/2022/12/LD_00508-267x400.jpg" },
  { email: "thuonghtt@uit.edu.vn", name: "Huỳnh Thị Thanh Thương", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00412-267x400.jpg" },
  { email: "thuyentd@uit.edu.vn", name: "Trần Doãn Thuyên", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00372-267x400.jpg" },
  { email: "tiendv@uit.edu.vn", name: "Đỗ Văn Tiến", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00354-267x400.jpg" },
  { email: "truonganpn@uit.edu.vn", name: "Phạm Nguyễn Trường An", url: "https://cs.uit.edu.vn/wp-content/uploads/2022/12/AnPNT-267x400.jpg" },
  { email: "uyenptt@uit.edu.vn", name: "Phạm Thị Thanh Uyên", url: "https://cs.uit.edu.vn/wp-content/uploads/2022/12/UyenPTT-267x400.jpg" },
];

function normName(name) {
  return String(name)
    .replace(/^(GS\.?\s*TS\.?|PGS\.?\s*TS\.?|TS\.?|ThS\.?|CN\.?|KS\.?|Cử\s+nhân)\s+/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function columnExists(db, table, col) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
}

const db = new Database(DB_FILE, { fileMustExist: true });
try {
  console.log(`[avatars] db=${DB_FILE} mode=${APPLY ? "APPLY" : "report-only"}`);

  const migs = db.prepare("SELECT id FROM schema_migrations ORDER BY id").all().map((r) => r.id);
  console.log(`[avatars] schema_migrations: ${migs.join(", ") || "(none)"}`);

  let hasCol = columnExists(db, "lecturers", "avatar_url");
  if (!hasCol) {
    if (APPLY) {
      db.exec("ALTER TABLE lecturers ADD COLUMN avatar_url TEXT");
      hasCol = true;
      console.log("[avatars] added missing lecturers.avatar_url column");
    } else {
      console.log("[avatars] lecturers.avatar_url column is MISSING (would be added with --apply)");
    }
  }

  const rows = db.prepare("SELECT id, name, email, " + (hasCol ? "avatar_url" : "NULL AS avatar_url") + " FROM lecturers").all();
  console.log(`[avatars] lecturers in DB: ${rows.length}`);

  const byEmail = new Map();
  const byName = new Map();
  for (const a of AVATARS) {
    byEmail.set(a.email.trim().toLowerCase(), a);
    byName.set(normName(a.name), a);
  }

  const update = db.prepare("UPDATE lecturers SET avatar_url = ? WHERE id = ?");
  const used = new Set();
  let already = 0, byE = 0, byN = 0, changed = 0, noMatch = 0;

  const run = db.transaction(() => {
    for (const r of rows) {
      const set = r.avatar_url && String(r.avatar_url).trim() !== "";
      if (set) { already++; used.add(String(r.email || "").toLowerCase()); continue; }
      const email = String(r.email || "").trim().toLowerCase();
      let hit = email ? byEmail.get(email) : undefined;
      let how = hit ? "email" : "";
      if (!hit) { hit = byName.get(normName(r.name)); if (hit) how = "name"; }
      if (hit) {
        if (how === "email") byE++; else byN++;
        used.add(hit.email.toLowerCase());
        if (APPLY) { update.run(hit.url, r.id); changed++; }
        console.log(`  ${APPLY ? "SET " : "WOULD SET"} [${how}] ${r.name} <${r.email}>`);
      } else {
        noMatch++;
        console.log(`  no-match  ${r.name} <${r.email}>`);
      }
    }
  });
  run();

  const unmatchedEntries = AVATARS.filter((a) => !used.has(a.email.toLowerCase()));
  console.log(`[avatars] already-set=${already}  ${APPLY ? "changed" : "would-change"}=${APPLY ? changed : byE + byN} (email=${byE}, name=${byN})  no-match-in-db=${noMatch}`);
  if (unmatchedEntries.length) {
    console.log(`[avatars] directory entries with NO matching lecturer (${unmatchedEntries.length}):`);
    for (const a of unmatchedEntries) console.log(`    ${a.name} <${a.email}>`);
  }
  if (!APPLY) console.log("[avatars] report-only — re-run with --apply to write changes");
} finally {
  db.close();
}
