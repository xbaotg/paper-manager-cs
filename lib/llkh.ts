// Lý lịch khoa học (UIT / ĐHQG-HCM scientific-CV form) data model. These are the
// fields NOT derivable from the publication database — a lecturer fills them in
// once and they are merged with the auto-generated publication list at export.
// Stored as a single JSON blob (see lib/queries/llkh.ts); pure + isomorphic so
// both the editor (client) and the export builder (server/client) share it.

export interface LlkhNgoaiNgu {
  name: string;        // tên ngoại ngữ
  nghe: string;        // Tốt | Khá | TB | ""
  noi: string;
  viet: string;
  doc: string;         // đọc hiểu tài liệu
}

export interface LlkhCongTac {
  from: string;        // "08/02/2018" / "2011"
  to: string;          // "Nay" / "02/2018"
  noi: string;         // nơi công tác
  chucVu: string;
}

export interface LlkhDaoTao {
  bac: string;         // Kỹ sư | Thạc sĩ | Tiến sĩ ...
  thoiGian: string;    // "4,5 năm" / "2"
  noi: string;         // nơi đào tạo
  nganh: string;       // chuyên ngành
  luanAn: string;      // tên luận án tốt nghiệp
}

export interface LlkhDeTai {
  ten: string;
  maSo: string;        // mã số & cấp quản lý
  thoiGian: string;
  kinhPhi: string;     // triệu đồng
  vaiTro: string;      // Chủ nhiệm | Thành viên
  ngayNghiemThu: string;
  ketQua: string;
}

export interface LlkhHuongDan {
  ten: string;         // tên SV/HVCH/NCS
  luanAn: string;
  namTN: string;       // năm tốt nghiệp
  bac: string;         // bậc đào tạo
  sanPham: string;     // sản phẩm của đề tài (mã số)
}

export interface LlkhSach {
  ten: string;
  sanPham: string;     // sản phẩm của đề tài (mã số)
  nhaXB: string;
  namXB: string;
  tacGia: string;      // tác giả / đồng tác giả
  butDanh: string;
}

export interface LlkhGiaiThuong {
  ten: string;         // hình thức & nội dung giải thưởng
  nam: string;         // năm tặng thưởng
}

export interface LlkhProfile {
  // I. THÔNG TIN CHUNG
  photo: string;               // ảnh 4x6, data URI (base64), shown in the export header
  dob: string;                 // ngày sinh
  gender: string;              // Nam | Nữ
  truong: string;              // trường / viện
  khoa: string;                // phòng / khoa
  boMon: string;
  phongThiNghiem: string;
  chucVu: string;
  hocVi: string;               // học vị
  hocViYear: string;           // năm đạt
  hocHam: string;              // học hàm
  hocHamYear: string;          // năm phong
  diaChiCoQuan: string;
  diaChiCaNhan: string;
  dienThoaiCoQuan: string;
  faxCoQuan: string;
  dienThoaiCaNhan: string;
  email: string;
  orcid: string;               // mã ORCID
  gioiThieu: string;           // giới thiệu / tiểu sử
  ngoaiNgu: LlkhNgoaiNgu[];
  congTac: LlkhCongTac[];      // 9. thời gian công tác
  daoTao: LlkhDaoTao[];        // 10. quá trình đào tạo
  linhVucChuyenMon: string;    // 11.1 - Lĩnh vực
  chuyenNganh: string;         // 11.1 - Chuyên ngành
  chuyenMon: string;           // 11.1 - Chuyên môn
  huongNghienCuu: string;      // 11.2 (legacy: chuỗi nhiều dòng — không còn dùng để nhập)
  huongNghienCuuList: string[]; // 11.2 (canonical: mỗi hướng một dòng)

  // II. NGHIÊN CỨU VÀ GIẢNG DẠY
  deTai: LlkhDeTai[];
  huongDan: LlkhHuongDan[];

  // III.1 Sách (publications themselves are derived from the papers DB)
  sachQuocTe: LlkhSach[];
  sachTrongNuoc: LlkhSach[];

  // IV. CÁC GIẢI THƯỞNG
  giaiThuong: LlkhGiaiThuong[];
  patent: string;              // 2. bằng phát minh, sáng chế
  giaiPhapHuuIch: string;      // 3. bằng giải pháp hữu ích

