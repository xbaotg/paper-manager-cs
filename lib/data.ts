export type LecturerTitle = "GS.TS" | "PGS.TS" | "TS" | "ThS" | "CN" | "CĐ" | "TC" | "CL" | "KS";

// Normalized academic rank used by KPI logic (per-rank publication targets and
// the PhD roadmap). Distinct from the free-form `title`: it collapses titles
// into the 5 categories the department's targets are defined against. NCS
// (nghiên cứu sinh / PhD candidate) cannot be inferred from `title` and is set
// by a manager.
export type AcademicRank = "PGS.TS" | "TS" | "NCS" | "ThS" | "CN";

export interface Lecturer {
  id: number;
  name: string;
  email: string;
  title: LecturerTitle;
  department: string;
  phone?: string;
  academicRank?: AcademicRank;
  boMonId?: number | null;
  avatarUrl?: string | null; // profile photo URL (scraped from the faculty site); null -> initials fallback
}

export const ACADEMIC_RANK_LABELS: Record<AcademicRank, string> = {
  "PGS.TS": "Phó Giáo sư, Tiến sĩ",
  TS: "Tiến sĩ",
  NCS: "Nghiên cứu sinh",
  ThS: "Thạc sĩ",
  CN: "Cử nhân (trợ giảng/NCV)",
};

// Build a deterministic username from a Vietnamese full name. Pattern:
//   "Đỗ Văn Tiến"          -> "tiendv"
//   "Lê Trần Trọng Khiêm"  -> "khiemltt"
//   "Trần Doãn Thuyên"     -> "thuyentd"
// Diacritics stripped, đ/Đ → d/D, lowercased. Last word is the given name; the
// remaining words contribute their first letters as initials suffix.
export function generateLecturerUsername(fullName: string): string {
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/Đ/g, "D")
      .replace(/đ/g, "d")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  const parts = fullName.trim().split(/\s+/).map(normalize).filter(Boolean);
  if (parts.length === 0) return "";
  const given = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map((p) => p[0]).join("");
  return given + initials;
}

// Best-effort initial mapping from the free-form title to a normalized rank.
// Titles with no clean PhD/Master/Bachelor mapping fall back to ThS for target
// purposes; NCS is never inferred (managers promote manually).
export function academicRankFromTitle(title: string): AcademicRank {
  switch (title) {
    case "GS.TS":
    case "PGS.TS":
      return "PGS.TS";
    case "TS":
      return "TS";
    case "CN":
      return "CN";
    default:
      return "ThS"; // ThS, CĐ, TC, CL, KS
  }
}

// Submission pipeline state — what stage the paper is at in the journal/conf.
// Scopus eligibility is a property of the venue (see isVenueScopus), not the
// paper; a paper counts toward Scopus once its submission status is accepted.
export type SubmissionStatus =
  | "submitted"      // sent, waiting
  | "under_review"   // peer review
  | "rebuttal"       // rebuttal / author response phase
  | "accepted"       // accepted, not yet published
  | "denied"         // rejected
  | "published";     // published / appeared

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  submitted: "Đã gửi (chờ kết quả)",
  under_review: "Đang phản biện",
  rebuttal: "Phản hồi phản biện (rebuttal)",
  accepted: "Chấp nhận",
  denied: "Từ chối",
  published: "Đã xuất bản",
};

// Outline/border classes for the status badge, shared across every list/detail view.
export const SUBMISSION_STATUS_BADGE_CLASS: Record<SubmissionStatus, string> = {
  submitted: "text-slate-600 border-slate-400/50",
  under_review: "text-amber-600 border-amber-600/40",
  rebuttal: "text-orange-600 border-orange-600/40",
  accepted: "text-blue-600 border-blue-600/40",
  denied: "text-destructive border-destructive/40",
  published: "text-green-600 border-green-600/40",
};

