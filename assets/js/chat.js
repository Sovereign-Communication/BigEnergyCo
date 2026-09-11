// Advisor chat bridge + modal helpers, extracted verbatim from index.html.
// Loads as a CLASSIC script (no type=module, no async/defer): classic scripts
// always run before deferred modules, so top-level function declarations here
// intentionally become window globals (sendChatMsg, openSizingModal, ...)
// before ui.js executes. Keep it classic or the advisor UI breaks.

// -- Cloudflare API Bridge URL (updated automatically by patch_and_publish.py) --

var CF_API_URL = "https://bigenergyco-api.bigenergyco.workers.dev";

var chatHistory = [];

window.openSizingModal = function () {
  var modal = document.getElementById("sizingModal");

  if (modal) {
    modal.style.display = "flex";

    var closer = document.getElementById("btnCloseSizing");

    if (closer) closer.focus();
  }
};

window.closeSizingModal = function () {
  var modal = document.getElementById("sizingModal");

  if (modal) modal.style.display = "none";
};

window.openLegalModal = function () {
  var modal = document.getElementById("legalModal");

  if (modal) {
    modal.style.display = "flex";

    var closer = document.getElementById("btnCloseLegal");

    if (closer) closer.focus();
  }
};

window.closeLegalModal = function () {
  var modal = document.getElementById("legalModal");

  if (modal) modal.style.display = "none";
};

window.toggleMobileNav = function () {
  var btn = document.getElementById("btnNavToggle");

  var drawer = document.getElementById("mobileNavDrawer");

  if (!btn || !drawer) return;

  var isOpen = drawer.classList.contains("open");

  if (isOpen) {
    drawer.classList.remove("open");

    btn.classList.remove("open");

    btn.setAttribute("aria-expanded", "false");
  } else {
    drawer.classList.add("open");

    btn.classList.add("open");

    btn.setAttribute("aria-expanded", "true");
  }
};

window.closeMobileNav = function () {
  var btn = document.getElementById("btnNavToggle");

  var drawer = document.getElementById("mobileNavDrawer");

  if (btn) {
    btn.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
  }

  if (drawer) drawer.classList.remove("open");
};

// Esc closes whichever modal or drawer is open; focus stays out of hidden overlays.
document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape") return;

  window.closeMobileNav();

  var sizing = document.getElementById("sizingModal");

  var legal = document.getElementById("legalModal");

  var system = document.getElementById("systemModal");

  if (sizing && sizing.style.display === "flex") {
    window.closeSizingModal();
    return;
  }

  if (legal && legal.style.display === "flex") {
    window.closeLegalModal();
    return;
  }

  if (system && system.style.display === "flex") {
    system.style.display = "none";
    return;
  }
});

window.scrollToCalc = function () {
  var calcElem = document.getElementById("calculator");

  if (calcElem) calcElem.scrollIntoView({ behavior: scrollBehavior() });
};

// Render AI text as plain text, never as markup  -  the model's output is untrusted input.

function renderBotReply(replyText) {
  var chatWindow = document.getElementById("chatWindow");

  if (!chatWindow) return;

  var botDiv = document.createElement("div");

  botDiv.className = "chat-msg bot";

  var body = document.createElement("div");

  body.style.whiteSpace = "pre-wrap";

  body.textContent = replyText;

  botDiv.appendChild(body);

  // The disclaimer travels with every answer, not buried in a modal nobody opens.

  var note = document.createElement("div");

  note.style.cssText =
    "margin-top:0.6rem;padding-top:0.5rem;border-top:1px solid var(--border-card);" +
    "font-size:0.75rem;color:var(--text-muted);line-height:1.45;";

  note.textContent =
    "AI-generated estimate  -  may be inaccurate, including prices and specifications. " +
    "Not engineering advice. Verify with a licensed electrician or engineer before " +
    "buying or building anything.";

  botDiv.appendChild(note);

  chatWindow.appendChild(botDiv);

  chatWindow.scrollTop = chatWindow.scrollHeight;

  chatHistory.push({ role: "bot", content: body.textContent });
}

