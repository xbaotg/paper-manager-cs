#!/usr/bin/env node
// Liệt kê các bài báo có tên tác giả viết bằng tiếng Việt (có dấu) trong
// papers.authors, kèm NGUỒN của bài đó — để biết tên bị nhập tiếng Việt từ đâu:
//
//   [nop-bai]  sinh viên tự nộp qua /nop-bai rồi được duyệt -> byline giữ
//              nguyên đúng như sinh viên gõ (thường là tên tiếng Việt).
//   [legacy]   bài cũ chưa có authors_json: khi mở form sửa hoặc chạy "Tìm & gán
//              giảng viên", danh sách tác giả được dựng lại và giảng viên nào
//              không khớp tên nào trong byline sẽ bị THÊM vào bằng tên tiếng
//              Việt (lib/author-match.ts: reconstructAuthorLinks) — lần lưu kế
//              tiếp ghi tên đó vào papers.authors.
//   [app]      đã có authors_json: tên là đúng những gì được gõ trong form.
//
// Chỉ ĐỌC, không sửa gì. Cách dùng:
//   node scripts/list-vn-author-names.mjs
//   docker compose exec app env DATABASE_FILE=/app/data/app.db \
//     node scripts/list-vn-author-names.mjs

import Database from "better-sqlite3";
import path from "node:path";

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
    db = new Database(p, { readonly: true, fileMustExist: true });
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

// Tên romanized ("Thanh Duc Ngo") không có ký tự nào dưới đây; tên tiếng Việt có.
const VN_RE = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;
const key = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d")
   .toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");

const lecturers = db.prepare("SELECT id, name FROM lecturers").all();
const lecturerByKey = new Map(lecturers.map((l) => [key(l.name), l]));
const fromSubmission = new Set(
  db.prepare("SELECT paper_id FROM paper_submissions WHERE paper_id IS NOT NULL")
    .all().map((r) => r.paper_id)
);
const papers = db.prepare("SELECT id, title, year, authors, authors_json FROM papers ORDER BY year DESC, id DESC").all();

let hits = 0;
for (const p of papers) {
  const tokens = String(p.authors || "").split(",").map((t) => t.trim()).filter(Boolean);
  const vn = tokens.filter((t) => VN_RE.test(t));
  if (vn.length === 0) continue;
  hits++;

  const origin = fromSubmission.has(p.id) ? "nop-bai" : p.authors_json ? "app" : "legacy";
  console.log(`#${p.id} [${origin}] ${p.year} — ${p.title.slice(0, 70)}`);
  console.log(`   byline: ${p.authors}`);
  console.log(
    `   tên tiếng Việt: ${vn.map((t) => {
      const l = lecturerByKey.get(key(t.replace(/^(GS\.TS|PGS\.TS|TS|ThS|NCS|CN|CĐ|TC|CL|KS)\.\s*/, "")));
      return l ? `${t} (= GV #${l.id})` : t;
    }).join(" | ")}`
  );
}

console.log(`\n${hits}/${papers.length} bài có tên tác giả tiếng Việt.`);
console.log("Sửa: mở bài trong app -> ô tên tác giả sửa thành tên như in trên bài.");
console.log("Đổi tên KHÔNG làm mất liên kết giảng viên/KPI (tên và liên kết là hai trường riêng).");