// "Un-accepted" papers still moving through review — the ones that need follow-up.
// Excludes the terminal states (accepted / published / denied).
export const PENDING_SUBMISSION_STATUSES: SubmissionStatus[] = ["submitted", "under_review", "rebuttal"];

export function isPendingSubmission(s: SubmissionStatus | undefined | null): boolean {
  return PENDING_SUBMISSION_STATUSES.includes((s ?? "submitted") as SubmissionStatus);
}

// A paper counts toward a lecturer's publication TOTAL (profile headline,
// rank distribution, per-year chart) only once it is accepted (in-press) or
// published. The in-progress pipeline (submitted/under_review/rebuttal) and
// rejected (denied) papers are excluded and flagged as "not published" in lists.
export const PUBLICATION_COUNTED_STATUSES: SubmissionStatus[] = ["accepted", "published"];

export function countsAsPublication(s: SubmissionStatus | undefined | null): boolean {
  return PUBLICATION_COUNTED_STATUSES.includes((s ?? "submitted") as SubmissionStatus);
}

// True when a paper is not yet publicly published (anything other than the
// terminal "published" state) — drives the "chưa xuất bản" tag in lists.
export function isUnpublished(s: SubmissionStatus | undefined | null): boolean {
  return (s ?? "submitted") !== "published";
}

export interface Paper {
  id: number;
  title: string;
  year: number;
  venue: string;
  authors: string;
  lecturerIds: number[];
  doi?: string;
  url?: string;
  abstract?: string;
  pubMonth?: number | null;
  // Single-credit publication tracking (the dept counts one paper for one person).
  creditedLecturerId?: number | null;
  isFirstAuthor?: boolean;
  isCorrespondingAuthor?: boolean;
  quartile?: string | null;        // Q1..Q4 snapshot; null -> fall back to venue rank
  submissionStatus?: SubmissionStatus;
}

export const LECTURER_TITLE_LABELS: Record<LecturerTitle, string> = {
  "GS.TS": "Giáo sư, Tiến sĩ",
  "PGS.TS": "Phó Giáo sư, Tiến sĩ",
  TS: "Tiến sĩ",
  ThS: "Thạc sĩ",
  CĐ: "Cao đẳng",
  TC: "Trung cấp",
  CL: "Công nhân",
  CN: "Cử nhân",
  KS: "Kỹ sư",
};

