#!/usr/bin/env node
// Đổi tên tác giả đang là tên tiếng Việt của giảng viên về đúng tên romanized
// như in trên bài. Chỉ xử lý những chỗ KHÔNG còn bản tiếng Anh trong cùng byline
// (chỗ còn bản tiếng Anh là trùng lặp — dedupeAuthorLinks đã dọn).
//
// Tên gốc của từng bài không còn trong DB, nên đề xuất được lấy từ chính tên
// romanized mà giảng viên đó đã dùng ở các bài khác (authors_json) và từ bảng
// author_aliases. Vì là suy đoán theo từng bài, luôn soát file rồi mới apply.
//
//   node scripts/fix-vn-author-names.mjs --list
//       -> ghi author-vn-fix.json + in bảng tóm tắt
//   # sửa/xoá dòng trong author-vn-fix.json ("new": "" -> bỏ qua dòng đó)
//   node scripts/fix-vn-author-names.mjs --apply author-vn-fix.json --dry
//   node scripts/fix-vn-author-names.mjs --apply author-vn-fix.json
//
// DATABASE_FILE: đường dẫn app.db (mặc định ./data/app.db). Trong Docker:
//   docker compose exec app env DATABASE_FILE=/app/data/app.db \
//     node scripts/fix-vn-author-names.mjs --list

import Database from "better-sqlite3";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const applyIdx = args.indexOf("--apply");
const isApply = applyIdx >= 0;
const isDry = args.includes("--dry");
const OUT = "author-vn-fix.json";

const CANDIDATES = [...new Set([
  process.env.DATABASE_FILE,
  path.join(process.cwd(), "data", "app.db"),
  path.join(process.cwd(), "app.db"),
  "/app/data/app.db",
  "/app/app.db",
].filter(Boolean))];

let db = null;
const errs = [];
for (const p of CANDIDATES) {
  try {
    db = new Database(p, { readonly: !isApply || isDry, fileMustExist: true });
    console.error(`(DB: ${p})`);
    break;
  } catch (e) {
    errs.push(`  ${p} -> ${e.message}`);
  }
}
if (!db) {
  console.error("Không mở được app.db. Đặt DATABASE_FILE=<đường dẫn đúng>. Đã thử:\n" + errs.join("\n"));
  process.exit(1);
}

const TITLE_RE = /^(GS\.TS|PGS\.TS|TS|ThS|NCS|CN|CĐ|TC|CL|KS)\.\s*/;
const VN_RE = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụỳýỷỹỵ]/i;
const tokens = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d")
   .toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
const nameKey = (s) => [...tokens(s)].sort().join(" ");
// Cùng người khi tập từ trùng nhau, hoặc dùng chung >= 2 từ (byline hay rút gọn).
function sameName(a, b) {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return false;
  if (nameKey(a) === nameKey(b)) return true;
  let n = 0;
  for (const t of A) if (B.has(t)) n++;
  return n >= 2 && n / Math.min(A.size, B.size) >= 0.6;
}
const split = (s) => String(s || "").split(",").map((t) => t.trim()).filter(Boolean);

const lecturers = db.prepare("SELECT id, name FROM lecturers").all();
const lecturerByKey = new Map(lecturers.map((l) => [nameKey(l.name), l]));
const papers = db.prepare("SELECT id, title, year, venue_code, authors, authors_json FROM papers").all();

// Tên romanized giảng viên đã dùng ở các bài khác, xếp theo số lần dùng.
const used = new Map(); // lecturerId -> Map(name -> count)
for (const p of papers) {
  if (!p.authors_json) continue;
  let links;
  try { links = JSON.parse(p.authors_json); } catch { continue; }
  if (!Array.isArray(links)) continue;
  for (const a of links) {
    if (!a?.lecturerId || !a.name || VN_RE.test(a.name)) continue;
    if (!used.has(a.lecturerId)) used.set(a.lecturerId, new Map());
    const m = used.get(a.lecturerId);
    m.set(a.name, (m.get(a.name) ?? 0) + 1);
  }
}
const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
const aliasesFor = new Map(); // lecturerId -> string[]
for (const a of db.prepare("SELECT raw_name, lecturer_id FROM author_aliases").all()) {
  if (VN_RE.test(a.raw_name)) continue;
  aliasesFor.set(a.lecturer_id, [...(aliasesFor.get(a.lecturer_id) ?? []), titleCase(a.raw_name)]);
}
function suggestions(lecturerId) {
  const byUse = [...(used.get(lecturerId) ?? new Map())]
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
    .map(([name]) => name);
  return [...new Set([...byUse, ...(aliasesFor.get(lecturerId) ?? [])])];
}