  // V. THÔNG TIN KHÁC
  thongTinKhac: string;
}

export const EMPTY_LLKH: LlkhProfile = {
  photo: "",
  dob: "",
  gender: "",
  truong: "Trường Đại học Công nghệ Thông tin (ĐHQG-HCM)",
  khoa: "Khoa Khoa học Máy tính",
  boMon: "",
  phongThiNghiem: "",
  chucVu: "",
  hocVi: "",
  hocViYear: "",
  hocHam: "",
  hocHamYear: "",
  diaChiCoQuan: "Trường ĐH CNTT, Khu phố 6, P.Linh Trung, TP. Thủ Đức, TP.HCM",
  diaChiCaNhan: "",
  dienThoaiCoQuan: "",
  faxCoQuan: "",
  dienThoaiCaNhan: "",
  email: "",
  orcid: "",
  gioiThieu: "",
  ngoaiNgu: [],
  congTac: [],
  daoTao: [],
  linhVucChuyenMon: "",
  chuyenNganh: "",
  chuyenMon: "",
  huongNghienCuu: "",
  huongNghienCuuList: [],
  deTai: [],
  huongDan: [],
  sachQuocTe: [],
  sachTrongNuoc: [],
  giaiThuong: [],
  patent: "",
  giaiPhapHuuIch: "",
  thongTinKhac: "",
};

// Coerce an arbitrary parsed JSON (possibly partial / from an older shape) into a
// complete LlkhProfile, so the editor + export never hit undefined fields.
export function normalizeLlkh(raw: unknown): LlkhProfile {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  // 11.2: prefer the new list; fall back to splitting the legacy multi-line string
  // so old blobs surface as rows in the editor/export.
  const legacyHuong = str(o.huongNghienCuu);
  const huongList = Array.isArray(o.huongNghienCuuList)
    ? (o.huongNghienCuuList as unknown[]).map(str).map((s) => s.trim()).filter(Boolean)
    : legacyHuong
      ? legacyHuong.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
      : [];
  return {
    ...EMPTY_LLKH,
    ...o,
    // Re-coerce the scalar string fields (guard against null/number).
    photo: str(o.photo),
    dob: str(o.dob), gender: str(o.gender),
    truong: str(o.truong) || EMPTY_LLKH.truong,
    khoa: str(o.khoa) || EMPTY_LLKH.khoa,
    boMon: str(o.boMon), phongThiNghiem: str(o.phongThiNghiem), chucVu: str(o.chucVu),
    hocVi: str(o.hocVi), hocViYear: str(o.hocViYear),
    hocHam: str(o.hocHam), hocHamYear: str(o.hocHamYear),
    diaChiCoQuan: str(o.diaChiCoQuan) || EMPTY_LLKH.diaChiCoQuan,
    diaChiCaNhan: str(o.diaChiCaNhan),
    dienThoaiCoQuan: str(o.dienThoaiCoQuan), faxCoQuan: str(o.faxCoQuan),
    dienThoaiCaNhan: str(o.dienThoaiCaNhan), email: str(o.email),
    orcid: str(o.orcid), gioiThieu: str(o.gioiThieu),
    linhVucChuyenMon: str(o.linhVucChuyenMon),
    chuyenNganh: str(o.chuyenNganh), chuyenMon: str(o.chuyenMon),
    huongNghienCuu: legacyHuong, huongNghienCuuList: huongList,
    patent: str(o.patent), giaiPhapHuuIch: str(o.giaiPhapHuuIch), thongTinKhac: str(o.thongTinKhac),
    ngoaiNgu: arr<LlkhNgoaiNgu>(o.ngoaiNgu),
    congTac: arr<LlkhCongTac>(o.congTac),
    daoTao: arr<LlkhDaoTao>(o.daoTao),
    deTai: arr<LlkhDeTai>(o.deTai),
    huongDan: arr<LlkhHuongDan>(o.huongDan),
    sachQuocTe: arr<LlkhSach>(o.sachQuocTe),
    sachTrongNuoc: arr<LlkhSach>(o.sachTrongNuoc),
    giaiThuong: arr<LlkhGiaiThuong>(o.giaiThuong),
  };
}
