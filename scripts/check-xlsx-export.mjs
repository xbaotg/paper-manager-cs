// Self-check for lib/xlsx-export.ts — run: node scripts/check-xlsx-export.mjs
// Builds a workbook, unzips it back with node:zlib and asserts the sheet XML.
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { buildPapersImportXlsx, PAPER_IMPORT_HEADERS } from "../lib/xlsx-export.ts";

// Read our own zip back: walk the local file headers from the front.
function unzip(buf) {
  const out = {};
  let i = 0;
  while (buf.readUInt32LE(i) === 0x04034b50) {
    const compSize = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const name = buf.subarray(i + 30, i + 30 + nameLen).toString("utf8");
    const start = i + 30 + nameLen + extraLen;
    out[name] = inflateRawSync(buf.subarray(start, start + compSize)).toString("utf8");
    i = start + compSize;
  }
  return out;
}

const papers = [
  {
    id: 1,
    title: "A <Fast> & Small Paper",
    year: 2025,
    pubMonth: 3,
    venue: "MMM",
    authors: "x",
    lecturerIds: [80197, 80273],
    authorLinks: [
      { name: "Ext Person", lecturerId: null },
      { name: "GV A", lecturerId: 80197 },
      { name: "GV B", lecturerId: 80273 },
    ],
    creditedLecturerId: 80273, // credited author must lead column G
    doi: "10.1109/x",
    submissionStatus: "published",
  },
  {
    id: 2,
    title: "Future Dated",
    year: 2099,
    pubMonth: null,
    venue: "ICCV",
    authors: "y",
    lecturerIds: [80001],
    submissionStatus: "accepted",
  },
];

const files = unzip(buildPapersImportXlsx(papers, "2026-07-21"));

// Package shape.
for (const part of [
  "[Content_Types].xml",
  "_rels/.rels",
  "xl/workbook.xml",
  "xl/_rels/workbook.xml.rels",
  "xl/worksheets/sheet1.xml",
  "xl/worksheets/sheet2.xml",
]) {
  assert.ok(files[part], `missing part ${part}`);
}
assert.match(files["xl/workbook.xml"], /name="Bài báo"/);
assert.match(files["xl/workbook.xml"], /name="Danh mục tham khảo"/);

// Cells reference the shared-string table, same as Excel's own output.
const strings = [...files["xl/sharedStrings.xml"].matchAll(/<si><t[^>]*>([^<]*)<\/t><\/si>/g)].map(
  (m) => m[1]
);
const sheet1 = files["xl/worksheets/sheet1.xml"];
const cell = (ref) => {
  const i = sheet1.match(new RegExp(`<c r="${ref}" t="s"><v>(\\d+)</v>`))?.[1];
  return i === undefined ? undefined : strings[Number(i)];
};

// Header row matches the official template, column for column.
PAPER_IMPORT_HEADERS.forEach((h, i) => {
  const ref = String.fromCharCode(65 + i) + "1";
  assert.equal(cell(ref), h.replace(/&/g, "&amp;"), `header ${ref}`);
});

// Row 2 = the 2099 paper (sorted newest first), clamped to today.
assert.equal(cell("B2"), "2026-07-21", "future date is clamped to today");
assert.equal(cell("G2"), "80001");

// Row 3 = the 2025 paper.
assert.equal(cell("A3"), "A &lt;Fast&gt; &amp; Small Paper", "XML-escaped title");
assert.equal(cell("B3"), "2025-03-01", "year + pubMonth");
assert.equal(cell("C3"), "MMM");
assert.equal(cell("E3"), "https://doi.org/10.1109/x", "DOI fallback when no url");
assert.equal(cell("G3"), "80273;80197", "credited lecturer leads, then author order");
assert.ok(cell("J3").startsWith("Công nghệ Thông tin"), "lĩnh vực prefilled");
assert.equal(cell("D3"), undefined, "untracked columns stay empty");

// Reference sheet carries both lookup lists.
assert.ok(strings.includes("NONE_GROUP"), "group codes present");
assert.ok(strings.includes("Lĩnh vực (chép đúng tên)"), "reference sheet header present");
assert.ok(files["xl/worksheets/sheet2.xml"].includes('<c r="C20"'), "reference sheet is fully written");

console.log("ok — xlsx export");
