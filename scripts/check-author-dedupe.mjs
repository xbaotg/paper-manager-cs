// Self-check for the author twin collapse — run: node scripts/check-author-dedupe.mjs
// Shapes are the real ones found in the production DB.
import assert from "node:assert/strict";
import { dedupeAuthorLinks, reconstructAuthorLinks } from "../lib/author-match.ts";

const LECTURERS = [
  { id: 80517, name: "Trần Doãn Thuyên" },
  { id: 80273, name: "Ngô Đức Thành" },
  { id: 80197, name: "Đỗ Văn Tiến" },
];
const shape = (links) => links.map((a) => `${a.name}#${a.lecturerId ?? "-"}`).join(", ");

// Today's shape: the byline name claims the link, the Vietnamese twin trails it.
// The byline name must survive — the old rule dropped it and kept the twin.
assert.equal(
  shape(dedupeAuthorLinks([
    { name: "Thuyen Tran", lecturerId: 80517 },
    { name: "Thanh Duc Ngo", lecturerId: 80273 },
    { name: "Trần Doãn Thuyên", lecturerId: null },
    { name: "Ngô Đức Thành", lecturerId: null },
  ])),
  "Thuyen Tran#80517, Thanh Duc Ngo#80273"
);

// Legacy shape: byline external, appended full name internal. Keep the byline
// name AND carry its link over.
assert.equal(
  shape(dedupeAuthorLinks([
    { name: "Tien Do", lecturerId: null },
    { name: "Đỗ Văn Tiến", lecturerId: 80197 },
  ])),
  "Tien Do#80197"
);

// Same person typed twice, one with an academic title.
assert.equal(
  shape(dedupeAuthorLinks([
    { name: "Mai Tiến Dũng", lecturerId: 80029 },
    { name: "TS. Mai Tiến Dũng", lecturerId: null },
  ])),
  "Mai Tiến Dũng#80029"
);

// Two unlinked authors are never merged on name alone, and two different
// lecturers stay separate.
const twoExternals = [{ name: "Tien Do", lecturerId: null }, { name: "Đỗ Văn Tiến", lecturerId: null }];
assert.equal(dedupeAuthorLinks(twoExternals).length, 2);
assert.equal(
  dedupeAuthorLinks([
    { name: "Thuyen Tran", lecturerId: 80517 },
    { name: "Thuyen Tran Doan", lecturerId: 80273 },
  ]).length,
  2
);

// End to end on the real row: reconstruct (no authors_json) then dedupe.
const byline =
  "Huy Nguyen Pham Gia, Dang Ngo Viet Tue, Hien Pham Duy, Bao Ta Cao Nguyen, Thuyen Tran, Thanh Duc Ngo, Trần Doãn Thuyên, Ngô Đức Thành";
const links = reconstructAuthorLinks(byline, [80517, 80273], LECTURERS).slice(0, byline.split(",").length);
const fixed = dedupeAuthorLinks(links);
assert.equal(
  fixed.map((a) => a.name).join(", "),
  "Huy Nguyen Pham Gia, Dang Ngo Viet Tue, Hien Pham Duy, Bao Ta Cao Nguyen, Thuyen Tran, Thanh Duc Ngo"
);
assert.deepEqual(fixed.filter((a) => a.lecturerId).map((a) => a.lecturerId), [80517, 80273]);

// A clean byline must come through untouched.
const clean = [
  { name: "Bao Tran", lecturerId: null },
  { name: "Tien Do", lecturerId: 80197 },
  { name: "Thanh Duc Ngo", lecturerId: 80273 },
];
assert.equal(shape(dedupeAuthorLinks(clean)), shape(clean));

console.log("author-dedupe OK");
