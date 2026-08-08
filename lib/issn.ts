// ISSN lookup against OpenAlex — the same free catalog the BibTeX / Scholar
// import already queries, and it sends CORS headers, so this runs straight from
// the admin page with no server route or API key of its own.
//
// ISSN identifies the venue, not the article: one lookup fills the STM and D03
// field for every paper published there, past and future. Conferences count too
// — a proceedings series carries an ISSN (LNCS 0302-9743, CCIS 1865-0929), even
// though publishers like ACM give their volumes an ISBN and no ISSN at all.
//
// Pure + fetch only, no app imports — scripts/check-issn.mjs runs it directly.

const API = "https://api.openalex.org/";

export interface IssnHit {
  issn: string;
  name: string;   // OpenAlex display_name — shown so a human can tell the journals apart
  type: string;   // "journal" | "conference" | "repository" | ...
  works: number;  // publication count, for ranking ambiguous names
}

/** The fields we read off an OpenAlex `source` (a journal/proceedings series). */
interface OaSource {
  display_name?: string;
  issn_l?: string;
  issn?: string[];
  type?: string;
  works_count?: number;
}

/** The linking ISSN when OpenAlex has one, else the first listed. STM's field
 *  takes a single number, so pick rather than join the print/electronic pair.
 *
 *  Preprint servers are refused outright: arXiv has an ISSN (2331-8422), papers
 *  do get filed under an arXiv DOI, and that number would be flatly wrong on a
 *  publication record — the venue is the conference or journal that accepted
 *  the work, not the server it was posted to. */
export function pickIssn(source: OaSource | null | undefined): string {
  const s = source;
  if (s?.type === "repository") return "";
  const linking = typeof s?.issn_l === "string" ? s.issn_l.trim() : "";
  if (linking) return linking;
  const first = Array.isArray(s?.issn) ? String(s.issn[0] ?? "").trim() : "";
  return first;
}

/** Comparable form of a journal title: case, punctuation, "&"/"and" and a
 *  leading "The" all vary between our catalog and OpenAlex without meaning a
 *  different journal. Anything else does. */
export function normalizeTitle(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^\s*the\s+/, "")
    .trim();
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(API + path);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** ISSN of the journal a DOI was published in. Exact by construction — the DOI
 *  belongs to one article, which belongs to one venue. */
export async function issnByDoi(doi: string): Promise<IssnHit | null> {
  const clean = (doi || "").trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  if (!/^10\./.test(clean)) return null;
  const json = await getJson<{ primary_location?: { source?: OaSource | null } | null }>(
    `works/doi:${encodeURIComponent(clean)}?select=primary_location`
  );
  const src = json?.primary_location?.source;
  const issn = pickIssn(src);
  return issn ? { issn, name: src?.display_name ?? "", type: src?.type ?? "", works: 0 } : null;
}

/** Journals whose name matches, most-published first — the candidate list the
 *  venue form offers when a title is ambiguous. */
export async function issnByName(name: string, limit = 5): Promise<IssnHit[]> {
  const q = (name || "").trim();
  if (q.length < 3) return [];
  const json = await getJson<{ results?: OaSource[] }>(
    `sources?filter=display_name.search:${encodeURIComponent(q)}&per-page=${limit}&select=display_name,issn_l,issn,type,works_count`
  );
  return (json?.results ?? [])
    .map((r): IssnHit => ({
      issn: pickIssn(r),
      name: r.display_name ?? "",
      type: r.type ?? "",
      works: r.works_count ?? 0,
    }))
    .filter((h) => h.issn)
    .sort((a, b) => b.works - a.works);
}

export interface IssnResolution {
  issn: string;
  from: "doi" | "name" | "";
  hits: IssnHit[]; // name candidates, for the "couldn't decide" case
}

/** What the batch fill writes without asking. A DOI is proof; a name search
 *  only counts on an exact title match — a near hit ("Informatica" for
 *  "Informatica (Slovenia)") is a different journal with a different ISSN, and
 *  a wrong ISSN in an official form is worse than an empty one. */
export async function resolveVenueIssn(name: string, doi = ""): Promise<IssnResolution> {
  const byDoi = doi ? await issnByDoi(doi) : null;
  if (byDoi) return { issn: byDoi.issn, from: "doi", hits: [byDoi] };

  const hits = await issnByName(name);
  const want = normalizeTitle(name);
  const exact = hits.find((h) => normalizeTitle(h.name) === want);
  return exact ? { issn: exact.issn, from: "name", hits } : { issn: "", from: "", hits };
}
