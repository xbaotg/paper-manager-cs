// Builds the "mẫu import bài báo" .xlsx that the university's publication system
// ingests: a 14-column "Bài báo" sheet plus the "Danh mục tham khảo" lookup sheet,
// both copied from the official template (mau_import_bai_bao.xlsx).
//
// The .xlsx is written by hand rather than with a spreadsheet library: an xlsx is
// a zip of a few XML parts, and with inline strings there is no shared-string
// table and no styles to emit. node:zlib does the compression.
//
// ponytail: values only — no fonts, column widths or cell comments (the receiving
// system reads cell values). Reach for a real xlsx lib if formatting is ever needed.
// Keep this file free of runtime imports from the app so it stays directly
// runnable by scripts/check-xlsx-export.mjs.

import { deflateRawSync } from "node:zlib";
import type { Paper } from "./data";

// ---------- zip ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Deflate-compressed zip. Timestamps are fixed at 1980-01-01 so the same data
// always produces the same bytes (and so this stays a pure function).
function zip(entries: { name: string; text: string }[]): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const raw = Buffer.from(e.text, "utf8");
    const body = deflateRawSync(raw);
    const crc = crc32(raw);

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0); // local file header
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // method: deflate
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0x21, 12); // mod date: 1980-01-01
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    name.copy(local, 30);
    locals.push(local, body);

    const cd = Buffer.alloc(46 + name.length);
    cd.writeUInt32LE(0x02014b50, 0); // central directory header
    cd.writeUInt16LE(20, 4); // version made by
    cd.writeUInt16LE(20, 6); // version needed
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0x21, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt16LE(0, 30); // extra
    cd.writeUInt16LE(0, 32); // comment
    cd.writeUInt16LE(0, 34); // disk
    cd.writeUInt16LE(0, 36); // internal attrs
    cd.writeUInt32LE(0, 38); // external attrs
    cd.writeUInt32LE(offset, 42);
    name.copy(cd, 46);
    central.push(cd);

    offset += local.length + body.length;
  }

  const dir = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // end of central directory
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(dir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, eocd]);
}

// ---------- xlsx ----------

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 0 -> "A", 25 -> "Z", 26 -> "AA"
function colName(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; ) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = (n - r - 1) / 26;
  }
  return s;
}

