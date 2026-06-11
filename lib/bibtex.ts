import bibtexParse from "bibtex-parse";
import { stringSimilarity } from "string-similarity-js";
import { VENUES, type Venue } from "./venues";
import type { Lecturer } from "./data";

export interface ParsedBibtex {
  title: string;
  year: number | "";
  venueMatch: Venue | null;
  venueRaw: string;
  authors: ParsedAuthor[];
  doi?: string;
  url?: string;
}

export interface ParsedAuthor {
  rawName: string;
  mappedLecturerId: number | null; // Set if match > 80% or found in alias
  mappedByAlias: boolean;
  topMatches: { lecturer: Lecturer; score: number }[];
}

// Strip diacritics and normalize spaces
function normalizeStr(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Format name cleanly (e.g., "Gia, Bao Tran" -> "Bao Tran Gia") without stripping diacritics
export function formatAuthorName(author: string): string {
  let name = author;
  if (name.includes(",")) {
    const parts = name.split(",");
    if (parts.length === 2) {
      name = parts[1].trim() + " " + parts[0].trim();
    } else {
      name = name.replace(/,/g, ""); 
    }
  }
  return name.trim();
}

// Export the normalization function so we can use it when saving aliases
export function normalizeAuthorName(author: string): string {
  return normalizeStr(formatAuthorName(author));
}

// Strip publication-proceedings boilerplate from a venue string so the real
// conference/journal name is what gets fuzzy-matched. BibTeX booktitles and
// Scholar venue lines wrap the actual name in noise like
//   "Proceedings of the 12th International Symposium on ICT, 2023"
// which drags down similarity against the clean catalog name. Applied to BOTH
// the query and the catalog entries (symmetric), so prefixed catalog names match
// too. Leading-only stripping keeps meaningful trailing tokens (e.g. the
// "Companion" in "... Computation Conference Companion") intact.
export function cleanVenueForMatch(raw: string): string {
  if (!raw) return "";
  let v = raw;
  // Leading "(In) Proceedings of (the)" / "Proc. of (the)" / "Proceedings ".
  v = v.replace(/^\s*in\s+/i, "");
  v = v.replace(/^\s*proc(?:eedings|\.)?\s+(?:of\s+)?(?:the\s+)?/i, "");
  // Leading "Companion/Workshops of/to (the)".
  v = v.replace(/^\s*(?:companion|workshops?)\s+(?:of|to)\s+(?:the\s+)?/i, "");
  // Ordinals anywhere: "12th", "1st", "23rd", "2nd" (with optional leading "the").
  v = v.replace(/\b(?:the\s+)?\d{1,3}(?:st|nd|rd|th)\b/gi, " ");
  // A leftover leading bare article.
  v = v.replace(/^\s*the\s+/i, "");
  // Trailing year: ", 2023" / " (2023)" / " 2023".
  v = v.replace(/[\s,(]+\d{4}\)?\s*$/, "");
  return v.replace(/\s+/g, " ").trim();
}

export function matchPaperData(
  title: string,
  year: number | "",
  venueRaw: string,
  rawAuthors: string[],
  doi: string,
  url: string,
  lecturers: Lecturer[],
  authorAliases: Record<string, number> = {}
): ParsedBibtex {
  let bestVenueMatch: Venue | null = null;
  let bestVenueScore = 0;

  if (venueRaw) {
    // Match on the de-boilerplated name (symmetric: query + catalog), but the
    // raw `venueRaw` is still returned for display.
    const normVenue = normalizeStr(cleanVenueForMatch(venueRaw));
    for (const v of VENUES) {
      const scoreEn = stringSimilarity(normVenue, normalizeStr(cleanVenueForMatch(v.nameEn)));
      const scoreVi = stringSimilarity(normVenue, normalizeStr(cleanVenueForMatch(v.nameVi)));
      const codeMatch = normVenue.includes(normalizeStr(v.code)) ? 0.85 : 0;
      
      let score = Math.max(scoreEn, scoreVi, codeMatch);
      if (score > bestVenueScore) {
        bestVenueScore = score;
        bestVenueMatch = v;
      }
    }
    if (bestVenueScore < 0.6) {
      bestVenueMatch = null;
    }
  }

  const authors: ParsedAuthor[] = [];
  for (const raw of rawAuthors) {
    const normQuery = normalizeAuthorName(raw);
    
    const scores = lecturers.map(l => {
      const normDb = normalizeStr(l.name);
      return {
        lecturer: l,
        score: stringSimilarity(normQuery, normDb)
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const topMatches = scores.slice(0, 5);

    let mappedLecturerId: number | null = null;
    let mappedByAlias = false;

    if (authorAliases[normQuery] !== undefined) {
      mappedLecturerId = authorAliases[normQuery];
      mappedByAlias = true;
    }

    if (!mappedByAlias && topMatches.length > 0 && topMatches[0].score >= 0.8) {
      mappedLecturerId = topMatches[0].lecturer.id;
    }

    authors.push({
      rawName: formatAuthorName(raw),
      mappedLecturerId,
      mappedByAlias,
      topMatches,
    });
  }

  return { title, year, venueRaw, venueMatch: bestVenueMatch, authors, doi, url };
}

export function parseAndMatchBibtex(
  bibtexStr: string,
  lecturers: Lecturer[],
  authorAliases: Record<string, number> = {}
): ParsedBibtex | null {
  try {
    const parsed = bibtexParse.entries(bibtexStr);
    if (!parsed || parsed.length === 0) return null;

    const entry = parsed[0];
    
    // 1. Title & Year
    const title = (entry.TITLE || entry.title || "").replace(/[{}]/g, "").trim();
    let year: number | "" = "";
    if (entry.YEAR || entry.year) {
      const y = parseInt(entry.YEAR || entry.year || "", 10);
      if (!isNaN(y)) year = y;
    }

    // 2. Venue
    const venueRaw = (entry.BOOKTITLE || entry.booktitle || entry.JOURNAL || entry.journal || "").replace(/[{}]/g, "").trim();
    const rawAuthorsStr = (entry.AUTHOR || entry.author || "").replace(/[{}]/g, "");
    const rawAuthors = rawAuthorsStr.split(/\s+and\s+/i).map((a: string) => a.trim()).filter(Boolean);
    const doi = (entry.DOI || entry.doi || "").replace(/[{}]/g, "").trim();
    const url = (entry.URL || entry.url || "").replace(/[{}]/g, "").trim();

    return matchPaperData(title, year, venueRaw, rawAuthors, doi, url, lecturers, authorAliases);
  } catch (err) {
    console.error("Error parsing bibtex:", err);
    return null;
  }
}

export async function searchOpenAlex(
  query: string,
  lecturers: Lecturer[],
  authorAliases: Record<string, number> = {}
): Promise<ParsedBibtex[]> {
  try {
    const res = await fetch(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&select=title,authorships,publication_year,primary_location,doi&per-page=3`);
    if (!res.ok) return [];
    const json = await res.json();
    if (!json.results) return [];
    
    return json.results.map((item: any) => {
      const rawAuthors = item.authorships ? item.authorships.map((a: any) => {
          return a.author?.display_name || "";
      }).filter(Boolean) : [];
      
      let doi = item.doi ? item.doi.replace("https://doi.org/", "").replace("http://dx.doi.org/", "") : "";
      let venue = "";
      let url = "";

      if (item.primary_location) {
        if (item.primary_location.source?.display_name) {
          venue = item.primary_location.source.display_name;
        } else if (item.primary_location.raw_source_name) {
          venue = item.primary_location.raw_source_name;
        }
        if (item.primary_location.landing_page_url) {
          url = item.primary_location.landing_page_url;
        }
      }

      // If DOI URL is provided in OpenAlex but no landing page url
      if (!url && item.doi) {
          url = item.doi;
      }

      return matchPaperData(
        item.title || "",
        item.publication_year || "",
        venue,
        rawAuthors,
        doi,
        url,
        lecturers,
        authorAliases
      );
    });
  } catch (err) {
    console.error("Error fetching from OpenAlex", err);
    return [];
  }
}
