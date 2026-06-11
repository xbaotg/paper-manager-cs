"use server";

import { getCurrentUser } from "@/lib/dal";
import { listLecturers } from "@/lib/queries/lecturers";
import { listPaperTitles } from "@/lib/queries/papers";
import { listAliases } from "@/lib/queries/aliases";
import { ensureVenuesHydrated } from "@/lib/queries/venues";
import {
  matchPaperData,
  searchOpenAlex,
  type ParsedAuthor,
} from "@/lib/bibtex";
import { titleSimilarity, findSimilarTitles } from "@/lib/text-match";
import {
  extractScholarUserId,
  fetchScholarProfile,
  splitScholarAuthors,
} from "@/lib/scholar";

// One reviewed-and-editable paper produced by a Scholar scan. Authors carry the
// same shape the BibTeX dialog already renders (rawName + suggested lecturer +
// top matches), so the review UI reuses LecturerCombobox unchanged.
export interface ScholarStagedPaper {
  title: string;
  year: number | "";
  venueRaw: string;
  venueCode: string; // matched catalog code, or "" when nothing matched
  authors: ParsedAuthor[];
  doi: string;
  url: string;
  duplicateOfId: number | null;
  duplicateTitle: string | null;
  source: "scholar" | "openalex";
}

export interface ScholarScanResult {
  ok: boolean;
  error?: string;
  profileName?: string;
  total?: number;
  papers: ScholarStagedPaper[];
}

// Bound a promise so one slow/hung enrichment can't stall the whole scan.
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(fallback);
      }
    }, ms);
    p.then((v) => {
      if (!done) {
        done = true;
        clearTimeout(t);
        resolve(v);
      }
    }).catch(() => {
      if (!done) {
        done = true;
        clearTimeout(t);
        resolve(fallback);
      }
    });
  });
}

// Concurrency-limited map (keeps OpenAlex enrichment polite + responsive).
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return out;
}

const TITLE_MATCH_THRESHOLD = 0.82; // OpenAlex hit must be this close to be trusted
const DUP_THRESHOLD = 0.85; // existing-paper "already imported" warning

// Scan a Google Scholar profile and return reviewed, editable paper drafts.
// Pipeline per paper: scrape row -> (simulate) search the title on OpenAlex to
// recover a clean venue / DOI / full author list -> fuzzy-match venue + authors
// against the catalog & faculty -> flag near-duplicate existing titles.
export async function scanScholarProfileServer(
  rawUrl: string
): Promise<ScholarScanResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Bạn cần đăng nhập.", papers: [] };

  const userId = extractScholarUserId(rawUrl);
  if (!userId) {
    return {
      ok: false,
      error:
        "Link Google Scholar không hợp lệ. Dán link hồ sơ dạng .../citations?user=XXXX",
      papers: [],
    };
  }

  let profile;
  try {
    profile = await fetchScholarProfile(userId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Quét thất bại.", papers: [] };
  }

  if (profile.papers.length === 0) {
    return {
      ok: false,
      error: "Không tìm thấy bài báo nào trong hồ sơ này (hoặc hồ sơ ở chế độ riêng tư).",
      profileName: profile.name,
      papers: [],
    };
  }

  // Venue catalog must be loaded so fuzzy venue matching sees runtime-added
  // venues (the in-memory cache is otherwise hydrated lazily on the client).
  ensureVenuesHydrated();
  const lecturers = listLecturers();
  const aliases = listAliases();
  const existingTitles = listPaperTitles();

  const staged = await mapPool(profile.papers, 6, async (raw) => {
    const scholarAuthors = splitScholarAuthors(raw.authorsRaw);

    // Local match from the Scholar row — always available as the fallback.
    const local = matchPaperData(
      raw.title,
      raw.year,
      raw.venueRaw,
      scholarAuthors,
      "",
      "",
      lecturers,
      aliases
    );

    // "Search the paper by name" on OpenAlex to enrich. Best-effort + bounded.
    const oa = await withTimeout(
      searchOpenAlex(raw.title, lecturers, aliases),
      5000,
      []
    );
    const hit = oa.find((r) => r.title && titleSimilarity(raw.title, r.title) >= TITLE_MATCH_THRESHOLD);

    const base = hit ?? local;
    const source: ScholarStagedPaper["source"] = hit ? "openalex" : "scholar";

    // Prefer Scholar's title (matches what the user sees on the profile) and
    // fill the year from whichever source has it.
    const title = raw.title || base.title;
    const year: number | "" =
      typeof raw.year === "number" ? raw.year : base.year || "";

    // Keep author display names verbatim; trim suggestion lists to bound payload.
    const authors: ParsedAuthor[] = (base.authors.length ? base.authors : local.authors).map(
      (a) => ({
        rawName: a.rawName,
        mappedLecturerId: a.mappedLecturerId,
        mappedByAlias: a.mappedByAlias,
        topMatches: a.topMatches.slice(0, 3),
      })
    );

    const dup = findSimilarTitles(title, existingTitles, {
      threshold: DUP_THRESHOLD,
      limit: 1,
    })[0];

    const stagedPaper: ScholarStagedPaper = {
      title,
      year,
      venueRaw: base.venueRaw || raw.venueRaw,
      venueCode: base.venueMatch?.code || "",
      authors,
      doi: base.doi || "",
      url: base.url || "",
      duplicateOfId: dup?.id ?? null,
      duplicateTitle: dup?.title ?? null,
      source,
    };
    return stagedPaper;
  });

  return {
    ok: true,
    profileName: profile.name,
    total: staged.length,
    papers: staged,
  };
}
