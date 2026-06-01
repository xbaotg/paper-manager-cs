import "server-only";
import { getDb } from "../sqlite";
import type { Venue } from "../venues";

interface VenueRow {
  id: number;
  code: string;
  name_en: string;
  name_vi: string;
  type: number;
  rank: string;
  scopus_indexed: number;
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
    "INSERT INTO venues (id, code, name_en, name_vi, type, rank, scopus_indexed) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, v.code, v.nameEn ?? "", v.nameVi ?? "", v.type ?? 1, v.rank ?? "", v.scopusIndexed ?? 0);
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
  };
  db.prepare(
    "UPDATE venues SET name_en = ?, name_vi = ?, type = ?, rank = ?, scopus_indexed = ? WHERE code = ?"
  ).run(merged.name_en, merged.name_vi, merged.type, merged.rank, merged.scopus_indexed, code);
  return toVenue(merged);
}

// Hard-delete a venue. Papers keep their venue_code string; their rank lookup
// just falls back to "Chưa phân loại" until the code is re-created or fixed.
export function deleteVenueByCode(code: string): void {
  getDb().prepare("DELETE FROM venues WHERE code = ?").run(code);
}
