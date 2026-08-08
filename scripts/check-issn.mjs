// Self-check for lib/issn.ts — run: node scripts/check-issn.mjs
// The confidence rule is what matters here: a wrong ISSN in an official form is
// worse than an empty one, so only a DOI or an exact title match may fill it.
// fetch is stubbed — no network, and the OpenAlex payloads are the real shapes.
import assert from "node:assert/strict";

const SOURCES = {
  "IEEE Access": { display_name: "IEEE Access", issn_l: "2169-3536", issn: ["2169-3536"], type: "journal", works_count: 110957 },
  // Same name as our catalog's "Informatica (Slovenia)" but a different journal.
  Informatica: { display_name: "Informatica", issn_l: "0350-5596", issn: ["0350-5596", "1854-3871"], type: "journal", works_count: 3000 },
  "Computers & Graphics": { display_name: "Computers & Graphics", issn_l: "0097-8493", issn: ["0097-8493"], type: "journal", works_count: 5000 },
  // A conference's ISSN is its proceedings series'.
  "Lecture notes in computer science": { display_name: "Lecture notes in computer science", issn_l: "0302-9743", issn: ["0302-9743"], type: "book series", works_count: 700000 },
  // Has an ISSN, must never be used as one: a preprint server is not a venue.
  "arXiv (Cornell University)": { display_name: "arXiv (Cornell University)", issn_l: "2331-8422", issn: ["2331-8422"], type: "repository", works_count: 2000000 },
};

// Which source a DOI resolves to, by prefix — Springer to LNCS, arXiv to arXiv.
const doiSource = (doi) =>
  doi.startsWith("10.48550") ? SOURCES["arXiv (Cornell University)"]
  : doi.startsWith("10.1007") ? SOURCES["Lecture notes in computer science"]
  : SOURCES["IEEE Access"];

// OpenAlex's own search is fuzzy about case and "&"/"and"; the stub mimics that
// much so the assertions test our rule, not the stub's literal matching.
const loose = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();

let calls = [];
globalThis.fetch = async (url) => {
  calls.push(String(url));
  const u = new URL(url);
  const q = loose(decodeURIComponent(u.search));
  const json = u.pathname.startsWith("/works/doi:")
    ? { primary_location: { source: doiSource(u.pathname.replace("/works/doi:", "")) } }
    : { results: Object.values(SOURCES).filter((s) => q.includes(loose(s.display_name))) };
  return { ok: true, json: async () => json };
};

const { pickIssn, normalizeTitle, resolveVenueIssn, issnByDoi } = await import("../lib/issn.ts");

// --- pure bits ---
assert.equal(pickIssn({ issn_l: "2169-3536", issn: ["1111-2222"] }), "2169-3536", "linking ISSN wins");
assert.equal(pickIssn({ issn: ["0350-5596", "1854-3871"] }), "0350-5596", "falls back to the first listed");
assert.equal(pickIssn(null), "");
assert.equal(pickIssn({}), "");
assert.equal(
  pickIssn({ display_name: "arXiv (Cornell University)", issn_l: "2331-8422", type: "repository" }),
  "",
  "a preprint server's own ISSN is never the venue's"
);

assert.equal(normalizeTitle("The Journal of Supercomputing"), "journal of supercomputing");
assert.equal(normalizeTitle("Computers & Graphics"), normalizeTitle("Computers and Graphics"));
assert.equal(normalizeTitle("IEEE  Access!"), "ieee access");
assert.notEqual(normalizeTitle("Informatica (Slovenia)"), normalizeTitle("Informatica"));

// --- DOI beats the name ---
calls = [];
const byDoi = await resolveVenueIssn("A name that matches nothing", "10.1109/ACCESS.2020.2988510");
assert.equal(byDoi.from, "doi");
assert.equal(byDoi.issn, "2169-3536");
assert.equal(calls.length, 1, "a resolved DOI must not also run a name search");

assert.equal(await issnByDoi("not-a-doi"), null, "junk in the doi column never reaches the API");
assert.equal((await issnByDoi("https://doi.org/10.1109/x"))?.issn, "2169-3536", "a doi.org URL is still a DOI");

// A conference's number is its proceedings series' — that is what makes the
// fill worth running over conferences at all.
const proceedings = await resolveVenueIssn("International Conference on Multimedia Modeling", "10.1007/978-3-031-x");
assert.equal(proceedings.issn, "0302-9743", "LNCS carries the ISSN the conference itself lacks");
assert.equal(proceedings.from, "doi");

// Papers filed under an arXiv DOI must yield nothing rather than arXiv's ISSN.
assert.deepEqual(
  await resolveVenueIssn("arXiv (Cornell University)", "10.48550/arxiv.2408.02623"),
  { issn: "", from: "", hits: [] },
  "a preprint DOI must not brand its venue with arXiv's ISSN"
);

// --- name: exact only ---
const exact = await resolveVenueIssn("Computers and Graphics", "");
assert.equal(exact.from, "name");
assert.equal(exact.issn, "0097-8493", "punctuation/&-spelling still counts as the same journal");

const ambiguous = await resolveVenueIssn("Informatica (Slovenia)", "");
assert.equal(ambiguous.issn, "", "a near-miss title is a different journal — leave it blank");
assert.equal(ambiguous.from, "");
assert.ok(ambiguous.hits.length, "…but hand the candidates to the form so a human can pick");

// A DOI that resolves to nothing must fall through to the name search.
globalThis.fetch = async (url) =>
  String(url).includes("/works/doi:")
    ? { ok: true, json: async () => ({ primary_location: null }) }
    : { ok: true, json: async () => ({ results: [SOURCES["IEEE Access"]] }) };
const fallback = await resolveVenueIssn("IEEE Access", "10.9999/missing");
assert.equal(fallback.from, "name");
assert.equal(fallback.issn, "2169-3536");

// A dead API must not throw into the batch loop — it just yields nothing.
globalThis.fetch = async () => {
  throw new Error("network down");
};
assert.deepEqual(await resolveVenueIssn("IEEE Access", "10.1109/x"), { issn: "", from: "", hits: [] });

console.log("issn OK");
