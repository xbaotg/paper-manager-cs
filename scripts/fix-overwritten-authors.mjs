#!/usr/bin/env node
// Liệt kê + sửa lại các tên tác giả bị ghi đè thành "Học hàm. Tên giảng viên"
// (do bản import BibTeX/OpenAlex cũ). Tên gốc trong paper đã bị mất khỏi DB nên
// bạn cung cấp lại tên gốc; script thay ngược lại trong papers.authors.
//
// Cách dùng (chạy trên host, nơi có DATABASE_FILE):
//   node scripts/fix-overwritten-authors.mjs --list
//       → in danh sách token bị ghi đè + ghi file author-fix-template.json
//   # mở author-fix-template.json, điền tên gốc cho mỗi token, lưu thành author-fix.json
//   node scripts/fix-overwritten-authors.mjs --apply author-fix.json --dry   # xem trước
//   node scripts/fix-overwritten-authors.mjs --apply author-fix.json         # ghi DB
//
// DATABASE_FILE: đường dẫn tới app.db (mặc định ./data/app.db). Trong Docker:
//   docker compose exec <service> env DATABASE_FILE=/app/data/app.db \
//     node scripts/fix-overwritten-authors.mjs --list

import Database from "better-sqlite3";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

// Auto-locate the DB: DATABASE_FILE env, then the common in-container paths.
const CANDIDATES = [
  process.env.DATABASE_FILE,
  path.join(process.cwd(), "data", "app.db"),
  path.join(process.cwd(), "app.db"),
  "/app/data/app.db",
  "/app/app.db",
].filter(Boolean);
const DB_FILE = CANDIDATES.find((p) => existsSync(p));
if (!DB_FILE) {
  console.error("Không tìm thấy app.db. Đặt DATABASE_FILE=<đường dẫn>. Đã thử:\n  " + CANDIDATES.join("\n  "));
  process.exit(1);
}
console.error(`(DB: ${DB_FILE})`);
// Mọi học hàm/học vị có thể đã được chèn vào trước tên (kể cả khi học hàm đã đổi từ lúc import).
const TITLE_RE = /^(GS\.TS|PGS\.TS|TS|ThS|NCS|CN|CĐ|TC|CL|KS)\.\s*/;

const args = process.argv.slice(2);
const isApply = args.includes("--apply");
const isDry = args.includes("--dry");

const db = new Database(DB_FILE, { readonly: !isApply });
const lecturers = db.prepare("SELECT id, title, name FROM lecturers").all();
const byName = new Map(lecturers.map((l) => [l.name, l])); // tên VN -> giảng viên
const papers = db.prepare("SELECT id, title, year, authors FROM papers").all();

const splitAuthors = (s) => (s || "").split(",").map((t) => t.trim()).filter(Boolean);

// Token bị ghi đè = có tiền tố học hàm + phần còn lại trùng đúng tên 1 giảng viên.
function overwrittenLecturer(token) {
  if (!TITLE_RE.test(token)) return null;
  const stripped = token.replace(TITLE_RE, "").trim();
  return byName.get(stripped) ?? null;
}

if (!isApply) {
  // --- LIST ---
  const found = new Map(); // token -> { lecturerId, name, papers: [] }
  for (const p of papers) {
    for (const tok of splitAuthors(p.authors)) {
      const l = overwrittenLecturer(tok);
      if (!l) continue;
      const e = found.get(tok) ?? { lecturerId: l.id, name: l.name, papers: [] };
      e.papers.push({ id: p.id, year: p.year, title: p.title });
      found.set(tok, e);
    }
  }

  if (found.size === 0) {
    console.log(`Không tìm thấy tên tác giả nào bị ghi đè trong ${papers.length} bài. ✅`);
    process.exit(0);
  }

  const template = {};
  console.log(`DB: ${DB_FILE}\n${found.size} token bị ghi đè (trên ${papers.length} bài):\n`);
  for (const [tok, e] of [...found.entries()].sort((a, b) => b[1].papers.length - a[1].papers.length)) {
    console.log(`• "${tok}"  — giảng viên id ${e.lecturerId} — ${e.papers.length} bài`);
    for (const pp of e.papers.slice(0, 6)) console.log(`      [${pp.id}] ${pp.year}  ${pp.title}`);
    if (e.papers.length > 6) console.log(`      … +${e.papers.length - 6} bài`);
    template[tok] = ""; // điền tên gốc trong paper
  }
  writeFileSync("author-fix-template.json", JSON.stringify(template, null, 2));
  console.log(`\n→ Đã ghi author-fix-template.json. Điền tên gốc cho mỗi token rồi:`);
  console.log(`  node scripts/fix-overwritten-authors.mjs --apply author-fix-template.json --dry`);
} else {
  // --- APPLY ---
  const mapFile = args.find((a) => a.endsWith(".json"));
  if (!mapFile) {
    console.error("Thiếu file mapping. Vd: --apply author-fix.json");
    process.exit(1);
  }
  const map = JSON.parse(readFileSync(mapFile, "utf8"));
  const entries = Object.entries(map).filter(([, orig]) => orig && String(orig).trim());
  if (entries.length === 0) {
    console.error("Mapping rỗng — chưa điền tên gốc nào.");
    process.exit(1);
  }

  const upd = db.prepare("UPDATE papers SET authors = ? WHERE id = ?");
  let changed = 0;
  const apply = () => {
    for (const p of papers) {
      const toks = splitAuthors(p.authors);
      const next = toks.map((t) => (map[t] && String(map[t]).trim() ? String(map[t]).trim() : t));
      const newAuthors = next.join(", ");
      if (newAuthors !== (p.authors || "")) {
        if (isDry) console.log(`[${p.id}] ${p.authors}\n   -> ${newAuthors}\n`);
        else upd.run(newAuthors, p.id);
        changed++;
      }
    }
  };
  if (isDry) {
    apply();
    console.log(`(--dry) Sẽ cập nhật ${changed} bài. Bỏ --dry để ghi DB.`);
  } else {
    db.transaction(apply)();
    console.log(`✅ Đã cập nhật ${changed} bài trong ${DB_FILE}.`);
  }
}
