// Cloudflare Turnstile client integration for the advisor (B1 / R-CF-02).
//
// Why this file exists at all. `worker/index.js` gates `POST /api/chat` on
// `env.TURNSTILE_SECRET_KEY` and fails CLOSED: the moment that secret exists,
// a call with no valid `turnstileToken` is a 403. The provisioning guide
// (`docs/cloudflare-showcase.md` §1e) used to tell operators to run
// `wrangler secret put TURNSTILE_SECRET_KEY` while the client integration was
// listed as "a follow-up, not in this branch". Following the deploy tracker as
// written therefore 403'd the AI advisor on the live demo, with no client
// recovery. This module is that missing half, and R-CF-02 makes the pairing
// structural: the server and the client are ONE item, never a follow-up.
//
// Shape: named ES exports (so tests import it directly, like cf-beacon.js) PLUS
// `window.*` attachments, because `assets/js/chat.js` is a CLASSIC script and
// cannot import anything. Every function takes its document and window
// explicitly, so the whole thing is testable under plain Node with no DOM and
// no network.
//
// Privacy, per Q-15 / D-18 / R-PRIV-05: the site key is public by design and
// is the only thing that ever crosses to the widget. Nothing here reads or
// writes a cookie, a localStorage entry, or an identifier of any kind. If
// Turnstile's managed mode turns out to set a cookie, that is exactly what the
// §9 gate in docs/cloudflare-showcase.md measures before the secret is set —
// this module does not decide it, and does not pretend to.

export const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=";

/** The placeholder wrangler.json ships with. Never a real site key. */
export const TURNSTILE_PLACEHOLDER_SITE_KEY =
  "REPLACE_WITH_TURNSTILE_SITE_KEY";

/**
 * Where the PUBLIC site key comes from, in precedence order:
 *   1. `window.BEC_TURNSTILE_SITE_KEY` (Pages build-time env var)
 *   2. `<meta name="bec-turnstile-site-key" content="...">`
 *
 * Returns null for: no document, nothing configured, or the placeholder.
 * A placeholder must never reach the widget - cf-beacon.js refuses its token
 * placeholder for the same reason, and loading the widget with a fake key buys
 * a failed challenge and a 403.
 */
export function resolveTurnstileSiteKey(doc, win) {
  if (!doc) return null;

  var fromWindow =
    win && typeof win.BEC_TURNSTILE_SITE_KEY === "string"
      ? win.BEC_TURNSTILE_SITE_KEY
      : null;
  var metaEl =
    typeof doc.querySelector === "function"
      ? doc.querySelector('meta[name="bec-turnstile-site-key"]')
      : null;
  var fromMeta = metaEl && metaEl.getAttribute ? metaEl.getAttribute("content") : null;

  var key = (fromWindow || fromMeta || "").trim();
  if (!key || key === TURNSTILE_PLACEHOLDER_SITE_KEY) return null;
  return key;
}

/**
 * Whether the widget is even possible: a site key AND a container to render
 * into. Used to decide "unconfigured" (widget absent, sends no token, the
 * endpoint stays unguarded) versus "configured" (token expected).
 */
export function turnstileIsConfigured(doc, win) {
  return !!resolveTurnstileSiteKey(doc, win);
}

/**
 * Injects the Turnstile API script once per document.
 *
 * Idempotent by construction: it looks for an existing script by src first, so
 * a second call (a second advisor question, a re-render) does not add a second
 * <script> tag. Returns a promise that RESOLVES on load and REJECTS on error;
 * callers treat rejection as "unavailable", never as fatal.
 */
export function loadTurnstileScript(doc, win, onloadName) {
  return new Promise(function (resolve, reject) {
    if (!doc || typeof doc.createElement !== "function") {
      reject(new Error("no document"));
      return;
    }
    if (typeof doc.querySelectorAll === "function") {
      var existing = doc.querySelectorAll("script[data-bec-turnstile]");
      if (existing && existing.length) {
        resolve(win);
        return;
      }
    }

    var el = doc.createElement("script");
    el.src = TURNSTILE_SCRIPT_SRC + encodeURIComponent(onloadName);
    el.async = true;
    el.defer = true;
    el.setAttribute("data-bec-turnstile", "1");
    el.onload = function () {
      resolve(win);
    };
    el.onerror = function () {
      reject(new Error("turnstile script failed to load"));
    };

    var parent = (doc.head || doc.body || doc.documentElement);
    if (!parent || typeof parent.appendChild !== "function") {
      reject(new Error("no mount point for the turnstile script"));
      return;
    }
    parent.appendChild(el);
  });
}

/**
 * Renders the widget EXPLICITLY and resolves the visitor's token.
 *
 * Explicit, not implicit: `render=explicit` in the script URL above means
 * nothing renders until we ask. That is what lets this module decide whether a
 * widget appears at all, which is the difference between "the advisor is
 * guarded" and "the advisor is unguarded and says so".
 *
 * The returned promise resolves to:
 *   - a non-empty token string on success
 *   - null when unconfigured, or when the widget is unavailable / expires /
 *     errors. null is NOT fatal: chat.js posts without a token, and an
 *     unprovisioned server accepts that. A provisioned one answers 403, which
 *     is the honest fail-closed answer and is what the §5 curl documents.
 */
export function requestTurnstileToken(options) {
  var opts = options || {};
  var doc = opts.doc;
  var win = opts.win;
  var siteKey = opts.siteKey || resolveTurnstileSiteKey(doc, win);

  // No site key => no widget. Not an error: this is the unprovisioned path,
  // and the advisor must keep working without Turnstile at all.
  if (!siteKey) return Promise.resolve(null);

  var container = opts.container;
  if (!container || typeof container !== "object") {
    return Promise.resolve(null);
  }

  return loadTurnstileScript(doc, win, opts.onloadName || "__becTurnstileOnload").then(
    function (w) {
      var api = (w && w.turnstile) || null;
      if (!api || typeof api.render !== "function") return null;

      return new Promise(function (resolve) {
        var settled = false;
        function finish(token) {
          if (settled) return;
          settled = true;
          // Always drop the widget: a one-shot token is spent once used, and a
          // leftover iframe in the modal is a focus trap for keyboard users.
          try {
            if (typeof api.remove === "function" && widgetId !== null) {
              api.remove(widgetId);
            }
          } catch (e) {
            /* removal is best-effort; never fail the send over it */
          }
          resolve(typeof token === "string" && token ? token : null);
        }

        var widgetId = null;
        try {
          widgetId = api.render(container, {
            sitekey: siteKey,
            callback: function (token) {
              finish(token);
            },
            "expired-callback": function () {
              finish(null);
            },
            "error-callback": function () {
              finish(null);
            },
          });
        } catch (e) {
          finish(null);
        }
      });
    },
    function () {
      // Script blocked, offline, or CSP-denied. The advisor still works.
      return null;
    },
  );
}

// The classic-script bridge. chat.js reads `window.requestTurnstileToken` and
// treats its absence as "no challenge configured", so this attachment is a
// convenience, never a hard dependency of the advisor.
if (typeof window !== "undefined") {
  window.resolveTurnstileSiteKey = resolveTurnstileSiteKey;
  window.turnstileIsConfigured = turnstileIsConfigured;
  window.loadTurnstileScript = loadTurnstileScript;
  window.requestTurnstileToken = requestTurnstileToken;
  window.BEC_TURNSTILE_PLACEHOLDER_SITE_KEY = TURNSTILE_PLACEHOLDER_SITE_KEY;
}
