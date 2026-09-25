// UI strings for the static chrome of the sizer page. The AI advisor already
// answers in any language; this file covers the fixed interface around it.
// `ar` flips the document to RTL automatically.
// Keys not present in a locale fall back to English silently.

export const LOCALES = {
  en: {
    navSizing: "Size Your System",
    navSupport: "Support",
    cutLabel: "Your bill-cut target",
    fxCodeLabel: "Currency code:",
    firstRunNote:
      "Choose your location and energy use, then click Size My System. The first run downloads ~2 MB of satellite weather data and caches it in your browser.",
    navBom: "Hardware Reference",
    navBlog: "Blog",
    navLegal: "Terms & Disclaimer",
    heroTag: "🌍 Free for everyone, everywhere • No signup • Nothing for sale",
    ctaStart: "Start a Free Estimate",
    pickCity: "Pick a city (or use 📍 My location) so we know your sunshine.",
    shareLoaded:
      "Shared setup loaded. Review the inputs, then click Size My System to calculate.",
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
    bomPanelTitle: "Your hardware list \u2014 what this system is made of",
    bomDownload: "Download parts list (CSV)",
    genSummary: "I run a generator \u2014 what does its power really cost?",
    genApply: "Use this as my electricity price",

    // -- Plausibility frontier (spend -> coverage curve) --
    socChartTitle:
      "Battery Charge Levels & Year-Round Reliability (5-Year Real Weather)",
    frontierTitle: "How far does your money get you?",
    frontierIntro:
      "Every system we could build at your location, cheapest first. The line is the best result any budget can buy — so you can see at a glance whether your goal here is easy, expensive, or out of reach.",
    frontierX: "Up-front system cost",
    frontierYGrid: "Share of your power bill cut",
    frontierYOffgrid: "Share of your energy covered, no generator",
    frontierTagSel: "selected",
    frontierSelTag: "{pv} kW + {batt} kWh · {pct}% · {cost}",
    frontierSelNoBatt: "{pv} kW, no battery · {pct}% · {cost}",
    frontierLegendSel: "Selected option — click any point to choose it",
    frontierNoSystem:
      "No system inside the sizes this tool searches can reach this target at this location. The curve below shows the furthest this site can practically get — try a lower target, or plan a generator or grid connection to cover what solar can't.",
    simpleInfeasible:
      "At this location, no system we can build reaches that goal. Try a lower bill-cut target — or read the full details for how close solar can actually get.",
    simpleWhatItMeans:
      "Panels make power when the sun is out; the battery carries it into the evening and cloudy days. The system is sized from five years of hourly satellite weather at your exact location.",
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
    frontierColCover: "Covered",
    frontierColPv: "Panels",
    frontierColBatt: "Battery",
    frontierNoBattery: "none",
    frontierTableToggle: "Show every point as a table",
    frontierLegendCurve: "Cheapest system that reaches each level",
    frontierLegendBand: "Same systems, DIY sourcing to shipped retail",
    frontierLegendRange: "Best-value range — every extra percent still cheap",
    frontierRangeTag: "best value",
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
  },
  es: {
    navSizing: "Dimensiona tu sistema",
    navSupport: "Soporte",
    cutLabel: "Tu objetivo de reducción de factura",
    fxCodeLabel: "Código de moneda:",
    firstRunNote:
      "Elige tu ubicación y tu consumo, y pulsa Dimensionar mi sistema. La primera ejecución descarga ~2 MB de datos satelitales y luego los guarda en tu navegador.",
    navBom: "Referencia de hardware",
    navBlog: "Blog",
    navLegal: "Términos y aviso legal",
    heroTag:
      "Gratis para todos, en todo el mundo · Sin registro · Nada en venta",
    ctaStart: "Empieza tu estimación gratis",
    pickCity:
      "Elige una ciudad (o usa 📍 Mi ubicación) para que sepamos tu insolación.",
    shareLoaded:
      "Configuración compartida cargada. Revisa los datos y pulsa Dimensionar mi sistema para calcular.",
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
    offlineCity: "usando perfil típico de {city}",
    assumptionsPrefix:
      "Datos: {source}, horario {dataYears}. Derates aplicados: ensuciamiento {soil}%, cableado {wire}%, desajuste {mismatch}%, MPPT {mppt}%. Modelo de temperatura: NOCT {noct}°C, coef. temp. {gamma}%/°C. Eficiencia inversor {eta}%. Carga bloqueada bajo límite de frío de la química (LFP 0°C). Base de carga: {basis}. Costes desde {basisLabel} ({source}) — el extremo bajo es componentes antes de flete/arancel/BMS, el alto es retail con BMS y caja. ",
    moneyPrefix: "",
    capacityNotePrefix: "",
    fxNotePrefix: " ",
    offlineNotePrefix:
      "MODO OFFLINE: esta ejecución usó el perfil típico anual para {offlineCity} — una aproximación cercana, no tu sitio exacto. Vuelve a ejecutar online para cinco años de clima puntual. ",
    tariffSpend: "El gasto en red asume ${tariff}/kWh a {dailyKwh} kWh/día.",
    noTariff: "Sin tarifa introducida, no se muestra amortización.",
    currencyNote:
      "Las cantidades se muestran en {code} a {rate} por 1 US$; las tarifas unitarias de batería se quedan en $/kWh porque los ámbitos de precio base son en USD.",
    capacityNote: "",
    offlineLabel:
      "MODO OFFLINE: esta ejecución usó el perfil típico anual para {offlineCity} — una aproximación cercana, no tu sitio exacto. Vuelve a ejecutar online para cinco años de clima puntual. ",
    tariffSpendLine:
      "A {tariff}/kWh, tu electricidad te cuesta unos {annual} al año hoy. Cada opción de abajo muestra la factura tras la solar y cuánto tarda en pagarse con los ahorros.",
    tariffSpendBattery:
      "A {tariff}/kWh, tu electricidad te cuesta unos {annual} al año hoy. Una batería sin paneles cambia cuándo consumes; no reduce lo que pagas.",
    noTariffLine: "Sin tarifa introducida, no se muestra amortización.",
    goalLabel: "¿Qué quieres que haga este sistema?",
    goalOffgrid: "Abastecerme totalmente sin red",
    goalGridtie: "Reducir mi factura manteniendo la conexión",
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
    locNotePrefix: "Clima estimado para ",
    locNoteSuffix: " — cambia la ciudad arriba si es necesario.",
    chemLabel: "Química de la batería:",
    tariffLabel: "Precio de la electricidad donde vives:",
    tariffNote:
      "Precio estimado para {label} — cámbialo arriba si conoces tu tarifa.",
    fxNote:
      "Cantidades mostradas en {code} a {rate} por 1 US$; las tarifas unitarias de batería siguen en $/kWh porque los precios base son en USD.",
    lvlBest: "Mejor opción",
    lvlCompare: "Comparar baterías",
    lvlMatrix: "Todas las opciones",
    bomPanelTitle: "Tu lista de hardware — de qué está hecho este sistema",
    bomDownload: "Descargar lista de piezas (CSV)",
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
    frontierYOffgrid: "Parte de tu energía cubierta, sin generador",
    frontierTagSel: "seleccionado",
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
    frontierColCover: "Cubierto",
    frontierColPv: "Paneles",
    frontierColBatt: "Batería",
    frontierNoBattery: "ninguna",
    frontierTableToggle: "Ver todos los puntos en una tabla",
    frontierLegendCurve: "El sistema más barato que alcanza cada nivel",
    frontierLegendBand: "Los mismos sistemas, de compra DIY a retail enviado",
    frontierLegendRange: "Rango óptimo — cada punto extra sigue barato",
    frontierRangeTag: "mejor valor",
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
  },
  pt: {
    navSizing: "Dimensione seu sistema",
    navSupport: "Suporte",
    cutLabel: "Sua meta de redução da conta",
    fxCodeLabel: "Código da moeda:",
    firstRunNote:
      "Escolha sua localização e seu consumo e clique em Dimensionar meu sistema. A primeira execução baixa ~2 MB de dados de clima por satélite e depois os guarda no navegador.",
    navBom: "Referência de hardware",
    navBlog: "Blog",
    navLegal: "Termos e aviso legal",
    heroTag:
      "Grátis para todos, no mundo inteiro · Sem cadastro · Nada à venda",
    ctaStart: "Comece sua estimativa grátis",
    goalLabel: "O que você quer que este sistema faça?",
    goalOffgrid: "Me alimentar totalmente fora da rede",
    goalGridtie: "Reduzir minha conta permanecendo conectado",
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
    locNotePrefix: "Clima estimado para ",
    locNoteSuffix: " — mude a cidade acima se necessário.",
    chemLabel: "Química da bateria:",
    tariffLabel: "Preço da eletricidade onde você mora:",
    tariffNote:
      "Preço estimado para {label} — mude acima se souber sua tarifa.",
    fxNote:
      "Valores mostrados em {code} a {rate} por 1 US$; taxas unitárias de bateria permanecem em $/kWh porque os preços base são em USD.",
    pickCity:
      "Escolha uma cidade (ou use 📍 Minha localização) para sabermos sua insolação.",
    shareLoaded:
      "Configuração compartilhada carregada. Confira os dados e clique em Dimensionar meu sistema para calcular.",
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
    offlineCity: "usando perfil típico de {city}",
    assumptionsPrefix:
      "Dados: {source}, horário {dataYears}. Derates aplicados: sujeira {soil}%, fiação {wire}%, descompasso {mismatch}%, MPPT {mppt}%. Modelo de temperatura: NOCT {noct}°C, coef. temp. {gamma}%/°C. Eficiência do inversor {eta}%. Carga bloqueada abaixo do limite de frio da química (LFP 0°C). Base de carga: {basis}. Custos de {basisLabel} ({source}) — o extremo baixo é componentes antes de frete/imposto/BMS, o alto é varejo com BMS e caixa. ",
    moneyPrefix: "",
    capacityNotePrefix: "",
    fxNotePrefix: " ",
    offlineNotePrefix:
      "MODO OFFLINE: esta execução usou o perfil típico anual para {offlineCity} — uma aproximação próxima, não seu local exato. Rode novamente online para cinco anos de clima pontual. ",
    tariffSpend: "O gasto na rede assume ${tariff}/kWh a {dailyKwh} kWh/dia.",
    noTariff: "Sem tarifa informada, não há amortização mostrada.",
    currencyNote:
      "Valores mostrados em {code} a {rate} por 1 US$; taxas unitárias de bateria permanecem em $/kWh porque os preços base são em USD.",
    capacityNote: "",
    offlineLabel:
      "MODO OFFLINE: esta execução usou o perfil típico anual para {offlineCity} — uma aproximação próxima, não seu local exato. Rode novamente online para cinco anos de clima pontual. ",
    tariffSpendLine:
      "A {tariff}/kWh, a sua eletricidade custa cerca de {annual} por ano hoje. Cada opção abaixo mostra a conta após a solar e em quanto tempo ela se paga com as economias.",
    tariffSpendBattery:
      "A {tariff}/kWh, a sua eletricidade custa cerca de {annual} por ano hoje. Uma bateria sem painéis muda quando consome; não reduz o que paga.",
    noTariffLine: "Sem tarifa informada, não há amortização mostrada.",
    tariffSpendOffgrid:
      "A {tariff}/kWh, este uso custa cerca de {annual} por ano em energia da rede. Os valores de retorno abaixo comparam o custo do sistema com esse gasto.",
    tariffSpendFixed:
      " Isso inclui {fixed}/mês em encargos fixos que o solar não reduz.",
    lvlBest: "Melhor escolha",
    lvlCompare: "Comparar baterias",
    lvlMatrix: "Todas as opções",
    bomPanelTitle: "Sua lista de hardware — do que este sistema é feito",
    bomDownload: "Baixar lista de peças (CSV)",
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
    frontierYOffgrid: "Parte da sua energia coberta, sem gerador",
    frontierTagSel: "selecionado",
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
    frontierColCover: "Coberto",
    frontierColPv: "Painéis",
    frontierColBatt: "Bateria",
    frontierNoBattery: "nenhuma",
    frontierTableToggle: "Ver todos os pontos em tabela",
    frontierLegendCurve: "O sistema mais barato que atinge cada nível",
    frontierLegendBand: "Os mesmos sistemas, de compra DIY a varejo entregue",
    frontierLegendRange: "Faixa ideal — cada ponto extra continua barato",
    frontierRangeTag: "melhor valor",
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
  },
  fr: {
    navSizing: "Dimensionner mon système",
    navSupport: "Assistance",
    cutLabel: "Votre objectif de réduction de facture",
    fxCodeLabel: "Code de devise :",
    firstRunNote:
      "Choisissez votre lieu et votre consommation, puis cliquez sur Dimensionner. Le premier lancement télécharge ~2 Mo de données météo satellite et les met ensuite en cache.",
    navBom: "Référence matériel",
    navBlog: "Blog",
    navLegal: "Conditions et avertissement",
    heroTag: "Gratuit pour tous, partout · Sans inscription · Rien à vendre",
    ctaStart: "Lancer une estimation gratuite",
    goalLabel: "Que doit faire ce système ?",
    goalOffgrid: "Me rendre totalement autonome",
    goalGridtie: "Réduire ma facture en restant raccordé",
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
    locNotePrefix: "Climat estimé pour ",
    locNoteSuffix: " — changez la ville ci-dessus si nécessaire.",
    chemLabel: "Chimie de la batterie :",
    tariffLabel: "Prix de l'électricité chez vous :",
    tariffNote:
      "Prix estimé pour {label} — changez-le ci-dessus si vous connaissez votre tarif.",
    fxNote:
      "Montants affichés en {code} à {rate} pour 1 US$ ; les taux unitaires de batterie restent en $/kWh car les prix de base sont en USD.",
    pickCity:
      "Choisissez une ville (ou utilisez 📍 Ma position) pour connaître votre ensoleillement.",
    shareLoaded:
      "Configuration partagée chargée. Vérifiez les entrées, puis cliquez sur Dimensionner pour calculer.",
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
    offlineCity: "utilisation du profil typique de {city}",
    assumptionsPrefix:
      "Données : {source}, horaires {dataYears}. Derates appliqués : salissure {soil}%, câblage {wire}%, désaccord {mismatch}%, MPPT {mppt}%. Modèle de température : NOCT {noct}°C, coef. temp. {gamma}%/°C. Efficacité onduleur {eta}%. Charge bloquée sous la limite de froid de la chimie (LFP 0°C). Base de charge : {basis}. Coûts de {basisLabel} ({source}) — le bas est composants avant fret/droits/BMS, le haut est détail avec BMS et boîte. ",
    moneyPrefix: "",
    capacityNotePrefix: "",
    fxNotePrefix: " ",
    offlineNotePrefix:
      "MODE HORS LIGNE : cette exécution a utilisé le profil annuel typique pour {offlineCity} — une approximation proche, pas votre site exact. Relancez en ligne pour cinq ans de météo précise. ",
    tariffSpend:
      "La dépense réseau suppose ${tariff}/kWh à {dailyKwh} kWh/jour.",
    noTariff: "Aucun tarif saisi, pas d'amortissement affiché.",
    currencyNote:
      "Montants affichés en {code} à {rate} pour 1 US$ ; les taux unitaires de batterie restent en $/kWh car les prix de base sont en USD.",
    capacityNote: "",
    offlineLabel:
      "MODE HORS LIGNE : cette exécution a utilisé le profil annuel typique pour {offlineCity} — une approximation proche, pas votre site exact. Relancez en ligne pour cinq ans de météo précise. ",
    tariffSpendLine:
      "À {tariff}/kWh, votre électricité coûte environ {annual} par an aujourd'hui. Chaque option ci-dessous montre la facture après le solaire et combien de temps elle se rembourse grâce aux économies.",
    tariffSpendBattery:
      "À {tariff}/kWh, votre électricité coûte environ {annual} par an aujourd'hui. Une batterie sans panneaux décale le moment où vous consommez ; elle ne réduit pas ce que vous payez.",
    noTariffLine: "Aucun tarif saisi, pas d'amortissement affiché.",
    tariffSpendOffgrid:
      "À {tariff}/kWh, cet usage coûte environ {annual} par an en électricité du réseau. Les délais de retour ci-dessous comparent le coût du système à cette dépense.",
    tariffSpendFixed:
      " Dont {fixed}/mois de charges fixes que le solaire ne réduit pas.",
    lvlBest: "Meilleur choix",
    lvlCompare: "Comparer les batteries",
    lvlMatrix: "Toutes les options",
    bomPanelTitle: "Votre liste de matériel — de quoi ce système est composé",
    bomDownload: "Télécharger la liste des pièces (CSV)",
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
    frontierYOffgrid: "Part de votre énergie couverte, sans groupe électrogène",
    frontierTagSel: "sélectionné",
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
    frontierColCover: "Couvert",
    frontierColPv: "Panneaux",
    frontierColBatt: "Batterie",
    frontierNoBattery: "aucune",
    frontierTableToggle: "Voir tous les points en tableau",
    frontierLegendCurve: "Le système le moins cher atteignant chaque niveau",
    frontierLegendBand: "Les mêmes systèmes, de l'achat DIY au détail livré",
    frontierLegendRange:
      "Plage optimale — chaque point en plus reste bon marché",
    frontierRangeTag: "meilleur rapport",
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
  },
  de: {
    navSizing: "System dimensionieren",
    navSupport: "Hilfe",
    cutLabel: "Ziel für die Rechnungssenkung",
    fxCodeLabel: "Währungscode:",
    firstRunNote:
      "Wählen Sie Standort und Verbrauch und klicken Sie auf System dimensionieren. Beim ersten Start werden Satelliten-Wetterdaten geladen und im Browser gespeichert.",
    navBom: "Hardware-Referenz",
    navBlog: "Blog",
    navLegal: "Bedingungen & Haftungsausschluss",
    heroTag:
      "🌍 Kostenlos für alle, überall · Keine Anmeldung · Nichts zu verkaufen",
    ctaStart: "Kostenlose Schätzung starten",
    pickCity:
      "Wähle eine Stadt oder nutze 📍 deinen Standort für die Sonnendaten.",
    shareLoaded:
      "Geteilte Einstellungen geladen. Prüfe die Eingaben und klicke dann auf System dimensionieren.",
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
    goalOffgrid: "Vollständig unabhängig vom Netz",
    goalGridtie: "Rechnung senken, am Netz bleiben",
    chemLabel: "Batteriechemie:",
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
    bomDownload: "Teileliste herunterladen (CSV)",
    genSummary: "Ich habe einen Generator — was kostet sein Strom wirklich?",
    genApply: "Als meinen Strompreis übernehmen",
    socChartTitle:
      "Batterieladung & Zuverlässigkeit übers Jahr (5 Jahre echtes Wetter)",
    frontierTitle: "Wie weit reicht dein Budget?",
    frontierIntro:
      "Wir zeigen die günstigsten Systeme für deinen Standort, damit du Kosten und erreichbare Versorgung vergleichen kannst.",
    frontierX: "Systemkosten zu Beginn",
    frontierYGrid: "Anteil der Rechnung gesenkt",
    frontierYOffgrid: "Anteil der Energie ohne Generator",
    frontierTagSel: "ausgewählt",
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
    frontierColCover: "Abgedeckt",
    frontierColPv: "Panels",
    frontierColBatt: "Batterie",
    frontierNoBattery: "keine",
    frontierTableToggle: "Alle Punkte als Tabelle anzeigen",
    frontierLegendCurve: "Günstigstes System für jede Stufe",
    frontierLegendBand: "Dieselben Systeme, von Selbstbau bis Versandhandel",
    frontierLegendRange:
      "Bestwert-Spanne — jedes weitere Prozent bleibt günstig",
    frontierRangeTag: "Bestwert",
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
  },
  ar: {
    rtl: true,
    navSizing: "صمّم نظامك",
    navSupport: "الدعم",
    cutLabel: "هدف خفض الفاتورة",
    fxCodeLabel: "رمز العملة:",
    firstRunNote:
      "اختر موقعك واستهلاكك ثم اضغط صمّم نظامك. أول تشغيل يُنزّل حوالي 2 ميغابايت من بيانات الطقس الساتلية ثم يخزّنها في متصفحك.",
    navBom: "مرجع المكونات",
    navBlog: "المدونة",
    navLegal: "الشروط وإخلاء المسؤولية",
    heroTag: "مجاني للجميع، في كل مكان · بدون تسجيل · لا شيء للبيع",
    ctaStart: "ابدأ تقديرًا مجانيًا",
    goalLabel: "ماذا تريد من هذا النظام؟",
    goalOffgrid: "تغذيتي بالكامل خارج الشبكة",
    goalGridtie: "خفض فاتورتي مع البقاء متصلًا",
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
    locNotePrefix: "المناخ المقدر لـ ",
    locNoteSuffix: " — غير المدينة أعلاه إذا لزم الأمر.",
    chemLabel: "نوع البطارية:",
    tariffLabel: "سعر الكهرباء في منطقتك:",
    tariffNote: "سعر تقديري لـ {label} — غيّره أعلاه إذا كنت تعرف تعريفتك.",
    fxNote:
      "المبالغ معروضة بـ {code} بسعر {rate} مقابل 1 دولار أمريكي؛ أسعار وحدات البطارية تبقى بالدولار للكيلوواط ساعة لأن الأسعار الأساسية بالدولار.",
    pickCity: "اختر مدينة (أو استخدم 📍 موقعي) لمعرفة إشعاعك الشمسي.",
    shareLoaded:
      "تم تحميل الإعدادات المشتركة. راجع المدخلات ثم اضغط احسب نظامي لبدء الحساب.",
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
    offlineNote: " · 🌐 وضع عدم الاتصال التقليدي",
    offlineCity: "باستخدام الملف النموذجي لـ {city}",
    assumptionsPrefix:
      "البيانات: {source}، بالساعة {dataYears}. ديارات مطبق: اتساخ {soil}%، أسلاك {wire}%، عدم تطابق {mismatch}%، MPPT {mppt}%. نموذج درجة الحرارة: NOCT {noct}°C، معامل حراري {gamma}%/°C. كفاءة العاكس {eta}%. الشحن ممنوع تحت حد كيمياء البرودة (LFP 0°C). أساس الحمل: {basis}. التكاليف من {basisLabel} ({source}) — الطرف المنخفض هو المكونات قبل الشحن/الرسوم/BMS، الطرف العالي هو البيع بالتجزئة مع BMS والصندوق. ",
    moneyPrefix: "",
    capacityNotePrefix: "",
    fxNotePrefix: " ",
    offlineNotePrefix:
      "وضع عدم الاتصال: استخدم هذا الملف السنوي النموذجي لـ {offlineCity} — تقريب قريب، ليس موقعك الدقيق. أعد التشغيل على الإنترنت لخمس سنوات من الطقس الدقيق. ",
    tariffSpend:
      "الإنفاق على الشبكة يفترض ${tariff}/كيلوواط ساعة عند {dailyKwh} كيلوواط ساعة/يوم.",
    noTariff: "لم يتم إدخال تعريفة، لا يتم عرض فترة الاسترداد.",
    currencyNote:
      "المبالغ معروضة بـ {code} بسعر {rate} مقابل 1 دولار أمريكي؛ أسعار وحدات البطارية تبقى بالدولار للكيلوواط ساعة لأن الأسعار الأساسية بالدولار.",
    capacityNote: "",
    offlineLabel:
      "وضع عدم الاتصال: هذه العملية استخدم الملف السنوي النموذجي لـ {offlineCity} — تقريب قريب، ليس موقعك الدقيق. أعد التشغيل على الإنترنت لخمس سنوات من الطقس الدقيق. ",
    tariffSpendLine:
      "بسعر {tariff}/كيلوواط/ساعة، تكلفك كهرباؤك حوالي {annual} سنويًا اليوم. كل خيار أدناه يوضح الفاتورة بعد الشمسي ومدى سرعة استرداد التكلفة من الادخار.",
    tariffSpendBattery:
      "بسعر {tariff}/كيلوواط/ساعة، تكلفك كهرباؤك حوالي {annual} سنويًا اليوم. البطارية بدون ألواح تغيّر وقت الاستهلاك؛ ولا تخفّض ما تدفعه.",
    noTariffLine: "لم يتم إدخال تعريفة، لا يتم عرض فترة الاسترداد.",
    tariffSpendOffgrid:
      "بسعر {tariff}/كيلوواط/ساعة، يكلفك هذا الاستخدام حوالي {annual} سنويًا من كهرباء الشبكة. أرقام الاسترداد أدناه تقارن تكلفة النظام بهذا الإنفاق.",
    tariffSpendFixed:
      " ويشمل ذلك {fixed}/شهريًا في رسوم ثابتة لا تخفضها الطاقة الشمسية.",
    lvlBest: "الاختيار الأفضل",
    lvlCompare: "مقارنة البطاريات",
    lvlMatrix: "كل الخيارات",
    bomPanelTitle: "قائمة المعدات الخاصة بك — مم يتكون هذا النظام",
    bomDownload: "تنزيل قائمة القطع (CSV)",
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
    frontierYOffgrid: "نسبة طاقتك المغطّاة دون مولّد",
    frontierTagSel: "النقطة المحددة",
    frontierSelTag: "{pv} كيلوواط + {batt} كيلوواط ساعة · {pct}% · {cost}",
    frontierSelNoBatt: "{pv} كيلوواط دون بطارية · {pct}% · {cost}",
    frontierLegendSel: "الخيار المحدد — انقر أي نقطة للاختيار",
    frontierNoSystem:
      "لا يمكن لأي نظام ضمن الأحجام التي تبحث عنها هذه الأداة الوصول إلى هذا الهدف في هذا الموقع. يُظهر المنحنى أدناه أبعد ما يصل إليه هذا الموقع عمليًا — جرّب هدفًا أدنى، أو خطّط لمولد أو اتصال بالشبكة لتغطية ما لا يصل إليه الشمس.",
    simpleInfeasible:
      "في هذا الموقع، لا يوجد نظام يمكن بناؤه يصل إلى هذا الهدف. جرّب نسبة توفير أدنى، أو اطّلع على التفاصيل الكاملة لترى مدى ما يمكن للطاقة الشمسية الوصول إليه فعليًا.",
    simpleWhatItMeans:
      "تُنتج الألواح الكهرباء وقت وجود الشمس؛ وتحملها البطارية إلى المساء والأيام الغائمة. يُحجَّم النظام اعتمادًا على خمس سنوات من بيانات الطقس الساعية بالأقمار الصناعية لموقعك الدقيق.",
    simpleCaveat:
      "هذا تقدير وليس وعدًا — جميع الأرقام الكاملة على بُعد نقرة واحدة.",
    simpleSeeDetails: "عرض كل التفاصيل",
    simpleDownloadBom: "تنزيل قائمة القطع (CSV)",
    simpleAskAdvisor: "اسأل مستشار الذكاء الاصطناعي (بكلمات بسيطة)",
    sanityOk: "تم التحقق بشكل مستقل ✓ — plausible من الناحية الفيزيائية",
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
    frontierColCover: "التغطية",
    frontierColPv: "الألواح",
    frontierColBatt: "البطارية",
    frontierNoBattery: "لا شيء",
    frontierTableToggle: "عرض كل النقاط في جدول",
    frontierLegendCurve: "أرخص نظام يبلغ كل مستوى",
    frontierLegendBand: "الأنظمة نفسها، من الشراء الذاتي إلى التجزئة المشحونة",
    frontierLegendRange: "النطاق الأفضل قيمة — كل نقطة إضافية ما زالت رخيصة",
    frontierRangeTag: "أفضل قيمة",
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
  },
};
