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

function tokens(s: string): string[] {
  return normName(s).split(" ").filter(Boolean);
}

// Word-order-insensitive key: "Thanh Duc Ngo" and "Ngô Đức Thành" both -> "duc ngo thanh".
function tokenKey(s: string): string {
  return [...tokens(s)].sort().join(" ");
}

// 1.0 when the token sets are identical (same person across romanization / order),
// otherwise the bigram similarity of the normalized strings (order-tolerant).
export function nameMatchScore(authorName: string, lecturerName: string): number {
  const ak = tokenKey(authorName);
  const lk = tokenKey(lecturerName);
  if (ak && ak === lk) return 1;
  return stringSimilarity(normName(authorName), normName(lecturerName));
}

// How strongly a byline name corresponds to a lecturer name when we already know
// they belong to the same paper. Bylines routinely drop the middle name or
// reorder words ("Tien Do" for "Đỗ Văn Tiến"), so identical token sets are scored
// 1.0 and otherwise we use token CONTAINMENT — the fraction of the shorter name's
// tokens found in the longer — requiring at least two shared tokens so a lone
// shared surname ("Do") can't trigger a false link.
function linkScore(bylineName: string, lecturerName: string): number {
  const a = new Set(tokens(bylineName));
  const b = new Set(tokens(lecturerName));
  if (a.size === 0 || b.size === 0) return 0;
  if (tokenKey(bylineName) === tokenKey(lecturerName)) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  if (inter < 2) return 0;
  return inter / Math.min(a.size, b.size);
}

const LINK_THRESHOLD = 0.6;

// Rebuild the ordered author list from the flat names string + the (orderless)
// linked-id set. Each byline name claims its best-matching linked lecturer
// (containment-based, greedy), so a shortened/reordered byline like "Tien Do"
// links to "Đỗ Văn Tiến" IN PLACE instead of leaving an external chip and
// appending the full name as a duplicate. Only lecturers that match no byline
// name at all are appended (e.g. an author auto-linked but absent from the byline).
// Used as the fallback for legacy papers that predate the stored authors_json.
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
    let best: Lecturer | null = null;
    let bestScore = 0;
    for (const l of linked) {
      if (used.has(l.id)) continue;
      const s = linkScore(name, l.name);
      if (s > bestScore) {
        bestScore = s;
        best = l;
      }
    }
    if (best && bestScore >= LINK_THRESHOLD) {
      used.add(best.id);
      return { name, lecturerId: best.id };
    }
    return { name, lecturerId: null };
  });
  for (const l of linked) {
    if (!used.has(l.id)) links.push({ name: l.name, lecturerId: l.id });
  }
  return links;
}

// Collapse the duplicate the old reconstruction produced: the byline entry
// ("Tien Do") plus a second entry carrying the lecturer's full Vietnamese name
// ("Đỗ Văn Tiến") for the SAME person.
//
// The EARLIER entry wins — it sits where the real byline put it, while the twin
// was appended at the end. Position decides, not the link: which twin holds the
// lecturerId flipped when reconstructAuthorLinks learned to link the byline name
// in place (it used to leave that one external and link only the appended full
// name), so keying on "drop the internal one" now deletes the byline name and
// keeps the Vietnamese duplicate. Order preserved; no-op without such a pair.
export function dedupeAuthorLinks(input: AuthorLink[]): AuthorLink[] {
  const links = input.map((a) => ({ ...a }));
  const removed = new Set<number>();
  for (let i = 0; i < links.length; i++) {
    if (removed.has(i)) continue;
    for (let j = i + 1; j < links.length; j++) {
      if (removed.has(j)) continue;
      const a = links[i];
      const b = links[j];
      // Two unlinked lookalikes are just two authors; only a lecturer link makes
      // them provably the same person (and two links must agree).
      if (a.lecturerId == null && b.lecturerId == null) continue;
      if (a.lecturerId != null && b.lecturerId != null && a.lecturerId !== b.lecturerId) continue;
      if (linkScore(b.name, a.name) < LINK_THRESHOLD) continue;
      a.lecturerId ??= b.lecturerId;
      removed.add(j);
    }
  }
  return links.filter((_, i) => !removed.has(i));
}
