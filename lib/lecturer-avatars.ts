import type BetterSqlite3 from "better-sqlite3";

// Lecturer portrait URLs scraped from the faculty directory
// (https://cs.uit.edu.vn/portfolio-teaches/). Each row carries BOTH the
// @uit.edu.vn email and the displayed name so the backfill can match a
// production lecturer by email first and fall back to a diacritic-insensitive
// name compare — production rows whose email differs from what was scraped
// would otherwise never match (the email-only migration 0009 missed them).
//
// NOTE: scripts/backfill-avatars.js keeps an inlined copy of this list for
// out-of-band ops use (it runs as plain node, not through the Next build).
// Keep the two in sync.
export interface LecturerAvatar {
  email: string;
  name: string;
  url: string;
}

export const LECTURER_AVATARS: LecturerAvatar[] = [
  { email: "chinhnt@uit.edu.vn", name: "Nguyễn Trọng Chỉnh", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00502-267x400.jpg" },
  { email: "diemntn@uit.edu.vn", name: "Nguyễn Thị Ngọc Diễm", url: "https://cs.uit.edu.vn/wp-content/uploads/2022/12/DiemNTN-267x400.jpg" },
  { email: "dungmt@uit.edu.vn", name: "Mai Tiến Dũng", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00295-267x400.jpg" },
  { email: "duyld@uit.edu.vn", name: "Lê Đình Duy", url: "https://cs.uit.edu.vn/wp-content/uploads/2022/12/DuyLD-267x400.jpg" },
  { email: "duyvnl@uit.edu.vn", name: "Võ Nguyễn Lê Duy", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00341-267x400.jpg" },
  { email: "hangdv@uit.edu.vn", name: "Dương Việt Hằng", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00419-267x400.jpg" },
  { email: "hiennd@uit.edu.vn", name: "Nguyễn Đình Hiển", url: "https://cs.uit.edu.vn/wp-content/uploads/2022/12/LD_00303-267x400.jpg" },
  { email: "hoangln@uit.edu.vn", name: "Lương Ngọc Hoàng", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00323-267x400.jpg" },
  { email: "khangtd@uit.edu.vn", name: "Trần Đình Khang", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00384-267x400.jpg" },
  { email: "khiemltt@uit.edu.vn", name: "Lê Trần Trọng Khiêm", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00392-267x400.jpg" },
  { email: "kietnt@uit.edu.vn", name: "Ngô Tuấn Kiệt", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00361-267x400.jpg" },
  { email: "thangcpd@uit.edu.vn", name: "Cáp Phạm Đình Thăng", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00310-267x400.jpg" },
  { email: "thanhnd@uit.edu.vn", name: "Ngô Đức Thành", url: "https://cs.uit.edu.vn/wp-content/uploads/2022/12/LD_00508-267x400.jpg" },
  { email: "thuonghtt@uit.edu.vn", name: "Huỳnh Thị Thanh Thương", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00412-267x400.jpg" },
  { email: "thuyentd@uit.edu.vn", name: "Trần Doãn Thuyên", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00372-267x400.jpg" },
  { email: "tiendv@uit.edu.vn", name: "Đỗ Văn Tiến", url: "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00354-267x400.jpg" },
  { email: "truonganpn@uit.edu.vn", name: "Phạm Nguyễn Trường An", url: "https://cs.uit.edu.vn/wp-content/uploads/2022/12/AnPNT-267x400.jpg" },
  { email: "uyenptt@uit.edu.vn", name: "Phạm Thị Thanh Uyên", url: "https://cs.uit.edu.vn/wp-content/uploads/2022/12/UyenPTT-267x400.jpg" },
];

// Normalize a Vietnamese name for matching: drop the academic-title prefix
// (TS. / ThS. / PGS.TS / CN / Cử nhân ...), strip diacritics, collapse
// whitespace, lowercase. Mirrors lib/text-match.ts but also removes the title.
export function normalizeLecturerName(name: string): string {
  return name
    .replace(/^(GS\.?\s*TS\.?|PGS\.?\s*TS\.?|TS\.?|ThS\.?|CN\.?|KS\.?|Cử\s+nhân)\s+/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

interface LecturerRow {
  id: number;
  name: string;
  email: string | null;
  avatar_url: string | null;
}

export interface AvatarBackfillResult {
  totalLecturers: number;
  alreadySet: number;
  changed: number;
  matchedByEmail: number;
  matchedByName: number;
  /** Avatar list entries that matched no lecturer at all (data drift signal). */
  unmatchedEntries: string[];
}

// Fill lecturers.avatar_url from LECTURER_AVATARS, only for rows still empty.
// Idempotent and non-destructive: never overwrites an existing photo. Matches
// by email (case-insensitive, trimmed) then by normalized name. Assumes the
// avatar_url column already exists (migration 0009 adds it; the standalone
// script adds it before calling).
export function backfillLecturerAvatars(db: BetterSqlite3.Database): AvatarBackfillResult {
  const rows = db
    .prepare("SELECT id, name, email, avatar_url FROM lecturers")
    .all() as LecturerRow[];

  const byEmail = new Map<string, LecturerAvatar>();
  const byName = new Map<string, LecturerAvatar>();
  for (const a of LECTURER_AVATARS) {
    byEmail.set(a.email.trim().toLowerCase(), a);
    byName.set(normalizeLecturerName(a.name), a);
  }

  const update = db.prepare("UPDATE lecturers SET avatar_url = ? WHERE id = ?");
  const usedEmails = new Set<string>();
  let changed = 0;
  let alreadySet = 0;
  let matchedByEmail = 0;
  let matchedByName = 0;

  const apply = db.transaction(() => {
    for (const r of rows) {
      if (r.avatar_url && r.avatar_url.trim() !== "") {
        alreadySet++;
        continue;
      }
      const email = (r.email ?? "").trim().toLowerCase();
      let hit = email ? byEmail.get(email) : undefined;
      if (hit) matchedByEmail++;
      if (!hit) {
        hit = byName.get(normalizeLecturerName(r.name));
        if (hit) matchedByName++;
      }
      if (hit) {
        update.run(hit.url, r.id);
        usedEmails.add(hit.email.toLowerCase());
        changed++;
      }
    }
  });
  apply();

  const unmatchedEntries = LECTURER_AVATARS
    .filter((a) => !usedEmails.has(a.email.toLowerCase()))
    .map((a) => `${a.name} <${a.email}>`);

  return {
    totalLecturers: rows.length,
    alreadySet,
    changed,
    matchedByEmail,
    matchedByName,
    unmatchedEntries,
  };
}
