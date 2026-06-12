// Builds the full Lý lịch khoa học document (UIT form) as an HTML string, used
// for both the print/PDF window and the downloadable Word (.doc) file. Pure +
// isomorphic; venue lookups read the in-memory catalog, so the caller should
// hydrateVenues() first (the editor does). Publications are auto-classified from
// the papers DB into the form's 2.1–2.4 buckets; everything else comes from the
// lecturer-filled LlkhProfile.

import { getVenueByCode, getVenueRankShort } from "./venues";
import { countsAsPublication, type Paper } from "./data";
import type { LlkhProfile } from "./llkh";

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

function pubTable(rows: Paper[], extraHead: string): string {
  const body = rows.length
    ? rows
        .map(
          (p, i) =>
            `<tr><td class="c">${i + 1}</td><td>${esc(citation(p))}</td><td></td><td></td></tr>`
        )
        .join("")
    : `<tr><td class="c">—</td><td colspan="3" class="muted">(Chưa có)</td></tr>`;
  return `<table><thead><tr><th class="c" style="width:5%">TT</th>
    <th>Tên tác giả, tên bài viết, tên tạp chí/hội nghị, số, trang, năm</th>
    <th style="width:14%">Sản phẩm đề tài</th><th style="width:16%">${extraHead}</th></tr></thead>
    <tbody>${body}</tbody></table>`;
}

function rowsTable(
  head: string[],
  widths: string[],
  rows: string[][]
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
    : `<tr><td class="c">—</td><td colspan="${head.length - 1}" class="muted">(Chưa có)</td></tr>`;
  return `<table><thead><tr><th class="c" style="width:5%">TT</th>${th}</tr></thead><tbody>${body}</tbody></table>`;
}

