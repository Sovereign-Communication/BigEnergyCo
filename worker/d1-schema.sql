-- D1 schema: anonymized usage-event ledger (showcase branch).
-- Apply: npx wrangler d1 execute bigenergyco-usage-showcase --file worker/d1-schema.sql
--
-- Privacy contract: aggregate product analytics only. No IPs, user agents,
-- emails, coordinates, or free-form client fields. Country comes from
-- Cloudflare's own cf-ipcountry header (see worker/usage-ledger.mjs).

CREATE TABLE IF NOT EXISTS usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  event TEXT NOT NULL,
  page TEXT NOT NULL,
  country TEXT,
  day TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_events_day ON usage_events(day, event);
