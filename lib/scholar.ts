import "server-only";

// Lightweight Google Scholar profile scraper. Pulls the public citations list
// (no API key — Scholar has no official API) and parses the publication rows
// out of the returned HTML with regex, so no DOM library is added. Best-effort:
// Scholar may rate-limit / present a CAPTCHA, in which case fetchScholarProfile
// throws a user-readable error.

export interface ScholarRawPaper {
  title: string;
  authorsRaw: string; // comma-separated, possibly truncated with "…"
  venueRaw: string;   // venue/source line, volume/pages/year stripped
  year: number | "";
}

export interface ScholarProfile {
  name: string;
  papers: ScholarRawPaper[];
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Accept a full profile URL, a bare "?user=..." fragment, or a raw user id.
export function extractScholarUserId(input: string): string | null {
  if (!input) return null;
  const s = input.trim();
  // Bare id: Scholar ids are ~12 chars of [A-Za-z0-9_-], no slash/dot/space.
  if (/^[\w-]{8,20}$/.test(s)) return s;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    const user = u.searchParams.get("user");
    if (user) return user;
  } catch {
    /* not a URL — fall through to regex */
  }
  const m = s.match(/[?&]user=([\w-]+)/);
  return m ? m[1] : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = parseInt(n, 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    });
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

// Strip Scholar's trailing "vol (issue), pages, YEAR" noise so the venue line is
// closer to a real venue name for fuzzy matching against the catalog.
function cleanVenue(s: string): string {
  let v = s.trim();
  v = v.replace(/,\s*\d{4}\s*$/, "");                    // trailing year
  v = v.replace(/\s+\d+\s*\(\d+\)\s*,?\s*[\d–-]*\s*$/, ""); // "12 (3), 45-67"
  v = v.replace(/,\s*[\d–-]+\s*$/, "");                  // trailing page range
  return v.trim();
}

// Prefer SerpApi (reliable, handles Google's anti-bot) when SERPAPI_KEY is set;
// otherwise fall back to the best-effort direct scrape.
export async function fetchScholarProfile(userId: string): Promise<ScholarProfile> {
  if (process.env.SERPAPI_KEY) return fetchScholarProfileViaSerpApi(userId);
  return fetchScholarProfileDirect(userId);
}

// SerpApi Google-Scholar-Author engine. SerpApi does the scraping on their side,
// so this works from a datacenter IP without CAPTCHA. Paginated via `start`.
async function fetchScholarProfileViaSerpApi(userId: string): Promise<ScholarProfile> {
  const key = process.env.SERPAPI_KEY!;
  const papers: ScholarRawPaper[] = [];
  let name = "";
  const PAGE = 100; // SerpApi caps `num` at 100 for this engine
  const MAX = 600;

  for (let start = 0; start < MAX; start += PAGE) {
    const url = `https://serpapi.com/search.json?engine=google_scholar_author&author_id=${encodeURIComponent(
      userId
    )}&hl=en&num=${PAGE}&start=${start}&api_key=${encodeURIComponent(key)}`;

    let res: Response;
    try {
      res = await fetch(url, { cache: "no-store" });
    } catch {
      throw new Error("Không kết nối được tới SerpApi (mạng máy chủ).");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let json: any;
    try {
      json = await res.json();
    } catch {
      throw new Error("SerpApi trả về dữ liệu không hợp lệ.");
    }

    if (!res.ok || json.error) {
      if (start === 0) throw new Error(`SerpApi lỗi: ${json.error || res.status}.`);
      break; // a later page failing just ends pagination
    }

    if (start === 0) name = (json.author?.name || "").trim();

    const articles = Array.isArray(json.articles) ? json.articles : [];
    if (articles.length === 0) break;

    for (const a of articles) {
      const title = (a.title || "").trim();
      if (!title) continue;
      const yearNum = parseInt(a.year, 10);
      papers.push({
        title,
        authorsRaw: a.authors || "",
        venueRaw: cleanVenue(a.publication || ""),
        year: Number.isFinite(yearNum) ? yearNum : "",
      });
    }

    if (articles.length < PAGE) break; // last page
  }

  return { name, papers };
}

// Fetch + parse one or more pages of the public citations list (no API key).
async function fetchScholarProfileDirect(userId: string): Promise<ScholarProfile> {
  const papers: ScholarRawPaper[] = [];
  let name = "";
  const PAGE = 100;
  const MAX = 600; // safety cap on how many publications we page through

  for (let cstart = 0; cstart < MAX; cstart += PAGE) {
    const url = `https://scholar.google.com/citations?hl=en&user=${encodeURIComponent(
      userId
    )}&cstart=${cstart}&pagesize=${PAGE}`;

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
        cache: "no-store",
      });
    } catch {
      throw new Error("Không kết nối được tới Google Scholar (mạng máy chủ).");
    }

    if (!res.ok) {
      if (cstart === 0) {
        throw new Error(
          `Google Scholar trả về lỗi ${res.status}. Có thể bị chặn truy cập tự động — thử lại sau.`
        );
      }
      break; // a later page failing just ends pagination
    }

    const html = await res.text();

    if (cstart === 0) {
      if (/gs_captcha|id="gs_captcha_ccl"|unusual traffic|not a robot|please show you'?re not a robot/i.test(html)) {
        throw new Error(
          "Google Scholar yêu cầu xác minh (CAPTCHA). Thử lại sau ít phút hoặc nhập thủ công."
        );
      }
      const nm = html.match(/id="gsc_prf_in"[^>]*>([^<]+)</);
      if (nm) name = decodeEntities(nm[1]).trim();
    }

    const rows = html.split('class="gsc_a_tr"').slice(1);
    if (rows.length === 0) break;

    for (const row of rows) {
      const titleM = row.match(/class="gsc_a_at"[^>]*>([\s\S]*?)<\/a>/);
      if (!titleM) continue;
      const title = stripTags(titleM[1]);
      if (!title) continue;

      const grays = [...row.matchAll(/class="gs_gray">([\s\S]*?)<\/div>/g)].map((m) =>
        stripTags(m[1])
      );
      const authorsRaw = grays[0] ?? "";
      const venueLine = grays[1] ?? "";

      const yearM =
        row.match(/class="gsc_a_y[\s\S]*?>(\d{4})</) ||
        row.match(/class="gsc_a_h[^"]*"[^>]*>(\d{4})</);
      let year: number | "" = "";
      if (yearM) year = parseInt(yearM[1], 10);
      else {
        const ym = venueLine.match(/(\d{4})\s*$/);
        if (ym) year = parseInt(ym[1], 10);
      }
      if (typeof year === "number" && !Number.isFinite(year)) year = "";

      papers.push({ title, authorsRaw, venueRaw: cleanVenue(venueLine), year });
    }

    if (rows.length < PAGE) break; // last page
  }

  return { name, papers };
}

// Split Scholar's author line into clean names. Scholar truncates long lists
// with an ellipsis token, which we drop.
export function splitScholarAuthors(authorsRaw: string): string[] {
  return authorsRaw
    .split(",")
    .map((a) => a.trim())
    .filter((a) => a && a !== "…" && a !== "..." && !/^\.{2,}$/.test(a));
}
