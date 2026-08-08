// Lays a lecturer's papers out as rows of the STM (Bộ KH&CN) "Thêm mới công bố
// khoa học" form. STM has no import function, so every publication is typed in
// by hand — the fields here are in the form's own on-screen order so the job is
// copy → paste → next field, with no digging back through the paper list.
//
// Pure + isomorphic like llkh-export: venue lookups read the in-memory catalog,
// so server callers must ensureVenuesHydrated() first. Keep it free of runtime
// app imports so scripts/check-stm-export.mjs can run it directly.

import { getVenueByCode, getVenueRankShort, isVenueScopus } from "./venues";
import { countsAsPublication, type Paper } from "./data";

export interface StmRow {
  id: number;
  loaiCongBo: string;
  tacGia: string;
  nam: string;
  tenCongTrinh: string;
  issn: string;
  phanLoai: string;
  ghiChu: string;
}

// The form's fields in screen order — one source of truth for both the CSV
// columns and the copy list. `required` marks STM's red asterisks.
export const STM_FIELDS: { key: keyof StmRow; label: string; required: boolean }[] = [
  { key: "loaiCongBo", label: "Loại công bố", required: true },
  { key: "tacGia", label: "Tên tác giả", required: true },
  { key: "nam", label: "Năm", required: true },
  { key: "tenCongTrinh", label: "Tên công trình", required: true },
  { key: "issn", label: "ISSN", required: true },
  { key: "phanLoai", label: "Phân loại", required: false },
  { key: "ghiChu", label: "Ghi chú", required: false },
];

// The "Loại công bố" dropdown option to pick. Same venue-type split the LLKH
// export uses (2 = international journal, 3 = domestic journal, anything else
// counts as proceedings), plus the uy tín / khác cut STM asks for: a journal
// that is ranked or Scopus/ISI-indexed is "uy tín".
export function stmLoaiCongBo(p: Paper): string {
  const t = getVenueByCode(p.venue)?.type ?? 0;
  if (t === 3) return "Bài báo đăng trên tạp chí trong nước";
  if (t === 2)
    return isVenueScopus(p.venue) || p.quartile
      ? "Bài báo đăng trên tạp chí quốc tế uy tín"
      : "Bài báo đăng trên tạp chí quốc tế khác";
  return "Báo cáo tại hội nghị, hội thảo khoa học quốc tế / quốc gia";
}

// Only accepted/published papers: STM is a publication register, so in-review
// and rejected ones have no business there (same rule as the .xlsx export).
export function stmRows(papers: Paper[]): StmRow[] {
  return papers
    .filter((p) => countsAsPublication(p.submissionStatus))
    .sort((a, b) => b.year - a.year || b.id - a.id)
    .map((p) => {
      const venueName = getVenueByCode(p.venue)?.nameEn?.trim() || p.venue;
      const link = p.url || (p.doi ? `https://doi.org/${p.doi}` : "");
      return {
        id: p.id,
        loaiCongBo: stmLoaiCongBo(p),
        tacGia: p.authors?.trim() ?? "",
        nam: String(p.year),
        tenCongTrinh: p.title,
        // ISSN is a property of the journal and we don't keep it — STM requires
        // it, so the UI flags the gap rather than shipping a wrong number.
        issn: "",
        phanLoai:
          (p.quartile || getVenueRankShort(p.venue) || (isVenueScopus(p.venue) ? "Scopus" : "")).trim(),
        // The form has no venue field at all, so the journal/conference name (plus
        // issue and link) rides along in Ghi chú instead of being lost.
        ghiChu: [venueName, p.volNoPp?.trim(), link].filter(Boolean).join(" — "),
      };
    });
}