function sendChatMsg() {
  var chatInput = document.getElementById("chatInput");

  var chatWindow = document.getElementById("chatWindow");

  if (!chatInput || !chatWindow) return;

  var userMsg = chatInput.value.trim();

  if (!userMsg) return;

  var userDiv = document.createElement("div");

  userDiv.className = "chat-msg user";

  userDiv.innerText = userMsg;

  chatWindow.appendChild(userDiv);

  chatHistory.push({ role: "user", content: userMsg });

  chatInput.value = "";

  chatWindow.scrollTop = chatWindow.scrollHeight;

  // Same-origin fetch via proxy_server.py (port 7510)

  var loadingDiv = document.createElement("div");

  loadingDiv.className = "chat-msg bot";

  loadingDiv.innerText = "\u23F3 Thinking...";

  loadingDiv.id = "loadingMsg";

  chatWindow.appendChild(loadingDiv);

  chatWindow.scrollTop = chatWindow.scrollHeight;

  var cleanHistory = chatHistory.slice(-6).map(function (m) {
    return {
      role: m.role === "bot" || m.role === "assistant" ? "assistant" : "user",

      content: m.content || "",
    };
  });

  var payload = JSON.stringify({ message: userMsg, history: cleanHistory });

  function setLoadingText(t) {
    var el = document.getElementById("loadingMsg");
    if (el) el.innerText = t;
  }

  function postTo(url) {
    return fetch(url, {
      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: payload,
    }).then(function (res) {
      if (!res.ok) {
        var err = new Error("HTTP " + res.status);

        err.status = res.status;

        err.retryAfter =
          parseInt(res.headers.get("Retry-After") || "0", 10) || 0;

        throw err;
      }

      return res.json();
    });
  }

  function attemptSend(retriesLeft) {
    var apiBase2 =
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "localhost"
        ? ""
        : CF_API_URL || "";

    return postTo(apiBase2 + "/api/chat").catch(function (err) {
      // Busy (free AI quota)  -  wait out the provider and retry once automatically.

      if ((err.status === 503 || err.status === 429) && retriesLeft > 0) {
        var waitSecs = Math.min(Math.max(err.retryAfter || 4, 3), 15);

        setLoadingText(
          " The free AI engine is busy  -  retrying in " + waitSecs + "s…",
        );

        return new Promise(function (resolve) {
          setTimeout(resolve, waitSecs * 1000);
        }).then(function () {
          return attemptSend(retriesLeft - 1);
        });
      }

      throw err;
    });
  }

  attemptSend(2)
    .then(function (data) {
      var loading = document.getElementById("loadingMsg");

      if (loading && loading.parentNode)
        loading.parentNode.removeChild(loading);

      if (data && data.reply) {
        renderBotReply(data.reply);
      } else {
        renderBotReply(" No reply received. Please try again.");
      }
    })

    .catch(function (err) {
      console.error("Chat API error:", err);

      var loading = document.getElementById("loadingMsg");

      if (loading && loading.parentNode)
        loading.parentNode.removeChild(loading);

      if (err && (err.status === 503 || err.status === 429)) {
        renderBotReply(
          " The free AI engine is swamped right now (HTTP " +
            err.status +
            "  -  it runs on a shared free quota).\n\n" +
            "Please wait about a minute and send that again.",
        );
      } else {
        renderBotReply(
          " The AI advisor is unreachable right now" +
            (err && err.status ? " (HTTP " + err.status + ")" : "") +
            ".\n\n" +
            "Check your connection and try again in a moment.",
        );
      }
    });
}

function toggleIntakeMode() {
  var modeEl = document.getElementById("intakeMode");

  var label = document.getElementById("intakeValueLabel");

  var input = document.getElementById("intakeValue");

  if (!modeEl || !label || !input) return;

  var mode = modeEl.value;

  if (mode === "bill") {
    label.innerText = "Monthly Electric Bill ($ USD):";

    input.placeholder = "e.g. 400";

    if (!input.value || input.value === "35") input.value = "400";
  } else {
    label.innerText = "Daily Energy Consumption (kWh / day):";

    input.placeholder = "e.g. 35";

    if (!input.value || input.value === "400") input.value = "35";
  }
}

function toggleInverterDetail() {
  var wrap = document.getElementById("inverterDetailWrap");

  var yes = document.getElementById("inverterHelpYes");

  if (!wrap || !yes) return;

  wrap.style.display = yes.checked ? "block" : "none";
}

// Heuristic: does the free-text inverter answer actually tell the advisor anything?

// Needs some substance AND at least one concrete signal (brand, model number,

// power/voltage figure, or an explicit "I don't have one yet").