export const SAMPLE_LECTURERS: Lecturer[] = [
  {
    id: 80001,
    name: "Phạm Nguyễn Trường An",
    email: "truonganpn@uit.edu.vn",
    title: "ThS",
    department: "Khoa KHMT",
  },
  {
    id: 80023,
    name: "Nguyễn Thị Ngọc Diễm",
    email: "diemntn@uit.edu.vn",
    title: "ThS",
    department: "Khoa KHMT",
  },
  {
    id: 80029,
    name: "Mai Tiến Dũng",
    email: "dungmt@uit.edu.vn",
    title: "TS",
    department: "Khoa KHMT",
  },
  {
    id: 80052,
    name: "Nguyễn Đình Hiển",
    email: "hiennd@uit.edu.vn",
    title: "PGS.TS",
    department: "Khoa KHMT",
  },
  {
    id: 80068,
    name: "Ngô Quốc Hưng",
    email: "hungnq@uit.edu.vn",
    title: "TS",
    department: "Khoa KHMT",
  },
  {
    id: 80070,
    name: "Huỳnh Thị Thanh Thương",
    email: "thuonghtt@uit.edu.vn",
    title: "TS",
    department: "Khoa KHMT",
  },
  {
    id: 80086,
    name: "Ngô Tuấn Kiệt",
    email: "kietnt@uit.edu.vn",
    title: "ThS",
    department: "Khoa KHMT",
  },
  {
    id: 80155,
    name: "Nguyễn Thị Quý",
    email: "quynt@uit.edu.vn",
    title: "TS",
    department: "Khoa KHMT",
  },
  {
    id: 80167,
    name: "Cáp Phạm Đình Thăng",
    email: "thangcpd@uit.edu.vn",
    title: "ThS",
    department: "Khoa KHMT",
  },
  {
    id: 80197,
    name: "Đỗ Văn Tiến",
    email: "tiendv@uit.edu.vn",
    title: "ThS",
    department: "Khoa KHMT",
  },
  {
    id: 80223,
    name: "Phạm Thị Thanh Uyên",
    email: "uyenptt@uit.edu.vn",
    title: "CN",
    department: "Khoa KHMT",
  },
  {
    id: 80226,
    name: "Nguyễn Bích Vân",
    email: "vannb@uit.edu.vn",
    title: "ThS",
    department: "Khoa KHMT",
  },
  {
    id: 80273,
    name: "Ngô Đức Thành",
    email: "thanhnd@uit.edu.vn",
    title: "TS",
    department: "Khoa KHMT",
  },
  {
    id: 80288,
    name: "Nguyễn Trọng Chỉnh",
    email: "chinhnt@uit.edu.vn",
    title: "TS",
    department: "Khoa KHMT",
  },
  {
    id: 80382,
    name: "Nguyễn Thanh Sơn",
    email: "sonnt@uit.edu.vn",
    title: "ThS",
    department: "Khoa KHMT",
  },
  {
    id: 80435,
    name: "Lương Ngọc Hoàng",
    email: "hoangln@uit.edu.vn",
    title: "TS",
    department: "Khoa KHMT",
  },
  {
    id: 80511,
    name: "Dương Việt Hằng",
    email: "hangdv@uit.edu.vn",
    title: "TS",
    department: "Khoa KHMT",
  },
  {
    id: 80517,
    name: "Trần Doãn Thuyên",
    email: "thuyentd@uit.edu.vn",
    title: "CN",
    department: "Khoa KHMT",
  },
  {
    id: 80518,
    name: "Trần Đình Khang",
    email: "khangtd@uit.edu.vn",
    title: "CN",
    department: "Khoa KHMT",
  },
  {
    id: 80546,
    name: "Võ Nguyễn Lê Duy",
    email: "duyvnl@uit.edu.vn",
    title: "TS",
    department: "Khoa KHMT",
  },
  {
    id: 80548,
    name: "Lê Trần Trọng Khiêm",
    email: "khiemltt@uit.edu.vn",
    title: "CN",
    department: "Khoa KHMT",
  },
  {
    id: 80566,
    name: "Phan Lê Sang",
    email: "sangpl@uit.edu.vn",
    title: "TS",
    department: "Khoa KHMT",
  },
  {
    id: 80573,
    name: "Phan Minh Quân",
    email: "quanpm@uit.edu.vn",
    title: "ThS",
    department: "Khoa KHMT",
  },
  {
    id: 80596,
    name: "Lê Thanh Bính",
    email: "binhlt@uit.edu.vn",
    title: "TS",
    department: "Khoa KHMT",
  },
  {
    id: 80606,
    name: "Huỳnh Tân Bối",
    email: "boiht@uit.edu.vn",
    title: "ThS",
    department: "Khoa KHMT",
  },
];


