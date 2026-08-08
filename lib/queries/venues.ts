import "server-only";
import { getDb } from "../sqlite";
import { applyVenueRows, type Venue } from "../venues";

interface VenueRow {
  id: number;
  code: string;
  name_en: string;
  name_vi: string;
  type: number;
  rank: string;
  scopus_indexed: number;
  issn: string;
}

function toVenue(r: VenueRow): Venue {
  return {
    id: r.id,
    code: r.code,
    nameEn: r.name_en,
    nameVi: r.name_vi,
    type: r.type,
    rank: r.rank,
    scopusIndexed: r.scopus_indexed,
    issn: r.issn ?? "",
  };
}

// Full venue catalog. Includes the seeded base set plus any custom venues added
// by users at runtime (see createCustomVenue). Ordered by id so the original
// curated venues come first and user additions append at the end.
export function listVenues(): Venue[] {
  const rows = getDb().prepare("SELECT * FROM venues ORDER BY id ASC").all() as VenueRow[];
  return rows.map(toVenue);
}

export function getVenueByCode(code: string): Venue | null {
  const r = getDb().prepare("SELECT * FROM venues WHERE code = ?").get(code) as VenueRow | undefined;
  return r ? toVenue(r) : null;
}

let venuesHydrated = false;
// Load the DB venue catalog into the in-memory cache that the isomorphic
// helpers (isVenueScopus / isVenueQ1 / getVenueRank*) read. hydrateVenues() only
// runs in the browser, so without this the server resolves venues against the
// build-time seed alone — custom venues and admin venue edits are invisible and
// every paper at such a venue silently scores 0 in the KPI. Call before any
// server-side venue lookup (KPI, profile, reports); pass force=true after a
// venue mutation. Idempotent and cheap (one indexed read of ~600 rows).
export function ensureVenuesHydrated(force = false): void {
  if (venuesHydrated && !force) return;
  applyVenueRows(listVenues());
  venuesHydrated = true;
}

// Insert a custom venue. Allocates an id past the seeded range so we never
// collide with the curated ids from lib/venues.ts. Idempotent on `code`: if a
// venue with the same code already exists, returns it unchanged.
export function createCustomVenue(v: Omit<Venue, "id">): Venue {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM venues WHERE code = ?").get(v.code) as VenueRow | undefined;
  if (existing) return toVenue(existing);

  const maxRow = db.prepare("SELECT COALESCE(MAX(id), 0) AS m FROM venues").get() as { m: number };
  const id = maxRow.m + 1;
  db.prepare(
    "INSERT INTO venues (id, code, name_en, name_vi, type, rank, scopus_indexed, issn) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, v.code, v.nameEn ?? "", v.nameVi ?? "", v.type ?? 1, v.rank ?? "", v.scopusIndexed ?? 0, v.issn ?? "");
  return { id, ...v };
}

// Update mutable fields on an existing venue. `code` is the lookup key and
// cannot be changed because papers reference venues by code.
export function updateVenueByCode(code: string, overrides: Partial<Omit<Venue, "id" | "code">>): Venue | null {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM venues WHERE code = ?").get(code) as VenueRow | undefined;
  if (!existing) return null;
  const merged: VenueRow = {
    ...existing,
    name_en: overrides.nameEn ?? existing.name_en,
    name_vi: overrides.nameVi ?? existing.name_vi,
    type: overrides.type ?? existing.type,
    rank: overrides.rank ?? existing.rank,
    scopus_indexed: overrides.scopusIndexed ?? existing.scopus_indexed,
    issn: overrides.issn ?? existing.issn ?? "",
  };
  db.prepare(
    "UPDATE venues SET name_en = ?, name_vi = ?, type = ?, rank = ?, scopus_indexed = ?, issn = ? WHERE code = ?"
  ).run(merged.name_en, merged.name_vi, merged.type, merged.rank, merged.scopus_indexed, merged.issn, code);
  return toVenue(merged);
}

/** Venues still missing an ISSN that at least one paper actually uses, newest
 *  first by paper count, each with one DOI published there when we have any —
 *  a DOI names its journal outright, which beats matching on title. Only
 *  journals: the STM ISSN field is the journal form's, and conference
 *  proceedings carry an ISBN instead. */
export function listVenuesMissingIssn(): { code: string; nameEn: string; doi: string }[] {
  return getDb()
    .prepare(
      `SELECT v.code AS code,
              v.name_en AS nameEn,
              COALESCE(MAX(CASE WHEN p.doi LIKE '10.%' THEN p.doi END), '') AS doi
         FROM venues v
         JOIN papers p ON p.venue_code = v.code
        WHERE COALESCE(v.issn, '') = '' AND v.type = 2
        GROUP BY v.code
        ORDER BY COUNT(*) DESC, v.code ASC`
    )
    .all() as { code: string; nameEn: string; doi: string }[];
}

/** Bulk ISSN write — one statement per venue, one transaction, so filling ~60
 *  journals costs a single round trip instead of 60 revalidations. */
export function setVenueIssns(items: { code: string; issn: string }[]): number {
  const db = getDb();
  const upd = db.prepare("UPDATE venues SET issn = ? WHERE code = ?");
  let n = 0;
  db.transaction(() => {
    for (const it of items) n += upd.run(it.issn.trim(), it.code).changes;
  })();
  return n;
}

// Hard-delete a venue. Papers keep their venue_code string; their rank lookup
// just falls back to "Chưa phân loại" until the code is re-created or fixed.
export function deleteVenueByCode(code: string): void {
  getDb().prepare("DELETE FROM venues WHERE code = ?").run(code);
}