function inverterDetailIsUseful(text) {
  var t = (text || "").trim();

  if (t.length < 12) return false;

  return (
    /\d\s*(k?w|kva|v|a)\b/i.test(t) ||
    /\b(victron|sol-?ark|eg4|schneider|conext|growatt|deye|sma|fronius|outback|midnite|studer|must|srne|pip|voltronic|luxpower|solis|goodwe|huawei|enphase|tesla)\b/i.test(
      t,
    ) ||
    /\b(no|none|don'?t|do not|haven'?t|not yet|nothing)\b.{0,30}\b(inverter|yet)\b/i.test(
      t,
    ) ||
    /\b(split[- ]?phase|single[- ]?phase|three[- ]?phase|3[- ]?phase|off[- ]?grid|grid[- ]?tie|hybrid)\b/i.test(
      t,
    )
  );
}

function buildIntakeBrief() {
  var modeEl = document.getElementById("intakeMode");

  var valEl = document.getElementById("intakeValue");

  var regionEl = document.getElementById("destRegion");

  var yesEl = document.getElementById("inverterHelpYes");

  var detailEl = document.getElementById("inverterDetail");

  // NEW: Climate context fields

  var climateEl = document.getElementById("destClimate");

  var spaceEl = document.getElementById("destSpace");

  var maintenanceEl = document.getElementById("maintenanceComfort");

  var mode = modeEl ? modeEl.value : "bill";

  var val = valEl ? valEl.value.trim() : "";

  var region = regionEl ? regionEl.value : "Global DDP Port";

  var wantsInverterHelp = !!(yesEl && yesEl.checked);

  var detail = detailEl ? detailEl.value.trim() : "";

  // NEW: Extract climate context

  var climate = climateEl ? climateEl.value : "unknown";

  var space = spaceEl ? spaceEl.value : "unknown";

  var maintenance = maintenanceEl ? maintenanceEl.value : "unknown";

  var lines = ["Please size an off-grid battery system for me."];

  lines.push(
    mode === "bill"
      ? "Basis: monthly electric bill of $" + (val || "unspecified") + " USD."
      : "Basis: daily consumption of " + (val || "unspecified") + " kWh/day.",
  );

  lines.push("Destination region: " + region + ".");

  // NEW: Add climate context for better battery chemistry recommendations

  lines.push("Climate: " + climate + ".");

  lines.push("Available space for batteries: " + space + ".");

  lines.push("Maintenance comfort level: " + maintenance + ".");

  lines.push(
    "[ADVISOR INSTRUCTION: Use these climate/space/maintenance details to reason about chemistry, stated as " +
      "trade-offs and ranges  -  never a hard sell. (a) Cold sites (frequently below -10°C): LFP cannot be charged " +
      "below 0°C without heating  -  recommend sodium-ion IF genuinely purchasable in my country, or LFP WITH a " +
      "heated/insulated enclosure, and say which you would pick and why. (b) Temperate/tropical sites: LFP is " +
      "the mature default (lowest cost per kWh-cycle, widest availability); suggest sodium-ion only if locally " +
      "available and certification is not required  -  note most sodium-ion packs still lack UL 9540/CE listing. " +
      "(c) Tight space: prefer LFP (higher energy density than sodium-ion). Always state " +
      "certification, availability, and warranty caveats for anything you highlight.]",
  );

  if (!wantsInverterHelp) {
    lines.push(
      "Inverter: I do not need inverter assistance  -  battery bank sizing only.",
    );
  } else if (inverterDetailIsUseful(detail)) {
    lines.push("Inverter: I need inverter assistance. Details: " + detail);
  } else {
    if (detail)
      lines.push(
        'Inverter: I need inverter assistance. What I said so far: "' +
          detail +
          '"',
      );
    else
      lines.push(
        "Inverter: I need inverter assistance but have not given any details.",
      );

    lines.push(
      "[ADVISOR INSTRUCTION: The inverter information above is missing or too vague to size " +
        "against. Give the battery sizing you can from the load basis, then ask me the specific " +
        "follow-up questions you need  -  whether I already own an inverter (make/model) or need a " +
        "recommendation, my continuous and surge power needs, AC voltage/phase, and whether the " +
        "system is off-grid, hybrid, or grid-tied. Do not invent an inverter for me.]",
    );
  }

  return lines.join("\n");
}

