// UI strings for the static chrome of the sizer page. The AI advisor already
// answers in any language; this file covers the fixed interface around it.
// `ar` flips the document to RTL automatically.
// Keys not present in a locale fall back to English silently.

export const LOCALES = {
  en: {
    navSizing: "Size Your System",
    navSupport: "Support",
    cutLabel: "Your bill-cut target",
    cutLabelBattery: "Your peak-offset target",
    cutValueBattery:
      "Target: shift ~{pct}% of your peak hours onto the battery",
    fxCodeLabel: "Currency code:",
    firstRunNote:
      "Choose your location and energy use, then click Size My System. The first run downloads ~2 MB of satellite weather data and caches it in your browser.",
    navBom: "Hardware Reference",
    navBlog: "Blog",
    navLegal: "Terms & Disclaimer",
    sourcesCardTitle: "Where these numbers come from",
    sourcesCardBody:
      "Each assumption behind a number here lists its publisher, the date checked, and how well it matches what we ship. Ones we cannot source say so.",
    sourcesCardLink: "See all sources →",
    heroTag: "🌍 Free for everyone, everywhere • No signup • Nothing for sale",
    heroTitle1: "Cut your electricity bill.",
    heroTitle2: "See exactly what it would take.",
    footerAboutPre: "Built and given away by",
    heroIntro:
      "Start with your location — your phone knows it — and we size every option that could cut your bill, from 1% to sellable surplus. The price-cut curve shows what any budget buys, in your currency. Educational estimates only, nothing for sale. Built and given away by",
    footerAboutPost: "Not a company, not incorporated, nothing for sale.",
    ctaStart: "Start a Free Estimate",
    pickCity: "Pick a city (or use 📍 My location) so we know your sunshine.",
    shareLoaded:
      "Shared setup loaded. Review the inputs, then click Size My System to calculate.",
    invalidShare: "Invalid share link.",
    customCoordsLocation: "Using custom coordinates ({lat}, {lon}).",
    resolvingCity: "Resolving your city — choose a match or wait for lookup.",
    chooseCityMatch: "Choose a city suggestion or wait for lookup to finish.",
    resolvingCoords: "Checking those coordinates…",
    invalidCoordinates:
      "Latitude must be between −90 and 90 and longitude between −180 and 180.",
    invalidDailyKwh:
      "Daily energy use must be between 0.5 and 500 kWh per day.",
    inputsChanged:
      "Inputs changed — click Size My System to update the estimate.",
    errorTimeout:
      "The sizing engine did not reply in time — check your connection and click Size My System to try again.",
    tellPowerUse:
      "Tell us your power use — tick some appliances, or enter a bill or kWh figure.",
    statusGridtie:
      "⏳ Fetching five years of satellite weather and searching bill-cutting system sizes…",
    statusOffgrid:
      "⏳ Fetching 5 years of hourly satellite weather and searching system sizes…",
    runningBtn: "⏳ Running 5-year simulation…",
    runBtnReady: "☀️ Size My System (5-yr simulation)",
    runBtn: "☀️ Size My System (5-yr simulation)",
    errorSim:
      "⚠️ Sizing engine failed to load. Refresh the page (Ctrl+F5) and try again.",
    statusSuccess:
      "✅ {years} yr of hourly data ({dataYears}) · {yield} kWh/yr per kW of panel.{offline}",
    offlineNote: " · 🌐 offline typical-year mode",
    tariffSpendLine:
      "At {tariff}/kWh, your power costs about {annual} per year today. Each option below shows the bill after solar and how fast it repays itself out of the savings.",
    tariffSpendBattery:
      "At {tariff}/kWh, your power costs about {annual} per year today. A battery with no panels moves when you draw power; it does not cut what you pay.",
    tariffSpendOffgrid:
      "At {tariff}/kWh, this use costs about {annual} per year in grid power. Payback figures below compare system cost against that spend.",
    tariffSpendFixed:
      " That includes {fixed}/mo in fixed charges solar can't cut.",
    readoutAppliancesEmpty:
      "Tick the things you want to power, and your daily energy shows up here.",
    readoutAppliancesSummary:
      "Estimated use: about {kwh} kWh/day · everything running at once ≈ {peakW} W (your inverter should be bigger than this)",
    readoutBill: "That works out to about {kwhDay} kWh/day of average use.",
    readoutBillIncomplete:
      "Enter your monthly bill amount to see the daily energy estimate.",
    readoutKwhEmpty: "Enter a daily kWh figure.",
    readoutKwhReady: "Using {kwh} kWh/day directly.",
    lvlBest: "Best pick",
    lvlCompare: "Compare batteries",
    lvlMatrix: "All options",
    bomPanelTitle: "Your hardware list — what this system is made of",
    genSummary: "I run a generator — what does its power really cost?",
    genApply: "Use this as my electricity price",

    // -- Plausibility frontier (spend -> coverage curve) --
    socChartTitle:
      "Battery Charge Levels & Year-Round Reliability (5-Year Real Weather)",
    frontierTitle: "How far does your money get you?",
    frontierIntro:
      "Every system we could build at your location, cheapest first. The line is the best result any budget can buy — so you can see at a glance whether your goal here is easy, expensive, or out of reach.",
    frontierX: "Up-front system cost",
    frontierYGrid: "Share of your power bill cut",
    frontierYGridBattery: "Share of your peak hours shifted",
    frontierYOffgrid: "Share of your energy covered, no generator",
    frontierSelTag: "{pv} kW + {batt} kWh · {pct}% · {cost}",
    frontierSelNoBatt: "{pv} kW, no battery · {pct}% · {cost}",
    frontierLegendSel: "Selected option — click any point to choose it",
    frontierNoSystem:
      "No system inside the sizes this tool searches can reach this target at this location. The curve below shows the furthest this site can practically get — try a lower target, or plan a generator or grid connection to cover what solar can't.",
    simpleInfeasible:
      "At this location, no system we can build reaches that goal. Try a lower bill-cut target — or read the full details for how close solar can actually get.",
    simpleWhatItMeans:
      "Panels make power when the sun is out; the battery carries it into the evening and cloudy days. The system is sized from five years of hourly satellite weather at your exact location.",
    simpleWhatItMeansBattery:
      "A battery makes no power of its own — it charges in the cheap hours and holds that energy for the expensive ones. The system is sized from five years of hourly satellite weather at your exact location.",
    simpleCaveat:
      "This is an estimate, not a promise — the full figures behind every number are one click away.",
    simpleSeeDetails: "See all the details",
    simpleDownloadBom: "Download parts list (CSV)",
    simpleAskAdvisor: "Ask the AI advisor (plain words)",
    sanityOk: "Independently sanity-checked ✓ — physics plausible",
    sanityFlag:
      "⚠ An independent AI check flags this result as physically implausible —",
    sanityAskAdvisor: "ask the advisor why",
    sanityUncertain:
      "Sanity check inconclusive — the independent AI check could not reach a confident verdict on these inputs",
    sanityTooltip:
      "An independent AI classifier (Jev) reviewed the sizing numbers only — no location, text, or personal data leaves your browser beyond these figures. It never changes the computed result.",
    simpleAdvisorStyle:
      "[ADVISOR INSTRUCTION: The visitor is in Simple mode. Answer like an expert talking to a smart 12-year-old: plain everyday words, no jargon (explain any technical term in a short parenthesis), 4 short sentences maximum, and end with the ONE number that matters most.]",
    advisorTitle: "Free AI Energy Advisor",
    advisorSubtitle:
      "You are talking to an AI (Groq AI Engine) — educational estimates only, not engineering advice",
    advisorIntro:
      "I explain the results from the main sizing tool — battery chemistry, wiring and fusing, or questions to bring to a local electrician. Run your sizing first, then ask about this result, or ask me anything.",
    advisorBotNote:
      "AI-generated estimate — may be inaccurate, including prices and specifications. Not engineering advice. Verify with a licensed electrician or engineer before buying or building anything.",
    advisorThinking: "⏳ Thinking...",
    advisorLabel: "Ask the AI advisor about your system",
    advisorPlaceholder:
      "Ask about cell specs, Sodium-ion vs LFP, freight costs...",
    advisorSend: "Send",
    advisorClose: "Close AI advisor",
    advisorBusyRetry: " The free AI engine is busy — retrying in {secs}s…",
    advisorNoReply: " No reply received. Please try again.",
    advisorBusy:
      " The free AI engine is swamped right now (HTTP {status} — it runs on a shared free quota).\n\nPlease wait about a minute and send that again.",
    // ── Degraded advisor reply (B2 / R-CF-10) ──────────────────────────
    // The worker emits these KEYS next to canonical English text. A browser
    // resolves them here, so a failure message is never English-only; the
    // English `reply` field stays what a non-browser client reads.
    advisorDegradedLabel: "Offline · not the live AI",
    advisorDegradedLine: "I can't answer right now — {why}.",
    advisorDegradedWhyUnavailable: "the service that answers did not reply",
    advisorDegradedWhyNoKey:
      "no model key is configured, so the advisor is offline by design",
    advisorDegradedReassure:
      "Nothing above is wrong, and your sizing is unaffected.",
    advisorDegradedSystem:
      "Take those numbers to a licensed electrician before you build.",
    advisorIsAi:
      "The advisor is a large language model. It writes plausible text and can state wrong numbers confidently. Check every figure — never take it as fact.",
    advisorDegradedGeneral:
      "For sizing help, use the calculator above — no account needed.",
    advisorDegradedRetry: "Try again in a minute; the free quota is shared.",
    advisorUnreachable:
      " The AI advisor is unreachable right now{status}.\n\nCheck your connection and try again in a moment.",
    frontierCeilingTag: "Best within the sizes searched: {pct}%",
    frontierSvgTitle: "How far your money gets you",
    frontierSvgDesc:
      "A curve of {n} systems, from {lowCost} covering {lowPct}% to {highCost} covering {highPct}%. The full figures are in the table below the chart.",
    frontierPointTip:
      "{cost}: {pct}% — {pv} kW of panels + {batt} kWh of battery",
    // -- Budget slider (unified curve walk) --
    budgetLabel: "Your budget (up-front)",
    frontierTableCaption:
      "Every point on the curve. Typical cost is the landed do-it-yourself middle; the range spans bare cells to shipped retail.",
    frontierColCost: "Typical cost",
    frontierColRange: "DIY to retail",
    frontierColCut: "Bill cut",
    frontierColCutBattery: "Peak hours shifted",
    frontierColCover: "Covered",
    frontierColPv: "Panels",
    frontierColBatt: "Battery",
    frontierNoBattery: "none",
    frontierTableToggle: "Show every point as a table",
    frontierLegendCurve: "Cheapest system that reaches each level",
    frontierLegendBand: "Same systems, DIY sourcing to shipped retail",
    frontierLegendRange: "Best-value range — every extra percent still cheap",
    frontierBestValueRange: "Best-value range: ~{lo}–{hi} ({loPct}–{hiPct}%).",
    frontierRangeTag: "best value",
    frontierTagSel: "selected",
    fuelLitLabel: "Price per liter",
    fuelGalLabel: "Price per gallon",
    fuelReadoutRate: "{type} at this price works out to about {rate} per kWh",
    fuelReadoutBurn:
      "({entry} ÷ {burn} {unit}/kWh — fuel alone; oil, filters and engine wear push the real number higher)",
    fuelReadoutGrid: "Typical grid power runs between {lo} and {hi} per kWh.",
    fuelApplyOk:
      "Your generator fuel works out to about {rate}/kWh — entered as your electricity price, so every payback figure below compares against what you burn today.",
    frontierLegendCeiling:
      "Best the searched sizes reach — not a limit of physics",
    frontierMarkerOffCurve:
      "Your option sits right of the curve because the recommendation is picked on true 20-year cost, not today's price — a cheaper bank that needs replacing costs less now and more later.",
    frontierVerdictSteepGrid:
      "Cutting about {kneePct}% of your bill costs around {kneeCost}. After that it gets expensive fast: roughly {tailCost} for each further percent, against {headCost} before.",
    frontierVerdictTaperingGrid:
      "Cutting about {kneePct}% of your bill costs around {kneeCost}. Past that, each further percent costs roughly {tailCost} — about {ratio} times the earlier rate.",
    frontierVerdictCoveredBattery:
      "Sizing is not your constraint here. The smallest practical battery — {batt} kWh, about {cost} — already shifts essentially all of this load's peak hours. Anything larger buys spare capacity, not a bigger offset.",
    frontierVerdictBeyondSweepBattery:
      "Within the battery sizes this tool searches — up to {battMax} kWh — the most you can shift here is about {ceilingPct}%, for around {ceilingCost}. Good value runs out well before that, at {kneePct}% for about {kneeCost}; shifting more needs a bigger bank than anything sized here.",
    frontierVerdictSteepBattery:
      "Shifting about {kneePct}% of your peak hours onto the battery costs around {kneeCost}. After that it gets expensive fast: roughly {tailCost} for each further percent, against {headCost} before.",
    frontierVerdictTaperingBattery:
      "Shifting about {kneePct}% of your peak hours onto the battery costs around {kneeCost}. Past that, each further percent costs roughly {tailCost} — about {ratio} times the earlier rate.",
    frontierVerdictLinearBattery:
      "Offset tracks spending fairly evenly here — about {headCost} for each percent of peak hours, all the way to {ceilingPct}%.",
    frontierVerdictLinearGrid:
      "Savings track spending fairly evenly here — about {headCost} for each percent of your bill, all the way to {ceilingPct}%.",
    frontierVerdictBeyondSweepGrid:
      "Within the sizes this tool searches — up to {pvMax} kW of panels and {battMax} kWh of battery — the most you can cut here is about {ceilingPct}%, for around {ceilingCost}. Good value runs out well before that, at {kneePct}% for about {kneeCost}. Cutting more is not impossible; it just needs a system bigger than anything sized here.",
    frontierVerdictSteepOffgrid:
      "Covering about {kneePct}% of your energy costs around {kneeCost}. The last stretch to full independence is where the money goes: roughly {tailCost} per further percent, against {headCost} before.",
    frontierVerdictTaperingOffgrid:
      "Covering about {kneePct}% of your energy costs around {kneeCost}. Past that, each further percent costs roughly {tailCost} — about {ratio} times the earlier rate.",
    frontierVerdictLinearOffgrid:
      "Coverage tracks spending fairly evenly here — about {headCost} per percent, all the way to {ceilingPct}%.",
    frontierVerdictBeyondSweepOffgrid:
      "Within the sizes this tool searches — up to {pvMax} kW of panels and {battMax} kWh of battery — the most you can cover here is about {ceilingPct}%, for around {ceilingCost}. Good value runs out at {kneePct}% for about {kneeCost}. Full independence is not impossible here, but it needs a system far larger than this, and a generator or a grid connection is almost certainly the cheaper way to cover the rest.",
    frontierMethod:
      "The curve comes from simulating every panel-and-battery combination on a coarse grid against the same hourly weather as the cards above, then keeping only the systems nothing cheaper beats. Prices use the same landed do-it-yourself middle as every other figure on this page.",
    frontierMethodBattery:
      "The curve comes from simulating every battery size on a coarse grid against the same hourly weather and tariff windows as the cards above, then keeping only the systems nothing cheaper beats. Panels are not part of this run, so the curve varies the bank alone. Prices use the same landed do-it-yourself middle as every other figure on this page.",
    // -- Cumulative 20-year cost caption (under the chart canvas) --
    cumCostRecommended: "recommended",
    cumCostSelected: "selected",
    cumCostCaptionHead:
      "Running 20-year cost for the {which} system ({label}): the amber line is what you pay the utility if you stay on the grid ({gridTotal}).",
    cumCostCaptionOwnCost:
      "The emerald line is the solar system's own cost (~{systemTotal}), matching the “Total 20-year cost” row for this system.",
    cumCostCaptionOwnCostNoPanels:
      "The emerald line is the system's own cost (~{systemTotal}), matching the “Total 20-year cost” row for this system.",
    cumCostCaptionStack:
      "The amber figure is a stack — the system, then the smaller bills that remain after solar (~{residualBills}), then your saving — so this system puts {saved} back in your pocket over the 20 years.",
    cumCostCaptionStackNoPanels:
      "The amber figure is a stack — the system, then the smaller bills that remain (~{residualBills}), then your saving — so this system puts {saved} back in your pocket over the 20 years.",
    cumCostCaptionNetNegative:
      "The stack runs the other way here: those remaining bills (~{residualBills}) never shrink enough, so over 20 years this system costs about {loss} MORE than staying on the grid — money spent, not money saved.",
    cumCostCaptionRepaid:
      "The system has repaid its cost by year {year} — every year after puts ~{perYear} back in your pocket. Total saving over 20 years: ~{saved}. The lower bars are your running net position: red until break-even, then climbing.",
    cumCostCaptionNeverRepays:
      "Within 20 years the system never repays its cost — battery replacements outpace bill savings, so the honest answer is: it does not pay for itself here.",
    cumCostCaptionResidual:
      "The slate line is the residual grid cost itself — about {annual}/yr for the {kwh} kWh/yr still drawn from the grid (net of your feed-in credit), {end} over the full 20 years.",
    cumCostCaptionResidualCreditDraw:
      "The slate line runs below $0 — net metering: the feed-in value of your surplus exceeds even the small {kwh} kWh/yr you still draw, so you earn ~{earned} over the full 20 years.",
    cumCostCaptionResidualCreditBill:
      "The slate line runs below $0 — net metering: the feed-in value of your surplus exceeds the tiny bill you still pay, so you earn ~{earned} over the full 20 years.",
    cumCostCaptionSurplusCredit:
      "The with-solar total (~{withSolar}) sits BELOW the system's own cost: your feed-in credit on surplus out-earns the small bill that remains, so the stack runs negative and the utility owes you ~{owed} in the 20-year picture.",
    frontierVerdictCoveredOffgrid:
      "Sizing is not your constraint here. The smallest practical system — {pv} kW of panels and {batt} kWh of battery, about {cost} — already covers this entire load, year-round. Anything larger buys spare capacity, not more independence.",
    frontierVerdictCoveredGrid:
      "Sizing is not your constraint here. The smallest practical system — {pv} kW of panels and {batt} kWh of battery, about {cost} — already covers essentially all of this load. Anything larger buys spare capacity, not a bigger saving.",
    pipelineLocation: "Location",
    pipelineWeather: "Weather",
    pipelineSimulating: "Simulating",
    pipelineRendering: "Rendering",
    pipelineElapsed: "{s}s elapsed",
    pipelineCached: "cached",
    pipelineReaching: "reaching satellite…",
    pipelineChunks: "{done}/{total} satellite chunks",
    speedNoteRepeat:
      "⚡ Instant — repeat of this exact setup (computed moments ago)",
    speedNoteCached: "⚡ Instant — cached satellite weather",
    speedNoteCachedWhere: "⚡ Instant — cached satellite weather for {where}",
    speedNoteOffline: "⚡ Instant — offline typical-year",
    speedNoteOfflineWhere: "⚡ Instant — offline typical-year for {where}",
    fmtAllDay: "all day (24 h)",
    fmtHoursDay: "{h} h/day",
    fmtMinutesDay: "{m} min/day",
    apWattsRunning: "~{w} W while running",
    apWatts: "~{w} W",
    apKwhDay: "{kwh} kWh/day",
    apAvgW: " (~{w} W avg)",
    offgridKwhReadout: "~{kwh} kWh/day",
    quickBillStarts:
      "Starts from ~{bill} (≈{kwh} kWh/day). Set your real bill here, choose a location, then click Size My System. The bill-cut slider appears with results.",
    quickBillManual:
      "Quick estimate: ~{bill} (starts from ~{kwh} kWh/day) — switch to Manual to change your bill, appliances, or rate.",
    dailyEnergyNeed: "Daily energy need (kWh/day slider)",
    billPerMonth: "/mo",
    simpleHeadline: "At your location, this system gets you {goal}:",
    simpleGoalGrid: "to cut about {pct}% off your bill",
    simpleGoalBattery:
      "to shift about {pct}% of your peak hours onto the battery",
    simpleGoalOffgrid: "to cover your home through the year",
    sharedLocationLoaded:
      "Shared result loaded - sunshine data for this location",
    uiInitFailed:
      "Warning: Interface failed to load - please refresh the page (Ctrl+F5).",
    infeasibleAreaTitle: "Too little roof/yard area for this target",
    infeasibleAreaBody:
      "The searched solar size was capped by the optional area input (see “Hardware setup”). Clear that box — or draw a bigger area on the map — and re-run: the site itself can reach this target.",
    infeasibleEnvelopeTitle: "Beyond this tool's search range for this target",
    infeasibleEnvelopeBody:
      "At this load, reaching that target needs a solar array or battery bank larger than this calculator searches (see Hardware setup for the limits). Try a lower bill-cut target, or check whether part of the load can be reduced.",
    infeasibleNeedsBatteryTitle: "Solar-only can't reach 100% off-grid",
    infeasibleNeedsBatteryBody:
      "An off-grid home needs storage for nights and cloudy days. Add a battery to the hardware selector, or switch the goal to 'Cut my bill, stay connected' (grid-tie).",
    infeasibleNeedsPanelsTitle: "Battery-only can't run off-grid",
    infeasibleNeedsPanelsBody:
      "Nothing recharges the bank at this site. Add panels to the hardware selector, or switch the goal to 'Cut my bill, stay connected' (grid-tie).",
    infeasibleNeedsSurplusTitle: "A battery-only bank can't produce surplus",
    infeasibleNeedsSurplusBody:
      "Surplus needs panels to generate more than your load. Drop the target below 100% on the bill-cut slider, or switch the hardware setup to 'Solar + Battery'.",
    infeasibleGenericTitle: "This hardware and goal combination can't solve",
    infeasibleGenericBody: "Change the goal or hardware, then re-run.",

    // These seven existed only in the five non-English dictionaries. Their
    // English text was authored straight into index.html, where no gate could
    // see it, so the translations were pinned to whatever the copy used to say
    // and drifted: "Where is this system going?" here versus "Where will the
    // system be installed?" in es/fr/de. Declaring the English makes this the
    // single source the other five are checked against, and lets the
    // reverse-parity rule fail if one is ever dropped again.
    goalLabel: "What outcome are you exploring?",
    useCaseLabel: "What do you want to do?",
    useCaseBillCut: "Cut my electricity bill",
    useCaseTou: "Save with a battery on time-of-use rates",
    useCaseBackup: "Keep essentials running in a power cut",
    useCaseReserve: "Keep a backup reserve in my battery",
    useCaseOffGrid: "Go fully off-grid",
    useCasePortable: "Portable power (RV, van, boat, camping)",
    useCaseBillCutBlurb:
      "Grid-tied solar, with a battery only if it earns its place. Measured as the share of your bill the system removes over 20 years.",
    useCaseTouBlurb:
      "A battery on its own: it charges in the cheap hours and covers the expensive ones. No panels.",
    useCaseBackupBlurb:
      "Sized on the appliances you tick, not on your whole home. Measured as the share of power cuts your essentials ride out.",
    useCaseReserveBlurb:
      "Hold part of the battery back for outages, and see exactly what that costs you in savings.",
    useCaseOffGridBlurb:
      "Solar and battery sized for your whole home. Measured as the share of hours that run with no grid at all.",
    useCasePortableBlurb:
      "A power station for a van, a boat or a campsite. No roof, no grid, no tariff.",
    metricBillCut: "of your bill removed over 20 years",
    metricTouOffset: "of your peak-window energy run by the battery",
    metricOutageCoverage:
      "of power cuts your essentials ride out for the full target",
    metricReserveTradeoff: "what holding a reserve costs, in savings and hours",
    metricGridIndependence: "of the year running with no grid at all",
    metricPortableRuntime: "of days the station runs your devices all day",
    statusWorks: "Works",
    statusPartial: "Partly",
    statusNotHere: "Does not work here",
    useCaseOutcomeTitle: "Your {useCase} result",
    useCaseVerdictFooter:
      "Measured for {useCase} against {metric}, using this location's own hourly weather.",
    useCaseNotMeasured:
      "Not measured: this combination cannot be sized at all, so there is no {metric} to report.",
    metricReserveTradeoffValue: "{lost}% of savings, {hours} h of cover",
    reserveOff: "off",
    touPeakLabel: "Your peak price (per kWh)",
    touOffPeakLabel: "Your off-peak price (per kWh)",
    touDefaultNote:
      "We have no published time-of-use schedule for your area, so we prefilled a peak price 60% above and an off-peak price 45% below your flat rate. Change either number if your bill says otherwise — the verdict below uses whatever you enter.",
    essentialLabel: "What must keep running? (pick any)",
    outageLabel: "How long must it last?",
    backupRechargeLabel: "Let the panels recharge it during the outage",
    reserveLabel: "Emergency reserve held in the battery",
    portableDeviceLabel: "What are you powering? (pick any)",
    portableBankLabel: "Power station usable size (kWh)",
    portableShoreLabel: "I can recharge from mains or a vehicle",
    generatorLabel: "A generator is available for the worst weeks",
    verdictBillCut:
      "{status}: this system removes {pct}% of your bill over 20 years.",
    verdictTou:
      "{status}: the battery covers {pct}% of your peak-window energy, worth about {saving} over 20 years against a {cost} battery. Your peak-to-off-peak spread here is {spread} per kWh.",
    verdictBackup:
      "{status}: your essentials run for the full {targetHours} hours in {pct}% of the power cuts we simulated (typical night: {hours} hours).",
    verdictReserve:
      "{status}: holding that reserve costs {pct}% of your bill savings and buys {coverHours} hours of cover.",
    verdictReserveNoBattery:
      "There is nothing to hold a reserve in: the cheapest system for this goal carries no battery at all.",
    verdictOffGrid:
      "{status}: {pct}% of the year runs with no grid — {unmetHours} hours short in the worst year, {autonomy} days of autonomy.",
    verdictPortable:
      "{status}: your station runs a full day on {days} of {trips} days here, and one charge lasts {runtime} hours.",
    cityLabel: "Where is this system going?",
    loadLabel: "How much power do you use?",
    loadAppliances: "Let me pick my appliances",
    loadBill: "I know my monthly electric bill",
    loadKwh: "I know my kWh/day (advanced)",
    chemLabel: "Battery chemistry:",

    // Same story as the seven above: English lived in the markup (or, for
    // tariffNote, in a template literal in ui.js) while only the translated
    // dictionaries carried the key. tariffNote is the one that actually LEAKED
    // English: its five translations existed and nothing ever read them.
    langLabel: "Language",
    locBtn: "📍 Use my precise location",
    tariffNote:
      "Electricity price estimated for {label} — change it above if you know your rate.",

    pathsLabel_turnkey: "Installer, turnkey",
    pathsLabel_lease: "Lease or PPA",
    pathsLabel_selfpurchase: "You buy the parts",
    pathsLabel_diy: "You mount it, an electrician connects",
    pathsTitle: "Four ways to pay for this same system",
    pathsSub:
      "One system, one set of definitions, twenty years. The gap between these cards is a gap in price, not a difference in what each one counts.",
    pathsCheapest: "Cheapest",
    pathsSpend20: "20-year cost",
    pathsRowIncentives: "Incentives",
    pathsRowBillCut: "Bill cut",
    pathsRowBreakEven: "Break-even",
    pathsRowNet: "Net over 20 years",
    pathsRowOwnership: "Ownership",
    pathsRowEndOfTerm: "At the end",
    pathsCountsHeading: "What this price counts",
    pathsInstrumentLabel: "Third-party route:",
    pathsGradeNote:
      "Every figure above comes from one regional price registry with a named source and a confidence grade. Hardware is your own build estimate; labour, permits, incentives and replacements are registry figures. Nothing here is a vendor's quote.",
    pathsWhy:
      "{cheaper} is {gap} cheaper than {dearer} over 20 years, driven mostly by {driver}.",
    pathsWhyCombined: " No single item explains the whole gap.",
    pathsDriver_year0: "the up-front price",
    pathsDriver_incentives: "who the incentives go to",
    pathsDriver_om: "maintenance",
    pathsDriver_replacements: "battery and inverter replacements",
    pathsDriver_leasePayments: "the payments you make",
    pathsDriver_none: "no single item",
    pathsInstrumentPpa: "PPA (you buy the energy)",
    pathsInstrumentLease: "Lease (you rent the system)",
    pathsEndOfTermBuyout:
      "Year {years}: you can buy it out for {buyoutPct}% of the installed price, and that buyout is inside this figure.",
    pathsEndOfTermStillLeasing:
      "In year {years} the term is still running, so no buyout is priced. Beyond 20 years you would still owe payments.",
    pathsOwnershipTurnkey: "You own it from day one.",
    pathsOwnershipPpa: "The provider owns it and keeps it maintained.",
    pathsOwnershipLease:
      "You rent it until the term ends, then you buy it out or hand it back.",
    pathsOwnershipSelf: "You own it once it is installed.",
    pathsIncentiveTaxCredit: "Federal tax credit",
    pathsIncentiveRebate: "Utility rebate",
    pathsIncentivesToProvider: "Incentives go to the provider, not to you.",
    pathsIncentivesGoToProvider: "The provider keeps them — you own nothing.",
    pathsNoIncentive: "None applies to this route.",
    pathsNoVerifiedIncentive: "We have no verified incentive for your region.",
    pathsUnknown: "Unknown",
    pathsNotWithinHorizon: "Not within 20 years",
    pathsBreakEvenYear: "Year {year}",
    pathsUnavailable: "Not available",
    pathsNoSystem: "There is no system to price.",
    pathsNoTariff:
      "A PPA needs a tariff to price against, so it is not shown here.",
    pathsDiyNotPermitted:
      "Not offered here: where you are, a licensed installer has to do the electrical work.",
    pathsDiyRestricted:
      "Not offered here: DIY mounting is restricted where you are.",
    pathsDiyUnknown:
      "Not offered here: we could not verify whether you may mount your own array.",
    pathsNoteTurnkeyAllIn:
      "One all-in price: the same hardware, plus labour, permits and the installer's margin.",
    pathsIncludesInstalledAllIn: "Parts, labour and permits, already installed",
    pathsIncludesProviderSwaps:
      "The provider maintains and replaces the battery and inverter",
    pathsIncludesIncentivesToProvider:
      "Incentives go to the provider, not to you",
    pathsIncludesIncentivesIfEligible: "Incentives, if you qualify for them",
    pathsIncludesNoYear0Hardware: "No hardware purchase up front",
    pathsIncludesEndOfTerm: "The end-of-term choice is priced in",
    pathsIncludesHardwareYouBuy: "The hardware you buy yourself",
    pathsIncludesElectricianInstalls: "A licensed electrician installs it",
    pathsIncludesPermitsAndInterconnection:
      "Permits, inspection and interconnection",
    pathsIncludesYouDoSwaps: "You arrange and pay for bank swaps",
    pathsIncludesYouMountTheArray: "You mount the array yourself",
    pathsIncludesElectricianConnects: "An electrician does the connection",
    pathsIncludesToolsAndSafety: "Tools and safety gear",
  },
  es: {
    navSizing: "Dimensiona tu sistema",
    navSupport: "Soporte",
    cutLabel: "Tu objetivo de reducción de factura",
    cutLabelBattery: "Tu objetivo de desplazamiento de horas punta",
    cutValueBattery:
      "Objetivo: desplazar ~{pct}% de tus horas punta a la batería",
    fxCodeLabel: "Código de moneda:",
    firstRunNote:
      "Elige tu ubicación y tu consumo, y pulsa Dimensionar mi sistema. La primera ejecución descarga ~2 MB de datos satelitales y luego los guarda en tu navegador.",
    navBom: "Referencia de hardware",
    navBlog: "Blog",
    navLegal: "Términos y aviso legal",
    sourcesCardTitle: "De dónde salen estos números",
    sourcesCardBody:
      "Cada supuesto detrás de una cifra indica aquí su editor, la fecha de verificación y hasta qué punto coincide con lo que aplicamos. Los que no podemos documentar lo dicen.",
    sourcesCardLink: "Ver todas las fuentes →",
    heroTag:
      "Gratis para todos, en todo el mundo · Sin registro · Nada en venta",
    heroTitle1: "Reduce tu factura de luz.",
    heroTitle2: "Vea exactamente lo que haría falta.",
    footerAboutPre: "Creada y entregada por",
    heroIntro:
      "Empieza con tu ubicación — tu móvil la sabe — y calculamos cada opción que puede reducir tu factura, del 1% al excedente vendible. La curva de precio muestra qué compra cada presupuesto, en tu moneda. Solo estimaciones educativas, nada en venta. Creada y entregada por",
    footerAboutPost: "No es una empresa, no está constituida, nada en venta.",
    ctaStart: "Empieza tu estimación gratis",
    pickCity:
      "Elige una ciudad (o usa 📍 Mi ubicación) para que sepamos tu insolación.",
    shareLoaded:
      "Configuración compartida cargada. Revisa los datos y pulsa Dimensionar mi sistema para calcular.",
    invalidShare: "Enlace inválido.",
    customCoordsLocation: "Usando coordenadas personalizadas ({lat}, {lon}).",
    resolvingCity:
      "Buscando tu ciudad: elige una opción o espera el resultado.",
    chooseCityMatch:
      "Elige una ciudad sugerida o espera a que termine la búsqueda.",
    resolvingCoords: "Comprobando esas coordenadas…",
    invalidCoordinates:
      "La latitud debe estar entre −90 y 90 y la longitud entre −180 y 180.",
    invalidDailyKwh: "El consumo diario debe estar entre 0,5 y 500 kWh al día.",
    inputsChanged:
      "Los datos cambiaron: pulsa Dimensionar mi sistema para actualizar.",
    errorTimeout:
      "El motor de cálculo no respondió a tiempo — revisa tu conexión y vuelve a intentarlo.",
    tellPowerUse:
      "Indica tu consumo de energía: marca algunos electrodomésticos, o introduce una factura o una cifra en kWh.",
    statusGridtie:
      "⏳ Obteniendo cinco años de clima satélite y buscando tamaños de sistema para recortar facturas…",
    statusOffgrid:
      "⏳ Obteniendo 5 años de clima horario por satélite y buscando tamaños de sistema…",
    errorSim:
      "⚠️ El motor de cálculo no pudo cargarse. Actualiza la página (Ctrl+F5) e inténtalo de nuevo.",
    statusSuccess:
      "✅ {years} años de datos horarios ({dataYears}) · {yield} kWh/año por kW de panel.{offline}",
    offlineNote: " · 🌐 modo offline típico",
    tariffSpendLine:
      "A {tariff}/kWh, tu electricidad te cuesta unos {annual} al año hoy. Cada opción de abajo muestra la factura tras la solar y cuánto tarda en pagarse con los ahorros.",
    tariffSpendBattery:
      "A {tariff}/kWh, tu electricidad te cuesta unos {annual} al año hoy. Una batería sin paneles cambia cuándo consumes; no reduce lo que pagas.",
    goalLabel: "¿Qué quieres que haga este sistema?",
    useCaseLabel: "¿Qué quieres conseguir?",
    useCaseBillCut: "Reducir tu factura de electricidad",
    useCaseTou: "Ahorrar con una batería en tarifas horarias",
    useCaseBackup: "Mantener los básicos funcionando durante un apagón",
    useCaseReserve: "Guardar una reserva de emergencia en la batería",
    useCaseOffGrid: "Quedarte totalmente sin red",
    useCasePortable: "Energía portátil (furgoneta, barco, camping)",
    useCaseBillCutBlurb:
      "Solar conectado a la red, con batería solo si compensa. Se mide como la parte de tu factura que el sistema elimina en 20 años.",
    useCaseTouBlurb:
      "Solo batería: carga en las horas baratas y cubre las caras. Sin paneles.",
    useCaseBackupBlurb:
      "Se dimensiona con los aparatos que marques, no con toda tu casa. Se mide como la parte de los apagones que lo esencial aguanta.",
    useCaseReserveBlurb:
      "Deja guardada una parte de la batería para los apagones y mira lo que eso te cuesta en ahorro.",
    useCaseOffGridBlurb:
      "Solar y batería dimensionados para toda tu casa. Se mide como la parte de las horas que funcionan sin red.",
    useCasePortableBlurb:
      "Una estación de energía para furgoneta, barco o campamento. Sin tejado, sin red, sin tarifa.",
    metricBillCut: "de tu factura eliminada en 20 años",
    metricTouOffset: "de tu energía en horas punta cubierta por la batería",
    metricOutageCoverage:
      "de los apagones que lo esencial aguanta el tiempo completo",
    metricReserveTradeoff: "lo que cuesta la reserva, en ahorro y horas",
    metricGridIndependence: "del año funcionando sin red",
    metricPortableRuntime:
      "de los días que la estación alimenta tus dispositivos todo el día",
    statusWorks: "Funciona",
    statusPartial: "En parte",
    statusNotHere: "Aquí no funciona",
    useCaseOutcomeTitle: "Tu resultado de {useCase}",
    useCaseVerdictFooter:
      "Medido para {useCase} frente a {metric}, con el clima horario de esta ubicación.",
    useCaseNotMeasured:
      "Sin medir: esta combinación no se puede dimensionar, así que no hay {metric} que informar.",
    metricReserveTradeoffValue: "{lost}% de ahorro, {hours} h de cobertura",
    reserveOff: "desactivada",
    touPeakLabel: "Tu precio en punta (por kWh)",
    touOffPeakLabel: "Tu precio fuera de punta (por kWh)",
    touDefaultNote:
      "No tenemos una tarifa horaria publicada para tu zona, así que hemos puesto un precio en punta un 60 % más alto y uno fuera de punta un 45 % más bajo que tu tarifa plana. Cambia cualquiera de los dos si tu factura dice otra cosa: el veredicto usa lo que escribas.",
    essentialLabel: "¿Qué debe seguir funcionando? (elige lo que quieras)",
    outageLabel: "¿Cuánto tiempo debe durar?",
    backupRechargeLabel: "Deja que los paneles la recarguen durante el apagón",
    reserveLabel: "Reserva de emergencia guardada en la batería",
    portableDeviceLabel: "¿Qué vas a alimentar? (elige lo que quieras)",
    portableBankLabel: "Capacidad útil de la estación (kWh)",
    portableShoreLabel: "Puedo recargar desde la red o desde el vehículo",
    generatorLabel: "Hay un generador disponible para las peores semanas",
    verdictBillCut:
      "{status}: este sistema elimina el {pct}% de tu factura en 20 años.",
    verdictTou:
      "{status}: la batería cubre el {pct}% de tu energía en horas punta, unos {saving} en 20 años frente a una batería de {cost}. Aquí la diferencia entre punta y valle es de {spread} por kWh.",
    verdictBackup:
      "{status}: lo esencial aguanta las {targetHours} horas completas en el {pct}% de los apagones que simulamos (noche típica: {hours} horas).",
    verdictReserve:
      "{status}: guardar esa reserva cuesta el {pct}% de tu ahorro y compra {coverHours} horas de cobertura.",
    verdictReserveNoBattery:
      "No hay nada donde guardar una reserva: el sistema más barato para este objetivo no lleva batería.",
    verdictOffGrid:
      "{status}: el {pct}% del año funciona sin red, con {unmetHours} horas de déficit en el peor año y {autonomy} días de autonomía.",
    verdictPortable:
      "{status}: tu estación alimenta tus dispositivos todo el día en {days} de {trips} días aquí, y una carga dura {runtime} horas.",
    cityLabel: "¿Dónde se instalará el sistema?",
    loadLabel: "¿Cuánta energía consumes?",
    loadAppliances: "Elijo mis electrodomésticos",
    loadBill: "Conozco mi factura mensual de luz",
    loadKwh: "Conozco mis kWh/día (avanzado)",
    langLabel: "Idioma",
    readoutAppliancesEmpty:
      "Marca los electrodomésticos que quieres alimentar y tu energía diaria aparecerá aquí.",
    readoutAppliancesSummary:
      "Uso estimado: unos {kwh} kWh/día · todo a la vez ≈ {peakW} W (tu inversor debería ser mayor)",
    readoutBill: "Eso equivale a unos {kwhDay} kWh/día de uso medio.",
    readoutBillIncomplete:
      "Introduce tu factura mensual para ver la estimación diaria.",
    readoutKwhReady: "Usando {kwh} kWh/día directamente.",
    runBtn: "Dimensionar mi sistema (simulación de 5 años)",
    runningBtn: "⏳ Simulando 5 años...",
    runBtnReady: "Dimensionar mi sistema (simulación 5 años)",
    locBtn: "Usar mi ubicación actual",
    chemLabel: "Química de la batería:",
    tariffNote:
      "Precio estimado para {label} — cámbialo arriba si conoces tu tarifa.",
    lvlBest: "Mejor opción",
    lvlCompare: "Comparar baterías",
    lvlMatrix: "Todas las opciones",
    bomPanelTitle: "Tu lista de hardware — de qué está hecho este sistema",
    genSummary: "Uso un generador — ¿cuánto cuesta realmente su energía?",
    genApply: "Usar esto como mi precio de electricidad",

    // -- Plausibility frontier (spend -> coverage curve) --
    socChartTitle:
      "Niveles de carga de batería y confiabilidad anual (5 años de clima real)",
    frontierTitle: "¿Hasta dónde llega tu dinero?",
    frontierIntro:
      "Todos los sistemas posibles en tu ubicación, del más barato al más caro. La línea es el mejor resultado que puede comprar cada presupuesto, para que veas de un vistazo si tu objetivo aquí es fácil, caro o inalcanzable.",
    frontierX: "Coste inicial del sistema",
    frontierYGrid: "Parte de tu factura eliminada",
    frontierYGridBattery: "Parte de tus horas punta desplazadas",
    frontierYOffgrid: "Parte de tu energía cubierta, sin generador",
    frontierSelTag: "{pv} kW + {batt} kWh · {pct}% · {cost}",
    frontierSelNoBatt: "{pv} kW, sin batería · {pct}% · {cost}",
    frontierLegendSel:
      "Opción seleccionada — haz clic en cualquier punto para elegirla",
    frontierNoSystem:
      "Ningún sistema dentro de los tamaños que busca esta herramienta puede alcanzar este objetivo en esta ubicación. La curva de abajo muestra hasta dónde llega este sitio en la práctica: prueba con un objetivo menor, o prevé un generador o conexión a la red para cubrir lo que el sol no puede.",
    simpleInfeasible:
      "En esta ubicación, ningún sistema que podamos construir alcanza ese objetivo. Prueba con un porcentaje de ahorro menor, o consulta los detalles completos para ver hasta dónde puede llegar la energía solar.",
    simpleWhatItMeans:
      "Los paneles generan electricidad cuando hay sol; la batería la guarda para la noche y los días nublados. El sistema se dimensiona con cinco años de datos meteorológicos horarios por satélite de tu ubicación exacta.",
    simpleWhatItMeansBattery:
      "Una batería no genera nada por sí sola: se carga en las horas baratas y guarda esa energía para las caras. El sistema se dimensiona con cinco años de datos meteorológicos horarios por satélite de tu ubicación exacta.",
    simpleCaveat:
      "Es una estimación, no una promesa; todas las cifras completas están a un clic.",
    simpleSeeDetails: "Ver todos los detalles",
    simpleDownloadBom: "Descargar lista de piezas (CSV)",
    simpleAskAdvisor: "Pregunta al asistente de IA (en palabras simples)",
    sanityOk: "Verificado de forma independiente ✓ — físicamente plausible",
    sanityFlag:
      "⚠ Una verificación de IA independiente marca este resultado como físicamente implausible —",
    sanityAskAdvisor: "pregunta al asistente por qué",
    sanityUncertain:
      "Verificación no concluyente — la comprobación independiente de IA no alcanzó un veredicto seguro sobre estas entradas",
    sanityTooltip:
      "Un clasificador de IA independiente (Jev) revisó solo las cifras del dimensionamiento — ninguna ubicación, texto o dato personal sale de tu navegador más allá de estas cifras. Nunca cambia el resultado calculado.",
    simpleAdvisorStyle:
      "[INSTRUCCIÓN PARA EL ASISTENTE: el visitante está en modo Simple. Responde como un experto hablando con un niño de 12 años inteligente: palabras cotidianas sencillas, sin tecnicismos (explica cualquier término técnico entre paréntesis), máximo 4 frases cortas, y termina con el UNO número que más importa.]",
    advisorTitle: "Asesor gratuito de energía con IA",
    advisorSubtitle:
      "Hablas con una IA (motor Groq) — solo estimaciones educativas, no asesoramiento de ingeniería",
    advisorIntro:
      "Explico los resultados de la calculadora: química de baterías, cableado y protecciones, o preguntas para un electricista local. Ejecuta primero el dimensionamiento y luego pregúntame sobre este resultado, o hazme cualquier pregunta.",
    advisorBotNote:
      "Estimación generada por IA: puede ser inexacta, incluidos precios y especificaciones. No es asesoramiento de ingeniería. Verifícala con un electricista o ingeniero autorizado antes de comprar o construir.",
    advisorThinking: "⏳ Pensando...",
    advisorLabel: "Pregunta al asesor de IA sobre tu sistema",
    advisorPlaceholder:
      "Pregunta sobre celdas, sodio-ion frente a LFP, costes de transporte...",
    advisorSend: "Enviar",
    advisorClose: "Cerrar asesor de IA",
    advisorBusyRetry:
      " El motor gratuito de IA está ocupado; reintentando en {secs}s…",
    advisorNoReply: " No se recibió respuesta. Inténtalo de nuevo.",
    advisorBusy:
      " El motor gratuito de IA está satur ahora (HTTP {status} — usa una cuota compartida).\n\nEspera aproximadamente un minuto y vuelve a enviarlo.",
    // ── Degraded advisor reply (B2 / R-CF-10) ──────────────────────────
    advisorDegradedLabel: "Sin conexión · no la IA en directo",
    advisorDegradedLine: "No puedo responder ahora — {why}.",
    advisorDegradedWhyUnavailable: "el servicio que responde no ha contestado",
    advisorDegradedWhyNoKey:
      "no hay clave de modelo: el asesor está apagado por diseño",
    advisorDegradedReassure:
      "Nada de lo anterior está mal y tus cálculos no se ven afectados.",
    advisorDegradedSystem:
      "Lleva esas cifras a un electricista habilitado antes de construir.",
    advisorIsAi:
      "El asesor es un modelo de lenguaje. Escribe texto plausible y puede dar cifras incorrectas con confianza. Comprueba cada número: nunca lo tomes como hecho.",
    advisorDegradedGeneral:
      "Para dimensionar, usa la calculadora de arriba; sin cuenta.",
    advisorDegradedRetry:
      "Inténtalo en un minuto; la cuota gratuita es compartida.",
    advisorUnreachable:
      " El asesor de IA no está disponible ahora{status}.\n\nComprueba tu conexión y vuelve a intentarlo en un momento.",
    frontierCeilingTag: "Lo máximo dentro de lo buscado: {pct}%",
    frontierSvgTitle: "Hasta dónde llega tu dinero",
    frontierSvgDesc:
      "Una curva de {n} sistemas, desde {lowCost} que cubre {lowPct}% hasta {highCost} que cubre {highPct}%. Las cifras completas están en la tabla bajo el gráfico.",
    frontierPointTip:
      "{cost}: {pct}% — {pv} kW de paneles + {batt} kWh de batería",
    budgetLabel: "Tu presupuesto (inicial)",
    frontierTableCaption:
      "Cada punto de la curva. El coste típico es el punto medio DIY con flete incluido; el rango va de celdas sueltas a retail enviado.",
    frontierColCost: "Coste típico",
    frontierColRange: "DIY a retail",
    frontierColCut: "Factura reducida",
    frontierColCutBattery: "Horas punta desplazadas",
    frontierColCover: "Cubierto",
    frontierColPv: "Paneles",
    frontierColBatt: "Batería",
    frontierNoBattery: "ninguna",
    frontierTableToggle: "Ver todos los puntos en una tabla",
    frontierLegendCurve: "El sistema más barato que alcanza cada nivel",
    frontierLegendBand: "Los mismos sistemas, de compra DIY a retail enviado",
    frontierLegendRange: "Rango óptimo — cada punto extra sigue barato",
    frontierBestValueRange: "Rango óptimo: ~{lo}–{hi} ({loPct}–{hiPct}%).",
    frontierRangeTag: "mejor valor",
    frontierTagSel: "seleccionado",
    fuelLitLabel: "Precio por litro",
    fuelGalLabel: "Precio por galón",
    fuelReadoutRate: "{type} a este precio sale a unos {rate} por kWh",
    fuelReadoutBurn:
      "({entry} ÷ {burn} {unit}/kWh — solo el combustible; el aceite, los filtros y el desgaste del motor elevan el coste real)",
    fuelReadoutGrid:
      "La electricidad de red típica ronda entre {lo} y {hi} por kWh.",
    fuelApplyOk:
      "Tu combustible de generador sale a unos {rate}/kWh — se ha introducido como tu precio de la electricidad, así que cada cifra de amortización abajo compara con lo que quemas hoy.",
    tariffSpendOffgrid:
      "A {tariff}/kWh, este consumo cuesta unos {annual} al año en electricidad de red. Las cifras de amortización abajo comparan el coste del sistema contra ese gasto.",
    tariffSpendFixed:
      " Eso incluye {fixed}/mes en cargos fijos que el solar no reduce.",
    readoutKwhEmpty:
      "Introduce tu consumo diario en kWh para ver la estimación.",
    frontierLegendCeiling:
      "Lo máximo que alcanzan los tamaños buscados, no un límite físico",
    frontierMarkerOffCurve:
      "Tu opción queda a la derecha de la curva porque la recomendación se elige por el coste real a 20 años, no por el precio de hoy: un banco más barato que hay que reemplazar cuesta menos ahora y más después.",
    frontierVerdictSteepGrid:
      "Recortar cerca del {kneePct}% de tu factura cuesta unos {kneeCost}. A partir de ahí se encarece rápido: unos {tailCost} por cada punto adicional, frente a {headCost} antes.",
    frontierVerdictTaperingGrid:
      "Recortar cerca del {kneePct}% de tu factura cuesta unos {kneeCost}. Después, cada punto adicional cuesta unos {tailCost}, alrededor de {ratio} veces el ritmo anterior.",
    frontierVerdictCoveredBattery:
      "El tamaño no es tu límite aquí. La batería práctica más pequeña — {batt} kWh, unos {cost} — ya desplaza casi todas las horas punta de este consumo. Algo mayor compra capacidad de reserva, no más desplazamiento.",
    frontierVerdictBeyondSweepBattery:
      "Dentro de los tamaños de batería que busca esta herramienta — hasta {battMax} kWh — lo máximo que puedes desplazar aquí es cerca del {ceilingPct}%, por unos {ceilingCost}. El buen valor se acaba mucho antes, en el {kneePct}% por unos {kneeCost}; desplazar más exige un banco mayor que cualquier cosa dimensionada aquí.",
    frontierVerdictSteepBattery:
      "Desplazar cerca del {kneePct}% de tus horas punta a la batería cuesta unos {kneeCost}. Después se encarece rápido: unos {tailCost} por cada punto adicional, frente a {headCost} antes.",
    frontierVerdictTaperingBattery:
      "Desplazar cerca del {kneePct}% de tus horas punta a la batería cuesta unos {kneeCost}. A partir de ahí, cada punto adicional cuesta unos {tailCost}, alrededor de {ratio} veces el ritmo anterior.",
    frontierVerdictLinearBattery:
      "El desplazamiento acompaña el gasto de forma bastante uniforme aquí — unos {headCost} por cada punto de horas punta, hasta el {ceilingPct}%.",
    frontierVerdictLinearGrid:
      "Aquí el ahorro sigue al gasto de forma bastante pareja: unos {headCost} por cada punto de tu factura, hasta el {ceilingPct}%.",
    frontierVerdictBeyondSweepGrid:
      "Dentro de los tamaños que busca esta herramienta —hasta {pvMax} kW de paneles y {battMax} kWh de batería— lo máximo que puedes recortar aquí es cerca del {ceilingPct}%, por unos {ceilingCost}. La buena relación se acaba mucho antes, en el {kneePct}% por unos {kneeCost}. Recortar más no es imposible: simplemente exige un sistema mayor que cualquiera dimensionado aquí.",
    frontierVerdictSteepOffgrid:
      "Cubrir cerca del {kneePct}% de tu energía cuesta unos {kneeCost}. El último tramo hasta la independencia total es donde se va el dinero: unos {tailCost} por cada punto adicional, frente a {headCost} antes.",
    frontierVerdictTaperingOffgrid:
      "Cubrir cerca del {kneePct}% de tu energía cuesta unos {kneeCost}. Después, cada punto adicional cuesta unos {tailCost}, alrededor de {ratio} veces el ritmo anterior.",
    frontierVerdictLinearOffgrid:
      "Aquí la cobertura sigue al gasto de forma bastante pareja: unos {headCost} por punto, hasta el {ceilingPct}%.",
    frontierVerdictBeyondSweepOffgrid:
      "Dentro de los tamaños que busca esta herramienta —hasta {pvMax} kW de paneles y {battMax} kWh de batería— lo máximo que puedes cubrir aquí es cerca del {ceilingPct}%, por unos {ceilingCost}. La buena relación se acaba en el {kneePct}% por unos {kneeCost}. La independencia total no es imposible aquí, pero exige un sistema mucho mayor; un generador o la red casi seguro son la forma más barata de cubrir el resto.",
    frontierMethod:
      "La curva sale de simular cada combinación de paneles y batería en una malla gruesa con el mismo clima horario que las tarjetas de arriba, y quedarse solo con los sistemas que nada más barato supera. Los precios usan el mismo punto medio DIY con flete que el resto de la página.",
    frontierMethodBattery:
      "La curva sale de simular cada tamaño de batería en una malla gruesa con el mismo clima horario y las mismas franjas tarifarias que las tarjetas de arriba, y quedarse solo con los sistemas que nada más barato supera. Aquí no hay paneles, así que la curva solo varía el banco de baterías. Los precios usan el mismo punto medio DIY con flete que el resto de la página.",
    // -- Cumulative 20-year cost caption (under the chart canvas) --
    cumCostRecommended: "recomendado",
    cumCostSelected: "seleccionado",
    cumCostCaptionHead:
      "Coste acumulado a 20 años del sistema {which} ({label}): la línea ámbar es lo que pagas a la compañía si sigues conectado a la red ({gridTotal}).",
    cumCostCaptionOwnCost:
      "La línea esmeralda es el coste propio del sistema solar (~{systemTotal}), y coincide con la fila “Coste total a 20 años” de este sistema.",
    cumCostCaptionOwnCostNoPanels:
      "La línea esmeralda es el coste propio del sistema (~{systemTotal}), y coincide con la fila “Coste total a 20 años” de este sistema.",
    cumCostCaptionStack:
      "La cifra ámbar es una pila — el sistema, luego las facturas menores que quedan tras lo solar (~{residualBills}), luego tu ahorro — así que este sistema te devuelve {saved} en los 20 años.",
    cumCostCaptionStackNoPanels:
      "La cifra ámbar es una pila — el sistema, luego las facturas menores que quedan (~{residualBills}), luego tu ahorro — así que este sistema te devuelve {saved} en los 20 años.",
    cumCostCaptionNetNegative:
      "Aquí la pila va al revés: esas facturas que quedan (~{residualBills}) nunca bajan lo suficiente, así que en 20 años este sistema cuesta unos {loss} MÁS que seguir conectado a la red — dinero gastado, no dinero ahorrado.",
    cumCostCaptionRepaid:
      "El sistema ha recuperado su coste en el año {year} — cada año posterior devuelve ~{perYear} a tu bolsillo. Ahorro total en 20 años: ~{saved}. Las barras inferiores son tu posición neta: rojas hasta el punto de equilibrio y luego en ascenso.",
    cumCostCaptionNeverRepays:
      "En 20 años el sistema nunca recupera su coste — las sustituciones de batería superan el ahorro en factura, así que la respuesta honesta es: aquí no se paga solo.",
    cumCostCaptionResidual:
      "La línea gris pizarra es el coste residual de la red — unos {annual}/año por los {kwh} kWh/año que aún tomas de la red (neto de tu crédito por vertido), {end} en los 20 años.",
    cumCostCaptionResidualCreditDraw:
      "La línea gris pizarra baja de $0 — facturación neta: el valor de vertido de tu excedente supera incluso los pequeños {kwh} kWh/año que aún consumes, así que ganas ~{earned} en los 20 años.",
    cumCostCaptionResidualCreditBill:
      "La línea gris pizarra baja de $0 — facturación neta: el valor de vertido de tu excedente supera la pequeña factura que aún pagas, así que ganas ~{earned} en los 20 años.",
    cumCostCaptionSurplusCredit:
      "El total con solar (~{withSolar}) queda POR DEBAJO del coste propio del sistema: tu crédito por vertido del excedente supera la pequeña factura que queda, así que la pila sale negativa y la compañía te debe ~{owed} en el balance a 20 años.",
    frontierVerdictCoveredOffgrid:
      "Aquí el tamaño no es tu limitación. El sistema práctico más pequeño —{pv} kW de paneles y {batt} kWh de batería, unos {cost}— ya cubre toda esta carga durante todo el año. Cualquier cosa mayor compra capacidad de reserva, no más independencia.",
    frontierVerdictCoveredGrid:
      "Aquí el tamaño no es tu limitación. El sistema práctico más pequeño —{pv} kW de paneles y {batt} kWh de batería, unos {cost}— ya cubre prácticamente toda esta carga. Cualquier cosa mayor compra capacidad de reserva, no más ahorro.",
    pipelineLocation: "Ubicación",
    pipelineWeather: "Clima",
    pipelineSimulating: "Simulando",
    pipelineRendering: "Renderizando",
    pipelineElapsed: "{s} s transcurridos",
    pipelineCached: "en caché",
    pipelineReaching: "contactando el satélite…",
    pipelineChunks: "{done}/{total} fragmentos satelitales",
    speedNoteRepeat:
      "⚡ Instantáneo — repetición exacta de esta configuración (calculada hace un momento)",
    speedNoteCached: "⚡ Instantáneo — clima satelital en caché",
    speedNoteCachedWhere:
      "⚡ Instantáneo — clima satelital en caché para {where}",
    speedNoteOffline: "⚡ Instantáneo — año típico sin conexión",
    speedNoteOfflineWhere:
      "⚡ Instantáneo — año típico sin conexión para {where}",
    fmtAllDay: "todo el día (24 h)",
    fmtHoursDay: "{h} h/día",
    fmtMinutesDay: "{m} min/día",
    apWattsRunning: "~{w} W en funcionamiento",
    apWatts: "~{w} W",
    apKwhDay: "{kwh} kWh/día",
    apAvgW: " (~{w} W de media)",
    offgridKwhReadout: "~{kwh} kWh/día",
    quickBillStarts:
      "Empieza desde ~{bill} (≈{kwh} kWh/día). Pon aquí tu factura real, elige una ubicación y pulsa Dimensionar mi sistema. El control de recorte aparece con los resultados.",
    quickBillManual:
      "Estimación rápida: ~{bill} (empieza desde ~{kwh} kWh/día) — cambia a Manual para ajustar tu factura, electrodomésticos o tarifa.",
    dailyEnergyNeed: "Necesidad diaria de energía (control kWh/día)",
    billPerMonth: "/mes",
    simpleHeadline: "En tu ubicación, este sistema consigue {goal}:",
    simpleGoalGrid: "recortar cerca de un {pct}% de tu factura",
    simpleGoalBattery:
      "desplazar cerca del {pct}% de tus horas punta a la batería",
    simpleGoalOffgrid: "cubrir tu hogar durante todo el año",
    sharedLocationLoaded:
      "Resultado compartido cargado — datos de sol para esta ubicación",
    uiInitFailed:
      "Aviso: la interfaz no pudo cargarse — actualiza la página (Ctrl+F5).",
    infeasibleAreaTitle:
      "Demasiada poca área de techo/terreno para este objetivo",
    infeasibleAreaBody:
      "El tamaño solar buscado quedó limitado por el campo opcional de área (ver “Configuración de hardware”). Borra ese campo — o dibuja un área mayor en el mapa — y vuelve a ejecutar: el sitio en sí puede alcanzar este objetivo.",
    infeasibleEnvelopeTitle:
      "Fuera del rango de búsqueda de esta herramienta para este objetivo",
    infeasibleEnvelopeBody:
      "Con este consumo, alcanzar el objetivo necesita un array solar o banco de baterías mayor que el que busca esta calculadora (ver Configuración de hardware para los límites). Prueba un objetivo de recorte menor, o mira si parte del consumo puede reducirse.",
    infeasibleNeedsBatteryTitle:
      "Solo solar no puede alcanzar el 100% fuera de la red",
    infeasibleNeedsBatteryBody:
      "Un hogar fuera de la red necesita almacenamiento para las noches y los días nublados. Añade una batería al selector de hardware, o cambia el objetivo a 'Recortar mi factura, seguir conectado' (conectado a la red).",
    infeasibleNeedsPanelsTitle:
      "Solo batería no puede funcionar fuera de la red",
    infeasibleNeedsPanelsBody:
      "Nada recarga el banco en este sitio. Añade paneles al selector de hardware, o cambia el objetivo a 'Recortar mi factura, seguir conectado' (conectado a la red).",
    infeasibleNeedsSurplusTitle:
      "Un banco solo de baterías no puede producir excedente",
    infeasibleNeedsSurplusBody:
      "El excedente necesita paneles que generen más que tu consumo. Baja el objetivo por debajo del 100% en el control de recorte, o cambia la configuración a 'Solar + Batería'.",
    infeasibleGenericTitle:
      "Esta combinación de hardware y objetivo no tiene solución",
    infeasibleGenericBody:
      "Cambia el objetivo o el hardware y vuelve a ejecutar.",

    pathsLabel_turnkey: "Instalador, llave en mano",
    pathsLabel_lease: "Alquiler o PPA",
    pathsLabel_selfpurchase: "Tú compras las piezas",
    pathsLabel_diy: "Tú lo montas, un electricista lo conecta",
    pathsTitle: "Cuatro formas de pagar este mismo sistema",
    pathsSub:
      "Un sistema, una sola definición, veinte años. La diferencia entre estas tarjetas es de precio, no de qué incluye cada una.",
    pathsCheapest: "Más barato",
    pathsSpend20: "Coste a 20 años",
    pathsRowIncentives: "Incentivos",
    pathsRowBillCut: "Ahorro en la factura",
    pathsRowBreakEven: "Equilibrio",
    pathsRowNet: "Neto a 20 años",
    pathsRowOwnership: "Titularidad",
    pathsRowEndOfTerm: "Al final",
    pathsCountsHeading: "Qué incluye este precio",
    pathsInstrumentLabel: "Vía de terceros:",
    pathsGradeNote:
      "Todas las cifras provienen de un único registro de precios regional con fuente indicada y grado de confianza. El hardware es tu propia estimación; la mano de obra, los permisos, los incentivos y las sustituciones son datos del registro. Nada de esto es una oferta de un vendedor.",
    pathsWhy:
      "{cheaper} sale {gap} menos que {dearer} en 20 años, sobre todo por {driver}.",
    pathsWhyCombined:
      " Ningún elemento explica por sí solo toda la diferencia.",
    pathsDriver_year0: "el precio inicial",
    pathsDriver_incentives: "a quién van los incentivos",
    pathsDriver_om: "el mantenimiento",
    pathsDriver_replacements: "las sustituciones de batería e inversor",
    pathsDriver_leasePayments: "los pagos que haces",
    pathsDriver_none: "ningún elemento concreto",
    pathsInstrumentPpa: "PPA (compras la energía)",
    pathsInstrumentLease: "Alquiler (alquilas el sistema)",
    pathsEndOfTermBuyout:
      "Año {years}: puedes comprarlo por el {buyoutPct}% del precio instalado, y esa compra ya está incluida en esta cifra.",
    pathsEndOfTermStillLeasing:
      "En el año {years} el contrato sigue vigente, así que no se incluye ninguna compra. Pasados los 20 años seguirías debiendo pagos.",
    pathsOwnershipTurnkey: "Eres propietario desde el primer día.",
    pathsOwnershipPpa: "El proveedor es el propietario y lo mantiene.",
    pathsOwnershipLease:
      "Lo alquileres hasta que termine el contrato y luego lo compras o lo devuelves.",
    pathsOwnershipSelf: "Eres propietario una vez instalado.",
    pathsIncentiveTaxCredit: "Crédito fiscal federal",
    pathsIncentiveRebate: "Subvención de la compañía eléctrica",
    pathsIncentivesToProvider: "Los incentivos van al proveedor, no a ti.",
    pathsIncentivesGoToProvider:
      "El proveedor se los queda: no eres propietario de nada.",
    pathsNoIncentive: "Ninguno se aplica a esta vía.",
    pathsNoVerifiedIncentive:
      "No tenemos un incentivo verificado para tu región.",
    pathsUnknown: "Desconocido",
    pathsNotWithinHorizon: "No dentro de 20 años",
    pathsBreakEvenYear: "Año {year}",
    pathsUnavailable: "No disponible",
    pathsNoSystem: "No hay ningún sistema que presupuestar.",
    pathsNoTariff:
      "Un PPA necesita una tarifa con la que comparar, así que no se muestra aquí.",
    pathsDiyNotPermitted:
      "No se ofrece aquí: en tu zona, la instalación eléctrica la debe hacer un instalador con licencia.",
    pathsDiyRestricted:
      "No se ofrece aquí: el montaje DIY está restringido en tu zona.",
    pathsDiyUnknown:
      "No se ofrece aquí: no pudimos verificar si puedes montar tu propio panel.",
    pathsNoteTurnkeyAllIn:
      "Un único precio que incluye todo: el mismo hardware, más mano de obra, permisos y el margen del instalador.",
    pathsIncludesInstalledAllIn:
      "Piezas, mano de obra y permisos, ya instalados",
    pathsIncludesProviderSwaps:
      "El proveedor mantiene y sustituye batería e inversor",
    pathsIncludesIncentivesToProvider:
      "Los incentivos van al proveedor, no a ti",
    pathsIncludesIncentivesIfEligible: "Incentivos, si te corresponden",
    pathsIncludesNoYear0Hardware: "Sin compra de hardware al inicio",
    pathsIncludesEndOfTerm:
      "La decisión al final del contrato está incluida en el precio",
    pathsIncludesHardwareYouBuy: "El hardware que compras tú",
    pathsIncludesElectricianInstalls:
      "Un electricista con licencia hace la instalación",
    pathsIncludesPermitsAndInterconnection:
      "Permisos, inspección y conexión a la red",
    pathsIncludesYouDoSwaps:
      "Tú gestionas y pagas las sustituciones de baterías",
    pathsIncludesYouMountTheArray: "Tú montas el panel",
    pathsIncludesElectricianConnects: "Un electricista hace la conexión",
    pathsIncludesToolsAndSafety: "Herramientas y equipo de seguridad",
  },
  pt: {
    navSizing: "Dimensione seu sistema",
    navSupport: "Suporte",
    cutLabel: "Sua meta de redução da conta",
    cutLabelBattery: "Sua meta de deslocamento de horas de ponta",
    cutValueBattery:
      "Meta: deslocar ~{pct}% das suas horas de ponta para a bateria",
    fxCodeLabel: "Código da moeda:",
    firstRunNote:
      "Escolha sua localização e seu consumo e clique em Dimensionar meu sistema. A primeira execução baixa ~2 MB de dados de clima por satélite e depois os guarda no navegador.",
    navBom: "Referência de hardware",
    navBlog: "Blog",
    navLegal: "Termos e aviso legal",
    sourcesCardTitle: "De onde vêm estes números",
    sourcesCardBody:
      "Cada premissa por trás de um número indica aqui o responsável, a data da verificação e o quanto corresponde ao que aplicamos. As que não conseguimos documentar dizem isso.",
    sourcesCardLink: "Ver todas as fontes →",
    heroTag:
      "Grátis para todos, no mundo inteiro · Sem cadastro · Nada à venda",
    heroTitle1: "Corte a sua conta de luz.",
    heroTitle2: "Veja exatamente o que seria preciso.",
    footerAboutPre: "Criada e oferecida por",
    heroIntro:
      "Comece pela sua localização — o telemóvel sabe — e calculamos cada opção que corta a sua conta, de 1% ao excedente vendável. A curva de preço mostra o que cada orçamento compra, na sua moeda. Apenas estimativas educativas, nada à venda. Criada e oferecida por",
    footerAboutPost: "Não é uma empresa, não é constituída, nada à venda.",
    ctaStart: "Comece sua estimativa grátis",
    goalLabel: "O que você quer que este sistema faça?",
    useCaseLabel: "O que você quer fazer?",
    useCaseBillCut: "Reduzir minha conta de luz",
    useCaseTou: "Economizar com uma bateria em tarifas horárias",
    useCaseBackup:
      "Manter o essencial funcionando durante uma queda de energia",
    useCaseReserve: "Guardar uma reserva de emergência na bateria",
    useCaseOffGrid: "Ficar totalmente sem rede",
    useCasePortable: "Energia portátil (van, barco, camping)",
    useCaseBillCutBlurb:
      "Solar ligado à rede, com bateria só quando ela se paga. Medido como a parcela da sua conta que o sistema elimina em 20 anos.",
    useCaseTouBlurb:
      "Só bateria: carrega nas horas baratas e cobre as caras. Sem painéis.",
    useCaseBackupBlurb:
      "Dimensionado pelos eletrodomésticos que você marcar, não pela casa toda. Medido como a parcela dos apagões que o essencial atravessa.",
    useCaseReserveBlurb:
      "Deixe uma parte da bateria guardada para os apagões e veja exatamente quanto isso custa em economia.",
    useCaseOffGridBlurb:
      "Solar e bateria dimensionados para a casa inteira. Medido como a parcela das horas que funcionam sem rede nenhuma.",
    useCasePortableBlurb:
      "Uma estação de energia para van, barco ou acampamento. Sem telhado, sem rede, sem tarifa.",
    metricBillCut: "da sua conta eliminada em 20 anos",
    metricTouOffset: "da sua energia nas horas de pico coberta pela bateria",
    metricOutageCoverage:
      "dos apagões que o essencial atravessa pelo tempo todo",
    metricReserveTradeoff: "o que custar a reserva, em economia e horas",
    metricGridIndependence: "do ano funcionando sem rede nenhuma",
    metricPortableRuntime:
      "dos dias em que a estação alimenta seus aparelhos o dia todo",
    statusWorks: "Funciona",
    statusPartial: "Em parte",
    statusNotHere: "Aqui não funciona",
    useCaseOutcomeTitle: "Seu resultado de {useCase}",
    useCaseVerdictFooter:
      "Medido para {useCase} em relação a {metric}, com o clima horário deste local.",
    useCaseNotMeasured:
      "Sem medir: esta combinação não pode ser dimensionada, então não há {metric} a informar.",
    metricReserveTradeoffValue: "{lost}% de economia, {hours} h de cobertura",
    reserveOff: "desativada",
    touPeakLabel: "Seu preço de pico (por kWh)",
    touOffPeakLabel: "Seu preço fora do pico (por kWh)",
    touDefaultNote:
      "Não temos uma tarifa horária publicada para sua região, então deixamos um preço de pico 60% maior e um preço fora do pico 45% menor que sua tarifa plana. Mude qualquer um dos dois se a sua conta disser outra coisa: o veredicto usa o que você digitar.",
    essentialLabel:
      "O que precisa continuar funcionando? (marque o que quiser)",
    outageLabel: "Por quanto tempo precisa durar?",
    backupRechargeLabel: "Deixe os painéis recarregá-la durante o apagão",
    reserveLabel: "Reserva de emergência guardada na bateria",
    portableDeviceLabel: "O que você vai alimentar? (marque o que quiser)",
    portableBankLabel: "Capacidade útil da estação (kWh)",
    portableShoreLabel: "Posso recarregar pela rede ou pelo veículo",
    generatorLabel: "Há um gerador disponível para as piores semanas",
    verdictBillCut:
      "{status}: este sistema elimina {pct}% da sua conta em 20 anos.",
    verdictTou:
      "{status}: a bateria cobre {pct}% da sua energia nas horas de pico, valendo cerca de {saving} em 20 anos contra uma bateria de {cost}. A diferença entre pico e fora do pico aqui é de {spread} por kWh.",
    verdictBackup:
      "{status}: o essencial funciona as {targetHours} horas completas em {pct}% dos apagões que simulamos (noite típica: {hours} horas).",
    verdictReserve:
      "{status}: guardar essa reserva custa {pct}% da sua economia e compra {coverHours} horas de cobertura.",
    verdictReserveNoBattery:
      "Não há onde guardar uma reserva: o sistema mais barato para esse objetivo não tem bateria nenhuma.",
    verdictOffGrid:
      "{status}: {pct}% do ano funciona sem rede — faltam {unmetHours} horas no pior ano, com {autonomy} dias de autonomia.",
    verdictPortable:
      "{status}: sua estação alimenta seus aparelhos o dia todo em {days} de {trips} dias aqui, e uma carga dura {runtime} horas.",
    cityLabel: "Onde o sistema será instalado?",
    loadLabel: "Quanta energia você consome?",
    loadAppliances: "Escolho meus eletrodomésticos",
    loadBill: "Sei minha conta mensal de luz",
    loadKwh: "Sei meu consumo em kWh/dia (avançado)",
    langLabel: "Idioma",
    readoutAppliancesEmpty:
      "Marque os eletrodomésticos que deseja alimentar e sua energia diária aparecerá aqui.",
    readoutAppliancesSummary:
      "Uso estimado: uns {kwh} kWh/dia · tudo ligado ao mesmo tempo ≈ {peakW} W (seu inversor deve ser maior)",
    readoutBill: "Isso equivale a uns {kwhDay} kWh/dia de uso médio.",
    readoutBillIncomplete:
      "Informe sua conta mensal para ver a estimativa diária.",
    readoutKwhEmpty: "Informe seu consumo diário em kWh para ver a estimativa.",
    readoutKwhReady: "Usando {kwh} kWh/dia diretamente.",
    runBtn: "Dimensionar meu sistema (simulação de 5 anos)",
    locBtn: "Usar minha localização atual",
    chemLabel: "Química da bateria:",
    tariffNote:
      "Preço estimado para {label} — mude acima se souber sua tarifa.",
    pickCity:
      "Escolha uma cidade (ou use 📍 Minha localização) para sabermos sua insolação.",
    shareLoaded:
      "Configuração compartilhada carregada. Confira os dados e clique em Dimensionar meu sistema para calcular.",
    invalidShare: "Link inválido.",
    customCoordsLocation: "Usando coordenadas personalizadas ({lat}, {lon}).",
    resolvingCity:
      "Buscando sua cidade: escolha uma opção ou aguarde o resultado.",
    chooseCityMatch: "Escolha uma cidade sugerida ou aguarde a busca terminar.",
    resolvingCoords: "Verificando essas coordenadas…",
    invalidCoordinates:
      "A latitude deve estar entre −90 e 90 e a longitude entre −180 e 180.",
    invalidDailyKwh: "O consumo diário deve ficar entre 0,5 e 500 kWh por dia.",
    inputsChanged:
      "Os dados mudaram — clique em Dimensionar meu sistema para atualizar.",
    errorTimeout:
      "O motor de dimensionamento não respondeu a tempo — verifique sua conexão e tente novamente.",
    tellPowerUse:
      "Informe seu consumo de energia: marque alguns eletrodomésticos, ou informe uma conta ou um valor em kWh.",
    statusGridtie:
      "⏳ Obtendo cinco anos de clima por satélite e buscando tamanhos de sistema para cortar a conta…",
    statusOffgrid:
      "⏳ Obtendo 5 anos de clima horário por satélite e buscando tamanhos de sistema…",
    runningBtn: "⏳ Simulando 5 anos...",
    runBtnReady: "☀️ Dimensionar meu sistema (simulação 5 anos)",
    errorSim:
      "⚠️ O motor de dimensionamento não pôde carregar. Atualize a página (Ctrl+F5) e tente novamente.",
    statusSuccess:
      "✅ {years} anos de dados horários ({dataYears}) · {yield} kWh/ano por kW de painel.{offline}",
    offlineNote: " · 🌐 modo offline típico",
    tariffSpendLine:
      "A {tariff}/kWh, a sua eletricidade custa cerca de {annual} por ano hoje. Cada opção abaixo mostra a conta após a solar e em quanto tempo ela se paga com as economias.",
    tariffSpendBattery:
      "A {tariff}/kWh, a sua eletricidade custa cerca de {annual} por ano hoje. Uma bateria sem painéis muda quando consome; não reduz o que paga.",
    tariffSpendOffgrid:
      "A {tariff}/kWh, este uso custa cerca de {annual} por ano em energia da rede. Os valores de retorno abaixo comparam o custo do sistema com esse gasto.",
    tariffSpendFixed:
      " Isso inclui {fixed}/mês em encargos fixos que o solar não reduz.",
    lvlBest: "Melhor escolha",
    lvlCompare: "Comparar baterias",
    lvlMatrix: "Todas as opções",
    bomPanelTitle: "Sua lista de hardware — do que este sistema é feito",
    genSummary: "Uso um gerador — quanto custa de verdade a energia dele?",
    genApply: "Usar isto como meu preço de eletricidade",

    // -- Plausibility frontier (spend -> coverage curve) --
    socChartTitle:
      "Níveis de carga da bateria e confiabilidade anual (5 anos de clima real)",
    frontierTitle: "Até onde vai o seu dinheiro?",
    frontierIntro:
      "Todos os sistemas possíveis na sua localização, do mais barato ao mais caro. A linha é o melhor resultado que cada orçamento consegue comprar — para você ver de relance se o seu objetivo aqui é fácil, caro ou inalcançável.",
    frontierX: "Custo inicial do sistema",
    frontierYGrid: "Parte da sua conta de luz cortada",
    frontierYGridBattery: "Parte das suas horas de ponta deslocadas",
    frontierYOffgrid: "Parte da sua energia coberta, sem gerador",
    frontierSelTag: "{pv} kW + {batt} kWh · {pct}% · {cost}",
    frontierSelNoBatt: "{pv} kW, sem bateria · {pct}% · {cost}",
    frontierLegendSel:
      "Opção selecionada — clique em qualquer ponto para escolher",
    frontierNoSystem:
      "Nenhum sistema dentro dos tamanhos que esta ferramenta procura consegue atingir esse objetivo neste local. A curva abaixo mostra até onde este local consegue chegar na prática — tente uma meta menor, ou planeje um gerador ou conexão à rede para cobrir o que o sol não cobre.",
    simpleInfeasible:
      "Neste local, nenhum sistema que possamos construir atinge essa meta. Tente uma meta de economia menor, ou veja os detalhes completos para saber até onde a energia solar consegue chegar.",
    simpleWhatItMeans:
      "Os painéis geram energia enquanto há sol; a bateria a guarda para a noite e os dias nublados. O sistema é dimensionado com cinco anos de dados meteorológicos horários por satélite do seu local exato.",
    simpleWhatItMeansBattery:
      "Uma bateria não gera nada por si só: carrega nas horas baratas e guarda essa energia para as caras. O sistema é dimensionado com cinco anos de dados meteorológicos horários por satélite do seu local exato.",
    simpleCaveat:
      "É uma estimativa, não uma promessa — todos os números completos estão a um clique.",
    simpleSeeDetails: "Ver todos os detalhes",
    simpleDownloadBom: "Baixar lista de peças (CSV)",
    simpleAskAdvisor: "Pergunte ao assistente de IA (em palavras simples)",
    sanityOk: "Verificado de forma independente ✓ — fisicamente plausível",
    sanityFlag:
      "⚠ Uma verificação de IA independente marca este resultado como fisicamente implausível —",
    sanityAskAdvisor: "pergunte ao assistente por quê",
    sanityUncertain:
      "Verificação inconclusiva — a verificação independente de IA não alcançou um veredito confiável sobre estas entradas",
    sanityTooltip:
      "Um classificador de IA independente (Jev) analisou apenas os números do dimensionamento — nenhum local, texto ou dado pessoal sai do seu navegador além desses números. Ele nunca altera o resultado calculado.",
    simpleAdvisorStyle:
      "[INSTRUÇÃO PARA O ASSISTENTE: o visitante está no modo Simples. Responda como um especialista a falar com uma criança de 12 anos inteligente: palavras do dia a dia, sem jargão (explica qualquer termo técnico num parêntese curto), no máximo 4 frases curtas, e termine com O número que mais importa.]",
    advisorTitle: "Consultor gratuito de energia com IA",
    advisorSubtitle:
      "Está a falar com uma IA (motor Groq) — apenas estimativas educativas, não aconselhamento de engenharia",
    advisorIntro:
      "Explico os resultados da calculadora: química das baterias, cablagem e proteção, ou perguntas para um eletricista local. Faça primeiro o dimensionamento e depois pergunte sobre este resultado, ou faça-me qualquer pergunta.",
    advisorBotNote:
      "Estimativa gerada por IA — pode ser imprecisa, incluindo preços e especificações. Não é aconselhamento de engenharia. Verifique com um eletricista ou engenheiro licenciado antes de comprar ou construir.",
    advisorThinking: "⏳ A pensar...",
    advisorLabel: "Pergunte ao consultor de IA sobre o seu sistema",
    advisorPlaceholder:
      "Pergunte sobre células, sódio-ion versus LFP, custos de frete...",
    advisorSend: "Enviar",
    advisorClose: "Fechar consultor de IA",
    advisorBusyRetry:
      " O motor gratuito de IA está ocupado — a tentar novamente em {secs}s…",
    advisorNoReply: " Não foi recebida resposta. Tente novamente.",
    advisorBusy:
      " O motor gratuito de IA está sobrecarregado agora (HTTP {status} — usa uma quota partilhada).\n\nEspere cerca de um minuto e envie novamente.",
    // ── Degraded advisor reply (B2 / R-CF-10) ──────────────────────────
    advisorDegradedLabel: "Sem ligação · não a IA em direto",
    advisorDegradedLine: "Não consigo responder agora — {why}.",
    advisorDegradedWhyUnavailable: "o serviço que responde não replied",
    advisorDegradedWhyNoKey:
      "não há chave de modelo: o consultor está off por desenho",
    advisorDegradedReassure:
      "Nada acima está errado e o seu dimensionamento não é afetado.",
    advisorDegradedSystem:
      "Leve esses valores a um eletricista credenciado antes de construir.",
    advisorIsAi:
      "O consultor é um modelo de linguagem. Escreve texto plausível e pode dar números errados com confiança. Verifique cada número: nunca o leve como facto.",
    advisorDegradedGeneral:
      "Para dimensionar, use a calculadora acima; sem conta.",
    advisorDegradedRetry:
      "Tente dentro de um minuto; a quota gratuita é partilhada.",
    advisorUnreachable:
      " O consultor de IA está indisponível neste momento{status}.\n\nVerifique a ligação e tente novamente dentro de instantes.",
    frontierCeilingTag: "O máximo dentro do que foi buscado: {pct}%",
    frontierSvgTitle: "Até onde vai o seu dinheiro",
    frontierSvgDesc:
      "Uma curva de {n} sistemas, de {lowCost} cobrindo {lowPct}% até {highCost} cobrindo {highPct}%. Os números completos estão na tabela abaixo do gráfico.",
    frontierPointTip:
      "{cost}: {pct}% — {pv} kW de painéis + {batt} kWh de bateria",
    budgetLabel: "Seu orçamento (inicial)",
    frontierTableCaption:
      "Cada ponto da curva. O custo típico é o meio-termo DIY já desembaraçado; a faixa vai de células avulsas a varejo entregue.",
    frontierColCost: "Custo típico",
    frontierColRange: "DIY a varejo",
    frontierColCut: "Conta cortada",
    frontierColCutBattery: "Horas de ponta deslocadas",
    frontierColCover: "Coberto",
    frontierColPv: "Painéis",
    frontierColBatt: "Bateria",
    frontierNoBattery: "nenhuma",
    frontierTableToggle: "Ver todos os pontos em tabela",
    frontierLegendCurve: "O sistema mais barato que atinge cada nível",
    frontierLegendBand: "Os mesmos sistemas, de compra DIY a varejo entregue",
    frontierLegendRange: "Faixa ideal — cada ponto extra continua barato",
    frontierBestValueRange: "Faixa ideal: ~{lo}–{hi} ({loPct}–{hiPct}%).",
    frontierRangeTag: "melhor valor",
    frontierTagSel: "selecionado",
    fuelLitLabel: "Preço por litro",
    fuelGalLabel: "Preço por galão",
    fuelReadoutRate: "{type} a esse preço dá cerca de {rate} por kWh",
    fuelReadoutBurn:
      "({entry} ÷ {burn} {unit}/kWh — só o combustível; óleo, filtros e desgaste do motor elevam o custo real)",
    fuelReadoutGrid:
      "A eletricidade da rede normalmente fica entre {lo} e {hi} por kWh.",
    fuelApplyOk:
      "Seu combustível de gerador sai a cerca de {rate}/kWh — definido como seu preço de eletricidade, então cada valor de retorno abaixo compara com o que você gasta hoje.",
    frontierLegendCeiling:
      "O máximo que os tamanhos buscados atingem, não um limite físico",
    frontierMarkerOffCurve:
      "Sua opção fica à direita da curva porque a recomendação é escolhida pelo custo real em 20 anos, não pelo preço de hoje: um banco mais barato que precisa ser trocado custa menos agora e mais depois.",
    frontierVerdictSteepGrid:
      "Cortar cerca de {kneePct}% da sua conta custa uns {kneeCost}. Depois disso fica caro rápido: cerca de {tailCost} por ponto adicional, contra {headCost} antes.",
    frontierVerdictTaperingGrid:
      "Cortar cerca de {kneePct}% da sua conta custa uns {kneeCost}. Depois, cada ponto adicional custa cerca de {tailCost}, umas {ratio} vezes o ritmo anterior.",
    frontierVerdictCoveredBattery:
      "O tamanho não é o seu limite aqui. A bateria prática mais pequena — {batt} kWh, cerca de {cost} — já desloca quase todas as horas de pico deste consumo. Algo maior compra capacidade de reserva, não mais deslocamento.",
    frontierVerdictBeyondSweepBattery:
      "Dentro dos tamanhos de bateria que esta ferramenta procura — até {battMax} kWh — o máximo que consegue deslocar aqui é cerca de {ceilingPct}%, por uns {ceilingCost}. O bom valor acaba muito antes, nos {kneePct}% por cerca de {kneeCost}; deslocar mais exige um banco maior do que tudo o que aqui é dimensionado.",
    frontierVerdictSteepBattery:
      "Deslocar cerca de {kneePct}% das suas horas de pico para a bateria custa uns {kneeCost}. Depois fica caro depressa: cerca de {tailCost} por cada ponto adicional, contra {headCost} antes.",
    frontierVerdictTaperingBattery:
      "Deslocar cerca de {kneePct}% das suas horas de pico para a bateria custa uns {kneeCost}. A partir daí, cada ponto adicional custa cerca de {tailCost} — umas {ratio} vezes o ritmo anterior.",
    frontierVerdictLinearBattery:
      "O deslocamento acompanha o gasto de forma bastante uniforme aqui — cerca de {headCost} por cada ponto de horas de pico, até aos {ceilingPct}%.",
    frontierVerdictLinearGrid:
      "Aqui a economia acompanha o gasto de forma bem regular: cerca de {headCost} por ponto da sua conta, até {ceilingPct}%.",
    frontierVerdictBeyondSweepGrid:
      "Dentro dos tamanhos que esta ferramenta busca — até {pvMax} kW de painéis e {battMax} kWh de bateria — o máximo que você corta aqui é cerca de {ceilingPct}%, por uns {ceilingCost}. O bom custo-benefício acaba bem antes, em {kneePct}% por uns {kneeCost}. Cortar mais não é impossível: só exige um sistema maior do que qualquer um dimensionado aqui.",
    frontierVerdictSteepOffgrid:
      "Cobrir cerca de {kneePct}% da sua energia custa uns {kneeCost}. O último trecho até a independência total é onde o dinheiro vai: cerca de {tailCost} por ponto adicional, contra {headCost} antes.",
    frontierVerdictTaperingOffgrid:
      "Cobrir cerca de {kneePct}% da sua energia custa uns {kneeCost}. Depois, cada ponto adicional custa cerca de {tailCost}, umas {ratio} vezes o ritmo anterior.",
    frontierVerdictLinearOffgrid:
      "Aqui a cobertura acompanha o gasto de forma bem regular: cerca de {headCost} por ponto, até {ceilingPct}%.",
    frontierVerdictBeyondSweepOffgrid:
      "Dentro dos tamanhos que esta ferramenta busca — até {pvMax} kW de painéis e {battMax} kWh de bateria — o máximo que você cobre aqui é cerca de {ceilingPct}%, por uns {ceilingCost}. O bom custo-benefício acaba em {kneePct}% por uns {kneeCost}. A independência total não é impossível aqui, mas exige um sistema bem maior; um gerador ou a rede quase certamente são o jeito mais barato de cobrir o resto.",
    frontierMethod:
      "A curva vem de simular cada combinação de painéis e bateria numa malha grossa com o mesmo clima horário dos cartões acima, mantendo só os sistemas que nada mais barato supera. Os preços usam o mesmo meio-termo DIY desembaraçado do resto da página.",
    frontierMethodBattery:
      "A curva vem de simular cada tamanho de bateria numa malha grossa com o mesmo clima horário e as mesmas janelas tarifárias dos cartões acima, mantendo só os sistemas que nada mais barato supera. Não há painéis nesta execução, então a curva varia apenas o banco. Os preços usam o mesmo meio-termo DIY desembaraçado do resto da página.",
    // -- Cumulative 20-year cost caption (under the chart canvas) --
    cumCostRecommended: "recomendado",
    cumCostSelected: "selecionado",
    cumCostCaptionHead:
      "Custo acumulado em 20 anos do sistema {which} ({label}): a linha âmbar é o que você paga à distribuidora se continuar na rede ({gridTotal}).",
    cumCostCaptionOwnCost:
      "A linha esmeralda é o custo próprio do sistema solar (~{systemTotal}), igual à linha “Custo total em 20 anos” deste sistema.",
    cumCostCaptionOwnCostNoPanels:
      "A linha esmeralda é o custo próprio do sistema (~{systemTotal}), igual à linha “Custo total em 20 anos” deste sistema.",
    cumCostCaptionStack:
      "O valor âmbar é uma pilha — o sistema, depois as contas menores que sobram depois do solar (~{residualBills}), depois a sua economia — então este sistema devolve {saved} ao seu bolso nos 20 anos.",
    cumCostCaptionStackNoPanels:
      "O valor âmbar é uma pilha — o sistema, depois as contas menores que sobram (~{residualBills}), depois a sua economia — então este sistema devolve {saved} ao seu bolso nos 20 anos.",
    cumCostCaptionNetNegative:
      "Aqui a pilha corre ao contrário: essas contas que sobram (~{residualBills}) nunca caem o bastante, então em 20 anos este sistema custa cerca de {loss} MAIS do que continuar na rede — dinheiro gasto, não dinheiro economizado.",
    cumCostCaptionRepaid:
      "O sistema pagou o próprio custo até o ano {year} — cada ano seguinte devolve ~{perYear} ao seu bolso. Economia total em 20 anos: ~{saved}. As barras de baixo são a sua posição líquida: vermelhas até o ponto de equilíbrio, depois subindo.",
    cumCostCaptionNeverRepays:
      "Em 20 anos o sistema nunca paga o próprio custo — as trocas de bateria superam a economia na conta, então a resposta honesta é: aqui ele não se paga.",
    cumCostCaptionResidual:
      "A linha cinza-ardósia é o custo residual da rede — cerca de {annual}/ano pelos {kwh} kWh/ano ainda tirados da rede (líquido do seu crédito de injeção), {end} nos 20 anos.",
    cumCostCaptionResidualCreditDraw:
      "A linha cinza-ardósia desce abaixo de $0 — compensação líquida: o valor de injeção do seu excedente supera até os pequenos {kwh} kWh/ano que você ainda consome, então você ganha ~{earned} nos 20 anos.",
    cumCostCaptionResidualCreditBill:
      "A linha cinza-ardósia desce abaixo de $0 — compensação líquida: o valor de injeção do seu excedente supera a pequena conta que você ainda paga, então você ganha ~{earned} nos 20 anos.",
    cumCostCaptionSurplusCredit:
      "O total com solar (~{withSolar}) fica ABAIXO do custo próprio do sistema: seu crédito de injeção sobre o excedente supera a pequena conta restante, então a pilha fica negativa e a distribuidora deve ~{owed} a você no balanço de 20 anos.",
    frontierVerdictCoveredOffgrid:
      "Aqui o tamanho não é a sua limitação. O menor sistema prático — {pv} kW de painéis e {batt} kWh de bateria, cerca de {cost} — já cobre toda essa carga o ano inteiro. Qualquer coisa maior compra capacidade sobrando, não mais independência.",
    frontierVerdictCoveredGrid:
      "Aqui o tamanho não é a sua limitação. O menor sistema prático — {pv} kW de painéis e {batt} kWh de bateria, cerca de {cost} — já cobre praticamente toda essa carga. Qualquer coisa maior compra capacidade sobrando, não mais economia.",
    pipelineLocation: "Localização",
    pipelineWeather: "Clima",
    pipelineSimulating: "Simulando",
    pipelineRendering: "Renderizando",
    pipelineElapsed: "{s} s decorridos",
    pipelineCached: "em cache",
    pipelineReaching: "contatando o satélite…",
    pipelineChunks: "{done}/{total} blocos de satélite",
    speedNoteRepeat:
      "⚡ Instantâneo — repetição exata desta configuração (calculada há instantes)",
    speedNoteCached: "⚡ Instantâneo — clima de satélite em cache",
    speedNoteCachedWhere:
      "⚡ Instantâneo — clima de satélite em cache para {where}",
    speedNoteOffline: "⚡ Instantâneo — ano típico offline",
    speedNoteOfflineWhere: "⚡ Instantâneo — ano típico offline para {where}",
    fmtAllDay: "o dia todo (24 h)",
    fmtHoursDay: "{h} h/dia",
    fmtMinutesDay: "{m} min/dia",
    apWattsRunning: "~{w} W em funcionamento",
    apWatts: "~{w} W",
    apKwhDay: "{kwh} kWh/dia",
    apAvgW: " (~{w} W méd.)",
    offgridKwhReadout: "~{kwh} kWh/dia",
    quickBillStarts:
      "Começa em ~{bill} (≈{kwh} kWh/dia). Coloque aqui sua conta real, escolha uma localização e clique em Dimensionar meu sistema. O controle de corte aparece com os resultados.",
    quickBillManual:
      "Estimativa rápida: ~{bill} (começa em ~{kwh} kWh/dia) — mude para Manual para alterar sua conta, eletrodomésticos ou tarifa.",
    dailyEnergyNeed: "Necessidade diária de energia (controle kWh/dia)",
    billPerMonth: "/mês",
    simpleHeadline: "Na sua localização, este sistema consegue {goal}:",
    simpleGoalGrid: "cortar cerca de {pct}% da sua conta",
    simpleGoalBattery:
      "deslocar cerca de {pct}% das suas horas de pico para a bateria",
    simpleGoalOffgrid: "cobrir sua casa ao longo do ano",
    sharedLocationLoaded:
      "Resultado compartilhado carregado — dados de sol para esta localização",
    uiInitFailed:
      "Aviso: a interface não pôde carregar — atualize a página (Ctrl+F5).",
    infeasibleAreaTitle:
      "Área de telhado/terreno pequena demais para este objetivo",
    infeasibleAreaBody:
      "O tamanho solar buscado foi limitado pelo campo opcional de área (ver “Configuração de hardware”). Limpe esse campo — ou desenhe uma área maior no mapa — e execute de novo: o local em si pode alcançar este objetivo.",
    infeasibleEnvelopeTitle:
      "Além da faixa de busca desta ferramenta para este objetivo",
    infeasibleEnvelopeBody:
      "Com este consumo, alcançar o objetivo exige um arranjo solar ou banco de baterias maior do que esta calculadora busca (ver Configuração de hardware para os limites). Tente um objetivo de corte menor, ou veja se parte do consumo pode ser reduzida.",
    infeasibleNeedsBatteryTitle: "Só solar não alcança 100% fora da rede",
    infeasibleNeedsBatteryBody:
      "Uma casa fora da rede precisa de armazenamento para as noites e dias nublados. Adicione uma bateria ao seletor de hardware, ou mude o objetivo para 'Cortar minha conta, continuar conectado' (conectado à rede).",
    infeasibleNeedsPanelsTitle: "Só bateria não pode funcionar fora da rede",
    infeasibleNeedsPanelsBody:
      "Nada recarrega o banco neste local. Adicione painéis ao seletor de hardware, ou mude o objetivo para 'Cortar minha conta, continuar conectado' (conectado à rede).",
    infeasibleNeedsSurplusTitle:
      "Um banco só de baterias não pode produzir excedente",
    infeasibleNeedsSurplusBody:
      "Excedente precisa de painéis que gerem mais que seu consumo. Baixe o objetivo abaixo de 100% no controle de corte, ou mude a configuração para 'Solar + Bateria'.",
    infeasibleGenericTitle:
      "Esta combinação de hardware e objetivo não tem solução",
    infeasibleGenericBody: "Mude o objetivo ou o hardware e execute de novo.",

    pathsLabel_turnkey: "Instalador, chave na mão",
    pathsLabel_lease: "Locação ou PPA",
    pathsLabel_selfpurchase: "Você compra as peças",
    pathsLabel_diy: "Você monta, um eletricista conecta",
    pathsTitle: "Quatro formas de pagar este mesmo sistema",
    pathsSub:
      "Um sistema, uma única definição, vinte anos. A diferença entre estes cartões é de preço, não do que cada um inclui.",
    pathsCheapest: "Mais barato",
    pathsSpend20: "Custo em 20 anos",
    pathsRowIncentives: "Incentivos",
    pathsRowBillCut: "Corte na conta",
    pathsRowBreakEven: "Equilíbrio",
    pathsRowNet: "Líquido em 20 anos",
    pathsRowOwnership: "Propriedade",
    pathsRowEndOfTerm: "No final",
    pathsCountsHeading: "O que este preço inclui",
    pathsInstrumentLabel: "Via de terceiros:",
    pathsGradeNote:
      "Todos os números vêm de um único registro regional de preços com fonte declarada e grau de confiança. O hardware é a sua própria estimativa; mão de obra, licenças, incentivos e substituições são dados do registro. Nada aqui é a oferta de um fornecedor.",
    pathsWhy:
      "{cheaper} sai {gap} menos que {dearer} em 20 anos, principalmente por causa de {driver}.",
    pathsWhyCombined: " Nenhum item isolado explica toda a diferença.",
    pathsDriver_year0: "o preço inicial",
    pathsDriver_incentives: "para quem vão os incentivos",
    pathsDriver_om: "a manutenção",
    pathsDriver_replacements: "as substituições de bateria e inversor",
    pathsDriver_leasePayments: "os pagamentos que você faz",
    pathsDriver_none: "nenhum item isolado",
    pathsInstrumentPpa: "PPA (você compra a energia)",
    pathsInstrumentLease: "Locação (você aluga o sistema)",
    pathsEndOfTermBuyout:
      "Ano {years}: você pode quitarlo por {buyoutPct}% do preço instalado, e essa compra já está neste valor.",
    pathsEndOfTermStillLeasing:
      "No ano {years} o contrato ainda está em vigor, então nenhuma compra é incluída. Depois de 20 anos você ainda teria pagamentos a fazer.",
    pathsOwnershipTurnkey: "Você é dono desde o primeiro dia.",
    pathsOwnershipPpa: "O provedor é o dono e faz a manutenção.",
    pathsOwnershipLease:
      "Você aluga até o fim do contrato e então compra ou devolve.",
    pathsOwnershipSelf: "Você é dono assim que está instalado.",
    pathsIncentiveTaxCredit: "Crédito de imposto federal",
    pathsIncentiveRebate: "Desconto da concessionária",
    pathsIncentivesToProvider:
      "Os incentivos vão para o provedor, não para você.",
    pathsIncentivesGoToProvider:
      "O provedor fica com eles — você não é dono de nada.",
    pathsNoIncentive: "Nenhum se aplica a esta via.",
    pathsNoVerifiedIncentive: "Não temos incentivo verificado para sua região.",
    pathsUnknown: "Desconhecido",
    pathsNotWithinHorizon: "Não em 20 anos",
    pathsBreakEvenYear: "Ano {year}",
    pathsUnavailable: "Indisponível",
    pathsNoSystem: "Não há sistema a precificar.",
    pathsNoTariff:
      "Um PPA precisa de uma tarifa para servir de referência, então não aparece aqui.",
    pathsDiyNotPermitted:
      "Não oferecida aqui: na sua região, um instalador licenciado precisa fazer a parte elétrica.",
    pathsDiyRestricted:
      "Não oferecida aqui: a instalação DIY é restrita na sua região.",
    pathsDiyUnknown:
      "Não oferecida aqui: não conseguimos verificar se você pode montar seu próprio painel.",
    pathsNoteTurnkeyAllIn:
      "Um preço único que inclui tudo: o mesmo hardware, mais mão de obra, licenças e a margem do instalador.",
    pathsIncludesInstalledAllIn: "Peças, mão de obra e licenças, já instalados",
    pathsIncludesProviderSwaps:
      "O provedor faz a manutenção e substitui bateria e inversor",
    pathsIncludesIncentivesToProvider:
      "Os incentivos vão para o provedor, não para você",
    pathsIncludesIncentivesIfEligible: "Incentivos, se você se qualificar",
    pathsIncludesNoYear0Hardware: "Sem compra de hardware no início",
    pathsIncludesEndOfTerm: "A escolha no fim do contrato já está no preço",
    pathsIncludesHardwareYouBuy: "O hardware que você compra",
    pathsIncludesElectricianInstalls:
      "Um eletricista licenciado faz a instalação",
    pathsIncludesPermitsAndInterconnection:
      "Licenças, inspeção e conexão à rede",
    pathsIncludesYouDoSwaps:
      "Você providencia e paga as substituições de baterias",
    pathsIncludesYouMountTheArray: "Você monta o painel",
    pathsIncludesElectricianConnects: "Um eletricista faz a conexão",
    pathsIncludesToolsAndSafety: "Ferramentas e equipamento de segurança",
  },
  fr: {
    navSizing: "Dimensionner mon système",
    navSupport: "Assistance",
    cutLabel: "Votre objectif de réduction de facture",
    cutLabelBattery: "Votre objectif de décalage des heures pleines",
    cutValueBattery:
      "Objectif : décaler ~{pct}% de vos heures pleines vers la batterie",
    fxCodeLabel: "Code de devise :",
    firstRunNote:
      "Choisissez votre lieu et votre consommation, puis cliquez sur Dimensionner. Le premier lancement télécharge ~2 Mo de données météo satellite et les met ensuite en cache.",
    navBom: "Référence matériel",
    navBlog: "Blog",
    navLegal: "Conditions et avertissement",
    sourcesCardTitle: "D'où viennent ces chiffres",
    sourcesCardBody:
      "Chaque hypothèse derrière un chiffre indique ici son éditeur, la date de vérification et sa proximité avec la valeur appliquée. Celles que nous ne pouvons pas sourcer le disent.",
    sourcesCardLink: "Voir toutes les sources →",
    heroTag: "Gratuit pour tous, partout · Sans inscription · Rien à vendre",
    heroTitle1: "Réduisez votre facture d'électricité.",
    heroTitle2: "Voyez exactement ce qu'il faudrait.",
    footerAboutPre: "Conçu et offert par",
    heroIntro:
      "Commencez par votre localisation — votre téléphone la connaît — et nous calculons chaque option qui réduit votre facture, de 1 % à l'excédent vendable. La courbe de prix montre ce que chaque budget achète, dans votre devise. Estimations éducatives, rien à vendre. Conçu et offert par",
    footerAboutPost: "Pas une société, pas immatriculée, rien à vendre.",
    ctaStart: "Lancer une estimation gratuite",
    goalLabel: "Que doit faire ce système ?",
    useCaseLabel: "Que voulez-vous faire ?",
    useCaseBillCut: "Réduire votre facture d'électricité",
    useCaseTou: "Économiser avec une batterie en tarification horaire",
    useCaseBackup: "Garder l'essentiel en marche pendant une coupure",
    useCaseReserve: "Garder une réserve d'urgence dans la batterie",
    useCaseOffGrid: "Devenir totalement indépendant du réseau",
    useCasePortable: "Énergie portable (camping-car, bateau, camping)",
    useCaseBillCutBlurb:
      "Solaire raccordé au réseau, avec une batterie seulement si elle le mérite. Mesuré comme la part de votre facture que le système supprime sur 20 ans.",
    useCaseTouBlurb:
      "Une batterie seule : elle charge aux heures creuses et couvre les heures pleines. Aucun panneau.",
    useCaseBackupBlurb:
      "Dimensionné sur les appareils que vous cochez, pas sur toute la maison. Mesuré comme la part des coupures que l'essentiel traverse.",
    useCaseReserveBlurb:
      "Gardez une partie de la batterie en réserve pour les coupures, et voyez exactement ce que cela vous coûte en économies.",
    useCaseOffGridBlurb:
      "Solaire et batterie dimensionnés pour toute la maison. Mesuré comme la part des heures qui fonctionnent sans aucun réseau.",
    useCasePortableBlurb:
      "Une station d'énergie pour un van, un bateau ou un camp-site. Pas de toit, pas de réseau, pas de tarif.",
    metricBillCut: "de votre facture supprimée sur 20 ans",
    metricTouOffset:
      "de votre énergie en heures pleines couverte par la batterie",
    metricOutageCoverage:
      "des coupures que l'essentiel traverse pendant toute la durée visée",
    metricReserveTradeoff: "ce que coûte la réserve, en économies et en heures",
    metricGridIndependence: "de l'année fonctionnant sans aucun réseau",
    metricPortableRuntime:
      "des jours où la station alimente vos appareils toute la journée",
    statusWorks: "Fonctionne",
    statusPartial: "En partie",
    statusNotHere: "Ne fonctionne pas ici",
    useCaseOutcomeTitle: "Votre résultat : {useCase}",
    useCaseVerdictFooter:
      "Mesuré pour {useCase} au regard de {metric}, avec la météo horaire de ce lieu.",
    useCaseNotMeasured:
      "Non mesuré : cette combinaison ne peut pas être dimensionnée, il n'y a donc pas de {metric} à annoncer.",
    metricReserveTradeoffValue: "{lost}% d'économies, {hours} h de couverture",
    reserveOff: "désactivée",
    touPeakLabel: "Votre prix en heures pleines (par kWh)",
    touOffPeakLabel: "Votre prix en heures creuses (par kWh)",
    touDefaultNote:
      "Nous n'avons pas de grille tarifaire horaire publiée pour votre secteur : nous avons prérempli un prix de pointe supérieur de 60 % et un prix creux inférieur de 45 % à votre tarif forfaitaire. Modifiez l'un ou l'autre si votre facture dit le contraire — le verdict ci-dessous utilise ce que vous saisissez.",
    essentialLabel:
      "Qu'est-ce qui doit continuer à fonctionner ? (cochez ce que vous voulez)",
    outageLabel: "Combien de temps doit tenir ?",
    backupRechargeLabel: "Laissez les panneaux la recharger pendant la coupure",
    reserveLabel: "Réserve d'urgence conservée dans la batterie",
    portableDeviceLabel: "Qu'alimentez-vous ? (cochez ce que vous voulez)",
    portableBankLabel: "Capacité utile de la station (kWh)",
    portableShoreLabel:
      "Je peux recharger sur le secteur ou depuis le véhicule",
    generatorLabel:
      "Un groupe électrogène est disponible pour les pires semaines",
    verdictBillCut:
      "{status} : ce système supprime {pct}% de votre facture sur 20 ans.",
    verdictTou:
      "{status} : la batterie couvre {pct}% de votre énergie en heures pleines, soit environ {saving} sur 20 ans face à une batterie de {cost}. L'écart entre pointe et creux ici est de {spread} par kWh.",
    verdictBackup:
      "{status} : l'essentiel tient les {targetHours} heures complètes dans {pct}% des coupures que nous avons simulées (nuit typique : {hours} heures).",
    verdictReserve:
      "{status} : garder cette réserve coûte {pct}% de vos économies et achète {coverHours} heures de couverture.",
    verdictReserveNoBattery:
      "Il n'y a rien où garder une réserve : le système le moins cher pour cet objectif ne comporte aucune batterie.",
    verdictOffGrid:
      "{status} : {pct}% de l'année fonctionne sans réseau — {unmetHours} heures manquantes la pire année, {autonomy} jours d'autonomie.",
    verdictPortable:
      "{status} : votre station alimente vos appareils toute la journée sur {days} jours sur {trips} ici, et une charge dure {runtime} heures.",
    cityLabel: "Où sera installé le système ?",
    loadLabel: "Quelle est votre consommation ?",
    loadAppliances: "Je choisis mes appareils",
    loadBill: "Je connais ma facture mensuelle",
    loadKwh: "Je connais mes kWh/jour (avancé)",
    langLabel: "Langue",
    readoutAppliancesEmpty:
      "Cochez les appareils que vous voulez alimenter et votre énergie quotidienne apparaîtra ici.",
    readoutAppliancesSummary:
      "Utilisation estimée : environ {kwh} kWh/jour · tout en même temps ≈ {peakW} W (votre onduleur devrait être plus gros)",
    readoutBill:
      "Cela équivaut à environ {kwhDay} kWh/jour d'utilisation moyenne.",
    readoutBillIncomplete:
      "Entrez votre facture mensuelle pour voir l'estimation quotidienne.",
    readoutKwhEmpty:
      "Entrez votre consommation quotidienne en kWh pour voir l'estimation.",
    readoutKwhReady: "Utilisation de {kwh} kWh/jour directement.",
    runBtn: "Dimensionner (simulation sur 5 ans)",
    locBtn: "Utiliser ma position actuelle",
    chemLabel: "Chimie de la batterie :",
    tariffNote:
      "Prix estimé pour {label} — changez-le ci-dessus si vous connaissez votre tarif.",
    pickCity:
      "Choisissez une ville (ou utilisez 📍 Ma position) pour connaître votre ensoleillement.",
    shareLoaded:
      "Configuration partagée chargée. Vérifiez les entrées, puis cliquez sur Dimensionner pour calculer.",
    invalidShare: "Lien invalide.",
    customCoordsLocation:
      "Coordonnées personnalisées utilisées ({lat}, {lon}).",
    resolvingCity:
      "Recherche de votre ville : choisissez une suggestion ou attendez le résultat.",
    chooseCityMatch:
      "Choisissez une suggestion ou attendez la fin de la recherche.",
    resolvingCoords: "Vérification de ces coordonnées…",
    invalidCoordinates:
      "La latitude doit être comprise entre −90 et 90 et la longitude entre −180 et 180.",
    invalidDailyKwh:
      "La consommation quotidienne doit être comprise entre 0,5 et 500 kWh par jour.",
    inputsChanged:
      "Les entrées ont changé — cliquez sur Dimensionner pour actualiser l’estimation.",
    errorTimeout:
      "Le moteur de dimensionnement n'a pas répondu à temps — vérifiez votre connexion et réessayez.",
    tellPowerUse:
      "Indiquez votre consommation d'énergie : cochez quelques appareils, ou entrez une facture ou une valeur en kWh.",
    statusGridtie:
      "⏳ Récupération de cinq ans de météo satellitaire et recherche de tailles de système pour réduire la facture…",
    statusOffgrid:
      "⏳ Récupération de 5 ans de météo horaire par satellite et recherche de tailles de système…",
    runningBtn: "⏳ Simulation de 5 ans...",
    runBtnReady: "☀️ Dimensionner (simulation 5 ans)",
    errorSim:
      "⚠️ Le moteur de dimensionnement n'a pas pu se charger. Actualisez la page (Ctrl+F5) et réessayez.",
    statusSuccess:
      "✅ {years} ans de données horaires ({dataYears}) · {yield} kWh/an par kW de panneau.{offline}",
    offlineNote: " · 🌐 mode hors ligne typique",
    tariffSpendLine:
      "À {tariff}/kWh, votre électricité coûte environ {annual} par an aujourd'hui. Chaque option ci-dessous montre la facture après le solaire et combien de temps elle se rembourse grâce aux économies.",
    tariffSpendBattery:
      "À {tariff}/kWh, votre électricité coûte environ {annual} par an aujourd'hui. Une batterie sans panneaux décale le moment où vous consommez ; elle ne réduit pas ce que vous payez.",
    tariffSpendOffgrid:
      "À {tariff}/kWh, cet usage coûte environ {annual} par an en électricité du réseau. Les délais de retour ci-dessous comparent le coût du système à cette dépense.",
    tariffSpendFixed:
      " Dont {fixed}/mois de charges fixes que le solaire ne réduit pas.",
    lvlBest: "Meilleur choix",
    lvlCompare: "Comparer les batteries",
    lvlMatrix: "Toutes les options",
    bomPanelTitle: "Votre liste de matériel — de quoi ce système est composé",
    genSummary:
      "J'utilise un générateur — combien coûte vraiment son électricité ?",
    genApply: "Utiliser ceci comme mon prix de l'électricité",

    // -- Plausibility frontier (spend -> coverage curve) --
    socChartTitle:
      "Niveaux de charge de la batterie et fiabilité annuelle (5 ans de météo réelle)",
    frontierTitle: "Jusqu'où va votre argent ?",
    frontierIntro:
      "Tous les systèmes possibles chez vous, du moins cher au plus cher. La courbe montre le meilleur résultat que chaque budget peut acheter — pour voir d'un coup d'œil si votre objectif est ici facile, coûteux ou hors d'atteinte.",
    frontierX: "Coût initial du système",
    frontierYGrid: "Part de votre facture supprimée",
    frontierYGridBattery: "Part de vos heures pleines décalées",
    frontierYOffgrid: "Part de votre énergie couverte, sans groupe électrogène",
    frontierSelTag: "{pv} kW + {batt} kWh · {pct}% · {cost}",
    frontierSelNoBatt: "{pv} kW, sans batterie · {pct}% · {cost}",
    frontierLegendSel:
      "Option sélectionnée — cliquez sur un point pour choisir",
    frontierNoSystem:
      "Aucun système, dans les tailles que cet outil explore, ne peut atteindre cet objectif à cet endroit. La courbe ci-dessous montre jusqu'où ce site peut réellement aller — visez plus bas, ou prévoyez un générateur ou une connexion au réseau pour couvrir ce que le solaire ne peut pas.",
    simpleInfeasible:
      "À cet endroit, aucun système constructible n'atteint cet objectif. Essayez un objectif d'économie plus bas, ou consultez les détails complets pour voir jusqu'où le solaire peut réellement aller.",
    simpleWhatItMeans:
      "Les panneaux produisent quand le soleil brille ; la batterie porte cette énergie jusqu'au soir et aux jours gris. Le système est dimensionné à partir de cinq ans de données météo horaires par satellite à votre position exacte.",
    simpleWhatItMeansBattery:
      "Une batterie ne produit rien par elle-même : elle se charge aux heures creuses et garde cette énergie pour les heures chères. Le système est dimensionné à partir de cinq ans de données météo horaires par satellite à votre position exacte.",
    simpleCaveat:
      "C'est une estimation, pas une promesse — tous les chiffres détaillés sont à un clic.",
    simpleSeeDetails: "Voir tous les détails",
    simpleDownloadBom: "Télécharger la liste des pièces (CSV)",
    simpleAskAdvisor: "Demandez au conseiller IA (en mots simples)",
    sanityOk: "Vérifié de façon indépendante ✓ — physiquement plausible",
    sanityFlag:
      "⚠ Une vérification IA indépendante signale ce résultat comme physiquement implausible —",
    sanityAskAdvisor: "demandez au conseiller pourquoi",
    sanityUncertain:
      "Vérification non concluante — le contrôle indépendant par IA n'a pas atteint de verdict fiable sur ces entrées",
    sanityTooltip:
      "Un classificateur IA indépendant (Jev) n'a examiné que les chiffres du dimensionnement — aucun lieu, texte ou donnée personnelle ne quitte votre navigateur en dehors de ces chiffres. Il ne modifie jamais le résultat calculé.",
    simpleAdvisorStyle:
      "[INSTRUCTION AU CONSEILLER : le visiteur est en mode Simple. Répondez comme un expert parlant à un enfant de 12 ans intelligent : mots simples du quotidien, pas de jargon (expliquez tout terme technique entre parenthèses), 4 phrases courtes maximum, et terminez par LE chiffre qui compte le plus.]",
    advisorTitle: "Conseiller énergie IA gratuit",
    advisorSubtitle:
      "Vous parlez à une IA (moteur Groq) — estimations éducatives uniquement, pas un conseil d'ingénierie",
    advisorIntro:
      "J'explique les résultats du calculateur : chimie des batteries, câblage et protection, ou questions à poser à un électricien local. Lancez d'abord le dimensionnement, puis posez votre question sur ce résultat, ou demandez-moi quoi que ce soit.",
    advisorBotNote:
      "Estimation générée par IA — elle peut être inexacte, y compris les prix et les spécifications. Ce n'est pas un conseil d'ingénierie. Faites vérifier par un électricien ou ingénieur agréé avant d'acheter ou de construire.",
    advisorThinking: "⏳ Réflexion...",
    advisorLabel: "Posez une question au conseiller IA sur votre système",
    advisorPlaceholder:
      "Questions sur les cellules, sodium-ion vs LFP, fret...",
    advisorSend: "Envoyer",
    advisorClose: "Fermer le conseiller IA",
    advisorBusyRetry:
      " Le moteur IA gratuit est occupé — nouvelle tentative dans {secs}s…",
    advisorNoReply: " Aucune réponse reçue. Veuillez réessayer.",
    advisorBusy:
      " Le moteur IA gratuit est saturé (HTTP {status} — quota partagé).\n\nAttendez environ une minute, puis renvoyez votre question.",
    // ── Degraded advisor reply (B2 / R-CF-10) ──────────────────────────
    advisorDegradedLabel: "Hors ligne · pas l’IA en direct",
    advisorDegradedLine: "Je ne peux pas répondre — {why}.",
    advisorDegradedWhyUnavailable: "le service qui répond n’a pas répondu",
    advisorDegradedWhyNoKey:
      "aucune clé modèle : le conseiller est hors ligne par conception",
    advisorDegradedReassure:
      "Rien de ce qui précède n’est faux, et votre dimensionnement n’est pas affecté.",
    advisorDegradedSystem:
      "Portez ces chiffres à un électricien agréé avant de construire.",
    advisorIsAi:
      "Le conseiller est un modèle de langage. Il écrit un texte plausible et peut donner de faux chiffres avec assurance. Vérifiez chaque chiffre : ne le prenez jamais pour un fait.",
    advisorDegradedGeneral:
      "Pour dimensionner, utilisez le calculateur ci-dessus ; sans compte.",
    advisorDegradedRetry:
      "Réessayez dans une minute ; le quota gratuit est partagé.",
    advisorUnreachable:
      " Le conseiller IA est momentanément inaccessible{status}.\n\nVérifiez votre connexion et réessayez dans un instant.",
    frontierCeilingTag: "Maximum dans les tailles explorées : {pct}%",
    frontierSvgTitle: "Jusqu'où va votre argent",
    frontierSvgDesc:
      "Une courbe de {n} systèmes, de {lowCost} couvrant {lowPct}% à {highCost} couvrant {highPct}%. Les chiffres complets sont dans le tableau sous le graphique.",
    frontierPointTip:
      "{cost} : {pct}% — {pv} kW de panneaux + {batt} kWh de batterie",
    budgetLabel: "Votre budget (initial)",
    frontierTableCaption:
      "Chaque point de la courbe. Le coût typique est le milieu DIY rendu droits acquittés ; la fourchette va des cellules nues au détail livré.",
    frontierColCost: "Coût typique",
    frontierColRange: "DIY à détail",
    frontierColCut: "Facture réduite",
    frontierColCutBattery: "Heures pleines décalées",
    frontierColCover: "Couvert",
    frontierColPv: "Panneaux",
    frontierColBatt: "Batterie",
    frontierNoBattery: "aucune",
    frontierTableToggle: "Voir tous les points en tableau",
    frontierLegendCurve: "Le système le moins cher atteignant chaque niveau",
    frontierLegendBand: "Les mêmes systèmes, de l'achat DIY au détail livré",
    frontierLegendRange:
      "Plage optimale — chaque point en plus reste bon marché",
    frontierBestValueRange: "Plage optimale : ~{lo}–{hi} ({loPct}–{hiPct}%).",
    frontierRangeTag: "meilleur rapport",
    frontierTagSel: "sélectionné",
    fuelLitLabel: "Prix au litre",
    fuelGalLabel: "Prix au gallon",
    fuelReadoutRate: "{type} à ce prix revient à environ {rate} par kWh",
    fuelReadoutBurn:
      "({entry} ÷ {burn} {unit}/kWh — carburant seul ; huile, filtres et usure du moteur font monter le coût réel)",
    fuelReadoutGrid:
      "L'électricité du réseau coûte en général entre {lo} et {hi} par kWh.",
    fuelApplyOk:
      "Votre carburant de groupe électrogène revient à environ {rate}/kWh — saisi comme prix de l'électricité, de sorte que chaque calcul de rentabilité ci-dessous compare avec ce que vous brûlez aujourd'hui.",
    frontierLegendCeiling:
      "Le maximum atteint par les tailles explorées, pas une limite physique",
    frontierMarkerOffCurve:
      "Votre option se situe à droite de la courbe car la recommandation est choisie sur le coût réel à 20 ans, pas sur le prix d'aujourd'hui : un parc moins cher à remplacer coûte moins maintenant et plus ensuite.",
    frontierVerdictSteepGrid:
      "Supprimer environ {kneePct}% de votre facture coûte autour de {kneeCost}. Ensuite ça grimpe vite : environ {tailCost} par point supplémentaire, contre {headCost} avant.",
    frontierVerdictTaperingGrid:
      "Supprimer environ {kneePct}% de votre facture coûte autour de {kneeCost}. Ensuite, chaque point supplémentaire coûte environ {tailCost}, soit {ratio} fois le rythme précédent.",
    frontierVerdictCoveredBattery:
      "La taille n'est pas votre contrainte ici. La plus petite batterie réaliste — {batt} kWh, environ {cost} — décale déjà la quasi-totalité des heures de pointe de cette consommation. Plus gros achète de la capacité de réserve, pas plus de décalage.",
    frontierVerdictBeyondSweepBattery:
      "Dans les tailles de batterie que cet outil explore — jusqu'à {battMax} kWh — le maximum que vous pouvez décaler ici est d'environ {ceilingPct}%, pour environ {ceilingCost}. Le bon rapport s'arrête bien avant, à {kneePct}% pour environ {kneeCost} ; décaler davantage exige un parc plus grand que tout ce qui est dimensionné ici.",
    frontierVerdictSteepBattery:
      "Décaler environ {kneePct}% de vos heures de pointe vers la batterie coûte environ {kneeCost}. Ensuite cela devient vite cher : environ {tailCost} par point supplémentaire, contre {headCost} avant.",
    frontierVerdictTaperingBattery:
      "Décaler environ {kneePct}% de vos heures de pointe vers la batterie coûte environ {kneeCost}. Au-delà, chaque point supplémentaire coûte environ {tailCost} — environ {ratio} fois le rythme précédent.",
    frontierVerdictLinearBattery:
      "Le décalage suit la dépense de façon assez régulière ici — environ {headCost} par point d'heures de pointe, jusqu'à {ceilingPct}%.",
    frontierVerdictLinearGrid:
      "Ici les économies suivent la dépense assez régulièrement : environ {headCost} par point de facture, jusqu'à {ceilingPct}%.",
    frontierVerdictBeyondSweepGrid:
      "Dans les tailles explorées par cet outil — jusqu'à {pvMax} kW de panneaux et {battMax} kWh de batterie — le maximum que vous pouvez supprimer ici est d'environ {ceilingPct}%, pour environ {ceilingCost}. Le bon rapport s'arrête bien avant, à {kneePct}% pour environ {kneeCost}. Aller plus loin n'est pas impossible : cela demande simplement un système plus grand que tous ceux dimensionnés ici.",
    frontierVerdictSteepOffgrid:
      "Couvrir environ {kneePct}% de votre énergie coûte autour de {kneeCost}. Le dernier tronçon vers l'indépendance totale est là où part l'argent : environ {tailCost} par point supplémentaire, contre {headCost} avant.",
    frontierVerdictTaperingOffgrid:
      "Couvrir environ {kneePct}% de votre énergie coûte autour de {kneeCost}. Ensuite, chaque point supplémentaire coûte environ {tailCost}, soit {ratio} fois le rythme précédent.",
    frontierVerdictLinearOffgrid:
      "Ici la couverture suit la dépense assez régulièrement : environ {headCost} par point, jusqu'à {ceilingPct}%.",
    frontierVerdictBeyondSweepOffgrid:
      "Dans les tailles explorées par cet outil — jusqu'à {pvMax} kW de panneaux et {battMax} kWh de batterie — le maximum que vous pouvez couvrir ici est d'environ {ceilingPct}%, pour environ {ceilingCost}. Le bon rapport s'arrête à {kneePct}% pour environ {kneeCost}. L'indépendance totale n'est pas impossible ici, mais elle demande un système bien plus grand ; un groupe électrogène ou le réseau est presque certainement le moyen le moins cher de couvrir le reste.",
    frontierMethod:
      "La courbe vient de la simulation de chaque combinaison panneaux-batterie sur une grille grossière avec la même météo horaire que les cartes ci-dessus, en ne gardant que les systèmes qu'aucun moins cher ne bat. Les prix utilisent le même milieu DIY rendu que tous les autres chiffres de la page.",
    frontierMethodBattery:
      "La courbe vient de la simulation de chaque taille de batterie sur une grille grossière avec la même météo horaire et les mêmes plages tarifaires que les cartes ci-dessus, en ne gardant que les systèmes qu'aucun moins cher ne bat. Aucun panneau n'entre dans ce calcul : la courbe ne fait varier que le parc de batteries. Les prix utilisent le même milieu DIY rendu que tous les autres chiffres de la page.",
    // -- Cumulative 20-year cost caption (under the chart canvas) --
    cumCostRecommended: "recommandé",
    cumCostSelected: "sélectionné",
    cumCostCaptionHead:
      "Coût cumulé sur 20 ans du système {which} ({label}) : la ligne ambre est ce que vous payez au réseau si vous restez raccordé ({gridTotal}).",
    cumCostCaptionOwnCost:
      "La ligne émeraude est le coût propre du système solaire (~{systemTotal}), identique à la ligne « Coût total sur 20 ans » de ce système.",
    cumCostCaptionOwnCostNoPanels:
      "La ligne émeraude est le coût propre du système (~{systemTotal}), identique à la ligne « Coût total sur 20 ans » de ce système.",
    cumCostCaptionStack:
      "Le chiffre ambre est un empilement — le système, puis les factures plus petites qui restent après le solaire (~{residualBills}), puis votre économie — ce système vous rend donc {saved} sur les 20 ans.",
    cumCostCaptionStackNoPanels:
      "Le chiffre ambre est un empilement — le système, puis les factures plus petites qui restent (~{residualBills}), puis votre économie — ce système vous rend donc {saved} sur les 20 ans.",
    cumCostCaptionNetNegative:
      "Ici l'empilement s'inverse : ces factures restantes (~{residualBills}) ne baissent jamais assez, donc sur 20 ans ce système coûte environ {loss} DE PLUS que rester raccordé — de l'argent dépensé, pas économisé.",
    cumCostCaptionRepaid:
      "Le système a remboursé son coût dès l'année {year} — chaque année suivante remet ~{perYear} dans votre poche. Économie totale sur 20 ans : ~{saved}. Les barres du bas sont votre position nette : rouges jusqu'au seuil de rentabilité, puis en hausse.",
    cumCostCaptionNeverRepays:
      "En 20 ans, le système ne rembourse jamais son coût — les remplacements de batterie dépassent les économies de facture ; la réponse honnête est donc : ici, il ne s'amortit pas.",
    cumCostCaptionResidual:
      "La ligne gris ardoise est le coût résiduel du réseau — environ {annual}/an pour les {kwh} kWh/an encore tirés du réseau (net de votre crédit d'injection), {end} sur les 20 ans.",
    cumCostCaptionResidualCreditDraw:
      "La ligne gris ardoise passe sous 0 $ — comptage net : la valeur d'injection de votre surplus dépasse même les petits {kwh} kWh/an que vous consommez encore, vous gagnez donc ~{earned} sur les 20 ans.",
    cumCostCaptionResidualCreditBill:
      "La ligne gris ardoise passe sous 0 $ — comptage net : la valeur d'injection de votre surplus dépasse la petite facture que vous payez encore, vous gagnez donc ~{earned} sur les 20 ans.",
    cumCostCaptionSurplusCredit:
      "Le total avec solaire (~{withSolar}) est INFÉRIEUR au coût propre du système : votre crédit d'injection sur le surplus dépasse la petite facture restante, l'empilement devient donc négatif et le réseau vous doit ~{owed} sur le bilan à 20 ans.",
    frontierVerdictCoveredOffgrid:
      "Ici, la taille n'est pas votre contrainte. Le plus petit système réaliste — {pv} kW de panneaux et {batt} kWh de batterie, environ {cost} — couvre déjà toute cette consommation, toute l'année. Plus grand n'achète que de la réserve, pas plus d'indépendance.",
    frontierVerdictCoveredGrid:
      "Ici, la taille n'est pas votre contrainte. Le plus petit système réaliste — {pv} kW de panneaux et {batt} kWh de batterie, environ {cost} — couvre déjà l'essentiel de cette consommation. Plus grand n'achète que de la réserve, pas plus d'économies.",
    pipelineLocation: "Lieu",
    pipelineWeather: "Météo",
    pipelineSimulating: "Simulation",
    pipelineRendering: "Rendu",
    pipelineElapsed: "{s} s écoulées",
    pipelineCached: "en cache",
    pipelineReaching: "contact du satellite…",
    pipelineChunks: "{done}/{total} tranches satellite",
    speedNoteRepeat:
      "⚡ Instantané — répétition exacte de cette configuration (calculée à l'instant)",
    speedNoteCached: "⚡ Instantané — météo satellite en cache",
    speedNoteCachedWhere:
      "⚡ Instantané — météo satellite en cache pour {where}",
    speedNoteOffline: "⚡ Instantané — année type hors ligne",
    speedNoteOfflineWhere: "⚡ Instantané — année type hors ligne pour {where}",
    fmtAllDay: "journée entière (24 h)",
    fmtHoursDay: "{h} h/jour",
    fmtMinutesDay: "{m} min/jour",
    apWattsRunning: "~{w} W en fonctionnement",
    apWatts: "~{w} W",
    apKwhDay: "{kwh} kWh/jour",
    apAvgW: " (~{w} W moy.)",
    offgridKwhReadout: "~{kwh} kWh/jour",
    quickBillStarts:
      "Démarre à ~{bill} (≈{kwh} kWh/jour). Indiquez ici votre vraie facture, choisissez un lieu, puis cliquez sur Dimensionner mon système. Le curseur de réduction apparaît avec les résultats.",
    quickBillManual:
      "Estimation rapide : ~{bill} (démarre à ~{kwh} kWh/jour) — passez en Manuel pour changer votre facture, vos appareils ou votre tarif.",
    dailyEnergyNeed: "Besoin énergétique quotidien (curseur kWh/jour)",
    billPerMonth: "/mois",
    simpleHeadline: "À votre lieu, ce système vous permet de {goal} :",
    simpleGoalGrid: "réduire d'environ {pct}% votre facture",
    simpleGoalBattery:
      "décaler environ {pct}% de vos heures de pointe vers la batterie",
    simpleGoalOffgrid: "couvrir votre maison toute l'année",
    sharedLocationLoaded:
      "Résultat partagé chargé — données d'ensoleillement pour ce lieu",
    uiInitFailed:
      "Avertissement : l'interface n'a pas pu se charger — actualisez la page (Ctrl+F5).",
    infeasibleAreaTitle:
      "Surface de toit/terrain trop petite pour cet objectif",
    infeasibleAreaBody:
      "La taille solaire explorée a été limitée par le champ de surface optionnel (voir « Configuration matériel »). Effacez ce champ — ou dessinez une zone plus grande sur la carte — et relancez : le site lui-même peut atteindre cet objectif.",
    infeasibleEnvelopeTitle:
      "Au-delà de la plage de recherche de cet outil pour cet objectif",
    infeasibleEnvelopeBody:
      "À cette consommation, atteindre l'objectif exige une installation solaire ou une batterie plus grande que ce que cette calculette explore (voir Configuration matériel pour les limites). Essayez un objectif de réduction plus bas, ou voyez si une partie de la consommation peut être réduite.",
    infeasibleNeedsBatteryTitle:
      "Le solaire seul ne peut pas atteindre 100% hors réseau",
    infeasibleNeedsBatteryBody:
      "Une maison hors réseau a besoin de stockage pour la nuit et les jours nuageux. Ajoutez une batterie au sélecteur matériel, ou changez l'objectif en 'Réduire ma facture, rester connecté' (au réseau).",
    infeasibleNeedsPanelsTitle:
      "La batterie seule ne peut pas fonctionner hors réseau",
    infeasibleNeedsPanelsBody:
      "Rien ne recharge la batterie sur ce site. Ajoutez des panneaux au sélecteur matériel, ou changez l'objectif en 'Réduire ma facture, rester connecté' (au réseau).",
    infeasibleNeedsSurplusTitle:
      "Une batterie seule ne peut pas produire de surplus",
    infeasibleNeedsSurplusBody:
      "Le surplus exige des panneaux produisant plus que votre consommation. Baissez l'objectif sous 100% sur le curseur de réduction, ou passez la configuration en 'Solaire + Batterie'.",
    infeasibleGenericTitle:
      "Cette combinaison matériel/objectif n'a pas de solution",
    infeasibleGenericBody: "Changez l'objectif ou le matériel, puis relancez.",

    pathsLabel_turnkey: "Installateur, clé en main",
    pathsLabel_lease: "Location ou PPA",
    pathsLabel_selfpurchase: "Vous achetez les pièces",
    pathsLabel_diy: "Vous montez, un électricien raccorde",
    pathsTitle: "Quatre façons de payer ce même système",
    pathsSub:
      "Un système, une seule définition, vingt ans. L'écart entre ces cartes est un écart de prix, pas une différence de ce que chacune compte.",
    pathsCheapest: "Le moins cher",
    pathsSpend20: "Coût sur 20 ans",
    pathsRowIncentives: "Subventions",
    pathsRowBillCut: "Réduction de facture",
    pathsRowBreakEven: "Rentabilité",
    pathsRowNet: "Net sur 20 ans",
    pathsRowOwnership: "Propriété",
    pathsRowEndOfTerm: "Au terme",
    pathsCountsHeading: "Ce que ce prix inclut",
    pathsInstrumentLabel: "Voie tierce :",
    pathsGradeNote:
      "Tous les chiffres proviennent d'un même registre régional de prix avec source nommée et niveau de confiance. Le matériel est votre propre estimation ; la main-d'œuvre, les permis, les subventions et les remplacements viennent du registre. Rien ici n'est un devis de fournisseur.",
    pathsWhy:
      "{cheaper} coûte {gap} de moins que {dearer} sur 20 ans, surtout à cause de {driver}.",
    pathsWhyCombined: " Aucun poste n'explique à lui seul tout l'écart.",
    pathsDriver_year0: "le coût initial",
    pathsDriver_incentives: "à qui vont les subventions",
    pathsDriver_om: "la maintenance",
    pathsDriver_replacements: "les remplacements de batterie et d'onduleur",
    pathsDriver_leasePayments: "les versements que vous effectuez",
    pathsDriver_none: "aucun poste précis",
    pathsInstrumentPpa: "PPA (vous achetez l'énergie)",
    pathsInstrumentLease: "Location (vous louez le système)",
    pathsEndOfTermBuyout:
      "Année {years} : vous pouvez le racheter à {buyoutPct}% du prix installé, et ce rachat est inclus dans ce montant.",
    pathsEndOfTermStillLeasing:
      "En année {years} le contrat court encore : aucun rachat n'est inclus. Au-delà de 20 ans, vous resteriez redevable.",
    pathsOwnershipTurnkey: "Il est à vous dès le premier jour.",
    pathsOwnershipPpa: "Le fournisseur en reste propriétaire et l'entretient.",
    pathsOwnershipLease:
      "Vous le louez jusqu'au terme, puis vous le rachetez ou le rendez.",
    pathsOwnershipSelf: "Il est à vous une fois installé.",
    pathsIncentiveTaxCredit: "Crédit d'impôt fédéral",
    pathsIncentiveRebate: "Subvention du distributeur",
    pathsIncentivesToProvider:
      "Les subventions vont au fournisseur, pas à vous.",
    pathsIncentivesGoToProvider:
      "Le fournisseur les conserve — vous ne possédez rien.",
    pathsNoIncentive: "Aucune ne s'applique à cette voie.",
    pathsNoVerifiedIncentive:
      "Nous n'avons pas de subvention vérifiée pour votre région.",
    pathsUnknown: "Inconnu",
    pathsNotWithinHorizon: "Pas sous 20 ans",
    pathsBreakEvenYear: "Année {year}",
    pathsUnavailable: "Non disponible",
    pathsNoSystem: "Aucun système à chiffrer.",
    pathsNoTariff:
      "Un PPA a besoin d'un tarif de référence ; il n'est donc pas affiché ici.",
    pathsDiyNotPermitted:
      "Non proposée ici : dans votre région, l'installation électrique exige un installateur agréé.",
    pathsDiyRestricted:
      "Non proposée ici : l'autoconsommation DIY est restreinte dans votre région.",
    pathsDiyUnknown:
      "Non proposée ici : nous n'avons pas pu vérifier si vous pouvez monter votre propre centrale.",
    pathsNoteTurnkeyAllIn:
      "Un prix tout compris : le même matériel, plus la main-d'œuvre, les permis et la marge de l'installateur.",
    pathsIncludesInstalledAllIn:
      "Pièces, main-d'œuvre et permis, déjà installés",
    pathsIncludesProviderSwaps:
      "Le fournisseur entretient et remplace batterie et onduleur",
    pathsIncludesIncentivesToProvider:
      "Les subventions vont au fournisseur, pas à vous",
    pathsIncludesIncentivesIfEligible: "Subventions, si vous y avez droit",
    pathsIncludesNoYear0Hardware: "Aucun achat de matériel au départ",
    pathsIncludesEndOfTerm: "L'option de fin de contrat est intégrée au prix",
    pathsIncludesHardwareYouBuy: "Le matériel que vous achetez",
    pathsIncludesElectricianInstalls:
      "Un électricien agréé réalise l'installation",
    pathsIncludesPermitsAndInterconnection:
      "Permis, inspection et raccordement au réseau",
    pathsIncludesYouDoSwaps:
      "C'est vous qui organisez et payez les remplacements",
    pathsIncludesYouMountTheArray: "Vous montez la centrale",
    pathsIncludesElectricianConnects: "Un électricien fait le raccordement",
    pathsIncludesToolsAndSafety: "Outillage et équipement de sécurité",
  },
  de: {
    navSizing: "System dimensionieren",
    navSupport: "Hilfe",
    cutLabel: "Ziel für die Rechnungssenkung",
    cutLabelBattery: "Ziel für die Verschiebung der Spitzenlaststunden",
    cutValueBattery:
      "Ziel: ~{pct}% Ihrer Spitzenlaststunden auf den Akku verschieben",
    fxCodeLabel: "Währungscode:",
    firstRunNote:
      "Wählen Sie Standort und Verbrauch und klicken Sie auf System dimensionieren. Beim ersten Start werden Satelliten-Wetterdaten geladen und im Browser gespeichert.",
    navBom: "Hardware-Referenz",
    navBlog: "Blog",
    navLegal: "Bedingungen & Haftungsausschluss",
    sourcesCardTitle: "Woher diese Zahlen kommen",
    sourcesCardBody:
      "Jede Annahme hinter einer Zahl nennt hier Herausgeber, Prüfdatum und die Übereinstimmung mit dem Angewendeten. Was wir nicht belegen können, sagt das.",
    sourcesCardLink: "Alle Quellen ansehen →",
    heroTag:
      "🌍 Kostenlos für alle, überall · Keine Anmeldung · Nichts zu verkaufen",
    heroTitle1: "Senken Sie Ihre Stromrechnung.",
    heroTitle2: "Sehen Sie genau, was dafür nötig wäre.",
    footerAboutPre: "Erstellt und bereitgestellt von",
    heroIntro:
      "Beginnen Sie mit Ihrem Standort — Ihr Telefon kennt ihn — und wir rechnen jede Option durch, die Ihre Rechnung senkt, von 1 % bis zum verkaufbaren Überschuss. Die Preiskurve zeigt, was jedes Budget kauft, in Ihrer Währung. Nur Schätzungen, nichts zu verkaufen. Erstellt und bereitgestellt von",
    footerAboutPost:
      "Kein Unternehmen, nicht eingetragen, nichts zu verkaufen.",
    ctaStart: "Kostenlose Schätzung starten",
    pickCity:
      "Wähle eine Stadt oder nutze 📍 deinen Standort für die Sonnendaten.",
    shareLoaded:
      "Geteilte Einstellungen geladen. Prüfe die Eingaben und klicke dann auf System dimensionieren.",
    invalidShare: "Link ungültig.",
    customCoordsLocation: "Eigene Koordinaten verwendet ({lat}, {lon}).",
    resolvingCity:
      "Ort wird gesucht — wählen Sie einen Treffer oder warten Sie kurz.",
    chooseCityMatch:
      "Wählen Sie einen Stadtvorschlag oder warten Sie das Suchergebnis ab.",
    resolvingCoords: "Koordinaten werden geprüft…",
    invalidCoordinates:
      "Der Breitengrad muss zwischen −90 und 90 und der Längengrad zwischen −180 und 180 liegen.",
    invalidDailyKwh:
      "Der tägliche Energieverbrauch muss zwischen 0,5 und 500 kWh liegen.",
    inputsChanged:
      "Eingaben geändert — klicken Sie auf System dimensionieren, um die Schätzung zu aktualisieren.",
    errorTimeout:
      "Die Auslegungssoftware hat nicht rechtzeitig geantwortet — prüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
    tellPowerUse: "Gib deinen Verbrauch an — Geräte, Rechnung oder kWh.",
    statusGridtie:
      "⏳ Fünf Jahre Satellitenwetter werden geladen, Systeme zur Rechnungssenkung gesucht…",
    statusOffgrid:
      "⏳ 5 Jahre stündliches Satellitenwetter werden geladen, Systemgrößen gesucht…",
    runningBtn: "⏳ 5-Jahres-Simulation läuft…",
    runBtnReady: "☀️ System dimensionieren (5-Jahres-Simulation)",
    errorSim:
      "⚠️ Die Dimensionierungs-Engine konnte nicht geladen werden. Aktualisieren Sie die Seite (Ctrl+F5) und versuchen Sie es erneut.",
    tariffSpendLine:
      "Bei {tariff}/kWh kostet dein Strom heute etwa {annual} pro Jahr. Jede Option unten zeigt die Rechnung nach Solar und wie schnell sie sich aus den Ersparnissen bezahlt.",
    tariffSpendBattery:
      "Bei {tariff}/kWh kostet dein Strom heute etwa {annual} pro Jahr. Eine Batterie ohne Module verschiebt, wann du Strom ziehst; sie senkt nicht, was du zahlst.",
    tariffSpendOffgrid:
      "Bei {tariff}/kWh kostet dieser Verbrauch etwa {annual} pro Jahr an Netzstrom. Die Amortisationswerte unten vergleichen die Systemkosten mit diesen Ausgaben.",
    tariffSpendFixed:
      " Darin sind {fixed}/Monat an Fixkosten enthalten, die Solar nicht senken kann.",
    readoutAppliancesEmpty:
      "Wähle die Geräte, die du versorgen willst — dein Tagesverbrauch erscheint hier.",
    readoutAppliancesSummary:
      "Geschätzter Verbrauch: etwa {kwh} kWh/Tag · alles gleichzeitig ≈ {peakW} W (dein Wechselrichter sollte größer sein)",
    readoutBill: "Das sind etwa {kwhDay} kWh/Tag im Schnitt.",
    readoutBillIncomplete:
      "Gib deine Monatsrechnung ein, um die Tages-Schätzung zu sehen.",
    readoutKwhEmpty: "Gib einen Tagesverbrauch in kWh ein.",
    readoutKwhReady: "{kwh} kWh/Tag werden direkt verwendet.",
    statusSuccess:
      "✅ {years} Jahre stündliche Daten ({dataYears}) · {yield} kWh/Jahr pro kW Panel.{offline}",
    offlineNote: " · 🌐 typisches Offline-Jahr",
    goalLabel: "Welches Ergebnis möchtest du untersuchen?",
    useCaseLabel: "Was willst du erreichen?",
    useCaseBillCut: "Meine Stromrechnung senken",
    useCaseTou: "Mit einer Batterie bei Zeittarifen sparen",
    useCaseBackup: "Das Nötigste läuft bei einem Stromausfall weiter",
    useCaseReserve: "Einen Notfall-Reservestand in der Batteri halten",
    useCaseOffGrid: "Vollständig unabhängig vom Netz",
    useCasePortable: "Tragbare Stromversorgung (Wohnmobil, Boot, Camping)",
    useCaseBillCutBlurb:
      "Netzgebundene Solaranlage, mit Batterie nur, wenn sie sich lohnt. Gemessen als Anteil deiner Rechnung, den das System über 20 Jahre einspart.",
    useCaseTouBlurb:
      "Nur eine Batterie: Sie lädt in den günstigen Stunden und deckt die teuren. Keine Module.",
    useCaseBackupBlurb:
      "Ausgelegt auf den Geräten, die du ankreuzt, nicht auf dein ganzes Haus. Gemessen als Anteil der Stromausfälle, die das Nötigste übersteht.",
    useCaseReserveBlurb:
      "Lass einen Teil der Batteri für Stromausfälle zurück und sieh genau, was dich das an Ersparnis kostet.",
    useCaseOffGridBlurb:
      "Solar und Batterie für dein ganzes Haus ausgelegt. Gemessen als Anteil der Stunden, die ganz ohne Netz laufen.",
    useCasePortableBlurb:
      "Eine Stromstation für Wohnmobil, Boot oder Campingplatz. Kein Dach, kein Netz, kein Tarif.",
    metricBillCut: "deiner Rechnung, über 20 Jahre eingespart",
    metricTouOffset:
      "deiner Energie in den Spitzenstunden, die die Batterie deckt",
    metricOutageCoverage:
      "der Stromausfälle, die dein Nötigstes über die volle Dauer übersteht",
    metricReserveTradeoff: "was die Reserve kostet, in Ersparnis und Stunden",
    metricGridIndependence: "des Jahres ganz ohne Netz",
    metricPortableRuntime:
      "der Tage, an denen die Station deine Geräte den ganzen Tag versorgt",
    statusWorks: "Funktioniert",
    statusPartial: "Teilweise",
    statusNotHere: "Funktioniert hier nicht",
    useCaseOutcomeTitle: "Dein Ergebnis: {useCase}",
    useCaseVerdictFooter:
      "Gemessen für {useCase} anhand von {metric}, mit dem stündlichen Wetter dieses Ortes.",
    useCaseNotMeasured:
      "Nicht gemessen: Diese Kombination lässt sich überhaupt nicht auslegen, es gibt also kein {metric} zu nennen.",
    metricReserveTradeoffValue: "{lost}% Ersparnis, {hours} h Reserve",
    reserveOff: "aus",
    touPeakLabel: "Dein Preis in den Spitzenstunden (pro kWh)",
    touOffPeakLabel: "Dein Preis außerhalb der Spitzenzeiten (pro kWh)",
    touDefaultNote:
      "Für deine Region haben wir keine veröffentlichte Zeittarif-Tabelle. Deshalb haben wir einen Spitzenpreis von 60 % über und einen Preis außerhalb der Spitze von 45 % unter deinem Pauschalpreis eingetragen. Ändere beide Werte, wenn deine Rechnung etwas anderes sagt — das Urteil unten nutzt, was du eingibst.",
    essentialLabel: "Was muss weiterlaufen? (Auswählen, was passt)",
    outageLabel: "Wie lange muss es durchhalten?",
    backupRechargeLabel: "Die Module dürfen sie während des Ausfalls nachladen",
    reserveLabel: "Notfall-Reservestand in der Batteri",
    portableDeviceLabel: "Was versorgst du? (Auswählen, was passt)",
    portableBankLabel: "Nutzbare Größe der Stromstation (kWh)",
    portableShoreLabel: "Ich kann am Netz oder am Fahrzeug nachladen",
    generatorLabel:
      "Ein Generator steht für die schlimmsten Wochen zur Verfügung",
    verdictBillCut:
      "{status}: Dieses System spart {pct}% deiner Rechnung über 20 Jahre.",
    verdictTou:
      "{status}: Die Batterie deckt {pct}% deiner Energie in den Spitzenstunden, rund {saving} über 20 Jahre gegen eine {cost}-Batterie. Der Abstand zwischen Spitze und Tal beträgt hier {spread} pro kWh.",
    verdictBackup:
      "{status}: Dein Nötigstes läuft die vollen {targetHours} Stunden in {pct}% der simulierten Stromausfälle (typische Nacht: {hours} Stunden).",
    verdictReserve:
      "{status}: Dieser Reserve kostet dich {pct}% deiner Ersparnis und bringt {coverHours} Stunden Deckung.",
    verdictReserveNoBattery:
      "Es gibt nichts, worin eine Reserve stecken könnte: das billigste System für dieses Ziel hat gar keine Batterie.",
    verdictOffGrid:
      "{status}: {pct}% des Jahres laufen ganz ohne Netz — {unmetHours} Stunden fehlen im schlechtesten Jahr, {autonomy} Tage Autonomie.",
    verdictPortable:
      "{status}: Deine Station versorgt deine Geräte hier an {days} von {trips} Tagen den ganzen Tag, und eine Ladung reicht {runtime} Stunden.",
    chemLabel: "Batteriechemie:",
    // Added with the English key. German was the one locale that never
    // received this note at all: it lived only in the translated
    // dictionaries, which ui.js never read, so the note rendered in English
    // everywhere and no rule could see the hole until English declared it.
    tariffNote:
      "Geschätzter Strompreis für {label} – ändere ihn oben, wenn du deinen Tarif kennst.",
    cityLabel: "Wo wird das System installiert?",
    loadLabel: "Wie viel Strom verbrauchst du?",
    loadAppliances: "Geräte auswählen",
    loadBill: "Monatliche Rechnung",
    loadKwh: "Ich kenne kWh/Tag (fortgeschritten)",
    locBtn: "📍 Präzisen Standort verwenden",
    runBtn: "☀️ System dimensionieren",
    langLabel: "Sprache",
    lvlBest: "Beste Wahl",
    lvlCompare: "Batterien vergleichen",
    lvlMatrix: "Alle Optionen",
    bomPanelTitle: "Deine Hardware-Liste — woraus dieses System besteht",
    genSummary: "Ich habe einen Generator — was kostet sein Strom wirklich?",
    genApply: "Als meinen Strompreis übernehmen",
    socChartTitle:
      "Batterieladung & Zuverlässigkeit übers Jahr (5 Jahre echtes Wetter)",
    frontierTitle: "Wie weit reicht dein Budget?",
    frontierIntro:
      "Wir zeigen die günstigsten Systeme für deinen Standort, damit du Kosten und erreichbare Versorgung vergleichen kannst.",
    frontierX: "Systemkosten zu Beginn",
    frontierYGrid: "Anteil der Rechnung gesenkt",
    frontierYGridBattery: "Anteil der verschobenen Spitzenlaststunden",
    frontierYOffgrid: "Anteil der Energie ohne Generator",
    frontierSelTag: "{pv} kW + {batt} kWh · {pct} % · {cost}",
    frontierSelNoBatt: "{pv} kW, ohne Batterie · {pct} % · {cost}",
    frontierLegendSel:
      "Ausgewählte Option — klicke einen Punkt, um ihn zu wählen",
    frontierNoSystem:
      "Kein System in den hier durchsuchten Größen erreicht dieses Ziel an diesem Standort. Die Kurve unten zeigt, wie weit dieser Standort praktisch kommt — versuch ein niedrigeres Ziel oder plane einen Generator oder Netzanschluss für den Rest.",
    simpleInfeasible:
      "An diesem Standort erreicht kein baubares System dieses Ziel. Versuch ein niedrigeres Einspar-Ziel — oder lies die vollständigen Details, um zu sehen, wie weit Solar hier tatsächlich kommt.",
    simpleWhatItMeans:
      "Paneele liefern Strom, wenn die Sonne scheint; der Akku trägt ihn in den Abend und die Grautage. Bemessen wird das System aus fünf Jahren stündlicher Satelliten-Wetterdaten an deinem genauen Standort.",
    simpleWhatItMeansBattery:
      "Ein Akku erzeugt selbst keinen Strom: Er lädt in den günstigen Stunden und hält die Energie für die teuren bereit. Bemessen wird das System aus fünf Jahren stündlicher Satelliten-Wetterdaten an deinem genauen Standort.",
    simpleCaveat:
      "Das ist eine Schätzung, kein Versprechen — alle vollständigen Zahlen sind einen Klick entfernt.",
    simpleSeeDetails: "Alle Details anzeigen",
    simpleDownloadBom: "Teileliste herunterladen (CSV)",
    simpleAskAdvisor: "Fragen Sie den KI-Berater (in einfachen Worten)",
    sanityOk: "Unabhängig geprüft ✓ — physikalisch plausibel",
    sanityFlag:
      "⚠ Eine unabhängige KI-Prüfung markiert dieses Ergebnis als physikalisch unplausibel —",
    sanityAskAdvisor: "fragen Sie den Berater warum",
    sanityUncertain:
      "Prüfung unentschieden — die unabhängige KI-Prüfung erreichte für diese Eingaben kein eindeutiges Urteil",
    sanityTooltip:
      "Ein unabhängiger KI-Klassifikator (Jev) hat nur die Dimensionierungszahlen geprüft — kein Standort, Text oder personenbezogener Daten verlässt Ihren Browser über diese Zahlen hinaus. Er ändert niemals das berechnete Ergebnis.",
    simpleAdvisorStyle:
      "[ANWEISUNG FÜR DEN BERATER: Der Besucher ist im einfachen Modus. Antworten Sie wie ein Experte, der mit einem klugen 12-Jährigen spricht: einfache Alltagsworte, kein Fachjargon (erklären Sie jeden Fachbegriff in einer kurzen Klammer), höchstens 4 kurze Sätze, und enden Sie mit DER Zahl, die am meisten zählt.]",
    advisorTitle: "Kostenloser KI-Energieberater",
    advisorSubtitle:
      "Sie sprechen mit einer KI (Groq-Motor) — nur Bildungswerte, keine Ingenieursberatung",
    advisorIntro:
      "Ich erkläre die Ergebnisse des Rechners: Batteriechemie, Verkabelung und Schutz oder Fragen für einen lokalen Elektriker. Führen Sie zuerst die Dimensionierung aus und fragen Sie dann zu diesem Ergebnis — oder stellen Sie mir eine beliebige Frage.",
    advisorBotNote:
      "Von KI erzeugte Schätzung — möglicherweise ungenau, einschließlich Preisen und Spezifikationen. Keine Ingenieursberatung. Lassen Sie sie vor dem Kauf oder Bau von einem zugelassenen Elektriker oder Ingenieur prüfen.",
    advisorThinking: "⏳ Denkt nach...",
    advisorLabel: "Fragen Sie den KI-Berater zu Ihrem System",
    advisorPlaceholder:
      "Fragen zu Zellen, Natrium-Ion vs. LFP, Frachtkosten...",
    advisorSend: "Senden",
    advisorClose: "KI-Berater schließen",
    advisorBusyRetry:
      " Die kostenlose KI ist ausgelastet — erneuter Versuch in {secs}s…",
    advisorNoReply: " Keine Antwort erhalten. Bitte versuchen Sie es erneut.",
    advisorBusy:
      " Die kostenlose KI ist gerade überlastet (HTTP {status} — gemeinsames Kontingent).\n\nWarten Sie etwa eine Minute und senden Sie die Frage erneut.",
    // ── Degraded advisor reply (B2 / R-CF-10) ──────────────────────────
    advisorDegradedLabel: "Offline · nicht die Live-KI",
    advisorDegradedLine: "Das kann ich gerade nicht beantworten — {why}.",
    advisorDegradedWhyUnavailable:
      "der Dienst, der antwortet, hat nicht geantwortet",
    advisorDegradedWhyNoKey:
      "kein Modellschlüssel: der Berater ist planmäßig offline",
    advisorDegradedReassure:
      "An dem oben Gesagten ist nichts falsch und Ihre Berechnung ist nicht betroffen.",
    advisorDegradedSystem:
      "Lassen Sie diese Zahlen vor dem Bau von einem Elektriker prüfen.",
    advisorIsAi:
      "Der Berater ist ein Sprachmodell. Er schreibt plausiblen Text und kann falsche Zahlen sicher nennen. Prüfen Sie jede Zahl — nehmen Sie sie nie als Tatsache.",
    advisorDegradedGeneral:
      "Für die Dimensionierung: der Rechner oben, ohne Konto.",
    advisorDegradedRetry:
      "In einer Minute erneut versuchen; das Kontingent ist geteilt.",
    advisorUnreachable:
      " Der KI-Berater ist gerade nicht erreichbar{status}.\n\nPrüfen Sie Ihre Verbindung und versuchen Sie es gleich noch einmal.",
    frontierCeilingTag: "Bestes in den durchsuchten Größen: {pct} %",
    frontierSvgTitle: "Wie weit dein Geld reicht",
    frontierSvgDesc:
      "Eine Kurve aus {n} Systemen, von {lowCost} mit {lowPct} % bis {highCost} mit {highPct} %. Alle Zahlen stehen in der Tabelle unter dem Diagramm.",
    frontierPointTip: "{cost}: {pct} % — {pv} kW Panels + {batt} kWh Batterie",
    budgetLabel: "Dein Budget (zu Beginn)",
    frontierTableCaption:
      "Jeder Punkt der Kurve. Typische Kosten sind die Mitte für Selbstbau mit Versand; die Spanne reicht von nackten Zellen bis Versandhandel.",
    frontierColCost: "Typische Kosten",
    frontierColRange: "Selbstbau bis Handel",
    frontierColCut: "Rechnung gesenkt",
    frontierColCutBattery: "Verschobene Spitzenlaststunden",
    frontierColCover: "Abgedeckt",
    frontierColPv: "Panels",
    frontierColBatt: "Batterie",
    frontierNoBattery: "keine",
    frontierTableToggle: "Alle Punkte als Tabelle anzeigen",
    frontierLegendCurve: "Günstigstes System für jede Stufe",
    frontierLegendBand: "Dieselben Systeme, von Selbstbau bis Versandhandel",
    frontierLegendRange:
      "Bestwert-Spanne — jedes weitere Prozent bleibt günstig",
    frontierBestValueRange: "Bestwert-Spanne: ~{lo}–{hi} ({loPct}–{hiPct}%).",
    frontierRangeTag: "Bestwert",
    frontierTagSel: "ausgewählt",
    fuelLitLabel: "Preis pro Liter",
    fuelGalLabel: "Preis pro Gallone",
    fuelReadoutRate: "{type} kostet bei diesem Preis etwa {rate} pro kWh",
    fuelReadoutBurn:
      "({entry} ÷ {burn} {unit}/kWh — nur Kraftstoff; Öl, Filter und Motorverschleiß treiben den echten Wert höher)",
    fuelReadoutGrid:
      "Typischer Netzstrom kostet zwischen {lo} und {hi} pro kWh.",
    fuelApplyOk:
      "Dein Generator-Kraftstoff kostet etwa {rate}/kWh — als dein Strompreis übernommen, sodass jede Amortisation unten mit dem vergleicht, was du heute verfeuerst.",
    frontierLegendCeiling:
      "Bestes in den durchsuchten Größen — keine physikalische Grenze",
    frontierMarkerOffCurve:
      "Deine Option liegt rechts der Kurve, weil die Empfehlung nach echten 20-Jahres-Kosten gewählt wird, nicht nach dem Preis heute: Eine billigere Bank mit Austausch kostet jetzt weniger und später mehr.",
    frontierVerdictSteepGrid:
      "Etwa {kneePct} % deiner Rechnung zu senken kostet rund {kneeCost}. Danach wird es schnell teuer: etwa {tailCost} pro weiterem Prozent, gegenüber {headCost} davor.",
    frontierVerdictTaperingGrid:
      "Etwa {kneePct} % deiner Rechnung zu senken kostet rund {kneeCost}. Danach kostet jedes weitere Prozent etwa {tailCost} — rund {ratio}-mal so viel wie zuvor.",
    frontierVerdictCoveredBattery:
      "Die Größe ist hier nicht deine Grenze. Die kleinste praktische Batterie — {batt} kWh, etwa {cost} — verschiebt bereits praktisch alle Spitzenlaststunden dieser Last. Größer kauft Reservekapazität, nicht mehr Verschiebung.",
    frontierVerdictBeyondSweepBattery:
      "Innerhalb der Batteriegrößen, die dieses Werkzeug sucht — bis {battMax} kWh — kannst du hier höchstens etwa {ceilingPct}% verschieben, für rund {ceilingCost}. Der gute Gegenwert endet viel früher, bei {kneePct}% für etwa {kneeCost}; mehr Verschiebung braucht einen größeren Speicher als alles, was hier dimensioniert wird.",
    frontierVerdictSteepBattery:
      "Etwa {kneePct}% deiner Spitzenlaststunden in die Batterie zu verlagern kostet rund {kneeCost}. Danach wird es schnell teuer: rund {tailCost} je weiterem Prozent, gegenüber {headCost} zuvor.",
    frontierVerdictTaperingBattery:
      "Etwa {kneePct}% deiner Spitzenlaststunden in die Batterie zu verlagern kostet rund {kneeCost}. Darüber hinaus kostet jedes weitere Prozent etwa {tailCost} — rund {ratio}-mal so viel wie zuvor.",
    frontierVerdictLinearBattery:
      "Die Verschiebung folgt den Kosten hier recht gleichmäßig — etwa {headCost} je Prozent Spitzenlaststunden, bis {ceilingPct}%.",
    frontierVerdictLinearGrid:
      "Ersparnis folgt den Ausgaben hier ziemlich gleichmäßig — etwa {headCost} pro Prozent deiner Rechnung, bis {ceilingPct} %.",
    frontierVerdictBeyondSweepGrid:
      "In den hier durchsuchten Größen — bis {pvMax} kW Panels und {battMax} kWh Batterie — lassen sich hier höchstens etwa {ceilingPct} % senken, für rund {ceilingCost}. Das gute Preis-Leistungs-Verhältnis endet deutlich früher, bei {kneePct} % für etwa {kneeCost}. Mehr zu senken ist nicht unmöglich, braucht aber ein größeres System als alles hier Dimensionierte.",
    frontierVerdictSteepOffgrid:
      "Etwa {kneePct} % deiner Energie abzudecken kostet rund {kneeCost}. Die letzte Strecke zur vollen Unabhängigkeit kostet das Geld: etwa {tailCost} pro weiterem Prozent, gegenüber {headCost} davor.",
    frontierVerdictTaperingOffgrid:
      "Etwa {kneePct} % deiner Energie abzudecken kostet rund {kneeCost}. Danach kostet jedes weitere Prozent etwa {tailCost} — rund {ratio}-mal so viel wie zuvor.",
    frontierVerdictLinearOffgrid:
      "Abdeckung folgt den Ausgaben hier ziemlich gleichmäßig — etwa {headCost} pro Prozent, bis {ceilingPct} %.",
    frontierVerdictBeyondSweepOffgrid:
      "In den hier durchsuchten Größen — bis {pvMax} kW Panels und {battMax} kWh Batterie — lassen sich hier höchstens etwa {ceilingPct} % abdecken, für rund {ceilingCost}. Das gute Preis-Leistungs-Verhältnis endet bei {kneePct} % für etwa {kneeCost}. Volle Unabhängigkeit ist hier nicht unmöglich, braucht aber ein weit größeres System — und ein Generator oder Netzanschluss ist fast sicher der billigere Weg für den Rest.",
    frontierVerdictCoveredOffgrid:
      "Dimensionierung ist hier nicht deine Grenze. Das kleinste praktische System — {pv} kW Panels und {batt} kWh Batterie, etwa {cost} — deckt diesen Verbrauch bereits ganzjährig ab. Alles Größere kauft Reserve, nicht mehr Unabhängigkeit.",
    frontierVerdictCoveredGrid:
      "Dimensionierung ist hier nicht deine Grenze. Das kleinste praktische System — {pv} kW Panels und {batt} kWh Batterie, etwa {cost} — deckt diesen Verbrauch bereits praktisch vollständig ab. Alles Größere kauft Reserve, keine größere Ersparnis.",
    frontierMethod:
      "Die Kurve nutzt dieselbe stündliche Wetter-Simulation und dieselben Preisannahmen wie die Ergebnisse oben.",
    frontierMethodBattery:
      "Die Kurve simuliert jede Batteriegröße auf einem groben Raster mit demselben stündlichen Wetter und denselben Tarifzeiten wie die Ergebnisse oben und behält nur die Systeme, die nichts Günstigeres schlägt. In diesem Lauf gibt es keine Module, die Kurve variiert also nur den Speicher. Die Preise verwenden dieselben Mittelwerte wie alle anderen Zahlen auf dieser Seite.",
    // -- Cumulative 20-year cost caption (under the chart canvas) --
    // The caption head is "Kumulierte Kosten … für das {which} System": after a
    // definite neuter article the weak adjective takes -e, so the caption read
    // "für das empfohlenen System" — visible German grammar, and the kind of
    // thing only a real non-English pass turns up.
    cumCostRecommended: "empfohlene",
    cumCostSelected: "ausgewählte",
    cumCostCaptionHead:
      "Kumulierte Kosten über 20 Jahre für das {which} System ({label}): Die amberfarbene Linie ist das, was Sie an den Versorger zahlen, wenn Sie am Netz bleiben ({gridTotal}).",
    cumCostCaptionOwnCost:
      "Die smaragdgrüne Linie sind die eigentlichen Kosten der Solaranlage (~{systemTotal}) und entsprechen der Zeile “Gesamtkosten über 20 Jahre” für dieses System.",
    cumCostCaptionOwnCostNoPanels:
      "Die smaragdgrüne Linie sind die eigentlichen Kosten des Systems (~{systemTotal}) und entsprechen der Zeile “Gesamtkosten über 20 Jahre” für dieses System.",
    cumCostCaptionStack:
      "Der amberfarbene Wert ist ein Stapel — das System, dann die kleineren Rechnungen, die nach der Solaranlage bleiben (~{residualBills}), dann Ihre Ersparnis — dieses System bringt Ihnen über die 20 Jahre also {saved} zurück.",
    cumCostCaptionStackNoPanels:
      "Der amberfarbene Wert ist ein Stapel — das System, dann die kleineren Rechnungen, die bleiben (~{residualBills}), dann Ihre Ersparnis — dieses System bringt Ihnen über die 20 Jahre also {saved} zurück.",
    cumCostCaptionNetNegative:
      "Hier läuft der Stapel andersherum: Diese verbleibenden Rechnungen (~{residualBills}) sinken nie genug, also kostet dieses System über 20 Jahre rund {loss} MEHR als am Netz zu bleiben — ausgegebenes Geld, kein gespartes.",
    cumCostCaptionRepaid:
      "Das System hat seine Kosten bis Jahr {year} zurückverdient — jedes weitere Jahr bringt ~{perYear} zurück in Ihre Tasche. Gesamtersparnis über 20 Jahre: ~{saved}. Die unteren Balken sind Ihre Nettoposition: rot bis zum Break-even, danach steigend.",
    cumCostCaptionNeverRepays:
      "Über 20 Jahre verdient das System seine Kosten nie zurück — Batteriewechsel übersteigen die Rechnungseinsparung, also lautet die ehrliche Antwort: Hier rechnet es sich nicht.",
    cumCostCaptionResidual:
      "Die schiefergraue Linie sind die Restnetzkosten selbst — etwa {annual}/Jahr für die {kwh} kWh/Jahr, die noch aus dem Netz kommen (netto nach Ihrer Einspeisegutschrift), {end} über die vollen 20 Jahre.",
    cumCostCaptionResidualCreditDraw:
      "Die schiefergraue Linie läuft unter 0 $ — Net-Metering: Der Einspeisewert Ihres Überschusses übersteigt sogar die kleinen {kwh} kWh/Jahr, die Sie noch beziehen, Sie gewinnen also ~{earned} über die vollen 20 Jahre.",
    cumCostCaptionResidualCreditBill:
      "Die schiefergraue Linie läuft unter 0 $ — Net-Metering: Der Einspeisewert Ihres Überschusses übersteigt die kleine Rechnung, die Sie noch zahlen, Sie gewinnen also ~{earned} über die vollen 20 Jahre.",
    cumCostCaptionSurplusCredit:
      "Der Wert mit Solaranlage (~{withSolar}) liegt UNTER den eigentlichen Kosten des Systems: Ihre Einspeisegutschrift für den Überschuss übersteigt die kleine Restrechnung, der Stapel läuft also negativ und der Versorger schuldet Ihnen ~{owed} in der 20-Jahres-Bilanz.",
    pipelineLocation: "Standort",
    pipelineWeather: "Wetter",
    pipelineSimulating: "Simulieren",
    pipelineRendering: "Rendern",
    pipelineElapsed: "{s} s vergangen",
    pipelineCached: "im Cache",
    pipelineReaching: "Satellit wird erreicht…",
    pipelineChunks: "{done}/{total} Satelliten-Abschnitte",
    speedNoteRepeat:
      "⚡ Sofort — exakte Wiederholung dieses Setups (gerade berechnet)",
    speedNoteCached: "⚡ Sofort — gespeichertes Satellitenwetter",
    speedNoteCachedWhere:
      "⚡ Sofort — gespeichertes Satellitenwetter für {where}",
    speedNoteOffline: "⚡ Sofort — typisches Offline-Jahr",
    speedNoteOfflineWhere: "⚡ Sofort — typisches Offline-Jahr für {where}",
    fmtAllDay: "ganztägig (24 h)",
    fmtHoursDay: "{h} h/Tag",
    fmtMinutesDay: "{m} min/Tag",
    apWattsRunning: "~{w} W im Betrieb",
    apWatts: "~{w} W",
    apKwhDay: "{kwh} kWh/Tag",
    apAvgW: " (~{w} W Ø)",
    offgridKwhReadout: "~{kwh} kWh/Tag",
    quickBillStarts:
      "Beginnt bei ~{bill} (≈{kwh} kWh/Tag). Tragen Sie hier Ihre echte Rechnung ein, wählen Sie einen Standort und klicken Sie auf Mein System dimensionieren. Der Spar-Schieber erscheint mit den Ergebnissen.",
    quickBillManual:
      "Schnellschätzung: ~{bill} (beginnt bei ~{kwh} kWh/Tag) — wechseln Sie zu Manuell, um Rechnung, Geräte oder Tarif zu ändern.",
    dailyEnergyNeed: "Täglicher Energiebedarf (kWh/Tag-Schieber)",
    billPerMonth: "/Mon.",
    simpleHeadline: "An Ihrem Standort bringt Ihnen dieses System {goal}:",
    simpleGoalGrid: "etwa {pct}% Ihrer Rechnung einsparen",
    simpleGoalBattery:
      "etwa {pct}% deiner Spitzenlaststunden in die Batterie zu verlagern",
    simpleGoalOffgrid: "Ihr Haus übers Jahr versorgen",
    sharedLocationLoaded:
      "Geteiltes Ergebnis geladen — Sonnendaten für diesen Standort",
    uiInitFailed:
      "Warnung: Die Oberfläche konnte nicht laden — bitte Seite neu laden (Strg+F5).",
    infeasibleAreaTitle: "Zu wenig Dach-/Grundfläche für dieses Ziel",
    infeasibleAreaBody:
      "Die gesuchte Solargröße wurde durch das optionale Flächenfeld begrenzt (siehe „Hardware-Konfiguration“). Leeren Sie dieses Feld — oder zeichnen Sie eine größere Fläche auf der Karte — und rechnen Sie erneut: der Standort selbst kann dieses Ziel erreichen.",
    infeasibleEnvelopeTitle:
      "Außerhalb des Suchbereichs dieses Tools für dieses Ziel",
    infeasibleEnvelopeBody:
      "Bei diesem Verbrauch braucht das Ziel eine Solaranlage oder Batteriebank, die größer ist als der Suchbereich dieses Rechners (siehe Hardware-Konfiguration für die Grenzen). Versuchen Sie ein niedrigeres Sparziel, oder prüfen Sie, ob sich der Verbrauch senken lässt.",
    infeasibleNeedsBatteryTitle: "Nur Solar erreicht 100% netzunabhängig nicht",
    infeasibleNeedsBatteryBody:
      "Ein netzunabhängiges Haus braucht Speicher für Nächte und bewölkte Tage. Fügen Sie eine Batterie zur Hardware-Auswahl hinzu, oder wechseln Sie das Ziel zu „Meine Rechnung senken, verbunden bleiben“ (Netzanbindung).",
    infeasibleNeedsPanelsTitle: "Nur Batterie kann netzunabhängig nicht laufen",
    infeasibleNeedsPanelsBody:
      "An diesem Standort lädt nichts die Bank auf. Fügen Sie Module zur Hardware-Auswahl hinzu, oder wechseln Sie das Ziel zu „Meine Rechnung senken, verbunden bleiben“ (Netzanbindung).",
    infeasibleNeedsSurplusTitle:
      "Eine reine Batteriebank kann keinen Überschuss erzeugen",
    infeasibleNeedsSurplusBody:
      "Überschuss braucht Module, die mehr erzeugen als Ihr Verbrauch. Senken Sie das Ziel unter 100% am Spar-Schieber, oder wechseln Sie die Hardware zu „Solar + Batterie“.",
    infeasibleGenericTitle:
      "Diese Kombination aus Hardware und Ziel ist nicht lösbar",
    infeasibleGenericBody:
      "Ändern Sie das Ziel oder die Hardware und rechnen Sie erneut.",

    pathsLabel_turnkey: "Installateur, schlüsselfertig",
    pathsLabel_lease: "Leasing oder PPA",
    pathsLabel_selfpurchase: "Sie kaufen die Teile selbst",
    pathsLabel_diy: "Sie montieren, ein Elektriker schließt an",
    pathsTitle: "Vier Wege, dieses selbe System zu bezahlen",
    pathsSub:
      "Ein System, eine Definition, zwanzig Jahre. Der Abstand zwischen diesen Karten ist ein Preisunterschied, kein Unterschied dessen, was jeweils mitgezählt wird.",
    pathsCheapest: "Am günstigsten",
    pathsSpend20: "20-jährige Kosten",
    pathsRowIncentives: "Förderungen",
    pathsRowBillCut: "Rechnungssenkung",
    pathsRowBreakEven: "Amortisation",
    pathsRowNet: "Netto über 20 Jahre",
    pathsRowOwnership: "Eigentum",
    pathsRowEndOfTerm: "Am Ende",
    pathsCountsHeading: "Was dieser Preis umfasst",
    pathsInstrumentLabel: "Drittanbieter-Weg:",
    pathsGradeNote:
      "Alle Zahlen stammen aus einem regionalen Preisregister mit genannter Quelle und Vertrauensstufe. Die Hardware ist Ihre eigene Schätzung; Arbeitszeit, Genehmigungen, Förderungen und Austausch kommen aus dem Register. Nichts davon ist ein Angebot eines Anbieters.",
    pathsWhy:
      "{cheaper} ist über 20 Jahre {gap} günstiger als {dearer}, vor allem wegen {driver}.",
    pathsWhyCombined: " Kein Einzelposten erklärt die ganze Differenz.",
    pathsDriver_year0: "der Vorauszahlungspreis",
    pathsDriver_incentives: "an wen die Förderungen gehen",
    pathsDriver_om: "die Wartung",
    pathsDriver_replacements: "die Batterie- und Wechselrichtertausche",
    pathsDriver_leasePayments: "die Zahlungen, die Sie leisten",
    pathsDriver_none: "kein Einzelposten",
    pathsInstrumentPpa: "PPA (Sie kaufen den Strom)",
    pathsInstrumentLease: "Leasing (Sie mieten das System)",
    pathsEndOfTermBuyout:
      "Jahr {years}: Sie können es für {buyoutPct}% des Installationspreises übernehmen, und diese Übernahme steckt in dieser Zahl.",
    pathsEndOfTermStillLeasing:
      "Im Jahr {years} läuft der Vertrag noch, eine Übernahme ist also nicht eingerechnet. Nach 20 Jahren wären weiterhin Zahlungen fällig.",
    pathsOwnershipTurnkey: "Es gehört Ihnen vom ersten Tag an.",
    pathsOwnershipPpa: "Der Anbieter bleibt Eigentümer und wartet es.",
    pathsOwnershipLease:
      "Sie mieten es bis zum Vertragsende und übernehmen es dann oder geben es zurück.",
    pathsOwnershipSelf: "Es gehört Ihnen, sobald es installiert ist.",
    pathsIncentiveTaxCredit: "Bundessteuergutschrift",
    pathsIncentiveRebate: "Zuschuss des Netzbetreibers",
    pathsIncentivesToProvider:
      "Förderungen gehen an den Anbieter, nicht an Sie.",
    pathsIncentivesGoToProvider:
      "Der Anbieter behält sie — Sie besitzen nichts.",
    pathsNoIncentive: "Für diesen Weg gilt keiner.",
    pathsNoVerifiedIncentive:
      "Für Ihre Region haben wir keinen geprüften Anreiz.",
    pathsUnknown: "Unbekannt",
    pathsNotWithinHorizon: "Nicht in 20 Jahren",
    pathsBreakEvenYear: "Jahr {year}",
    pathsUnavailable: "Nicht verfügbar",
    pathsNoSystem: "Es gibt kein System zu bepreisen.",
    pathsNoTariff:
      "Ein PPA braucht einen Tarif als Bezugsgröße und wird hier deshalb nicht gezeigt.",
    pathsDiyNotPermitted:
      "Hier nicht angeboten: Bei Ihnen muss die Elektroinstallation von einem zugelassenen Fachbetrieb ausgeführt werden.",
    pathsDiyRestricted:
      "Hier nicht angeboten: Die Eigenmontage ist bei Ihnen eingeschränkt.",
    pathsDiyUnknown:
      "Hier nicht angeboten: Wir konnten nicht prüfen, ob Sie Ihre Anlage selbst montieren dürfen.",
    pathsNoteTurnkeyAllIn:
      "Ein Pauschalpreis: dieselbe Hardware, plus Arbeitszeit, Genehmigungen und die Marge des Installateurs.",
    pathsIncludesInstalledAllIn:
      "Teile, Arbeitszeit und Genehmigungen, bereits installiert",
    pathsIncludesProviderSwaps:
      "Der Anbieter wartet und tauscht Batterie und Wechselrichter",
    pathsIncludesIncentivesToProvider:
      "Förderungen gehen an den Anbieter, nicht an Sie",
    pathsIncludesIncentivesIfEligible: "Förderungen, sofern Sie Anspruch haben",
    pathsIncludesNoYear0Hardware: "Keine Anschaffung von Hardware vorab",
    pathsIncludesEndOfTerm: "Die Option am Vertragsende ist eingepreist",
    pathsIncludesHardwareYouBuy: "die Hardware, die Sie selbst kaufen",
    pathsIncludesElectricianInstalls: "Ein zugelassener Elektriker montiert es",
    pathsIncludesPermitsAndInterconnection:
      "Genehmigungen, Abnahme und Netzanschluss",
    pathsIncludesYouDoSwaps:
      "Sie organisieren und bezahlen die Batteriewechsel selbst",
    pathsIncludesYouMountTheArray: "Sie montieren die Anlage selbst",
    pathsIncludesElectricianConnects: "Ein Elektriker nimmt den Anschluss vor",
    pathsIncludesToolsAndSafety: "Werkzeug und Schutzausrüstung",
  },
  ar: {
    rtl: true,
    navSizing: "صمّم نظامك",
    navSupport: "الدعم",
    cutLabel: "هدف خفض الفاتورة",
    cutLabelBattery: "هدف نقل ساعات الذروة",
    cutValueBattery: "الهدف: نقل ~{pct}% من ساعات الذروة إلى البطارية",
    fxCodeLabel: "رمز العملة:",
    firstRunNote:
      "اختر موقعك واستهلاكك ثم اضغط صمّم نظامك. أول تشغيل يُنزّل حوالي 2 ميغابايت من بيانات الطقس الساتلية ثم يخزّنها في متصفحك.",
    navBom: "مرجع المكونات",
    navBlog: "المدونة",
    navLegal: "الشروط وإخلاء المسؤولية",
    sourcesCardTitle: "من أين تأتي هذه الأرقام",
    sourcesCardBody:
      "كل افتراض وراء أي رقم يذكر هنا الناشر وتاريخ التحقق ومدى مطابقته للقيمة المستخدمة. وما تعذّر توثيقه يقول ذلك صراحةً.",
    sourcesCardLink: "عرض كل المصادر ←",
    heroTag: "مجاني للجميع، في كل مكان · بدون تسجيل · لا شيء للبيع",
    heroTitle1: "قلّل فاتورة الكهرباء.",
    heroTitle2: "شاهد بالضبط ما يتطلبه الأمر.",
    footerAboutPre: "أنشأها وقدّمها",
    heroIntro:
      "ابدأ بموقعك — هاتفك يعرفه — ونحسب كل خيار يخفض فاتورتك، من 1% إلى فائض قابل للبيع. منحنى السعر يوضح ما يشتريه كل مبلغ، بعملتك. تقديرات تعليمية فقط، ولا شيء للبيع. أنشأها وقدّمها",
    footerAboutPost: "ليست شركة، ولا مُسجّلة، ولا شيء للبيع.",
    ctaStart: "ابدأ تقديرًا مجانيًا",
    goalLabel: "ماذا تريد من هذا النظام؟",
    useCaseLabel: "ماذا تريد أن تنجز؟",
    useCaseBillCut: "خفض فاتورة الكهرباء",
    useCaseTou: "الاقتصاد ببطارية مع تعرفة الساعات",
    useCaseBackup: "إبقاء الأساسيات تعمل أثناء انقطاع الكهرباء",
    useCaseReserve: "الاحتفاظ بهامش طوارئ في البطارية",
    useCaseOffGrid: "الاعتماد الكامل على عدم وجود شبكة",
    useCasePortable: "طاقة محمولة (شاحنة، قارب، تخييم)",
    useCaseBillCutBlurb:
      "طاقة شمسية مرتبطة بالشبكة، مع بطارية فقط إذا استحقت. يُقاس كنسبة فاتورتك التي يزيلها النظام على مدى 20 عامًا.",
    useCaseTouBlurb:
      "بطارية وحدها: تشحن في الساعات الرخيصة وتغطي الغالية. بدون ألواح.",
    useCaseBackupBlurb:
      "يُحجَّم حسب الأجهزة التي تختارها، لا حسب المنزل كله. يُقاس كنسبة انقطاعات الكهرباء التي تصمد الأساسيات خلالها.",
    useCaseReserveBlurb:
      "اترك جزءًا من البطارية جانبًا لحالات الانقطاع، وانظر بدقة ما يكلفه ذلك من fourni.",
    useCaseOffGridBlurb:
      "طاقة شمسية وبطارية محجَّمة لمنزلك كله. يُقاس كنسبة الساعات التي تعمل بلا شبكة إطلاقًا.",
    useCasePortableBlurb:
      "محطة طاقة لشاحنة أو قارب أو مخيم. بلا سطح، بلا شبكة، بلا تعرفة.",
    metricBillCut: "من فاتورتك يزيلها النظام على مدى 20 عامًا",
    metricTouOffset: "من طاقتك في ساعات الذروة تغطيها البطارية",
    metricOutageCoverage:
      "من انقطاعات الكهرباء التي تصمد الأساسيات خلالها طوال المدة المطلوبة",
    metricReserveTradeoff: "تكلفة الاحتفاظ بالهامش، بالوفوفير والساعات",
    metricGridIndependence: "من السنة تعمل بلا شبكة إطلاقًا",
    metricPortableRuntime: "من الأيام التي تغذّي فيها المحطة أجهزتك طوال اليوم",
    statusWorks: "ينجح",
    statusPartial: "جزئيًا",
    statusNotHere: "لا ينجح هنا",
    useCaseOutcomeTitle: "نتيجتك: {useCase}",
    useCaseVerdictFooter:
      "قِيست لـ {useCase} مقابل {metric}، باستخدام بيانات الطقس الساعية لهذا الموقع.",
    useCaseNotMeasured:
      "غير مقيس: هذا التركيب لا يمكن تحجيمه أصلًا، فلا يوجد {metric} للإبلاغ عنه.",
    metricReserveTradeoffValue: "{lost}% من الوفر، {hours} ساعة تغطية",
    reserveOff: "موقوف",
    touPeakLabel: "سعر الذروة عندك (لكل ك.و.س)",
    touOffPeakLabel: "سعر خارج الذروة عندك (لكل ك.و.س)",
    touDefaultNote:
      "لا نملك جدول تعرفة ساعية منشورًا لمنطقتك، لذلك وضعنا سعر ذروة أعلى بنسبة 60٪ وسعرًا خارج الذروة أدنى بنسبة 45٪ من تسعيرتك الثابتة. غيّر أيًّا منهما إن كانت فاتورتك تقول غير ذلك — والحكم أدناه يستخدم ما تكتبه.",
    essentialLabel: "ما الذي يجب أن يبقى يعمل؟ (اختر ما تشاء)",
    outageLabel: "كم يجب أن يصمد؟",
    backupRechargeLabel: "دع الألواح تعيد الشحن أثناء الانقطاع",
    reserveLabel: "هامش طوارئ محفوظ في البطارية",
    portableDeviceLabel: "ما الذي ستغذّيه؟ (اختر ما تشاء)",
    portableBankLabel: "السعة الفعلية للمحطة (ك.و.س)",
    portableShoreLabel: "أستطيع الشحن من الشبكة أو من المركبة",
    generatorLabel: "تتوفر مولدة للأسابيع الأسوأ",
    verdictBillCut:
      "{status}: يزيل هذا النظام {pct}% من فاتورتك على مدى 20 عامًا.",
    verdictTou:
      "{status}: تغطي البطارية {pct}% من طاقتك في ساعات الذروة، بقيمة نحو {saving} على مدى 20 عامًا مقابل بطارية تكلف {cost}. الفارق بين الذروة وخارج الذروة هنا {spread} لكل ك.و.س.",
    verdictBackup:
      "{status}: تعمل أساسياتك كاملة الساعات {targetHours} في {pct}% من انقطاعات الكهرباء التي حاكيناها (ليلة نموذجية: {hours} ساعات).",
    verdictReserve:
      "{status}: الاحتفاظ بهذا الهامش يكلفك {pct}% من وفورك ويشتري {coverHours} ساعة من التغطية.",
    verdictReserveNoBattery:
      "لا يوجد مكان للاحتفاظ بهامش: أرخص نظام لهذا الهدف لا يحمل بطارية إطلاقًا.",
    verdictOffGrid:
      "{status}: {pct}% من السنة تعمل بلا شبكة — تنقص {unmetHours} ساعة في أسوأ عام، مع {autonomy} يومًا من الاستقلالية.",
    verdictPortable:
      "{status}: تغذّي محطتك أجهزتك طوال اليوم في {days} يومًا من {trips} يومًا هنا، وشحنة واحدة تدوم {runtime} ساعة.",
    cityLabel: "أين سيُركَّب النظام؟",
    loadLabel: "كم تستهلك من الطاقة؟",
    loadAppliances: "أختار أجهزتي الكهربائية",
    loadBill: "أعرف فاتورتي الشهرية",
    loadKwh: "أعرف استهلاكي بالكيلوواط ساعة يوميًا (متقدم)",
    langLabel: "اللغة",
    readoutAppliancesEmpty:
      "اختر الأجهزة التي تريد تشغيلها وستظهر طاقتك اليومية هنا.",
    readoutAppliancesSummary:
      "الاستخدام المقدر: حوالي {kwh} كيلوواط ساعة/يوم · كل شيء يعمل في وقت واحد ≈ {peakW} واط (يجب أن يكون العاكس أكبر)",
    readoutBill:
      "هذا يعادل حوالي {kwhDay} كيلوواط ساعة/يوم من الاستخدام المتوسط.",
    readoutBillIncomplete: "أدخل فاتورتك الشهرية لرؤية التقدير اليومي.",
    readoutKwhEmpty: "أدخل استهلاكك اليومي بالكيلوواط ساعة لرؤية التقدير.",
    readoutKwhReady: "استخدام {kwh} كيلوواط ساعة/يوم مباشرة.",
    runBtn: "احسب نظامي (محاكاة خمس سنوات)",
    locBtn: "استخدم موقعي الحالي",
    chemLabel: "نوع البطارية:",
    tariffNote: "سعر تقديري لـ {label} — غيّره أعلاه إذا كنت تعرف تعريفتك.",
    pickCity: "اختر مدينة (أو استخدم 📍 موقعي) لمعرفة إشعاعك الشمسي.",
    shareLoaded:
      "تم تحميل الإعدادات المشتركة. راجع المدخلات ثم اضغط احسب نظامي لبدء الحساب.",
    invalidShare: "رابط غير صالح.",
    customCoordsLocation: "يجري استخدام الإحداثيات المخصصة ({lat}, {lon}).",
    resolvingCity: "جارٍ البحث عن مدينتك — اختر نتيجة أو انتظر قليلاً.",
    chooseCityMatch: "اختر مدينة من الاقتراحات أو انتظر انتهاء البحث.",
    resolvingCoords: "جارٍ التحقق من الإحداثيات…",
    invalidCoordinates:
      "يجب أن يتراوح خط العرض بين −90 و90 وخط الطول بين −180 و180.",
    invalidDailyKwh:
      "يجب أن يتراوح استهلاك الطاقة اليومي بين 0.5 و500 كيلوواط ساعة.",
    inputsChanged: "تغيرت المدخلات — اضغط احسب نظامي لتحديث التقدير.",
    errorTimeout:
      "لم يرد محرك الحساب في الوقت المحدد — تحقق من اتصالك وحاول مرة أخرى.",
    tellPowerUse:
      "أدخل استهلاكك للطاقة: حدد بعض الأجهزة، أو أدخل فاتورة أو قيمة بالكيلوواط ساعة.",
    statusGridtie:
      "⏳ جاري الحصول على خمس سنوات من طقس الأقمار الصناعية والبحث عن أحجام الأنظمة لتقليل الفاتورة…",
    statusOffgrid:
      "⏳ جاري الحصول على 5 سنوات من طقس الأقمار الصناعية ساعة بساعة والبحث عن أحجام الأنظمة…",
    runningBtn: "⏳ جاري المحاكاة لمدة 5 سنوات...",
    runBtnReady: "☀️ احسب نظامي (محاكاة 5 سنوات)",
    errorSim:
      "⚠️ تعذّر تحميل محرك التقدير. حدّث الصفحة (Ctrl+F5) وحاول مرة أخرى.",
    statusSuccess:
      "✅ {years} سنوات من البيانات الساعة ({dataYears}) · {yield} كيلوواط ساعة/سنة لكل كيلوواط من اللوحة.{offline}",
    offlineNote: " · 🌐 وضع السنة النموذجية دون اتصال",
    tariffSpendLine:
      "بسعر {tariff}/كيلوواط/ساعة، تكلفك كهرباؤك حوالي {annual} سنويًا اليوم. كل خيار أدناه يوضح الفاتورة بعد الشمسي ومدى سرعة استرداد التكلفة من الادخار.",
    tariffSpendBattery:
      "بسعر {tariff}/كيلوواط/ساعة، تكلفك كهرباؤك حوالي {annual} سنويًا اليوم. البطارية بدون ألواح تغيّر وقت الاستهلاك؛ ولا تخفّض ما تدفعه.",
    tariffSpendOffgrid:
      "بسعر {tariff}/كيلوواط/ساعة، يكلفك هذا الاستخدام حوالي {annual} سنويًا من كهرباء الشبكة. أرقام الاسترداد أدناه تقارن تكلفة النظام بهذا الإنفاق.",
    tariffSpendFixed:
      " ويشمل ذلك {fixed}/شهريًا في رسوم ثابتة لا تخفضها الطاقة الشمسية.",
    lvlBest: "الاختيار الأفضل",
    lvlCompare: "مقارنة البطاريات",
    lvlMatrix: "كل الخيارات",
    bomPanelTitle: "قائمة المعدات الخاصة بك — مم يتكون هذا النظام",
    genSummary: "أستخدم مولدا — كم تبلغ التكلفة الحقيقية للكهرباء منه؟",
    genApply: "استخدم هذا كسعر الكهرباء لدي",

    // -- Plausibility frontier (spend -> coverage curve) --
    socChartTitle:
      "مستويات شحن البطارية والموثوقية السنوية (محاكاة 5 سنوات من الطقس الحقيقي)",
    frontierTitle: "إلى أين يصل مالك؟",
    frontierIntro:
      "كل نظام يمكن بناؤه في موقعك، من الأرخص إلى الأغلى. يمثل الخط أفضل نتيجة يمكن لأي ميزانية شراؤها، لترى بلمحة واحدة هل هدفك هنا سهل أم مكلف أم بعيد المنال.",
    frontierX: "التكلفة الأولية للنظام",
    frontierYGrid: "نسبة فاتورتك المخفّضة",
    frontierYGridBattery: "نسبة ساعات الذروة المنقولة",
    frontierYOffgrid: "نسبة طاقتك المغطّاة دون مولّد",
    frontierSelTag: "{pv} كيلوواط + {batt} كيلوواط ساعة · {pct}% · {cost}",
    frontierSelNoBatt: "{pv} كيلوواط دون بطارية · {pct}% · {cost}",
    frontierLegendSel: "الخيار المحدد — انقر أي نقطة للاختيار",
    frontierNoSystem:
      "لا يمكن لأي نظام ضمن الأحجام التي تبحث عنها هذه الأداة الوصول إلى هذا الهدف في هذا الموقع. يُظهر المنحنى أدناه أبعد ما يصل إليه هذا الموقع عمليًا — جرّب هدفًا أدنى، أو خطّط لمولد أو اتصال بالشبكة لتغطية ما لا يصل إليه الشمس.",
    simpleInfeasible:
      "في هذا الموقع، لا يوجد نظام يمكن بناؤه يصل إلى هذا الهدف. جرّب نسبة توفير أدنى، أو اطّلع على التفاصيل الكاملة لترى مدى ما يمكن للطاقة الشمسية الوصول إليه فعليًا.",
    simpleWhatItMeans:
      "تُنتج الألواح الكهرباء وقت وجود الشمس؛ وتحملها البطارية إلى المساء والأيام الغائمة. يُحجَّم النظام اعتمادًا على خمس سنوات من بيانات الطقس الساعية بالأقمار الصناعية لموقعك الدقيق.",
    simpleWhatItMeansBattery:
      "لا تولّد البطارية كهرباء بنفسها: تشحن في الساعات الرخيصة وتحفظ تلك الطاقة للساعات الغالية. ويُحجَّم النظام اعتمادًا على خمس سنوات من بيانات الطقس الساعية بالأقمار الصناعية لموقعك الدقيق.",
    simpleCaveat:
      "هذا تقدير وليس وعدًا — جميع الأرقام الكاملة على بُعد نقرة واحدة.",
    simpleSeeDetails: "عرض كل التفاصيل",
    simpleDownloadBom: "تنزيل قائمة القطع (CSV)",
    simpleAskAdvisor: "اسأل مستشار الذكاء الاصطناعي (بكلمات بسيطة)",
    sanityOk: "تم التحقق بشكل مستقل ✓ — معقول فيزيائيًا",
    sanityFlag:
      "⚠ تشير مراجعة ذكاء اصطناعي مستقلة إلى أن هذه النتيجة غير معقولة فيزيائيًا —",
    sanityAskAdvisor: "اسأل المستشار لماذا",
    sanityUncertain:
      "التحقق غير حاسم — لم يتمكن الفحص المستقل بالذكاء الاصطناعي من الوصول إلى حكم واثق بشأن هذه المدخلات",
    sanityTooltip:
      "راجع مصنف ذكاء اصطناعي مستقل (Jev) أرقام التحجيم فقط — لا يخرج من متصفحك أي موقع أو نص أو بيانات شخصية غير هذه الأرقام. لا يغير أبدًا النتيجة المحسوبة.",
    simpleAdvisorStyle:
      "[تعليمات للمستشار: الزائر في الوضع المبسّط. أجب كخبير يتحدث إلى طفل ذكي في الثانية عشرة: كلمات يومية بسيطة، بلا مصطلحات تقنية (اشرح أي مصطلح تقني بين قوسين قصيرين)، أربع جمل قصيرة كحد أقصى، واختم بالرقم الأهم.]",
    advisorTitle: "مستشار الطاقة المجاني بالذكاء الاصطناعي",
    advisorSubtitle:
      "أنت تتحدث إلى ذكاء اصطناعي (محرك Groq) — تقديرات تعليمية فقط وليست استشارة هندسية",
    advisorIntro:
      "أشرح نتائج الحاسبة: نوع بطارية المصدر، الأسلاك والحماية، أو أسئلة تطرحها على فني كهرباء محلي. شغّل التحجيم أولاً ثم اسألني عن هذه النتيجة، أو اسألني أي شيء.",
    advisorBotNote:
      "تقدير من الذكاء الاصطناعي — قد يكون غير دقيق، بما في ذلك الأسعار والمواصفات. ليست هذه نصيحة هندسية. تحقق مع كهربائي أو مهندس مرخص قبل الشراء أو البناء.",
    advisorThinking: "⏳ أفكر...",
    advisorLabel: "اسأل مستشار الذكاء الاصطناعي عن نظامك",
    advisorPlaceholder:
      "اسأل عن الخلايا، أيوني الصوديوم مقابل LFP، تكلفة الشحن...",
    advisorSend: "إرسال",
    advisorClose: "إغلاق مستشار الذكاء الاصطناعي",
    advisorBusyRetry:
      " محرك الذكاء الاصطناعي المجاني مشغول — إعادة المحاولة خلال {secs}s…",
    advisorNoReply: " لم يصل رد. حاول مرة أخرى.",
    advisorBusy:
      " محرك الذكاء الاصطناعي المجاني مزدحم الآن (HTTP {status} — حصة مشتركة).\n\nانتظر نحو دقيقة ثم أرسل الطلب مجدداً.",
    // ── Degraded advisor reply (B2 / R-CF-10) ──────────────────────────
    advisorDegradedLabel: "دون اتصال · ليس الذكاء الحيّ مباشرة",
    advisorDegradedLine: "لا أستطيع الإجابة الآن — {why}.",
    advisorDegradedWhyUnavailable: "الخدمة التي يجيب لم يستجب",
    advisorDegradedWhyNoKey: "لا مفتاح نموذج، فالمشير غير متصل عمدًا",
    advisorDegradedReassure: "لا خطأ في ما سبق وحسابك لم يتأثر.",
    advisorDegradedSystem: "خذ هذه الأرقام إلى كهربائي مرخَّص قبل البناء.",
    advisorIsAi:
      "المستشار نموذج لغوي. يكتب نصًا مقنعًا وقد يذكر أرقامًا خاطئة بثقة. تحقّق من كل رقم — لا تأخذه كحقيقة.",
    advisorDegradedGeneral: "للتحجيم: استخدم الحاسبة أعلاه؛ بلا حساب.",
    advisorDegradedRetry: "أعد المحاولة بعد دقيقة؛ الحصة مشتركة.",
    advisorUnreachable:
      " مستشار الذكاء الاصطناعي غير متاح حالياً{status}.\n\nتحقق من اتصالك وحاول مرة أخرى بعد قليل.",
    frontierCeilingTag: "الأقصى ضمن الأحجام المبحوثة: {pct}%",
    frontierSvgTitle: "إلى أين يصل مالك",
    frontierSvgDesc:
      "منحنى من {n} نظامًا، من {lowCost} يغطي {lowPct}% إلى {highCost} يغطي {highPct}%. الأرقام الكاملة في الجدول أسفل الرسم.",
    frontierPointTip:
      "{cost}: {pct}% — {pv} كيلوواط ألواح + {batt} كيلوواط ساعة بطارية",
    budgetLabel: "ميزانيتك (مقدّمًا)",
    frontierTableCaption:
      "كل نقطة على المنحنى. التكلفة النموذجية هي الوسط للتنفيذ الذاتي بعد الشحن؛ والمدى يمتد من الخلايا المجردة إلى التجزئة المشحونة.",
    frontierColCost: "التكلفة النموذجية",
    frontierColRange: "من الذاتي إلى التجزئة",
    frontierColCut: "خفض الفاتورة",
    frontierColCutBattery: "ساعات الذروة المنقولة",
    frontierColCover: "التغطية",
    frontierColPv: "الألواح",
    frontierColBatt: "البطارية",
    frontierNoBattery: "لا شيء",
    frontierTableToggle: "عرض كل النقاط في جدول",
    frontierLegendCurve: "أرخص نظام يبلغ كل مستوى",
    frontierLegendBand: "الأنظمة نفسها، من الشراء الذاتي إلى التجزئة المشحونة",
    frontierLegendRange: "النطاق الأفضل قيمة — كل نقطة إضافية ما زالت رخيصة",
    frontierBestValueRange:
      "النطاق الأفضل قيمة: ~{lo}–{hi} ({loPct}–{hiPct}%).",
    frontierRangeTag: "أفضل قيمة",
    frontierTagSel: "النقطة المحددة",
    fuelLitLabel: "السعر لكل لتر",
    fuelGalLabel: "السعر لكل غالون",
    fuelReadoutRate: "{type} بهذا السعر يخرج بحوالي {rate} لكل كيلوواط/ساعة",
    fuelReadoutBurn:
      "({entry} ÷ {burn} {unit}/كيلوواط/ساعة — الوقود فقط؛ الزيت والفلاتر وتآكل المحرك ترفع التكلفة الحقيقية)",
    fuelReadoutGrid:
      "كهرباء الشبكة النموذجية تتراوح بين {lo} و{hi} لكل كيلوواط/ساعة.",
    fuelApplyOk:
      "وقود مولّدك يخرج بحوالي {rate}/كيلوواط/ساعة — أُدخل كسعر كهربائك، بحيث يُقارن كل حساب استرداد أدناه بما تدفعه اليوم.",
    frontierLegendCeiling:
      "أقصى ما تبلغه الأحجام المبحوثة، وليس حدًا فيزيائيًا",
    frontierMarkerOffCurve:
      "خيارك يقع يمين المنحنى لأن التوصية تُختار على أساس التكلفة الحقيقية على عشرين عامًا، لا سعر اليوم: مجموعة أرخص تحتاج إلى استبدال تكلف أقل الآن وأكثر لاحقًا.",
    frontierVerdictSteepGrid:
      "خفض نحو {kneePct}% من فاتورتك يكلف قرابة {kneeCost}. بعد ذلك ترتفع التكلفة سريعًا: نحو {tailCost} لكل نقطة إضافية، مقابل {headCost} قبلها.",
    frontierVerdictTaperingGrid:
      "خفض نحو {kneePct}% من فاتورتك يكلف قرابة {kneeCost}. بعد ذلك تكلف كل نقطة إضافية نحو {tailCost}، أي نحو {ratio} ضعف المعدل السابق.",
    frontierVerdictCoveredBattery:
      "الحجم ليس قيدك هنا. أصغر بطارية عملية — {batt} كيلوواط/ساعة، بنحو {cost} — تنقل بالفعل جميع ساعات الذروة لهذا الاستهلاك تقريبًا. أي شيء أكبر يشتري سعة احتياطية، لا نقلًا أكثر.",
    frontierVerdictBeyondSweepBattery:
      "ضمن أحجام البطاريات التي يبحث عنها هذا البرنامج — حتى {battMax} كيلوواط/ساعة — أقصى ما يمكن نقله هنا نحو {ceilingPct}%، بنحو {ceilingCost}. القيمة الجيدة تنتهي قبل ذلك بكثير، عند {kneePct}% بنحو {kneeCost}؛ ونقل المزيد يتطلب مخزونًا أكبر من أي شيء يُقاس هنا.",
    frontierVerdictSteepBattery:
      "نقل نحو {kneePct}% من ساعات الذروة إلى البطارية يكلف قرابة {kneeCost}. بعد ذلك يصبح مكلفًا بسرعة: نحو {tailCost} لكل نقطة إضافية، مقابل {headCost} قبلها.",
    frontierVerdictTaperingBattery:
      "نقل نحو {kneePct}% من ساعات الذروة إلى البطارية يكلف قرابة {kneeCost}. بعد ذلك تكلف كل نقطة إضافية نحو {tailCost} — أي نحو {ratio} ضعف المعدل السابق.",
    frontierVerdictLinearBattery:
      "النقل يواكب الإنفاق بانتظام نسبي هنا — نحو {headCost} لكل نقطة من ساعات الذروة، حتى {ceilingPct}%.",
    frontierVerdictLinearGrid:
      "هنا يسير التوفير مع الإنفاق بانتظام: نحو {headCost} لكل نقطة من فاتورتك، حتى {ceilingPct}%.",
    frontierVerdictBeyondSweepGrid:
      "ضمن الأحجام التي تبحثها هذه الأداة — حتى {pvMax} كيلوواط ألواح و{battMax} كيلوواط ساعة بطارية — أقصى ما يمكن خفضه هنا نحو {ceilingPct}%، بتكلفة قرابة {ceilingCost}. وتنتهي القيمة الجيدة قبل ذلك بكثير، عند {kneePct}% بنحو {kneeCost}. والخفض أكثر ليس مستحيلًا، لكنه يحتاج نظامًا أكبر من كل ما جرى تحجيمه هنا.",
    frontierVerdictSteepOffgrid:
      "تغطية نحو {kneePct}% من طاقتك تكلف قرابة {kneeCost}. المرحلة الأخيرة نحو الاستقلال الكامل هي حيث يذهب المال: نحو {tailCost} لكل نقطة إضافية، مقابل {headCost} قبلها.",
    frontierVerdictTaperingOffgrid:
      "تغطية نحو {kneePct}% من طاقتك تكلف قرابة {kneeCost}. بعد ذلك تكلف كل نقطة إضافية نحو {tailCost}، أي نحو {ratio} ضعف المعدل السابق.",
    frontierVerdictLinearOffgrid:
      "هنا تسير التغطية مع الإنفاق بانتظام: نحو {headCost} لكل نقطة، حتى {ceilingPct}%.",
    frontierVerdictBeyondSweepOffgrid:
      "ضمن الأحجام التي تبحثها هذه الأداة — حتى {pvMax} كيلوواط ألواح و{battMax} كيلوواط ساعة بطارية — أقصى ما يمكن تغطيته هنا نحو {ceilingPct}%، بتكلفة قرابة {ceilingCost}. وتنتهي القيمة الجيدة عند {kneePct}% بنحو {kneeCost}. والاستقلال الكامل ليس مستحيلًا هنا، لكنه يحتاج نظامًا أكبر بكثير، وغالبًا يكون مولّد أو اتصال بالشبكة أرخص وسيلة لتغطية الباقي.",
    frontierMethod:
      "يأتي المنحنى من محاكاة كل توليفة ألواح وبطاريات على شبكة خشنة بنفس الطقس الساعي المستخدم في البطاقات أعلاه، ثم الإبقاء فقط على ما لا يتفوق عليه أي نظام أرخص. وتستخدم الأسعار نفس الوسط للتنفيذ الذاتي المستخدم في بقية الصفحة.",
    frontierMethodBattery:
      "يأتي المنحنى من محاكاة كل حجم بطارية على شبكة خشنة بنفس الطقس الساعي ونوافذ التعرفة المستخدمة في البطاقات أعلاه، ثم الإبقاء فقط على ما لا يتفوق عليه أي نظام أرخص. لا توجد ألواح في هذه الحالة، لذا يغيّر المنحنى حجم البطارية وحده. وتستخدم الأسعار نفس الوسط للتنفيذ الذاتي المستخدم في بقية الصفحة.",
    // -- Cumulative 20-year cost caption (under the chart canvas) --
    cumCostRecommended: "الموصى به",
    cumCostSelected: "المحدد",
    cumCostCaptionHead:
      "التكلفة التراكمية على 20 عامًا للنظام {which} ({label}): الخط الكهرماني هو ما تدفعه للشركة إذا بقيت على الشبكة ({gridTotal}).",
    cumCostCaptionOwnCost:
      "الخط الزمردي هو التكلفة الخاصة بالنظام الشمسي (~{systemTotal})، ويطابق صف “إجمالي التكلفة على 20 عامًا” لهذا النظام.",
    cumCostCaptionOwnCostNoPanels:
      "الخط الزمردي هو التكلفة الخاصة بالنظام (~{systemTotal})، ويطابق صف “إجمالي التكلفة على 20 عامًا” لهذا النظام.",
    cumCostCaptionStack:
      "الشكل الكهرماني كومة — النظام، ثم الفواتير الأصغر التي تبقى بعد الطاقة الشمسية (~{residualBills})، ثم توفيرك — أي أن هذا النظام يعيد إليك {saved} على مدى 20 عامًا.",
    cumCostCaptionStackNoPanels:
      "الشكل الكهرماني كومة — النظام، ثم الفواتير الأصغر التي تبقى (~{residualBills})، ثم توفيرك — أي أن هذا النظام يعيد إليك {saved} على مدى 20 عامًا.",
    cumCostCaptionNetNegative:
      "هنا تسير الكومة في الاتجاه المعاكس: تلك الفواتير المتبقية (~{residualBills}) لا تنخفض بما يكفي أبدًا، لذا يكلفك هذا النظام على مدى 20 عامًا نحو {loss} أكثر من البقاء على الشبكة — مال مُنفَق، لا مال مُوفَّر.",
    cumCostCaptionRepaid:
      "استرد النظام تكلفته بحلول السنة {year} — وكل سنة بعدها تعيد ~{perYear} إلى جيبك. إجمالي التوفير على 20 عامًا: ~{saved}. الأعمدة السفلية هي صافي مركزك: حمراء حتى نقطة التعادل ثم صاعدة.",
    cumCostCaptionNeverRepays:
      "خلال 20 عامًا لا يسترد النظام تكلفته أبدًا — استبدال البطاريات يتجاوز التوفير في الفاتورة، لذا فالجواب الصادق: هنا لا يدفع النظام تكلفته.",
    cumCostCaptionResidual:
      "الخط الرمادي الداكن هو تكلفة الشبكة المتبقية نفسها — نحو {annual} سنويًا مقابل {kwh} كيلوواط ساعة سنويًا لا تزال مسحوبة من الشبكة (بعد خصم رصيد التغذية)، أي {end} على مدى 20 عامًا كاملة.",
    cumCostCaptionResidualCreditDraw:
      "الخط الرمادي الداكن ينزل تحت 0 دولار — صافي القياس: قيمة تغذية فائضك تتجاوز حتى الكمية الصغيرة {kwh} كيلوواط ساعة سنويًا التي لا تزال تستهلكها، فتكسب ~{earned} على مدى 20 عامًا كاملة.",
    cumCostCaptionResidualCreditBill:
      "الخط الرمادي الداكن ينزل تحت 0 دولار — صافي القياس: قيمة تغذية فائضك تتجاوز الفاتورة الصغيرة التي لا تزال تدفعها، فتكسب ~{earned} على مدى 20 عامًا كاملة.",
    cumCostCaptionSurplusCredit:
      "الإجمالي مع الطاقة الشمسية (~{withSolar}) يقع تحت التكلفة الخاصة بالنظام: رصيد تغذية فائضك يتجاوز الفاتورة الصغيرة المتبقية، فتسير الكومة بالسالب وتكون الشركة مدينة لك بنحو ~{owed} في حساب 20 عامًا.",
    frontierVerdictCoveredOffgrid:
      "الحجم ليس قيدك هنا. أصغر نظام عملي — {pv} كيلوواط ألواح و{batt} كيلوواط ساعة بطارية، بنحو {cost} — يغطي هذا الحمل بالكامل طوال العام. وأي شيء أكبر يشتري سعة احتياطية، لا مزيدًا من الاستقلال.",
    frontierVerdictCoveredGrid:
      "الحجم ليس قيدك هنا. أصغر نظام عملي — {pv} كيلوواط ألواح و{batt} كيلوواط ساعة بطارية، بنحو {cost} — يغطي عمليًا كل هذا الحمل. وأي شيء أكبر يشتري سعة احتياطية، لا مزيدًا من التوفير.",
    pipelineLocation: "الموقع",
    pipelineWeather: "الطقس",
    pipelineSimulating: "المحاكاة",
    pipelineRendering: "العرض",
    pipelineElapsed: "مرّت {s} ثانية",
    pipelineCached: "مخزّن",
    pipelineReaching: "جارٍ الاتصال بالقمر الصناعي…",
    pipelineChunks: "{done}/{total} مقاطع فضائية",
    speedNoteRepeat: "⚡ فوري — تكرار دقيق لهذا الإعداد (حُسب الآن)",
    speedNoteCached: "⚡ فوري — طقس الأقمار الصناعية مخزّن",
    speedNoteCachedWhere: "⚡ فوري — طقس الأقمار الصناعية مخزّن لـ {where}",
    speedNoteOffline: "⚡ فوري — سنة نموذجية دون اتصال",
    speedNoteOfflineWhere: "⚡ فوري — سنة نموذجية دون اتصال لـ {where}",
    fmtAllDay: "طوال اليوم (24 ساعة)",
    fmtHoursDay: "{h} ساعة/يوم",
    fmtMinutesDay: "{m} دقيقة/يوم",
    apWattsRunning: "~{w} واط أثناء التشغيل",
    apWatts: "~{w} واط",
    apKwhDay: "{kwh} كيلوواط·ساعة/يوم",
    apAvgW: " (~{w} واط في المتوسط)",
    offgridKwhReadout: "~{kwh} كيلوواط·ساعة/يوم",
    quickBillStarts:
      "يبدأ من ~{bill} (≈{kwh} كيلوواط·ساعة/يوم). ضع فاتورتك الحقيقية هنا، واختر موقعًا، ثم انقر على «حجم نظامي». يظهر منزلق خفض الفاتورة مع النتائج.",
    quickBillManual:
      "تقدير سريع: ~{bill} (يبدأ من ~{kwh} كيلوواط·ساعة/يوم) — بدّل إلى اليدوي لتغيير فاتورتك أو أجهزتك أو التعرفة.",
    dailyEnergyNeed: "الحاجة اليومية من الطاقة (منزلق كيلوواط·ساعة/يوم)",
    billPerMonth: "/شهريًا",
    simpleHeadline: "في موقعك، يمنحك هذا النظام {goal}:",
    simpleGoalGrid: "خفض نحو {pct}% من فاتورتك",
    simpleGoalBattery: "نقل نحو {pct}% من ساعات الذروة إلى البطارية",
    simpleGoalOffgrid: "تغطية منزلك على مدار السنة",
    sharedLocationLoaded:
      "تم تحميل النتيجة المشتركة — بيانات أشعة الشمس لهذا الموقع",
    uiInitFailed: "تنبيه: تعذّر تحميل الواجهة — يرجى تحديث الصفحة (Ctrl+F5).",
    infeasibleAreaTitle: "مساحة السطح/الأرض صغيرة جدًا لهذا الهدف",
    infeasibleAreaBody:
      "حُدّ حجم الطاقة الشمسية المبحوث عنه بحقل المساحة الاختياري (راجع «إعدادات العتاد»). امسح هذا الحقل — أو ارسم مساحة أكبر على الخريطة — ثم أعد التشغيل: الموقع نفسه يمكنه بلوغ هذا الهدف.",
    infeasibleEnvelopeTitle: "خارج نطاق بحث هذه الأداة لهذا الهدف",
    infeasibleEnvelopeBody:
      "عند هذا الاستهلاك، بلوغ الهدف يتطلب مصفوفًا شمسيًا أو بنك بطاريات أكبر مما تبحث عنه هذه الآلة الحاسبة (راجع إعدادات العتاد للحدود). جرّب هدف خفض أقل، أو تحقق من إمكانية تقليل جزء من الاستهلاك.",
    infeasibleNeedsBatteryTitle:
      "الطاقة الشمسية وحدها لا تبلغ 100% خارج الشبكة",
    infeasibleNeedsBatteryBody:
      "المنزل خارج الشبكة يحتاج تخزينًا للّيل والأيام الغائمة. أضف بطارية إلى اختيار العتاد، أو بدّل الهدف إلى «خفض فاتورتي، ابقَ موصولًا» (موصول بالشبكة).",
    infeasibleNeedsPanelsTitle: "البطارية وحدها لا تعمل خارج الشبكة",
    infeasibleNeedsPanelsBody:
      "لا شيء يعيد شحن البنك في هذا الموقع. أضف ألواحًا إلى اختيار العتاد، أو بدّل الهدف إلى «خفض فاتورتي، ابقَ موصولًا» (موصول بالشبكة).",
    infeasibleNeedsSurplusTitle: "بنك البطاريات وحده لا ينتج فائضًا",
    infeasibleNeedsSurplusBody:
      "الفائض يحتاج ألواحًا تولّد أكثر من استهلاكك. اخفض الهدف دون 100% في منزلق خفض الفاتورة، أو بدّل إعداد العتاد إلى «شمسي + بطارية».",
    infeasibleGenericTitle: "هذا المزيج من العتاد والهدف لا حلّ له",
    infeasibleGenericBody: "غيّر الهدف أو العتاد، ثم أعد التشغيل.",

    pathsLabel_turnkey: "مُثبِّت، تسليم كامل",
    pathsLabel_lease: "إيجار أو عقد شراء",
    pathsLabel_selfpurchase: "أنت تشتري القطع",
    pathsLabel_diy: "أنت تركّب، وكهربائي يوصّل",
    pathsTitle: "أربع طرق لدفع ثمن النظام نفسه",
    pathsSub:
      "نظام واحد، وتعريف واحد، وعشرون سنة. الفرق بين هذه البطاقات فرق في السعر، لا اختلاف في ما تحسبه كل واحدة.",
    pathsCheapest: "الأرخص",
    pathsSpend20: "تكلفة 20 عامًا",
    pathsRowIncentives: "حوافز",
    pathsRowBillCut: "خفض الفاتورة",
    pathsRowBreakEven: "نقطة التعادل",
    pathsRowNet: "صافي 20 عامًا",
    pathsRowOwnership: "الملكية",
    pathsRowEndOfTerm: "في النهاية",
    pathsCountsHeading: "ما يشمله هذا السعر",
    pathsInstrumentLabel: "طريق الغير:",
    pathsGradeNote:
      "كل رقم أعلاه يأتي من سجل أسعار إقليمي واحد بمصدر مذكور ودرجة ثقة. العتاد هو تقديرك أنت؛ أما العمل والتراخيص والحوافز والاستبدال فهي أرقام السجل. ولا شيء هنا عرض سعر من بائع.",
    pathsWhy:
      "{cheaper} أرخص بمقدار {gap} من {dearer} على 20 عامًا، والسبب الأهم هو {driver}.",
    pathsWhyCombined: " لا يفسّر عنصر واحد وحده الفرق كاملًا.",
    pathsDriver_year0: "سعر البداية",
    pathsDriver_incentives: "الجهة التي تذهب إليها الحوافز",
    pathsDriver_om: "الصيانة",
    pathsDriver_replacements: "استبدال البطاريات والعاكسات",
    pathsDriver_leasePayments: "الأقساط التي تدفعها",
    pathsDriver_none: "لا عنصر بعينه",
    pathsInstrumentPpa: "عقد شراء الطاقة",
    pathsInstrumentLease: "إيجار (تستأجر النظام)",
    pathsEndOfTermBuyout:
      "السنة {years}: يمكنك شراؤه مقابل {buyoutPct}% من سعر التركيب، وهذا الشراء مُحتسب أصلًا في هذا الرقم.",
    pathsEndOfTermStillLeasing:
      "في السنة {years} لا يزال العقد ساريًا، لذا لا يُحتسب أي شراء. وبعد 20 عامًا ستظل مدينًا بأقساط.",
    pathsOwnershipTurnkey: "أنت تملكه من اليوم الأول.",
    pathsOwnershipPpa: "المزوّد هو المالك ويتولى الصيانة.",
    pathsOwnershipLease: "تستأجره حتى نهاية العقد ثم تشتريه أو تعيده.",
    pathsOwnershipSelf: "تملكه بعد تركيبه.",
    pathsIncentiveTaxCredit: "ائتمان ضريبي فيدرالي",
    pathsIncentiveRebate: "خصم من شركة الكهرباء",
    pathsIncentivesToProvider: "الحوافز تذهب إلى المزوّد لا إليك.",
    pathsIncentivesGoToProvider: "المزوّد يحتفظ بها — وأنت لا تملك شيئًا.",
    pathsNoIncentive: "لا ينطبق أي منها على هذه الطريقة.",
    pathsNoVerifiedIncentive: "لا يوجد لدينا حافز موثّق لمنطقتك.",
    pathsUnknown: "غير معروف",
    pathsNotWithinHorizon: "ليس خلال 20 عامًا",
    pathsBreakEvenYear: "السنة {year}",
    pathsUnavailable: "غير متاح",
    pathsNoSystem: "لا يوجد نظام لتسعيره.",
    pathsNoTariff:
      "يحتاج عقد الشراء إلى سعر كهرباء ليُسعَّر بمقابله، لذلك لا يظهر هنا.",
    pathsDiyNotPermitted:
      "غير معروضة هنا: في منطقتك يجب أن ينفّذ العمل الكهربائي مُثبِّت مرخّص.",
    pathsDiyRestricted: "غير معروضة هنا: التركيب الذاتي مقيّد في منطقتك.",
    pathsDiyUnknown:
      "غير معروضة هنا: تعذّر التحقق مما إذا كان بإمكانك تركيب ألواحك بنفسك.",
    pathsNoteTurnkeyAllIn:
      "سعر واحد شامل: نفس العتاد، إضافة إلى العمل والتراخيص وهامش المُثبِّت.",
    pathsIncludesInstalledAllIn: "القطع والعمل والتراخيص، بعد التركيب",
    pathsIncludesProviderSwaps: "المزوّد يصون ويستبدل البطارية والعاكس",
    pathsIncludesIncentivesToProvider: "الحوافز تذهب إلى المزوّد لا إليك",
    pathsIncludesIncentivesIfEligible: "الحوافز، إن كنت مؤهلًا لها",
    pathsIncludesNoYear0Hardware: "دون شراء عتاد مقدمًا",
    pathsIncludesEndOfTerm: "خيار نهاية العقد مُحتسب في السعر",
    pathsIncludesHardwareYouBuy: "العتاد الذي تشتريه بنفسك",
    pathsIncludesElectricianInstalls: "كهربائي مرخّص يتولى التركيب",
    pathsIncludesPermitsAndInterconnection: "التراخيص، الفحص، والربط بالشبكة",
    pathsIncludesYouDoSwaps: "أنت تنظّم وتدفع استبدال البطاريات",
    pathsIncludesYouMountTheArray: "أنت تركّب الألواح بنفسك",
    pathsIncludesElectricianConnects: "كهربائي يتولى عملية الربط",
    pathsIncludesToolsAndSafety: "الأدوات ومعدات السلامة",
  },
};
