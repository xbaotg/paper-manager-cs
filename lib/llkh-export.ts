// Builds the Lý lịch khoa học as an HTML string that mirrors the official UIT /
// ĐHQG-HCM "Mẫu D03" form (logo + blue section headings + dotted tables, sections
// I–V, same labels and column layout), used for both the print/PDF window and the
// downloadable Word (.doc) file. Pure + isomorphic; venue lookups read the
// in-memory catalog, so the caller should hydrateVenues() first (the editor does).
// Publications are auto-classified from the papers DB into the form's 2.1–2.4
// buckets; everything else comes from the lecturer-filled LlkhProfile.

import { getVenueByCode, getVenueRankShort, isVenueScopus } from "./venues";
import { countsAsPublication, type Paper } from "./data";
import type { LlkhProfile } from "./llkh";
import { UIT_LOGO_DATA_URI } from "./llkh-logo";

export interface LlkhExportInput {
  lecturerName: string;
  lecturerTitle: string;
  profile: LlkhProfile;
  papers: Paper[];
  dateStr?: string; // "14 tháng 05 năm 2018" — caller supplies (no Date in lib helpers elsewhere)
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Citation line: "Authors, Title, Venue [Qx], Year."
function citation(p: Paper): string {
  const v = getVenueByCode(p.venue);
  const venueName = v?.nameEn?.trim() || p.venue;
  const rank = (p.quartile || getVenueRankShort(p.venue) || "").trim();
  const authors = p.authors?.trim() || "—";
  return `${authors}, ${p.title}, ${venueName}${rank ? ` (${rank})` : ""}, ${p.year}.`;
}

interface Classified {
  journalsQT: Paper[];
  journalsTN: Paper[];
  confQT: Paper[];
  confTN: Paper[];
}

// Split published/accepted papers by venue type:
//   2 journal -> international journal (2.1); 3 other/domestic journal -> 2.2;
//   1 conference -> international proceedings (2.3); 4 domestic conf -> 2.4.
//   Unknown/book(5) falls back to international proceedings.
export function classifyPapers(papers: Paper[]): Classified {
  const pub = papers
    .filter((p) => countsAsPublication(p.submissionStatus))
    .sort((a, b) => b.year - a.year || b.id - a.id);
  const out: Classified = { journalsQT: [], journalsTN: [], confQT: [], confTN: [] };
  for (const p of pub) {
    const t = getVenueByCode(p.venue)?.type ?? 0;
    if (t === 2) out.journalsQT.push(p);
    else if (t === 3) out.journalsTN.push(p);
    else if (t === 4) out.confTN.push(p);
    else out.confQT.push(p); // 1, 5, 0
  }
  return out;
}

// One blank cell repeated — used to pad empty form rows so the table keeps its
// shape (matches how the printed D03 ships with empty ruled rows).
function blanks(n: number): string {
  return "<td></td>".repeat(n);
}

// Publication table for one of the 2.1–2.4 buckets. Matches the D03 layout:
// TT | citation | Sản phẩm của đề tài | <col4Head> | <col5Head>. `col4` fills the
// ISSN/ISBN column (we only know the ISI flag, so it carries that for 2.1).
function pubTable(
  rows: Paper[],
  citationHead: string,
  col4Head: string,
  col5Head: string,
  col4: (p: Paper) => string
): string {
  const body = rows.length
    ? rows
        .map(
          (p, i) =>
            `<tr><td class="c">${i + 1}</td><td>${esc(citation(p))}</td><td></td><td class="c">${esc(
              col4(p)
            )}</td><td></td></tr>`
        )
        .join("")
    : `<tr><td class="c">1</td>${blanks(4)}</tr><tr><td class="c">2</td>${blanks(4)}</tr>`;
  return `<table><thead><tr>
    <th class="c" style="width:5%">TT</th>
    <th>${esc(citationHead)}</th>
    <th style="width:14%">Sản phẩm của đề tài/dự án<br/>(chỉ ghi mã số)</th>
    <th style="width:17%">${esc(col4Head)}</th>
    <th style="width:11%">${esc(col5Head)}</th></tr></thead>
    <tbody>${body}</tbody></table>`;
}

// Generic ruled table: numbered rows; when there are none, render `minRows`
// empty ruled rows so the form looks like the blank template.
function rowsTable(
  head: string[],
  widths: string[],
  rows: string[][],
  minRows = 2
): string {
  const th = head
    .map((h, i) => `<th style="width:${widths[i] ?? "auto"}">${esc(h)}</th>`)
    .join("");
  const body = rows.length
    ? rows
        .map(
          (r, i) =>
            `<tr><td class="c">${i + 1}</td>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`
        )
        .join("")
    : Array.from(
        { length: minRows },
        (_, i) => `<tr><td class="c">${i + 1}</td>${blanks(head.length)}</tr>`
      ).join("");
  return `<table><thead><tr><th class="c" style="width:5%">TT</th>${th}</tr></thead><tbody>${body}</tbody></table>`;
}

// Foreign-language proficiency table. The D03 form scores each of the four skills
// on a Tốt / Khá / TB scale, so every skill is three sub-columns. We map the
// lecturer's single stored grade onto whichever sub-column it names (an "x").
function ngoaiNguTable(P: LlkhProfile): string {
  const tk = (v: string): [string, string, string] => {
    const s = (v || "").toLowerCase();
    if (s.includes("tốt") || s.includes("tot") || s === "good") return ["x", "", ""];
    if (s.includes("khá") || s.includes("kha")) return ["", "x", ""];
    if (s.includes("tb") || s.includes("trung bình") || s.includes("trung binh")) return ["", "", "x"];
    return [v || "", "", ""]; // unknown grade: drop raw text under Tốt
  };
  const cell3 = (v: string) =>
    tk(v).map((m) => `<td class="c">${esc(m)}</td>`).join("");
  const body = P.ngoaiNgu.length
    ? P.ngoaiNgu
        .map(
          (n, i) =>
            `<tr><td class="c">${i + 1}</td><td>${esc(n.name)}</td>${cell3(n.nghe)}${cell3(
              n.noi
            )}${cell3(n.viet)}${cell3(n.doc)}</tr>`
        )
        .join("")
    : `<tr><td class="c">1</td>${blanks(13)}</tr><tr><td class="c">2</td>${blanks(13)}</tr>`;
  const sub = `<th class="c">Tốt</th><th class="c">Khá</th><th class="c">TB</th>`;
  return `<table><thead>
    <tr>
      <th class="c" rowspan="2" style="width:5%">TT</th>
      <th rowspan="2" style="width:21%">Tên ngoại ngữ</th>
      <th class="c" colspan="3">Nghe</th>
      <th class="c" colspan="3">Nói</th>
      <th class="c" colspan="3">Viết</th>
      <th class="c" colspan="3">Đọc hiểu tài liệu</th>
    </tr>
    <tr>${sub}${sub}${sub}${sub}</tr>
  </thead><tbody>${body}</tbody></table>`;
}

// 9. Thời gian công tác — one "Thời gian" column (Từ…nay / Từ…đến…), then
// Nơi công tác + Chức vụ.
function congTacTable(P: LlkhProfile): string {
  const body = P.congTac.length
    ? P.congTac
        .map(
          (c) =>
            `<tr><td>${esc(`Từ ${c.from || "…"} ${c.to ? `đến ${c.to}` : "đến nay"}`)}</td><td>${esc(
              c.noi
            )}</td><td>${esc(c.chucVu)}</td></tr>`
        )
        .join("")
    : `<tr><td>Từ…nay</td><td></td><td></td></tr><tr><td>Từ…đến…</td><td></td><td></td></tr>`;
  return `<table><thead>
    <tr><th style="width:24%">Thời gian</th><th>Nơi công tác</th><th style="width:24%">Chức vụ</th></tr>
  </thead><tbody>${body}</tbody></table>`;
}

// 10. Quá trình đào tạo — ships with the four standard levels as ruled rows.
const STANDARD_BAC = ["Đại học", "Thạc sỹ", "Tiến sỹ", "Tiến sỹ Khoa học"];
function daoTaoTable(P: LlkhProfile): string {
  const rows = P.daoTao.length
    ? P.daoTao.map((d) => [d.bac, d.thoiGian, d.noi, d.nganh, d.luanAn])
    : STANDARD_BAC.map((b) => [b, "", "", "", ""]);
  const body = rows
    .map(
      (r) =>
        `<tr><td>${esc(r[0])}</td><td class="c">${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(
          r[3]
        )}</td><td>${esc(r[4])}</td></tr>`
    )
    .join("");
  return `<table><thead><tr>
    <th style="width:16%">Bậc đào tạo</th>
    <th style="width:12%">Thời gian</th>
    <th style="width:24%">Nơi đào tạo</th>
    <th style="width:20%">Chuyên ngành</th>
    <th>Tên luận án tốt nghiệp</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function buildLlkhHtml(input: LlkhExportInput): string {
  const { lecturerName, lecturerTitle, profile: P, papers, dateStr } = input;
  const cls = classifyPapers(papers);
  const fullName = `${lecturerTitle ? lecturerTitle + ". " : ""}${lecturerName}`;
  const isiFlag = (p: Paper) => (isVenueScopus(p.venue) ? "ISI" : "");

  // labelled field: "<b>label</b> value"
  const fld = (label: string, val: string) =>
    `<p class="f"><b>${esc(label)}</b> <span class="v">${esc(val)}</span></p>`;

  const deTai = rowsTable(
    ["Tên đề tài/dự án", "Mã số & cấp quản lý", "Thời gian thực hiện", "Kinh phí (triệu đồng)", "Chủ nhiệm/Tham gia", "Ngày nghiệm thu", "Kết quả"],
    ["26%", "13%", "11%", "10%", "11%", "11%", "8%"],
    P.deTai.map((d) => [d.ten, d.maSo, d.thoiGian, d.kinhPhi, d.vaiTro, d.ngayNghiemThu, d.ketQua])
  );
  const huongDan = rowsTable(
    ["Tên SV, HVCH, NCS", "Tên luận án", "Năm tốt nghiệp", "Bậc đào tạo", "Sản phẩm của đề tài/dự án (chỉ ghi mã số)"],
    ["20%", "30%", "11%", "14%", "20%"],
    P.huongDan.map((h) => [h.ten, h.luanAn, h.namTN, h.bac, h.sanPham])
  );
  const sach = (rows: typeof P.sachQuocTe) =>
    rowsTable(
      ["Tên sách", "Sản phẩm của đề tài/ dự án (chỉ ghi mã số)", "Nhà xuất bản", "Năm xuất bản", "Tác giả/ đồng tác giả", "Bút danh"],
      ["28%", "16%", "15%", "10%", "16%", "10%"],
      rows.map((s) => [s.ten, s.sanPham, s.nhaXB, s.namXB, s.tacGia, s.butDanh])
    );
  const giaiThuong = rowsTable(
    ["Hình thức, nội dung giải thưởng", "Năm tặng thưởng"],
    ["73%", "22%"],
    P.giaiThuong.map((g) => [g.ten, g.nam])
  );

  const journalCiteHead =
    "Tên tác giả, tên bài viết, tên tạp chí và số của tạp chí, trang đăng bài viết, năm xuất bản";
  const confCiteHead =
    "Tên tác giả, tên bài viết, tên Hội nghị, thời gian tổ chức, nơi tổ chức";

  const body = `
  <table class="head">
    <tr>
      <td class="logo"><img src="${UIT_LOGO_DATA_URI}" alt="UIT" /></td>
      <td class="orgcell">
        <p class="org">ĐẠI HỌC QUỐC GIA TP. HCM</p>
        <p class="org b">TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN</p>
      </td>
      <td class="mau">Mẫu D03</td>
    </tr>
  </table>
  <div class="photo">Ảnh<br/>4x6</div>
  <div class="center titleblock">
    <h1>LÝ LỊCH KHOA HỌC</h1>
    <p class="note">(Thông tin trong 5 năm gần nhất và có liên quan trực tiếp đến đề tài/dự án đăng ký)</p>
  </div>

  <h2>I. THÔNG TIN CHUNG</h2>
  ${fld("1. Họ và tên:", fullName)}
  <p class="f"><b>2. Ngày sinh:</b> <span class="v">${esc(P.dob)}</span></p>
  <p class="f"><b>3. Nam/nữ:</b> <span class="v">${esc(P.gender)}</span></p>
  <p class="f"><b>4. Nơi đang công tác:</b></p>
  <div class="indent">
    ${fld("Trường/viện:", P.truong)}
    ${fld("Phòng/ Khoa:", P.khoa)}
    ${fld("Bộ môn:", P.boMon)}
    ${fld("Phòng thí nghiệm:", P.phongThiNghiem)}
    ${fld("Chức vụ:", P.chucVu)}
  </div>
  <p class="f"><b>5. Học vị:</b> <span class="v">${esc(P.hocVi)}</span>
     &nbsp;&nbsp;&nbsp;&nbsp;năm đạt: <span class="v">${esc(P.hocViYear)}</span></p>
  <p class="f"><b>6. Học hàm:</b> <span class="v">${esc(P.hocHam)}</span>
     &nbsp;&nbsp;&nbsp;&nbsp;năm phong: <span class="v">${esc(P.hocHamYear)}</span></p>
  <p class="f"><b>7. Liên lạc:</b></p>
  <table>
    <thead><tr><th class="c" style="width:5%">TT</th><th style="width:23%"></th><th>Cơ quan</th><th>Cá nhân</th></tr></thead>
    <tbody>
      <tr><td class="c">1</td><td><b>Địa chỉ</b></td><td>${esc(P.diaChiCoQuan)}</td><td>${esc(P.diaChiCaNhan)}</td></tr>
      <tr><td class="c">2</td><td><b>Điện thoại/ fax</b></td><td>${esc([P.dienThoaiCoQuan, P.faxCoQuan].filter(Boolean).join(" / "))}</td><td>${esc(P.dienThoaiCaNhan)}</td></tr>
      <tr><td class="c">3</td><td><b>Email</b></td><td>${esc(P.email)}</td><td></td></tr>
    </tbody>
  </table>
  <p class="f"><b>8. Trình độ ngoại ngữ:</b></p>
  ${ngoaiNguTable(P)}
  <p class="f"><b>9. Thời gian công tác:</b></p>
  ${congTacTable(P)}
  <p class="f"><b>10. Quá trình đào tạo:</b></p>
  ${daoTaoTable(P)}
  <p class="f"><b>11. Các lĩnh vực chuyên môn và hướng nghiên cứu</b></p>
  <div class="indent">
    <p class="f"><i>11.1 Lĩnh vực chuyên môn:</i></p>
    <div class="indent">${fld("- Lĩnh vực:", P.linhVucChuyenMon)}
    <p class="f"><b>- Chuyên ngành:</b></p>
    <p class="f"><b>- Chuyên môn:</b></p></div>
    <p class="f"><i>11.2 Hướng nghiên cứu:</i></p>
    <div class="indent pre">${esc(P.huongNghienCuu)}</div>
  </div>

  <h2>II. NGHIÊN CỨU VÀ GIẢNG DẠY</h2>
  <p class="f"><b>1. Đề tài/dự án</b></p>
  ${deTai}
  <p class="f"><b>2. Hướng dẫn sinh viên, học viên cao học, nghiên cứu sinh</b></p>
  ${huongDan}

  <h2>III. CÁC CÔNG TRÌNH ĐÃ CÔNG BỐ</h2>
  <p class="f"><b>1. Sách</b></p>
  <p class="sub">1.1 Sách xuất bản Quốc tế</p>
  ${sach(P.sachQuocTe)}
  <p class="sub">1.2. Sách xuất bản trong nước</p>
  ${sach(P.sachTrongNuoc)}
  <p class="f"><b>2. Các bài báo</b></p>
  <p class="sub">2.1. Đăng trên tạp chí Quốc tế</p>
  ${pubTable(cls.journalsQT, journalCiteHead, "Số hiệu ISSN (ghi rõ thuộc ISI hay không)", "Điểm IF", isiFlag)}
  <p class="sub">2.2. Đăng trên tạp chí trong nước</p>
  ${pubTable(cls.journalsTN, journalCiteHead, "Số hiệu ISSN", "Ghi chú", () => "")}
  <p class="sub">2.3. Đăng trên kỷ yếu Hội nghị Quốc tế</p>
  ${pubTable(cls.confQT, confCiteHead, "Số hiệu ISBN", "Ghi chú", () => "")}
  <p class="sub">2.4. Đăng trên kỷ yếu Hội nghị trong nước</p>
  ${pubTable(cls.confTN, confCiteHead, "Số hiệu ISBN", "Ghi chú", () => "")}

  <h2>IV. CÁC GIẢI THƯỞNG</h2>
  <p class="f"><b>1. Các giải thưởng Khoa học và Công nghệ</b></p>
  ${giaiThuong}
  <p class="f"><b>2. Bằng phát minh, sáng chế (patent)</b></p>
  <div class="pre">${esc(P.patent)}</div>
  <p class="f"><b>3. Bằng giải pháp hữu ích</b></p>
  <div class="pre">${esc(P.giaiPhapHuuIch)}</div>

  <h2>V. THÔNG TIN KHÁC</h2>
  <div class="pre">${esc(P.thongTinKhac)}</div>

  <table class="sign"><tr>
    <td style="width:50%"></td>
    <td class="center">
      <p class="datept">${dateStr ? `TP. Hồ Chí Minh, ngày ${esc(dateStr)}` : "TP. Hồ Chí Minh, ngày … tháng … năm …"}</p>
      <p><b>Người khai</b></p>
      <p class="muted">(Họ tên và chữ ký)</p>
      <br/><br/><br/>
      <p><b>${esc(fullName)}</b></p>
    </td>
  </tr></table>`;

  const styles = `
    @page WordSection1 { size: 21cm 29.7cm; margin: 2cm 2cm 2cm 3cm; }
    div.WordSection1 { page: WordSection1; }
    body{font-family:"Times New Roman",serif;font-size:13pt;color:#000;line-height:1.4}
    .center{text-align:center}
    table.head{width:100%;border-collapse:collapse;margin:0}
    table.head td{border:none;padding:0;vertical-align:top}
    table.head td.logo{width:70px}
    table.head td.logo img{width:64px;height:auto}
    .orgcell{padding-top:6px}
    .org{margin:0;font-size:13pt}
    .org.b{font-weight:bold;text-transform:uppercase}
    .mau{text-align:right;font-style:italic;font-size:12pt;white-space:nowrap}
    .photo{float:right;border:1px solid #000;width:2.6cm;height:3.4cm;line-height:1.3;font-size:12pt;text-align:center;padding-top:1.1cm;box-sizing:border-box;margin:4px 0 6px}
    .titleblock{clear:none}
    h1{font-size:17pt;font-weight:bold;margin:6px 0 2px;text-transform:uppercase}
    .note{font-style:italic;font-size:12.5pt;margin:0 0 10px;color:#c00000}
    h2{font-size:13pt;font-weight:bold;margin:16px 0 6px;text-transform:uppercase;color:#1f4e9f;clear:both}
    p{margin:4px 0}
    p.f{margin:3px 0}
    .indent{margin-left:24px}
    .sub{font-style:italic;font-weight:bold;margin:8px 0 4px}
    .pre{white-space:pre-wrap;margin:2px 0 6px;min-height:20px}
    table{width:100%;border-collapse:collapse;margin:4px 0 12px;font-size:12pt}
    th,td{border:1px dotted #000;padding:4px 6px;vertical-align:top;text-align:left}
    th{font-weight:bold;font-style:italic;text-align:center}
    td.c,th.c{text-align:center}
    .muted{font-style:italic}
    .datept{font-style:italic;margin-bottom:2px}
    table.sign{border:none;margin-top:24px}
    table.sign td{border:none}
    @media print{body{margin:0}}`;

  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<title>LLKH — ${esc(lecturerName)}</title><style>${styles}</style></head>
<body><div class="WordSection1">${body}</div></body></html>`;
}
