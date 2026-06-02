// Fuzzy title matching for duplicate-paper detection. Reuses string-similarity-js
// (already a dependency, used by lib/bibtex.ts) so no new package is added. Pure
// + isomorphic — safe to import from client components (the add-paper form) as
// well as the server.
import { stringSimilarity } from "string-similarity-js";

// Strip diacritics, lowercase, drop punctuation, collapse whitespace. Mirrors the
// normalizer in lib/bibtex.ts so venue/title matching behave consistently.
export function normalizeTitle(s: string): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Similarity in [0,1]. Exact-after-normalize short-circuits to 1.
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  return stringSimilarity(na, nb);
}

export interface TitleMatch {
  id: number;
  title: string;
  score: number; // 0..1
}

// Existing titles whose similarity to `title` is >= threshold (default 0.8),
// best first. Very short titles are ignored to avoid noise. `excludeId` skips the
// paper being edited so it never flags itself.
export function findSimilarTitles(
  title: string,
  existing: { id: number; title: string }[],
  opts: { threshold?: number; excludeId?: number | null; limit?: number } = {}
): TitleMatch[] {
  const { threshold = 0.8, excludeId = null, limit = 5 } = opts;
  if (normalizeTitle(title).length < 5) return [];
  const matches: TitleMatch[] = [];
  for (const e of existing) {
    if (excludeId != null && e.id === excludeId) continue;
    const score = titleSimilarity(title, e.title);
    if (score >= threshold) matches.push({ id: e.id, title: e.title, score });
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}
