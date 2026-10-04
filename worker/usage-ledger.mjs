// D1 anonymized usage-event ledger (showcase branch).
//
// Privacy contract (this repo is permanently free & public, no lead
// collection): the ledger stores aggregate product analytics only — which
// page, which event, coarse country from Cloudflare's own cf-ipcountry
// header. It NEVER stores IPs, user agents, emails, coordinates, or any
// free-form client field. The event vocabulary is a closed enum; unknown
// events are rejected, not stored.
//
// Schema (applied once per database, see docs/cloudflare-showcase.md):
//   CREATE TABLE usage_events (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     ts INTEGER NOT NULL,          -- unix seconds, server clock
//     event TEXT NOT NULL,          -- closed enum below
//     page TEXT NOT NULL,           -- validated site path
//     country TEXT,                 -- cf-ipcountry, 2 letters or null
//     day TEXT NOT NULL             -- UTC YYYY-MM-DD, for cheap rollups
//   );
//   CREATE INDEX idx_usage_events_day ON usage_events(day, event);

export const USAGE_EVENTS = Object.freeze([
  "page_view",
  "calc_run",
  "share_created",
  "chat_started",
]);

const PAGE_RE = /^\/[A-Za-z0-9/_.-]{0,120}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;

export function validateUsageEvent(input) {
  if (!input || typeof input !== "object") return null;
  const { event, page, country } = input;
  if (!USAGE_EVENTS.includes(event)) return null;
  const cleanPage = typeof page === "string" && PAGE_RE.test(page) ? page : "/";
  const cleanCountry =
    typeof country === "string" && COUNTRY_RE.test(country) ? country : null;
  return { event, page: cleanPage, country: cleanCountry };
}

/**
 * Insert one validated event. Returns { ok: true } or { ok: false, reason }:
 * "invalid_event" | "d1_unavailable".
 */
export async function recordUsageEvent(db, input, nowSecs = null) {
  const clean = validateUsageEvent(input);
  if (!clean) return { ok: false, reason: "invalid_event" };
  if (!db || typeof db.prepare !== "function") {
    return { ok: false, reason: "d1_unavailable" };
  }
  const ts = nowSecs !== null ? nowSecs : Math.floor(Date.now() / 1000);
  const day = new Date(ts * 1000).toISOString().slice(0, 10);
  await db
    .prepare(
      "INSERT INTO usage_events (ts, event, page, country, day) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(ts, clean.event, clean.page, clean.country, day)
    .run();
  return { ok: true };
}