// Every cell is text — including dates, which the template asks for as literal
// "YYYY-MM-DD". Strings go through the shared-string table (t="s") rather than
// inline: that is what Excel itself emits and what the official template uses, so
// importers that only ever learned to read sharedStrings still see our values.
function sheetXml(rows: string[][], sst: Map<string, number>): string {
  const intern = (v: string) => {
    let i = sst.get(v);
    if (i === undefined) sst.set(v, (i = sst.size));
    return i;
  };
  const body = rows
    .map(
      (cells, r) =>
        `<row r="${r + 1}">` +
        cells
          .map((v, c) => (v === "" ? "" : `<c r="${colName(c)}${r + 1}" t="s"><v>${intern(v)}</v></c>`))
          .join("") +
        `</row>`
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

export function buildXlsx(sheets: { name: string; rows: string[][] }[]): Buffer {
  const ids = sheets.map((_, i) => i + 1);
  const sstId = sheets.length + 1;

  // Render the sheets first so the shared-string table is complete.
  const sst = new Map<string, number>();
  const sheetParts = sheets.map((s, i) => ({
    name: `xl/worksheets/sheet${i + 1}.xml`,
    text: sheetXml(s.rows, sst),
  }));
  const totalCells = sheets.reduce(
    (n, s) => n + s.rows.reduce((m, row) => m + row.filter((v) => v !== "").length, 0),
    0
  );

  return zip([
    {
      name: "[Content_Types].xml",
      text:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        ids
          .map(
            (i) =>
              `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
          )
          .join("") +
        `<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>` +
        `</Types>`,
    },
    {
      name: "_rels/.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      text:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
        sheets
          .map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
          .join("") +
        `</sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      text:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        ids
          .map(
            (i) =>
              `<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`
          )
          .join("") +
        `<Relationship Id="rId${sstId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>` +
        `</Relationships>`,
    },
    ...sheetParts,
    {
      name: "xl/sharedStrings.xml",
      text:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${totalCells}" uniqueCount="${sst.size}">` +
        [...sst.keys()].map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("") +
        `</sst>`,
    },
  ]);
}

// ---------- the paper-import template ----------

// Sheet 1 header, in the exact order the importer expects. (*) = required there.
export const PAPER_IMPORT_HEADERS = [
  "Tên tiếng Anh (*)",
  "Ngày xuất bản (*)",
  "Tạp chí/Hội nghị (*)",
  "Vol/No/pp (*)",
  "Link tham chiếu (*)",
  "Link toàn văn PDF (*)",
  "Tác giả GV (magv) (*)",
  "Tác giả SV/HV (MSSV)",
  "Tên tiếng Việt",
  "Lĩnh vực",
  "Nhóm nghiên cứu",
  "Sản phẩm của đề tài",
  "UIT tài trợ",
  "Thông tin khác",
];

// Column J. Every paper here comes from Khoa Khoa học Máy tính, so the field is
// known — filling it saves whoever finishes the file a copy-down over every row.
const LINH_VUC_CNTT =
  "Công nghệ Thông tin & Truyền thông (gồm: Công nghệ thông tin, Điện - Điện tử - Vi Mạch)";

// Sheet 2, copied verbatim from the template: the receiving system's list of
// Lĩnh vực and research-group codes. Neither is derivable from our data, so it
// ships alongside the export for whoever fills those columns in.
const LINH_VUC_LIST = [
  "Công nghệ Hóa học và Vật liệu",
  LINH_VUC_CNTT,
  "Công nghệ sinh học & Khoa học Y sinh",
  "Cơ khí - Tự động hóa (gồm: Cơ khí - Tự động hóa, Kỹ thuật giao thông, Kỹ thuật xây dựng)",
  "Khoa học Cơ bản (gồm: Toán, Vật lý, Hóa, Sinh)",
  "Khoa học xã hội (gồm: Khoa học Xã hội và Nhân văn, Kinh tế - Luật - Quản lý)",
  "Môi trường & Năng lượng (gồm: Môi trường, Địa chất, Năng lượng)",
];

const NHOM_LIST: [string, string][] = [
  ["ASIC", "Thiết kế vi mạch ứng dụng đặc biệt"],
  ["B2DL", "Dữ liệu lớn và Học sâu"],
  ["BioMed", "Khoa học dữ liệu Y-Sinh"],
  ["CA", "Đại số giao hoán"],
  ["CEAI", "Kỹ thuật Máy tính và Trí tuệ Nhân tạo"],
  ["CRYPTO", "Mật Mã và Lý thuyết số"],
  ["DC-UIT", "DATA CHAIN (DC-UIT)"],
  ["FTISU", "Nhóm nghiên cứu dự báo HTTT (FTISU)"],
  ["IEC", "Tính toán cận biên thông minh"],
  ["KEG", "Công nghệ tri thức và Máy học"],
  ["NLP@UIT", "Nhóm xử lý ngôn ngữ tự nhiên UIT"],
  ["NONE_GROUP", "Không Thuộc Nhóm Nào"],
  ["OAC-TODS-RC", "Tối ưu và điều khiển; Lý thuyết hệ động lực; Giải tích ngẫu nhiên"],
  ["PTNATTT", "PTN An Toàn Thông Tin"],
  ["PTNHTTT", "PTN Hệ Thống Thông Tin"],
  ["PTNMMLAB", "PTN Truyền Thông & Đa Phương Tiện"],
  ["TTLab", "The Things Lab"],
  ["UTRG", "UIT-Sát Cánh"],
  ["UiTiOt", "Internet vạn vật, mạng không dây thế hệ mới"],
];

function referenceRows(): string[][] {
  const rows: string[][] = [["Lĩnh vực (chép đúng tên)", "Nhóm: MÃ", "Nhóm: Tên"]];
  for (let i = 0; i < NHOM_LIST.length; i++) {
    rows.push([LINH_VUC_LIST[i] ?? "", NHOM_LIST[i][0], NHOM_LIST[i][1]]);
  }
  return rows;
}

// Column B wants "YYYY-MM-DD" and rejects future dates. We store a year plus an
// optional month, so the day is always the 1st; a paper dated ahead of `today`
// (e.g. a plan-year row) is clamped back to it.
function pubDate(p: Paper, today: string): string {
  const m = p.pubMonth && p.pubMonth >= 1 && p.pubMonth <= 12 ? p.pubMonth : 1;
  const d = `${p.year}-${String(m).padStart(2, "0")}-01`;
  return d > today ? today : d; // ISO dates compare lexicographically
}

// Column G wants university staff codes (magv), leading with the author who gets
// the KPI. lecturers.id IS that code for everyone imported from the HR list;
// lecturers created inside this app get a Date.now() id, which the receiving
// system rejects on import — a loud, fixable failure, and a better outcome than
// dropping them here, which would silently hand the KPI slot to the next author.
function magvList(p: Paper): string {
  const ordered = (p.authorLinks ?? [])
    .map((a) => a.lecturerId)
    .filter((id): id is number => id != null);
  const ids = [...new Set([...ordered, ...(p.lecturerIds ?? [])])];
  const credited = p.creditedLecturerId;
  if (credited != null && ids.includes(credited)) {
    ids.splice(ids.indexOf(credited), 1);
    ids.unshift(credited);
  }
  return ids.join(";");
}

// `papers` must already be filtered to what should be exported (the caller drops
// anything not accepted/published). `today` is "YYYY-MM-DD".
export function buildPapersImportXlsx(papers: Paper[], today: string): Buffer {
  const rows = [PAPER_IMPORT_HEADERS];
  for (const p of [...papers].sort((a, b) => b.year - a.year || b.id - a.id)) {
    rows.push([
      p.title,
      pubDate(p, today),
      p.venue ?? "",
      "", // Vol/No/pp — not tracked here
      p.url || (p.doi ? `https://doi.org/${p.doi}` : ""),
      "", // full-text PDF link — not tracked here
      magvList(p),
      "", // student MSSV — not tracked here
      "", // Vietnamese title — not tracked here
      LINH_VUC_CNTT,
      "", // research group — blank means NONE_GROUP
      "", // Sản phẩm của đề tài — blank means "no"
      "", // UIT tài trợ
      "", // Thông tin khác
    ]);
  }
  return buildXlsx([
    { name: "Bài báo", rows },
    { name: "Danh mục tham khảo", rows: referenceRows() },
  ]);
}