export function buildLlkhHtml(input: LlkhExportInput): string {
  const { lecturerName, lecturerTitle, profile: P, papers, dateStr } = input;
  const cls = classifyPapers(papers);

  const fld = (label: string, val: string) =>
    `<p><b>${esc(label)}</b> ${esc(val) || "&nbsp;"}</p>`;

  const ngoaiNgu = rowsTable(
    ["Tên ngoại ngữ", "Nghe", "Nói", "Viết", "Đọc hiểu"],
    ["32%", "16%", "16%", "16%", "15%"],
    P.ngoaiNgu.map((n) => [n.name, n.nghe, n.noi, n.viet, n.doc])
  );
  const congTac = rowsTable(
    ["Từ", "Đến", "Nơi công tác", "Chức vụ"],
    ["14%", "14%", "45%", "22%"],
    P.congTac.map((c) => [c.from, c.to, c.noi, c.chucVu])
  );
  const daoTao = rowsTable(
    ["Bậc đào tạo", "Thời gian", "Nơi đào tạo", "Chuyên ngành", "Tên luận án"],
    ["14%", "12%", "24%", "20%", "25%"],
    P.daoTao.map((d) => [d.bac, d.thoiGian, d.noi, d.nganh, d.luanAn])
  );
  const deTai = rowsTable(
    ["Tên đề tài/dự án", "Mã số & cấp QL", "Thời gian", "Kinh phí", "Vai trò", "Ngày nghiệm thu", "Kết quả"],
    ["28%", "14%", "9%", "8%", "10%", "12%", "9%"],
    P.deTai.map((d) => [d.ten, d.maSo, d.thoiGian, d.kinhPhi, d.vaiTro, d.ngayNghiemThu, d.ketQua])
  );
  const huongDan = rowsTable(
    ["Tên SV/HVCH/NCS", "Tên luận án", "Năm TN", "Bậc đào tạo", "Sản phẩm đề tài"],
    ["22%", "32%", "10%", "16%", "15%"],
    P.huongDan.map((h) => [h.ten, h.luanAn, h.namTN, h.bac, h.sanPham])
  );
  const sach = (rows: typeof P.sachQuocTe) =>
    rowsTable(
      ["Tên sách", "Sản phẩm đề tài", "Nhà XB", "Năm XB", "Tác giả/đồng TG", "Bút danh"],
      ["30%", "14%", "16%", "10%", "16%", "9%"],
      rows.map((s) => [s.ten, s.sanPham, s.nhaXB, s.namXB, s.tacGia, s.butDanh])
    );
  const giaiThuong = rowsTable(
    ["Hình thức & nội dung giải thưởng", "Năm tặng thưởng"],
    ["75%", "20%"],
    P.giaiThuong.map((g) => [g.ten, g.nam])
  );

  const body = `
  <div class="center">
    <p class="org">ĐẠI HỌC QUỐC GIA TP. HỒ CHÍ MINH</p>
    <p class="org">TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN</p>
    <h1>LÝ LỊCH KHOA HỌC</h1>
    <p class="note">(Thông tin trong 5 năm gần nhất và có liên quan trực tiếp đến đề tài/dự án đăng ký)</p>
  </div>

  <h2>I. THÔNG TIN CHUNG</h2>
  ${fld("1. Họ và tên:", `${lecturerTitle ? lecturerTitle + ". " : ""}${lecturerName}`)}
  ${fld("2. Ngày sinh:", P.dob)}
  ${fld("3. Nam/Nữ:", P.gender)}
  <p><b>4. Nơi đang công tác:</b></p>
  <div class="indent">
    ${fld("Trường/Viện:", P.truong)}
    ${fld("Phòng/Khoa:", P.khoa)}
    ${fld("Bộ môn:", P.boMon)}
    ${fld("Phòng thí nghiệm:", P.phongThiNghiem)}
    ${fld("Chức vụ:", P.chucVu)}
  </div>
  ${fld("5. Học vị:", `${P.hocVi}${P.hocViYear ? `   — năm đạt: ${P.hocViYear}` : ""}`)}
  ${fld("6. Học hàm:", `${P.hocHam}${P.hocHamYear ? `   — năm phong: ${P.hocHamYear}` : ""}`)}
  <p><b>7. Liên lạc:</b></p>
  <table><thead><tr><th class="c" style="width:5%">TT</th><th style="width:19%"></th><th>Cơ quan</th><th>Cá nhân</th></tr></thead>
  <tbody>
    <tr><td class="c">1</td><td>Địa chỉ</td><td>${esc(P.diaChiCoQuan)}</td><td>${esc(P.diaChiCaNhan)}</td></tr>
    <tr><td class="c">2</td><td>Điện thoại / Fax</td><td>${esc([P.dienThoaiCoQuan, P.faxCoQuan].filter(Boolean).join(" / "))}</td><td>${esc(P.dienThoaiCaNhan)}</td></tr>
    <tr><td class="c">3</td><td>Email</td><td>${esc(P.email)}</td><td></td></tr>
  </tbody></table>
  <p><b>8. Trình độ ngoại ngữ:</b></p>
  ${ngoaiNgu}
  <p><b>9. Thời gian công tác:</b></p>
  ${congTac}
  <p><b>10. Quá trình đào tạo:</b></p>
  ${daoTao}
  <p><b>11. Các lĩnh vực chuyên môn và hướng nghiên cứu:</b></p>
  <div class="indent">
    ${fld("11.1 Lĩnh vực chuyên môn:", P.linhVucChuyenMon)}
    <p><b>11.2 Hướng nghiên cứu:</b></p>
    <div class="pre">${esc(P.huongNghienCuu)}</div>
  </div>

  <h2>II. NGHIÊN CỨU VÀ GIẢNG DẠY</h2>
  <p><b>1. Đề tài/dự án</b></p>
  ${deTai}
  <p><b>2. Hướng dẫn sinh viên, học viên cao học, nghiên cứu sinh</b></p>
  ${huongDan}

  <h2>III. CÁC CÔNG TRÌNH ĐÃ CÔNG BỐ</h2>
  <p><b>1. Sách</b></p>
  <p class="sub">1.1 Sách xuất bản Quốc tế</p>
  ${sach(P.sachQuocTe)}
  <p class="sub">1.2 Sách xuất bản trong nước</p>
  ${sach(P.sachTrongNuoc)}
  <p><b>2. Các bài báo</b></p>
  <p class="sub">2.1 Đăng trên tạp chí Quốc tế</p>
  ${pubTable(cls.journalsQT, "ISSN (ISI?) / IF")}
  <p class="sub">2.2 Đăng trên tạp chí trong nước</p>
  ${pubTable(cls.journalsTN, "ISSN / Ghi chú")}
  <p class="sub">2.3 Đăng trên kỷ yếu Hội nghị Quốc tế</p>
  ${pubTable(cls.confQT, "ISBN / Ghi chú")}
  <p class="sub">2.4 Đăng trên kỷ yếu Hội nghị trong nước</p>
  ${pubTable(cls.confTN, "ISBN / Ghi chú")}

  <h2>IV. CÁC GIẢI THƯỞNG</h2>
  <p><b>1. Các giải thưởng Khoa học và Công nghệ</b></p>
  ${giaiThuong}
  <p><b>2. Bằng phát minh, sáng chế (patent)</b></p>
  <div class="pre">${esc(P.patent)}</div>
  <p><b>3. Bằng giải pháp hữu ích</b></p>
  <div class="pre">${esc(P.giaiPhapHuuIch)}</div>

  <h2>V. THÔNG TIN KHÁC</h2>
  <div class="pre">${esc(P.thongTinKhac)}</div>

  <table class="sign"><tr>
    <td></td>
    <td class="center">
      <p>${dateStr ? `Ngày ${esc(dateStr)}` : "Ngày ….. tháng ….. năm ….."}</p>
      <p><b>Người khai</b></p>
      <p class="muted">(Ký và ghi rõ họ tên)</p>
      <br/><br/><br/>
      <p><b>${esc(`${lecturerTitle ? lecturerTitle + ". " : ""}${lecturerName}`)}</b></p>
    </td>
  </tr></table>`;

  const styles = `
    body{font-family:"Times New Roman",serif;font-size:13px;color:#000;line-height:1.45;max-width:900px;margin:24px auto;padding:0 28px}
    .center{text-align:center}
    .org{margin:0;font-weight:bold;font-size:13px}
    h1{font-size:18px;margin:10px 0 2px}
    .note{font-style:italic;margin:0 0 14px}
    h2{font-size:14px;margin:18px 0 8px;border-bottom:1px solid #000;padding-bottom:2px}
    p{margin:4px 0}
    .indent{margin-left:20px}
    .sub{font-style:italic;margin:8px 0 4px}
    .pre{white-space:pre-wrap;margin:2px 0 6px;min-height:16px}
    table{width:100%;border-collapse:collapse;margin:4px 0 10px;font-size:12px}
    th,td{border:1px solid #444;padding:4px 6px;vertical-align:top;text-align:left}
    th{background:#f0f0f0;font-weight:bold}
    td.c,th.c{text-align:center}
    .muted{color:#666;font-style:italic}
    table.sign{border:none;margin-top:24px}
    table.sign td{border:none}
    @media print{body{margin:0}}`;

  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<title>LLKH — ${esc(lecturerName)}</title><style>${styles}</style></head>
<body>${body}</body></html>`;
}