// Mỗi chỗ cần sửa: tên tiếng Việt của một giảng viên, không có bản tiếng Anh
// nào của chính người đó trong cùng byline.
function findTargets() {
  const out = [];
  for (const p of papers) {
    const names = split(p.authors);
    names.forEach((raw, index) => {
      const bare = raw.replace(TITLE_RE, "").trim();
      if (!VN_RE.test(bare)) return;
      const lec = lecturerByKey.get(nameKey(bare));
      if (!lec) return; // tên tiếng Việt của người ngoài -> để nguyên
      if (names.some((o, j) => j !== index && !VN_RE.test(o) && sameName(o, bare))) return; // trùng lặp
      const cands = suggestions(lec.id);
      out.push({
        paperId: p.id,
        title: p.title,
        year: p.year,
        venue: p.venue_code,
        index,
        current: raw,
        new: cands[0] ?? "",
        candidates: cands,
      });
    });
  }
  return out;
}

if (!isApply) {
  const targets = findTargets();
  writeFileSync(OUT, JSON.stringify(targets, null, 2) + "\n", "utf8");
  const byName = new Map();
  for (const t of targets) {
    const k = `${t.current.replace(TITLE_RE, "")} -> ${t.new || "(CHƯA CÓ GỢI Ý)"}`;
    byName.set(k, (byName.get(k) ?? 0) + 1);
  }
  for (const [k, n] of [...byName].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(3)}x  ${k}`);
  console.log(`\n${targets.length} chỗ / ${new Set(targets.map((t) => t.paperId)).size} bài -> đã ghi ${OUT}`);
  console.log(`Soát lại file (để "new": "" nếu muốn giữ nguyên), rồi: --apply ${OUT} --dry`);
  process.exit(0);
}

// ---- apply ----
const file = args[applyIdx + 1];
if (!file) {
  console.error("Thiếu file: --apply author-vn-fix.json");
  process.exit(1);
}
const items = JSON.parse(readFileSync(file, "utf8"));
const getPaper = db.prepare("SELECT id, authors, authors_json FROM papers WHERE id = ?");
const upd = db.prepare("UPDATE papers SET authors = ?, authors_json = ? WHERE id = ?");

let changed = 0, skipped = 0;
const run = () => {
  for (const it of items) {
    if (!it.new || it.new === it.current) { skipped++; continue; }
    const p = getPaper.get(it.paperId);
    if (!p) { console.log(`bỏ qua #${it.paperId}: không còn bài`); skipped++; continue; }
    const names = split(p.authors);
    if (names[it.index] !== it.current) {
      console.log(`bỏ qua #${it.paperId}: vị trí ${it.index} giờ là "${names[it.index] ?? "(trống)"}", không phải "${it.current}"`);
      skipped++;
      continue;
    }
    names[it.index] = it.new;

    // authors_json là nguồn sự thật khi có — không sửa thì lần lưu sau ghi đè lại.
    let json = p.authors_json;
    if (json) {
      let links;
      try { links = JSON.parse(json); } catch { links = null; }
      if (Array.isArray(links) && links[it.index]?.name === it.current) {
        links[it.index] = { ...links[it.index], name: it.new };
        json = JSON.stringify(links);
      } else {
        console.log(`bỏ qua #${it.paperId}: authors_json lệch với byline`);
        skipped++;
        continue;
      }
    }
    console.log(`#${it.paperId} [${it.index}] "${it.current}" -> "${it.new}"`);
    if (!isDry) upd.run(names.join(", "), json, it.paperId);
    changed++;
  }
};
if (isDry) run();
else db.transaction(run)();
console.log(`\n${isDry ? "(DRY) " : ""}sửa ${changed} chỗ, bỏ qua ${skipped}.`);