function runIntakeCalculation() {
  var chatInput = document.getElementById("chatInput");

  if (!chatInput) return;

  // If the visitor typed a question, honor that instead of overwriting it.

  if (!chatInput.value.trim()) chatInput.value = buildIntakeBrief();

  sendChatMsg();
}

function updateCalc() {
  var targetKwhInput = document.getElementById("targetKwh");

  if (!targetKwhInput) return;

  var targetKwh = parseFloat(targetKwhInput.value);

  var utilityRateSelect = document.getElementById("utilityRate");

  var utilityRate = utilityRateSelect
    ? parseFloat(utilityRateSelect.value)
    : 0.28;

  var targetKwhVal = document.getElementById("targetKwhVal");

  if (targetKwhVal) targetKwhVal.innerText = targetKwh + " kWh Usable Storage";

  // Scoped prices come from the same pricing module the sizing engine

  // uses (window.BECO_BATT_COST is set by ui.js). No second source of truth.

  var scopes = window.BECO_BATT_COST ? window.BECO_BATT_COST(targetKwh) : null;

  if (!scopes) return;

  function money(v) {
    return "$" + Math.round(v).toLocaleString();
  }

  function range(s) {
    return money(s.lo) + "\u2013" + money(s.hi);
  }

  var cellsCostVal = document.getElementById("cellsCostVal");

  var landedCostVal = document.getElementById("landedCostVal");

  var retailCostVal = document.getElementById("retailCostVal");

  if (cellsCostVal) cellsCostVal.innerText = range(scopes.cells);

  if (retailCostVal) retailCostVal.innerText = range(scopes.powmr);

  if (landedCostVal) landedCostVal.innerText = range(scopes.landed);

  document.querySelectorAll(".cmp-kwh").forEach(function (td) {
    td.innerText = targetKwh + " kWh";
  });

  var landedMidVal = document.getElementById("landedMidVal");

  if (landedMidVal) {
    var mid = (scopes.landed.lo + scopes.landed.hi) / 2;

    landedMidVal.innerText = "\u2248" + money(mid);
  }

  // Grid-energy equivalence: what the stored energy would cost bought from the grid.

  // Assumptions (stated in the UI): one full cycle per day, 90% round-trip efficiency,

  // energy charge only  -  excludes connection fees, demand charges, degradation, and

  // panels/inverter/BOS/labor. This is orientation, not a savings promise.

  var gridEqBox = document.getElementById("gridEqBox");

  var gridEqText = document.getElementById("gridEqText");

  if (!gridEqBox || !gridEqText) return;

  if (utilityRate > 0) {
    var ROUND_TRIP_EFF = 0.9;

    var annualKwh = targetKwh * 365 * ROUND_TRIP_EFF;

    var annualValue = annualKwh * utilityRate;

    var landedMid = (scopes.landed.lo + scopes.landed.hi) / 2;

    var paybackYears = landedMid / annualValue;

    var text =
      "If this bank were cycled once daily at $" +
      utilityRate.toFixed(2) +
      "/kWh with 90% " +
      "round-trip efficiency, the energy it moves in a year would cost about $" +
      (Math.round(annualValue / 10) * 10).toLocaleString() +
      " bought from the grid.";

    var paybackRounded = Math.round(paybackYears);

    text +=
      " The landed DIY estimate shown above equals roughly " +
      (paybackYears >= 1
        ? paybackRounded === 1
          ? "about one year"
          : "~" + paybackRounded + " years"
        : "under one year") +
      " of that grid energy";

    text +=
      " \u2014 before adding panels, inverter, wiring, install, and battery degradation, which are " +
      "the majority of a real off-grid budget. Off-grid is usually about where you live, not " +
      "about beating the grid on price.";

    gridEqText.textContent = text;

    gridEqBox.style.display = "block";
  } else {
    gridEqBox.style.display = "none";
  }
}

function scrollToSection(id) {
  var target = document.getElementById(id);

  if (target)
    target.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
}