export const SAMPLE_PAPERS: Paper[] = [
  {
    id: 1,
    title: "CAD-DA: Controllable Anomaly Detection after Domain Adaptation by Statistical Inference",
    year: 2024,
    venue: "AISTATS",
    authors: "Vo Nguyen Le Duy, Hsuan-Tien Lin, Ichiro Takeuchi",
    lecturerIds: [80546],
  },
  {
    id: 2,
    title: "Bounded p values in parametric programming-based selective inference",
    year: 2024,
    venue: "JJSD",
    authors: "Tomohiro Shiraishi, Daiki Miwa, Vo Nguyen Le Duy & Ichiro Takeuchi",
    lecturerIds: [80546],
  },
  {
    id: 3,
    title: "Intelligent Problem Solver in Database Systems based on Ontology Integration through Text-to-SQL",
    year: 2024,
    venue: "FPA",
    authors: "Nguyen Dinh Hien, Truong Duc, Tran Phong Nha, Sang Vu, et al.",
    lecturerIds: [80052],
  },
  {
    id: 4,
    title: "Thiết Kế Trò Chơi Giáo Dục Hỗ Trợ Việc Đào Tạo Kĩ Năng Sống cho Trẻ Mầm Non",
    year: 2024,
    venue: "UTEJS",
    authors: "Viet Hung Nguyen, Thi Vuong Pham, Phuong Thao Nguyen, Nguyen Anh Dung Dinh, Dinh Hien Nguyen",
    lecturerIds: [80052],
  },
  {
    id: 5,
    title: "Tích hợp biểu diễn tri thức ontology và đồ thị tri thức cho hệ thống chatbot hỗ trợ truy vấn kiến thức trong giáo dục",
    year: 2024,
    venue: "HCMUE-JS",
    authors: "Nguyễn Viết Hưng, Lê Thị Ngọc Thảo, Nguyễn Văn Hậu, Nguyễn Đắc Long, Trần Phong Nhã, Nguyễn Đình Hiển",
    lecturerIds: [80052],
  },
  {
    id: 6,
    title: "Statistical Test for Attention Maps in Vision Transformers",
    year: 2024,
    venue: "ICML",
    authors: "Tomohiro Shiraishi, Daiki Miwa, Teruyuki Katsuoka, Vo Nguyen Le Duy, Ichiro Takeuchi",
    lecturerIds: [80546],
  },
  {
    id: 7,
    title: "Deep Learning Approaches for Vietnamese Sentiment Analysis on Social Media",
    year: 2023,
    venue: "RIVF",
    authors: "Tran Bao Gia, Nguyen Van Hieu, Le Thi Mai, Pham Duc Anh",
    lecturerIds: [],
  },
  {
    id: 8,
    title: "Knowledge Graph Embedding for Question Answering in Education Domain",
    year: 2023,
    venue: "KSE",
    authors: "Nguyen Dinh Hien, et al.",
    lecturerIds: [80052],
  },
  {
    id: 9,
    title: "Efficient Student Performance Prediction using Ensemble Learning Methods",
    year: 2023,
    venue: "NICS",
    authors: "Le Minh Tuan, Nguyen Viet Hung, Pham Thi Thu, Tran Van Duc",
    lecturerIds: [],
  },
  {
    id: 10,
    title: "A Novel Approach to Vietnamese Text Summarization using Transformer Models",
    year: 2022,
    venue: "SOICT",
    authors: "Nguyen Van Hau, Tran Phong Nha, Le Dac Long, Pham Quoc Viet",
    lecturerIds: [],
  },
  {
    id: 11,
    title: "Real-time Object Detection for Autonomous Driving in Vietnamese Traffic",
    year: 2022,
    venue: "ICCE",
    authors: "Vo Le Duy, Nguyen Anh Dung, Le Thi Ngoc Thao",
    lecturerIds: [80546],
  },
  {
    id: 12,
    title: "Blockchain-based Academic Credential Verification System",
    year: 2022,
    venue: "FAIR",
    authors: "Phan Thanh Son, Nguyen Dinh Hien, Le Minh Tuan, Vo Hung",
    lecturerIds: [80052],
  },
  {
    id: 13,
    title: "Multi-modal Learning for Vietnamese Medical Image Analysis",
    year: 2021,
    venue: "RIVF",
    authors: "Nguyen Van Hieu, Pham Duc Anh, Le Thi Mai",
    lecturerIds: [],
  },
  {
    id: 14,
    title: "Adaptive E-learning Platform with Personalized Content Recommendation",
    year: 2021,
    venue: "ICCASA",
    authors: "Tran Van Duc, Pham Thi Thu, Le Dac Long",
    lecturerIds: [],
  },
];
