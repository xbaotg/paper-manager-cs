// Self-check for lib/stm-export.ts — run: node scripts/check-stm-export.mjs
// Asserts the "Loại công bố" mapping and the field values the copy UI/CSV read.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// stm-export.ts imports ./venues and ./data at runtime, and node's TypeScript
// stripping doesn't add the extension back for extensionless specifiers.
registerHooks({
  resolve: (spec, ctx, next) =>
    next(spec.startsWith("./") && !spec.endsWith(".ts") ? `${spec}.ts` : spec, ctx),
});

const { stmRows, STM_FIELDS } = await import("../lib/stm-export.ts");

const base = { authors: "A, B", lecturerIds: [], submissionStatus: "published" };
const papers = [
  // ACCESS: type 2 + Q1 -> international journal, "uy tín"
  { ...base, id: 1, title: "Ranked journal", year: 2024, venue: "ACCESS",
    volNoPp: "Vol.12, No.3, pp.45-58", doi: "10.1109/x" },
  // AACL: type 1 conference -> proceedings
  { ...base, id: 2, title: "Conference paper", year: 2023, venue: "AACL", url: "https://x.test/p" },
  // type 3 -> domestic journal
  { ...base, id: 3, title: "Domestic journal", year: 2022, venue: "Cong nghe TTTT" },
  // unknown code: no venue row -> proceedings, no rank
  { ...base, id: 4, title: "Free text venue", year: 2021, venue: "Some Workshop 2021" },
  // not accepted/published -> dropped
  { ...base, id: 5, title: "Still in review", year: 2025, venue: "ACCESS", submissionStatus: "under_review" },
];

const rows = stmRows(papers);

assert.equal(rows.length, 4, "in-review papers must not reach STM");
assert.deepEqual(rows.map((r) => r.id), [1, 2, 3, 4], "newest year first");

const [journal, conf, domestic, unknown] = rows;
assert.equal(journal.loaiCongBo, "Bài báo đăng trên tạp chí quốc tế uy tín");
assert.equal(conf.loaiCongBo, "Báo cáo tại hội nghị, hội thảo khoa học quốc tế / quốc gia");
assert.equal(domestic.loaiCongBo, "Bài báo đăng trên tạp chí trong nước");
assert.equal(unknown.loaiCongBo, "Báo cáo tại hội nghị, hội thảo khoa học quốc tế / quốc gia");

assert.equal(journal.phanLoai, "Q1");
assert.equal(unknown.phanLoai, "", "unknown venue has no classification to offer");
assert.equal(journal.nam, "2024");
assert.equal(journal.tacGia, "A, B");
assert.equal(journal.issn, "", "ISSN is not tracked — the UI flags it");

// Ghi chú carries what the STM form has no field for: venue, issue, link.
assert.equal(journal.ghiChu, "IEEE Access — Vol.12, No.3, pp.45-58 — https://doi.org/10.1109/x");
assert.ok(conf.ghiChu.endsWith("https://x.test/p"), "url wins over a missing doi");
assert.equal(unknown.ghiChu, "Some Workshop 2021", "free-text venue passes through");

// Every field the CSV/copy UI renders must exist on the row.
for (const f of STM_FIELDS) assert.ok(f.key in journal, `missing field ${f.key}`);

console.log("stm-export OK —", rows.length, "rows,", STM_FIELDS.length, "fields");