function setupEventListeners() {
  var navSizeArray = document.getElementById("btnNavSizeArray");

  var heroSizing = document.getElementById("btnHeroSizing");

  var heroCompare = document.getElementById("btnHeroCompare");

  var calcAdvisor = document.getElementById("btnCalcAdvisor");

  var terms1 = document.getElementById("btnLegalTerms1");

  var terms2 = document.getElementById("btnLegalTerms2");

  var terms3 = document.getElementById("btnLegalTerms3");

  var closeSizing = document.getElementById("btnCloseSizing");

  var closeLegal = document.getElementById("btnCloseLegal");

  var intakeCalc = document.getElementById("btnIntakeCalculate");

  var sendChat = document.getElementById("btnSendChat");

  var targetKwhInput = document.getElementById("targetKwh");

  var utilityRateSelect = document.getElementById("utilityRate");

  var intakeModeSelect = document.getElementById("intakeMode");

  var chatInput = document.getElementById("chatInput");

  // The deterministic sizer is the product; the AI advisor explains results.

  if (navSizeArray)
    navSizeArray.addEventListener("click", function () {
      scrollToSection("sizing");
    });

  if (heroSizing)
    heroSizing.addEventListener("click", function () {
      scrollToSection("sizing");
    });

  if (calcAdvisor)
    calcAdvisor.addEventListener("click", function () {
      scrollToSection("sizing");
    });

  if (heroCompare) heroCompare.addEventListener("click", window.scrollToCalc);

  if (terms1) terms1.addEventListener("click", window.openLegalModal);

  if (terms2) terms2.addEventListener("click", window.openLegalModal);

  if (terms3) terms3.addEventListener("click", window.openLegalModal);

  if (closeSizing)
    closeSizing.addEventListener("click", window.closeSizingModal);

  if (closeLegal) closeLegal.addEventListener("click", window.closeLegalModal);

  if (intakeCalc) intakeCalc.addEventListener("click", runIntakeCalculation);

  if (sendChat) sendChat.addEventListener("click", sendChatMsg);

  var navToggle = document.getElementById("btnNavToggle");

  if (navToggle) navToggle.addEventListener("click", window.toggleMobileNav);

  document.querySelectorAll(".mobile-nav-link").forEach(function (link) {
    link.addEventListener("click", window.closeMobileNav);
  });

  document.addEventListener("click", function (e) {
    var header = document.querySelector("header");

    if (header && !header.contains(e.target)) {
      window.closeMobileNav();
    }
  });

  var invYes = document.getElementById("inverterHelpYes");

  var invNo = document.getElementById("inverterHelpNo");

  if (invYes) invYes.addEventListener("change", toggleInverterDetail);

  if (invNo) invNo.addEventListener("change", toggleInverterDetail);

  toggleInverterDetail();

  if (targetKwhInput) targetKwhInput.addEventListener("input", updateCalc);

  if (utilityRateSelect)
    utilityRateSelect.addEventListener("change", updateCalc);

  if (intakeModeSelect)
    intakeModeSelect.addEventListener("change", toggleIntakeMode);

  if (chatInput)
    chatInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") sendChatMsg();
    });

  updateCalc();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupEventListeners);
} else {
  setupEventListeners();
}

// Divs styled as buttons (hero CTAs, "My location", terms, chat, close)

// are clickable but not keyboard-operable by default. Give them a button

// role, make them focusable, and fire their click on Enter/Space. This

// also covers the modal .close-btn X buttons.

function makeClickableDivsKeyboardOperable() {
  document.querySelectorAll(".btn, .close-btn").forEach(function (el) {
    if (el.tagName === "BUTTON" || el.tagName === "A") return;

    if (el.getAttribute("role") === "button") return;

    el.setAttribute("role", "button");

    el.setAttribute("tabindex", "0");
  });
}

function isClickableDivButton(t) {
  return !!(
    t &&
    t.classList &&
    (t.classList.contains("btn") || t.classList.contains("close-btn")) &&
    t.getAttribute("role") === "button"
  );
}

document.addEventListener("keydown", function (e) {
  if (e.key !== "Enter" && e.key !== " ") return;

  if (isClickableDivButton(e.target)) {
    e.preventDefault();

    e.target.click();
  }
});

// Reduced-motion users get instant scrolling instead of JS smooth scroll.

function scrollBehavior() {
  return window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    makeClickableDivsKeyboardOperable,
  );
} else {
  makeClickableDivsKeyboardOperable();
}

// Installable / offline-capable: after the first visit, the tool shell

// loads with no network. Sizing math is client-side and satellite weather

// is cached per location, so a visited site keeps working fully offline.

if (
  "serviceWorker" in navigator &&
  (location.protocol === "https:" ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1")
) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./sw.js").catch(function () {
      /* offline support unavailable  -  tool still works normally */
    });
  });
}
