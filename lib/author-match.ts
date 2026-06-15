// Author-name matching + ordered author-link reconstruction. Isomorphic (no
// server-only) so the editor and the bulk-attribution tool share one definition
// of "this author name is this lecturer" instead of re-implementing it ad hoc.

import { stringSimilarity } from "string-similarity-js";
import type { Lecturer } from "./data";

export interface AuthorLink {
  name: string;
  lecturerId: number | null;
}

// Diacritic-stripped, lowercased, alnum-only ("Ngô Đức Thành" -> "ngo duc thanh").
function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Word-order-insensitive key: "Thanh Duc Ngo" and "Ngô Đức Thành" both -> "duc ngo thanh".
function tokenKey(s: string): string {
  return normName(s).split(" ").filter(Boolean).sort().join(" ");
}

// 1.0 when the token sets are identical (same person across romanization / order),
// otherwise the bigram similarity of the normalized strings (order-tolerant).
export function nameMatchScore(authorName: string, lecturerName: string): number {
  const ak = tokenKey(authorName);
  const lk = tokenKey(lecturerName);
  if (ak && ak === lk) return 1;
  return stringSimilarity(normName(authorName), normName(lecturerName));
}

// Rebuild the ordered author list from the flat names string + the (orderless)
// linked-id set, pairing names to lecturers by token key. Any linked id whose
// name isn't found in the text is appended so no internal link is dropped. Used
// as the fallback for legacy papers that predate the stored authors_json.
export function reconstructAuthorLinks(
  authorsStr: string,
  lecturerIds: number[],
  lecturers: Lecturer[]
): AuthorLink[] {
  const names = (authorsStr || "").split(",").map((n) => n.trim()).filter(Boolean);
  const linked = lecturerIds
    .map((id) => lecturers.find((l) => l.id === id))
    .filter((l): l is Lecturer => !!l);
  const used = new Set<number>();
  const links: AuthorLink[] = names.map((name) => {
    const k = tokenKey(name);
    const m = k ? linked.find((l) => !used.has(l.id) && tokenKey(l.name) === k) : undefined;
    if (m) {
      used.add(m.id);
      return { name, lecturerId: m.id };
    }
    return { name, lecturerId: null };
  });
  for (const l of linked) {
    if (!used.has(l.id)) links.push({ name: l.name, lecturerId: l.id });
  }
  return links;
}
