// Reader-visible copy from index.html, separate from the short control labels.
// Keep each locale complete so switching language never leaves long-form copy in English.
export const HOME_COPY = {
  en: {
    homeIntro:
      "Enter your location and average electric bill. We simulate 5 years of hourly NASA satellite weather to size the exact solar panel array and battery storage you need — with honest 20-year payback, battery replacement cadence, and equipment costs in your local currency.",
    quickSetupTitle: "⚡ Quick setup",
    quickSetupHint: "— choose inputs, then click Size My System",
    preciseLocationHelp:
      "The precise-location button fills your exact coordinates and pulls area prices from the nearest reference region. For another place, type a city or town and press Enter or Tab to resolve it. Then click Size My System to calculate.",
    imageryPrivacy:
      "Satellite imagery (no account needed) loads only after you ask for it. Coordinates go to the map tiles and NASA weather; nothing is saved.",
    locationPrecision:
      "A city lookup is convenient, but your exact location gives the most precise weather and solar estimate. Enter custom latitude and longitude manually, or use Use my current location for browser GPS.",
    monthlyBillLabel:
      "Your monthly electric bill — rough is fine, it auto-adjusts to your location's prices",
    electricityRateLabel:
      "Electricity price where you live (drives your bill estimate and payback) - your price per kWh ($):",
    generatorAssumption:
      "Assumes a small genset at typical partial load: petrol 0.5 L /kWh, diesel 0.35 L /kWh (fuel only — oil, filters, and engine wear push the true number higher). If you know your real $/kWh, type it directly instead.",
    feedInCreditLabel:
      "Feed-in credit for surplus you can sell ($/kWh, optional — grid-tie only) :",
    fixedMonthlyChargeLabel:
      "Fixed monthly charge on your bill ($/mo, optional — solar can't cut it) :",
    applianceWattages:
      "Wattages are typical values — yours may differ. Cycling appliances (fridges, freezers, air conditioners, pumps) only draw power while running: their slider is hours actually running per day , capped to realistic compressor time, and each row shows the resulting 24-hour average. A modern fridge at the default (100 W running, ~10 h/day) really does use about 1 kWh/day.",
    fixedChargeTaxEstimate:
      "Bills include fixed charges and taxes, so this slightly overestimates real use — which is a safe direction to err.",
    roofAreaLabel: "Optional roof or yard area (m²)",
    roofAreaHelp:
      "A rough manual estimate is enough: about 6 m² per 400 W panel. This only caps the searched solar size; leave it blank for the normal estimate. Your coordinates are never stored.",
    independenceTarget:
      "Independence target (applied to all three chemistries) :",
    billCutTarget: "Bill-cut target — sets the results slider too :",
    fxRateHelp:
      "How many of your currency equal 1 US dollar. Auto-filled for your location; change only if you know a different rate.",
    surplusTargetHelp:
      "Above 100% the system is sized to produce sellable surplus — without a feed-in credit entered above, that surplus has no cash value and is flagged as clipped waste. The “your target” matrix column and the price-cut curve follow this slider.",
    resultsIntro:
      "Results appear here: a recommended path first, with battery comparisons and all options available below. For grid-tied plans, the result also separates bill reduction from outage backup.",
    bomSafetyNote:
      "Educational estimate from your sizing result — not an engineering design, not a shopping order. Fuse and cable figures assume copper, conservative ampacity, and a short battery-to-inverter run; verify everything against your local electrical code with a licensed professional before buying or energizing anything.",
    assumptionsIntro:
      "Run a sizing first - every constant used (derates, temperature model, efficiencies, weather data years and source) is listed here.",
    partsListIntro:
      "A reference parts list so you know what the pieces are and roughly what they cost. Nothing here is sold by this site — prices are indicative figures seen on the open market and change constantly.",
    lfpCells:
      "Brand new Grade-A prismatic LFP cells. 16S configuration per pack (51.2V nominal).",
    batteryManagementSpec:
      "Smart active balancing (2A balance current), dual temperature probes, RS485/CANbus comms with Sol-Ark & Victron.",
    breakerSpec:
      "20kA AIC interrupt rating @ 160V DC. Clears very high short-circuit DC currents in milliseconds — sized to protect the BMS and wiring.",
    endplateSpec:
      "Belleville spring washer endplates hold uniform compression (about 3,000 N). Manufacturers cite cycle-life benefits; treat specific gains as unverified.",
    faqIntro:
      "Short answers to what people ask most. The AI advisor can go deeper on any of these.",
    estimateMethodDisclaimer:
      "Every number comes from testable code simulating your exact location against five years of NASA satellite weather - not an AI guessing. Real-world results still vary with shading, installation quality, and hardware, so have a licensed professional verify anything you build.",
    paybackClaim:
      "Where grid power is expensive - Hawaii, islands, much of Europe, Africa, South Asia - properly built solar plus storage commonly repays its component cost in one to four years, then runs nearly free for decades. The calculator shows your personal payback from your own tariff.",
    batteryCostClaim:
      "Battery banks self-built from prismatic cells typically land around $80–125 per usable kWh shipped and duty-paid; budget retail packs run roughly $110–165. Panels add about $0.16–0.38 per watt. Every result states its price scope honestly.",
    offgridTradeoff:
      "Only if you want near-total independence through weeks of bad weather. The three off-grid options show exactly that trade-off: one never needs a generator, one needs it about a day a year, one only now and then. Grid-connected users skip this entirely.",
    offlineFallback:
      "Yes. After your first visit the tool installs itself as an offline app: sizing math runs entirely in your browser, and if the network is down it falls back to bundled typical-year weather for the nearest of 66 reference cities.",
    batterySafety:
      "It demands respect: lithium cells store enough energy to start fires, and DC arcs don't switch off. The guides here insist on proper fusing, BMS use, and code compliance - and on having a licensed electrician check anything before you energize it.",
    donationIntro:
      "This is free and always will be. If it helped you and you want to chip in toward the AI and hosting costs, here's where.",
    donationRecipientPrefix: "Contributions go directly to",
    donationRecipientSuffix: "personally.",
    donationTerms:
      "Please read before sending anything. Contributions are voluntary gifts to an individual, not payment for a service. They are not tax-deductible — this is not a charity or a registered nonprofit. They buy nothing: no priority, no features, no personal advice, no support obligation, and no continued availability of this site. Everyone gets exactly the same free tool whether they contribute or not. Please don't send money you need. If you were hoping to pay for professional engineering help, spend it on a licensed local engineer or electrician instead — that is genuinely the better use of it.",
    freeToolDisclaimer:
      "Short version: this is a free educational toy that produces rough estimates, run by one person, with no warranty of any kind.",
    resultEstimateDisclaimer:
      "Output is an automated educational estimate. It is not engineering, not a stamped design, not a quote, and not a safety certification. It may be wrong. Have any real system reviewed by a licensed electrician or engineer before you build or energize it.",
    chatPrivacySummary:
      "No signup, no cookies for advertising, no analytics profile. Your chat text is sent to the AI provider to generate a reply and is not stored here. Don't type anything sensitive into it.",
    emailWelcome: "You're welcome to email me:",
    emailSupportExpectations:
      "This is one person answering email in his own time, as a favor — not a support desk. I read what I can and reply when I'm able, but I can't promise a response or a timeframe. Anything I send back is a friendly opinion for your own further research, not professional engineering, electrical, or financial advice , and it doesn't create any professional relationship or obligation. For anything you're going to actually build, energize, or spend real money on, please talk to a licensed electrician or engineer in your area.",
    footerWarranty:
      "Provided free and as-is, with no warranty of any kind , express or implied. Estimates are educational only and may be inaccurate. Working with batteries, high DC current, and mains wiring can cause fire, serious injury, and death — you are responsible for your own safety, your own decisions, and compliance with your local electrical code. Verify everything with a licensed professional before building. - Blog - Worldwide Benchmarks - Heatmap - About - Terms - Support - lucasballek@gmail.com",
    operatorDescription:
      "This is a free, personal, non-commercial educational tool operated by an individual, Lucas Ballek. It is not a company, not incorporated, and not a licensed engineering, electrical contracting, or financial advisory practice. Nothing on this site is for sale and no service is being offered or promised to you.",
    independentVerification:
      "All output is an automated educational estimate produced from assumptions you supply. It is not a design, not a stamped drawing, not a quote, not a safety assessment, and not a code-compliance review. It may contain errors. Do not rely on it. Independently verify every figure — capacity, wire sizing, fuse ratings, and equipment compatibility — with a licensed electrician or professional engineer in your jurisdiction before purchasing, building, or energizing anything.",
    llmDisclaimer:
      "You are interacting with a large language model. It produces fluent, confident text that can be factually wrong, including specific numbers, prices, product specifications, and regulations. Treat every output as an unverified starting point.",
    electricalSafetyDisclaimer:
      "Battery banks, high DC currents, and mains wiring can cause arc flash, electric shock, fire, toxic gas release, serious injury, and death. Lithium cells can enter thermal runaway. You are solely responsible for your own safety and for the safety of anyone affected by what you build. You are solely responsible for permits, inspections, and compliance with your local electrical and fire codes.",
    siteAsIs:
      'THIS SITE AND ITS OUTPUT ARE PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, AND NON-INFRINGEMENT. There is no guarantee of availability, correctness, or continued operation, and the site may change or disappear at any time without notice.',
    liabilityLimitation:
      "To the fullest extent permitted by applicable law, the operator shall not be liable for any direct, indirect, incidental, consequential, special, or punitive damages — including property damage, fire, personal injury, lost savings, or business interruption — arising from your use of or reliance on this free tool. Some jurisdictions do not allow certain exclusions, in which case they apply only to the extent permitted. Nothing here excludes liability that cannot lawfully be excluded, including liability for death or personal injury caused by negligence, or for fraud.",
    donationTermsPrefix:
      "Any contribution you choose to send is a voluntary gift to an individual. It is",
    donationNotTaxDeductible: "not tax-deductible",
    donationTermsSuffix:
      ", is not payment for goods or services, creates no contract, entitles you to nothing, and is not refundable in exchange for any obligation. Contributing does not change the service you receive in any way.",
    advisorPrivacyDisclosure:
      "No account is required and no personal details are requested. Text you type into the advisor is transmitted to a third-party AI provider (Groq) in order to generate a reply, subject to their terms. Conversations are not stored by this site. Please do not enter personal, financial, or otherwise sensitive information. Basic request counts may be recorded to keep the service running and prevent abuse.",
    rateLimitDisclaimer:
      "Please don't automate, scrape, or hammer this tool — it is one person paying for the AI calls. Rate limits apply and abuse will be blocked.",
  },
  es: {
    homeIntro:
      "Introduce tu ubicación y tu factura eléctrica media. Simulamos 5 años de datos horarios de satélite de NASA para dimensionar exactamente los paneles solares y la batería que necesitas, con una amortización honesta a 20 años, la frecuencia de reemplazo de la batería y el costo de los equipos en tu moneda local.",
    quickSetupTitle: "⚡ Configuración rápida",
    quickSetupHint: "— elige los datos y luego pulsa Dimensionar mi sistema",
    preciseLocationHelp:
      "El botón de ubicación precisa completa tus coordenadas exactas y obtiene los precios de la zona de la región de referencia más cercana. Para otro lugar, escribe una ciudad o localidad y pulsa Intro o Tab para seleccionarla. Después, pulsa Dimensionar mi sistema para calcular.",
    imageryPrivacy:
      "Las imágenes satelitales (sin necesidad de cuenta) solo se cargan cuando las solicitas. Las coordenadas se envían a los mosaicos del mapa y a los datos meteorológicos de NASA; no se guarda nada.",
    locationPrecision:
      "Buscar una ciudad es cómodo, pero tu ubicación exacta ofrece la estimación meteorológica y solar más precisa. Introduce manualmente la latitud y la longitud, o usa Usar mi ubicación actual para el GPS del navegador.",
    monthlyBillLabel:
      "Tu factura mensual de electricidad — basta con una cifra aproximada; se ajusta a los precios de tu zona",
    electricityRateLabel:
      "Precio de la electricidad en tu zona (determina la factura estimada y la amortización) — tu precio por kWh ($):",
    generatorAssumption:
      "Supone un generador pequeño con una carga parcial típica: gasolina 0.5 L/kWh y diésel 0.35 L/kWh (solo combustible; el aceite, los filtros y el desgaste del motor elevan el costo real). Si conoces tu costo real en $/kWh, escríbelo directamente.",
    feedInCreditLabel:
      "Crédito por la energía excedente que puedes vender ($/kWh, opcional — solo conexión a la red):",
    fixedMonthlyChargeLabel:
      "Cargo fijo mensual de la factura ($/mes, opcional — la energía solar no puede reducirlo):",
    applianceWattages:
      "Las potencias son valores típicos; las tuyas pueden variar. Los aparatos cíclicos (refrigeradores, congeladores, aires acondicionados y bombas) solo consumen energía mientras funcionan: el control deslizante indica las horas reales de funcionamiento al día, limitadas a un tiempo realista del compresor, y cada fila muestra el promedio resultante en 24 horas. Un refrigerador moderno con el valor predeterminado (100 W en funcionamiento, unas 10 h/día) realmente consume alrededor de 1 kWh/día.",
    fixedChargeTaxEstimate:
      "Las facturas incluyen cargos fijos e impuestos, así que esta cifra sobreestima ligeramente el consumo real; es más seguro equivocarse en esa dirección.",
    roofAreaLabel: "Superficie opcional del techo o terreno (m²)",
    roofAreaHelp:
      "Basta con una estimación manual aproximada: unos 6 m² por panel de 400 W. Esto solo limita el tamaño solar que se busca; déjalo en blanco para la estimación normal. Tus coordenadas nunca se guardan.",
    independenceTarget:
      "Objetivo de independencia (aplicado a las tres químicas):",
    billCutTarget:
      "Objetivo de reducción de la factura — también ajusta el control deslizante de resultados:",
    fxRateHelp:
      "Cuántas unidades de tu moneda equivalen a 1 dólar estadounidense. Se completa automáticamente para tu ubicación; cámbialo solo si conoces otra tasa.",
    surplusTargetHelp:
      "Por encima del 100%, el sistema se dimensiona para producir excedentes vendibles. Si no introduces arriba un crédito por energía inyectada a la red, ese excedente no tiene valor monetario y se marca como energía desperdiciada. La columna «tu objetivo» de la matriz y la curva de reducción de precio siguen este control.",
    resultsIntro:
      "Aquí aparecen los resultados: primero una opción recomendada, seguida de comparaciones de baterías y todas las alternativas. En los planes conectados a la red, el resultado también separa la reducción de la factura del respaldo durante apagones.",
    bomSafetyNote:
      "Estimación educativa basada en tu dimensionamiento; no es un diseño de ingeniería ni una lista de compra. Los valores de fusibles y cables suponen cobre, una capacidad de corriente conservadora y un tramo corto entre la batería y el inversor. Antes de comprar o energizar nada, verifica todo con un profesional autorizado conforme al código eléctrico local.",
    assumptionsIntro:
      "Primero ejecuta un dimensionamiento: aquí se enumeran todas las constantes usadas (reducciones, modelo de temperatura, eficiencias, años de datos meteorológicos y fuente).",
    partsListIntro:
      "Una lista de referencia para que sepas qué piezas componen el sistema y cuánto cuestan aproximadamente. Este sitio no vende nada de lo que aparece aquí; son precios orientativos observados en el mercado abierto y cambian constantemente.",
    lfpCells:
      "Celdas prismáticas LFP nuevas, grado A. Configuración 16S por paquete (51.2 V nominales).",
    batteryManagementSpec:
      "Balanceo activo inteligente (corriente de balanceo de 2 A), dos sondas de temperatura y comunicaciones RS485/CANbus con Sol-Ark y Victron.",
    breakerSpec:
      "Capacidad de interrupción AIC de 20 kA a 160 V CC. Interrumpe corrientes de cortocircuito CC muy altas en milisegundos; está dimensionado para proteger el BMS y el cableado.",
    endplateSpec:
      "Las placas terminales con arandelas elásticas Belleville mantienen una compresión uniforme (unos 3,000 N). Los fabricantes citan beneficios para la vida útil en ciclos; considera no verificadas las mejoras concretas.",
    faqIntro:
      "Respuestas breves a las preguntas más frecuentes. El asesor de IA puede profundizar en cualquiera de ellas.",
    estimateMethodDisclaimer:
      "Cada cifra procede de código comprobable que simula tu ubicación exacta con cinco años de datos meteorológicos satelitales de NASA; no es una conjetura de IA. Los resultados reales también varían según la sombra, la calidad de la instalación y los equipos; pide a un profesional autorizado que verifique cualquier sistema que construyas.",
    paybackClaim:
      "Donde la electricidad de la red es cara —Hawái, las islas y gran parte de Europa, África y el sur de Asia—, una instalación solar con almacenamiento bien construida suele recuperar el costo de sus componentes en uno a cuatro años y luego funcionar casi gratis durante décadas. La calculadora muestra tu amortización personal según tu propia tarifa.",
    batteryCostClaim:
      "Los bancos de baterías construidos por cuenta propia con celdas prismáticas suelen costar entre $80 y $125 por kWh útil, con envío y aranceles pagados; los paquetes económicos de venta minorista cuestan aproximadamente entre $110 y $165. Los paneles añaden unos $0.16–0.38 por vatio. Cada resultado indica con honestidad qué incluye el precio.",
    offgridTradeoff:
      "Solo si quieres una independencia casi total durante semanas de mal tiempo. Las tres opciones aisladas de la red muestran exactamente esa compensación: una nunca necesita generador, otra lo necesita aproximadamente un día al año y la tercera solo de vez en cuando. Si sigues conectado a la red, puedes omitir esto.",
    offlineFallback:
      "Sí. Después de tu primera visita, la herramienta se instala como una aplicación sin conexión: los cálculos se ejecutan por completo en tu navegador y, si no hay red, usa datos meteorológicos típicos de un año incluidos para la más cercana de 66 ciudades de referencia.",
    batterySafety:
      "Hay que tratarlo con respeto: las celdas de litio almacenan energía suficiente para iniciar incendios y los arcos de CC no se apagan solos. Estas guías insisten en instalar fusibles adecuados, usar un BMS y cumplir el código, y en que un electricista autorizado revise todo antes de energizarlo.",
    donationIntro:
      "Es gratis y siempre lo será. Si te ayudó y quieres aportar algo a los costos de IA y alojamiento, aquí puedes hacerlo.",
    donationRecipientPrefix: "Las contribuciones se entregan directamente a",
    donationRecipientSuffix: "en persona.",
    donationTerms:
      "Lee esto antes de enviar nada. Las contribuciones son regalos voluntarios a una persona, no el pago de un servicio. No son deducibles de impuestos; esto no es una organización benéfica ni una entidad sin fines de lucro registrada. No compran nada: ni prioridad, ni funciones, ni asesoría personal, ni obligación de soporte, ni la disponibilidad futura de este sitio. Todas las personas reciben exactamente la misma herramienta gratuita, contribuyan o no. No envíes dinero que necesites. Si querías pagar por ayuda de ingeniería profesional, es mejor gastarlo en un ingeniero o electricista local autorizado.",
    freeToolDisclaimer:
      "En resumen: es una herramienta educativa gratuita que ofrece estimaciones aproximadas, gestionada por una persona y sin garantía de ningún tipo.",
    resultEstimateDisclaimer:
      "El resultado es una estimación educativa automatizada. No es un trabajo de ingeniería, un diseño visado, un presupuesto ni una certificación de seguridad. Puede ser incorrecto. Antes de construir o energizar un sistema real, pide a un electricista o ingeniero autorizado que lo revise.",
    chatPrivacySummary:
      "No hace falta registrarse; no hay cookies publicitarias ni perfil analítico. El texto de tu conversación se envía al proveedor de IA para generar una respuesta y este sitio no lo almacena. No escribas información sensible.",
    emailWelcome: "Puedes escribirme por correo electrónico:",
    emailSupportExpectations:
      "Soy una sola persona que responde correos en su tiempo libre, como favor; no es un servicio de soporte. Leo lo que puedo y respondo cuando me es posible, pero no puedo prometer una respuesta ni un plazo. Lo que te envíe será una opinión cordial para que sigas investigando, no asesoría profesional de ingeniería, electricidad o finanzas, y no crea una relación ni obligación profesional. Para cualquier cosa que vayas a construir, energizar o pagar con dinero real, consulta a un electricista o ingeniero autorizado de tu zona.",
    footerWarranty:
      "Se ofrece gratis y tal cual, sin garantía de ningún tipo, expresa ni implícita. Las estimaciones son solo educativas y pueden ser inexactas. Trabajar con baterías, alta corriente CC y cableado de red eléctrica puede causar incendios, lesiones graves y la muerte; eres responsable de tu seguridad, tus decisiones y el cumplimiento del código eléctrico local. Verifica todo con un profesional autorizado antes de construir. - Blog - Referencias mundiales - Mapa de calor - Acerca de - Términos - Soporte - lucasballek@gmail.com",
    operatorDescription:
      "Esta es una herramienta educativa gratuita, personal y sin fines comerciales, gestionada por una persona, Lucas Ballek. No es una empresa ni una sociedad constituida, ni un despacho autorizado de ingeniería, instalaciones eléctricas o asesoría financiera. Nada de este sitio está a la venta y no se te ofrece ni promete ningún servicio.",
    independentVerification:
      "Todos los resultados son estimaciones educativas automatizadas basadas en los supuestos que proporcionas. No son un diseño, un plano visado, un presupuesto, una evaluación de seguridad ni una revisión del cumplimiento del código. Pueden contener errores. No te bases en ellos. Antes de comprar, construir o energizar nada, verifica cada cifra por separado —capacidad, dimensionamiento de cables, valores de fusibles y compatibilidad de equipos— con un electricista autorizado o un ingeniero profesional de tu jurisdicción.",
    llmDisclaimer:
      "Estás interactuando con un modelo de lenguaje grande. Produce textos fluidos y seguros de sí mismos que pueden contener errores factuales, incluidos números concretos, precios, especificaciones de productos y normativas. Trata cada respuesta como un punto de partida sin verificar.",
    electricalSafetyDisclaimer:
      "Los bancos de baterías, las corrientes CC altas y el cableado de red pueden causar arco eléctrico, descarga, incendio, liberación de gases tóxicos, lesiones graves y muerte. Las celdas de litio pueden sufrir fuga térmica. Eres el único responsable de tu seguridad y la de cualquier persona afectada por lo que construyas. También eres el único responsable de los permisos, inspecciones y cumplimiento de los códigos eléctricos y contra incendios locales.",
    siteAsIs:
      "ESTE SITIO Y SUS RESULTADOS SE OFRECEN «TAL CUAL» Y «SEGÚN DISPONIBILIDAD», SIN GARANTÍA DE NINGÚN TIPO, EXPRESA NI IMPLÍCITA, INCLUIDAS, ENTRE OTRAS, LAS GARANTÍAS DE COMERCIABILIDAD, IDONEIDAD PARA UN FIN PARTICULAR, EXACTITUD Y NO INFRACCIÓN. No se garantiza la disponibilidad, exactitud ni continuidad del servicio; el sitio puede cambiar o desaparecer en cualquier momento y sin aviso.",
    liabilityLimitation:
      "En la máxima medida permitida por la ley aplicable, el operador no será responsable de daños directos, indirectos, incidentales, consecuentes, especiales ni punitivos —incluidos daños materiales, incendios, lesiones personales, ahorros perdidos o interrupción del negocio— derivados del uso de esta herramienta gratuita o de la confianza depositada en ella. Algunas jurisdicciones no permiten ciertas exclusiones; en esos casos, solo se aplican en la medida permitida. Nada de lo aquí dispuesto excluye responsabilidades que legalmente no puedan excluirse, incluida la responsabilidad por muerte o lesiones personales causadas por negligencia, o por fraude.",
    donationTermsPrefix:
      "Cualquier contribución que decidas enviar es un regalo voluntario a una persona. No es",
    donationNotTaxDeductible: "deducible de impuestos",
    donationTermsSuffix:
      ", no es un pago por bienes ni servicios, no crea ningún contrato, no te da derecho a nada y no es reembolsable a cambio de obligación alguna. Contribuir no cambia en absoluto el servicio que recibes.",
    advisorPrivacyDisclosure:
      "No hace falta tener una cuenta ni se solicitan datos personales. El texto que escribes al asesor se transmite a un proveedor de IA externo (Groq) para generar una respuesta, conforme a sus condiciones. Este sitio no almacena las conversaciones. No introduzcas información personal, financiera ni de otro tipo que sea sensible. Es posible que se registren recuentos básicos de solicitudes para mantener el servicio y prevenir abusos.",
    rateLimitDisclaimer:
      "No automatices, raspes ni sobrecargues esta herramienta: una sola persona paga las llamadas a la IA. Hay límites de uso y se bloqueará el abuso.",
  },
  pt: {
    homeIntro:
      "Informe sua localização e sua conta média de eletricidade. Simulamos 5 anos de dados horários de satélite da NASA para dimensionar exatamente os painéis solares e a bateria de que você precisa, com retorno honesto em 20 anos, frequência de substituição da bateria e custos dos equipamentos na sua moeda local.",
    quickSetupTitle: "⚡ Configuração rápida",
    quickSetupHint: "— escolha os dados e clique em Dimensionar meu sistema",
    preciseLocationHelp:
      "O botão de localização precisa preenche suas coordenadas exatas e consulta os preços da região de referência mais próxima. Para outro lugar, digite uma cidade ou município e pressione Enter ou Tab para selecionar. Depois, clique em Dimensionar meu sistema para calcular.",
    imageryPrivacy:
      "As imagens de satélite (sem necessidade de conta) só são carregadas quando você solicita. As coordenadas são enviadas para os blocos do mapa e para o clima da NASA; nada é salvo.",
    locationPrecision:
      "Buscar uma cidade é prático, mas sua localização exata fornece a estimativa solar e meteorológica mais precisa. Digite manualmente a latitude e a longitude ou use Usar minha localização atual para o GPS do navegador.",
    monthlyBillLabel:
      "Sua conta mensal de eletricidade — uma estimativa serve; o valor se ajusta aos preços da sua região",
    electricityRateLabel:
      "Preço da eletricidade onde você mora (define a estimativa da conta e o retorno) — seu preço por kWh ($):",
    generatorAssumption:
      "Considera um gerador pequeno em carga parcial típica: gasolina 0.5 L/kWh, diesel 0.35 L/kWh (somente combustível — óleo, filtros e desgaste do motor aumentam o custo real). Se você souber seu custo real em $/kWh, informe-o diretamente.",
    feedInCreditLabel:
      "Crédito pela energia excedente que você pode vender ($/kWh, opcional — somente conectado à rede):",
    fixedMonthlyChargeLabel:
      "Cobrança mensal fixa na conta ($/mês, opcional — a energia solar não pode reduzi-la):",
    applianceWattages:
      "As potências são valores típicos; as suas podem variar. Aparelhos cíclicos (geladeiras, freezers, ar-condicionado e bombas) só consomem energia enquanto estão funcionando: o controle indica as horas reais de funcionamento por dia, limitadas a um tempo realista do compressor, e cada linha mostra a média resultante em 24 horas. Uma geladeira moderna no valor padrão (100 W em funcionamento, cerca de 10 h/dia) realmente consome aproximadamente 1 kWh/dia.",
    fixedChargeTaxEstimate:
      "As contas incluem cobranças fixas e impostos, então esta estimativa fica um pouco acima do consumo real — uma margem de erro mais segura.",
    roofAreaLabel: "Área opcional do telhado ou terreno (m²)",
    roofAreaHelp:
      "Uma estimativa manual aproximada basta: cerca de 6 m² por painel de 400 W. Isso apenas limita o tamanho solar pesquisado; deixe em branco para a estimativa normal. Suas coordenadas nunca são armazenadas.",
    independenceTarget: "Meta de independência (aplicada às três químicas):",
    billCutTarget:
      "Meta de redução da conta — também define o controle deslizante dos resultados:",
    fxRateHelp:
      "Quantas unidades da sua moeda equivalem a 1 dólar americano. O valor é preenchido automaticamente para sua localização; altere-o somente se souber outra taxa.",
    surplusTargetHelp:
      "Acima de 100%, o sistema é dimensionado para produzir excedente vendável. Sem informar acima um crédito pela energia injetada na rede, esse excedente não tem valor monetário e aparece como desperdício limitado. A coluna «sua meta» da matriz e a curva de redução de preço acompanham este controle.",
    resultsIntro:
      "Os resultados aparecem aqui: primeiro, um caminho recomendado; abaixo, comparações de baterias e todas as opções. Em projetos conectados à rede, o resultado também separa a redução da conta do respaldo durante apagões.",
    bomSafetyNote:
      "Estimativa educativa baseada no dimensionamento — não é um projeto de engenharia nem uma lista de compras. Os valores de fusíveis e cabos pressupõem cobre, capacidade de corrente conservadora e um trecho curto entre a bateria e o inversor. Antes de comprar ou energizar qualquer coisa, verifique tudo com um profissional habilitado conforme o código elétrico local.",
    assumptionsIntro:
      "Faça primeiro um dimensionamento: todas as constantes usadas (fatores de redução, modelo de temperatura, eficiências, anos e fonte dos dados meteorológicos) estão listadas aqui.",
    partsListIntro:
      "Uma lista de referência para você conhecer as peças e ter uma ideia de seus custos. Este site não vende nada do que aparece aqui — são preços indicativos observados no mercado aberto e mudam o tempo todo.",
    lfpCells:
      "Células prismáticas LFP novas, grau A. Configuração 16S por conjunto (51.2 V nominais).",
    batteryManagementSpec:
      "Balanceamento ativo inteligente (corrente de balanceamento de 2 A), duas sondas de temperatura e comunicação RS485/CANbus com Sol-Ark e Victron.",
    breakerSpec:
      "Capacidade de interrupção AIC de 20 kA a 160 V CC. Interrompe correntes de curto-circuito CC muito altas em milissegundos — dimensionado para proteger o BMS e a fiação.",
    endplateSpec:
      "Placas terminais com arruelas Belleville mantêm uma compressão uniforme (cerca de 3,000 N). Fabricantes citam benefícios para a vida útil em ciclos; trate ganhos específicos como não verificados.",
    faqIntro:
      "Respostas breves às perguntas mais comuns. O consultor de IA pode explicar qualquer uma delas em mais detalhes.",
    estimateMethodDisclaimer:
      "Cada número vem de código testável que simula sua localização exata com cinco anos de dados meteorológicos de satélite da NASA — não de um palpite de IA. Os resultados reais também variam conforme sombra, qualidade da instalação e equipamentos; peça a um profissional habilitado que verifique qualquer sistema que você construir.",
    paybackClaim:
      "Onde a energia da rede é cara — Havaí, ilhas e grande parte da Europa, África e Sul da Ásia — um sistema solar com armazenamento bem construído costuma recuperar o custo dos componentes em um a quatro anos e depois funcionar quase de graça por décadas. A calculadora mostra seu retorno pessoal com base na sua tarifa.",
    batteryCostClaim:
      "Bancos de baterias montados por conta própria com células prismáticas costumam custar de $80 a $125 por kWh utilizável, já com frete e impostos de importação; conjuntos econômicos de varejo ficam em torno de $110–165. Os painéis acrescentam cerca de $0.16–0.38 por watt. Cada resultado informa com honestidade o que o preço inclui.",
    offgridTradeoff:
      "Somente se você quiser quase total independência durante semanas de mau tempo. As três opções fora da rede mostram exatamente essa troca: uma nunca precisa de gerador, outra precisa dele cerca de um dia por ano e a terceira apenas de vez em quando. Quem continua conectado à rede pode ignorar isso.",
    offlineFallback:
      "Sim. Depois da primeira visita, a ferramenta se instala como um aplicativo offline: os cálculos de dimensionamento rodam inteiramente no navegador e, se a rede cair, usam dados meteorológicos típicos de um ano incluídos para a mais próxima das 66 cidades de referência.",
    batterySafety:
      "É preciso ter respeito: células de lítio armazenam energia suficiente para iniciar incêndios, e arcos CC não se desligam sozinhos. Estas orientações exigem fusíveis adequados, uso de BMS e cumprimento do código, além de uma inspeção por eletricista habilitado antes de energizar o sistema.",
    donationIntro:
      "É gratuito e sempre será. Se ajudou você e quiser contribuir com os custos de IA e hospedagem, pode fazer isso aqui.",
    donationRecipientPrefix: "As contribuições vão diretamente para",
    donationRecipientSuffix: "pessoalmente.",
    donationTerms:
      "Leia antes de enviar qualquer valor. As contribuições são doações voluntárias a uma pessoa, não pagamento por um serviço. Não são dedutíveis do imposto; isto não é uma instituição de caridade nem uma organização sem fins lucrativos registrada. Elas não compram nada: prioridade, recursos, aconselhamento pessoal, obrigação de suporte ou disponibilidade contínua deste site. Todos recebem exatamente a mesma ferramenta gratuita, contribuam ou não. Não envie dinheiro de que você precise. Se queria pagar por ajuda profissional de engenharia, é melhor contratar um engenheiro ou eletricista local habilitado.",
    freeToolDisclaimer:
      "Em resumo: é uma ferramenta educativa gratuita que fornece estimativas aproximadas, administrada por uma pessoa e sem garantia de qualquer tipo.",
    resultEstimateDisclaimer:
      "O resultado é uma estimativa educativa automatizada. Não é engenharia, projeto assinado, orçamento nem certificação de segurança. Pode estar errado. Antes de construir ou energizar um sistema real, peça a um eletricista ou engenheiro habilitado que o revise.",
    chatPrivacySummary:
      "Não é preciso se cadastrar; não há cookies de publicidade nem perfil analítico. O texto da conversa é enviado ao provedor de IA para gerar uma resposta e não é armazenado aqui. Não digite informações sensíveis.",
    emailWelcome: "Fique à vontade para me enviar um e-mail:",
    emailSupportExpectations:
      "Sou uma pessoa respondendo e-mails no meu próprio tempo, como um favor — não é uma central de suporte. Leio o que posso e respondo quando consigo, mas não posso prometer resposta nem prazo. O que eu enviar será uma opinião amigável para sua própria pesquisa, não aconselhamento profissional de engenharia, eletricidade ou finanças, e não cria relação nem obrigação profissional. Para qualquer coisa que você realmente vá construir, energizar ou pagar com dinheiro de verdade, converse com um eletricista ou engenheiro habilitado na sua região.",
    footerWarranty:
      "Fornecido gratuitamente e no estado em que se encontra, sem garantia de qualquer tipo, expressa ou implícita. As estimativas são apenas educativas e podem estar incorretas. Trabalhar com baterias, alta corrente CC e fiação da rede elétrica pode causar incêndio, lesões graves e morte — você é responsável pela sua segurança, pelas suas decisões e pelo cumprimento do código elétrico local. Verifique tudo com um profissional habilitado antes de construir. - Blog - Referências mundiais - Mapa de calor - Sobre - Termos - Suporte - lucasballek@gmail.com",
    operatorDescription:
      "Esta é uma ferramenta educativa gratuita, pessoal e sem fins comerciais, administrada por uma pessoa, Lucas Ballek. Não é uma empresa nem uma sociedade constituída, nem um escritório habilitado de engenharia, instalações elétricas ou consultoria financeira. Nada neste site está à venda e nenhum serviço é oferecido ou prometido a você.",
    independentVerification:
      "Todos os resultados são estimativas educativas automatizadas, produzidas com base nas premissas que você informa. Não são um projeto, desenho assinado, orçamento, avaliação de segurança nem análise de conformidade com normas. Podem conter erros. Não confie neles. Antes de comprar, construir ou energizar qualquer coisa, verifique cada valor de forma independente — capacidade, dimensionamento dos cabos, classificação dos fusíveis e compatibilidade dos equipamentos — com um eletricista habilitado ou engenheiro profissional da sua jurisdição.",
    llmDisclaimer:
      "Você está interagindo com um modelo de linguagem grande. Ele produz textos fluentes e confiantes que podem conter erros factuais, inclusive números específicos, preços, especificações de produtos e regulamentos. Trate cada resposta como um ponto de partida não verificado.",
    electricalSafetyDisclaimer:
      "Bancos de baterias, altas correntes CC e fiação da rede elétrica podem causar arco elétrico, choque, incêndio, liberação de gases tóxicos, lesões graves e morte. Células de lítio podem entrar em fuga térmica. Você é o único responsável pela sua segurança e pela segurança de qualquer pessoa afetada pelo que construir. Também é o único responsável por licenças, inspeções e cumprimento dos códigos elétricos e contra incêndio locais.",
    siteAsIs:
      'ESTE SITE E SEUS RESULTADOS SÃO FORNECIDOS "NO ESTADO EM QUE SE ENCONTRAM" E "CONFORME DISPONÍVEIS", SEM GARANTIA DE QUALQUER TIPO, EXPRESSA OU IMPLÍCITA, INCLUINDO, ENTRE OUTRAS, GARANTIAS DE COMERCIABILIDADE, ADEQUAÇÃO A UMA FINALIDADE ESPECÍFICA, EXATIDÃO E NÃO VIOLAÇÃO. Não há garantia de disponibilidade, correção ou funcionamento contínuo; o site pode mudar ou desaparecer a qualquer momento, sem aviso.',
    liabilityLimitation:
      "Na máxima extensão permitida pela lei aplicável, o operador não será responsável por danos diretos, indiretos, incidentais, consequenciais, especiais ou punitivos — incluindo danos materiais, incêndio, lesões pessoais, perda de economias ou interrupção de negócios — decorrentes do uso desta ferramenta gratuita ou da confiança depositada nela. Algumas jurisdições não permitem certas exclusões; nesses casos, elas se aplicam somente na medida permitida. Nada aqui exclui responsabilidade que não possa ser legalmente excluída, incluindo morte ou lesão pessoal causada por negligência, ou fraude.",
    donationTermsPrefix:
      "Qualquer contribuição que você decidir enviar é uma doação voluntária a uma pessoa. Ela não é",
    donationNotTaxDeductible: "dedutível do imposto",
    donationTermsSuffix:
      ", não é pagamento por bens ou serviços, não cria contrato, não dá direito a nada e não é reembolsável em troca de qualquer obrigação. Contribuir não altera de modo algum o serviço que você recebe.",
    advisorPrivacyDisclosure:
      "Não é necessário ter uma conta e nenhum dado pessoal é solicitado. O texto que você digita para o consultor é transmitido a um provedor de IA terceirizado (Groq) para gerar uma resposta, sujeito aos termos dele. Este site não armazena as conversas. Não informe dados pessoais, financeiros ou qualquer outra informação sensível. Contagens básicas de solicitações podem ser registradas para manter o serviço funcionando e evitar abusos.",
    rateLimitDisclaimer:
      "Não automatize, raspe nem sobrecarregue esta ferramenta — uma pessoa paga pelas chamadas de IA. Há limites de uso e abusos serão bloqueados.",
  },
  fr: {
    homeIntro:
      "Indiquez votre emplacement et votre facture d’électricité moyenne. Nous simulons 5 ans de données météorologiques horaires par satellite de la NASA pour dimensionner précisément les panneaux solaires et la batterie nécessaires, avec un retour sur investissement honnête sur 20 ans, la fréquence de remplacement de la batterie et le coût du matériel dans votre devise locale.",
    quickSetupTitle: "⚡ Configuration rapide",
    quickSetupHint:
      "— choisissez les données, puis cliquez sur Dimensionner mon système",
    preciseLocationHelp:
      "Le bouton de localisation précise renseigne vos coordonnées exactes et récupère les prix de la région de référence la plus proche. Pour un autre endroit, saisissez une ville ou un village, puis appuyez sur Entrée ou Tab pour le sélectionner. Cliquez ensuite sur Dimensionner mon système pour lancer le calcul.",
    imageryPrivacy:
      "Les images satellite (sans compte) ne se chargent que si vous le demandez. Les coordonnées sont transmises aux tuiles cartographiques et aux données météo de la NASA ; rien n’est enregistré.",
    locationPrecision:
      "La recherche par ville est pratique, mais votre emplacement exact fournit l’estimation solaire et météo la plus précise. Saisissez manuellement la latitude et la longitude, ou utilisez Utiliser ma position actuelle pour le GPS du navigateur.",
    monthlyBillLabel:
      "Votre facture d’électricité mensuelle — une estimation suffit, elle s’adapte aux tarifs de votre région",
    electricityRateLabel:
      "Prix de l’électricité chez vous (il détermine la facture estimée et le retour) — votre prix par kWh ($) :",
    generatorAssumption:
      "Le calcul suppose un petit groupe électrogène à charge partielle typique : essence 0.5 L/kWh, diesel 0.35 L/kWh (carburant uniquement ; huile, filtres et usure du moteur augmentent le coût réel). Si vous connaissez votre coût réel en $/kWh, saisissez-le directement.",
    feedInCreditLabel:
      "Crédit pour le surplus que vous pouvez vendre ($/kWh, facultatif — réseau uniquement) :",
    fixedMonthlyChargeLabel:
      "Frais fixes mensuels sur votre facture ($/mois, facultatifs — le solaire ne peut pas les réduire) :",
    applianceWattages:
      "Les puissances sont des valeurs typiques ; les vôtres peuvent différer. Les appareils cycliques (réfrigérateurs, congélateurs, climatiseurs et pompes) ne consomment que lorsqu’ils fonctionnent : le curseur indique les heures de fonctionnement réelles par jour, plafonnées à une durée réaliste pour le compresseur, et chaque ligne affiche la moyenne obtenue sur 24 heures. Un réfrigérateur moderne avec la valeur par défaut (100 W en marche, environ 10 h/jour) consomme bien près de 1 kWh/jour.",
    fixedChargeTaxEstimate:
      "Les factures comprennent des frais fixes et des taxes ; cette estimation surestime donc légèrement la consommation réelle, ce qui constitue une marge de sécurité.",
    roofAreaLabel: "Surface facultative du toit ou du terrain (m²)",
    roofAreaHelp:
      "Une estimation manuelle approximative suffit : environ 6 m² par panneau de 400 W. Cela limite uniquement la taille solaire recherchée ; laissez le champ vide pour l’estimation normale. Vos coordonnées ne sont jamais enregistrées.",
    independenceTarget:
      "Objectif d’indépendance (appliqué aux trois chimies) :",
    billCutTarget:
      "Objectif de réduction de facture — il règle aussi le curseur des résultats :",
    fxRateHelp:
      "Nombre d’unités de votre devise pour 1 dollar américain. La valeur est remplie automatiquement selon votre emplacement ; modifiez-la seulement si vous connaissez un autre taux.",
    surplusTargetHelp:
      "Au-delà de 100 %, le système est dimensionné pour produire un surplus vendable. Sans crédit d’injection saisi ci-dessus, ce surplus n’a aucune valeur monétaire et est signalé comme gaspillage écrêté. La colonne « votre objectif » de la matrice et la courbe de réduction des prix suivent ce curseur.",
    resultsIntro:
      "Les résultats s’affichent ici : d’abord une solution recommandée, puis des comparaisons de batteries et toutes les options disponibles ci-dessous. Pour les systèmes raccordés au réseau, le résultat distingue aussi la baisse de facture du secours en cas de panne.",
    bomSafetyNote:
      "Estimation pédagogique issue de votre dimensionnement ; ce n’est ni une conception d’ingénieur ni une liste d’achat. Les valeurs de fusibles et de câbles supposent du cuivre, une intensité admissible prudente et une courte liaison entre la batterie et l’onduleur. Avant tout achat ou toute mise sous tension, faites tout vérifier par un professionnel agréé selon le code électrique local.",
    assumptionsIntro:
      "Lancez d’abord un dimensionnement : toutes les constantes utilisées (déclassements, modèle de température, rendements, années et source des données météo) sont indiquées ici.",
    partsListIntro:
      "Une liste de référence pour connaître les éléments du système et leur coût approximatif. Rien de ce qui figure ici n’est vendu par ce site ; les prix sont indicatifs, observés sur le marché libre et changent constamment.",
    lfpCells:
      "Cellules LFP prismatiques neuves de grade A. Configuration 16S par bloc (51.2 V nominaux).",
    batteryManagementSpec:
      "Équilibrage actif intelligent (courant d’équilibrage de 2 A), deux sondes de température et communications RS485/CANbus avec Sol-Ark et Victron.",
    breakerSpec:
      "Pouvoir de coupure AIC de 20 kA à 160 V CC. Coupe en quelques millisecondes les très forts courants de court-circuit CC ; dimensionné pour protéger le BMS et le câblage.",
    endplateSpec:
      "Les plaques d’extrémité avec rondelles Belleville maintiennent une compression uniforme (environ 3,000 N). Les fabricants citent des gains de durée de vie en cycles ; considérez les gains précis comme non vérifiés.",
    faqIntro:
      "Des réponses courtes aux questions les plus fréquentes. Le conseiller IA peut approfondir chacune d’elles.",
    estimateMethodDisclaimer:
      "Chaque chiffre provient d’un code vérifiable qui simule votre emplacement exact à partir de cinq ans de données météo satellitaires de la NASA — ce n’est pas une supposition de l’IA. Les résultats réels varient aussi selon l’ombrage, la qualité de l’installation et le matériel ; faites vérifier tout système que vous construisez par un professionnel agréé.",
    paybackClaim:
      "Là où l’électricité du réseau coûte cher — à Hawaï, dans les îles et dans une grande partie de l’Europe, de l’Afrique et de l’Asie du Sud — une installation solaire avec stockage correctement construite rembourse souvent le coût de ses composants en un à quatre ans, puis fonctionne presque gratuitement pendant des décennies. Le calculateur indique votre propre délai selon votre tarif.",
    batteryCostClaim:
      "Les batteries assemblées soi-même à partir de cellules prismatiques coûtent généralement $80–125 par kWh utilisable, livraison et droits acquittés ; les packs de détail économiques coûtent environ $110–165. Les panneaux ajoutent environ $0.16–0.38 par watt. Chaque résultat précise honnêtement le périmètre du prix.",
    offgridTradeoff:
      "Uniquement si vous recherchez une quasi-autonomie pendant plusieurs semaines de mauvais temps. Les trois options hors réseau montrent précisément ce compromis : l’une n’a jamais besoin d’un groupe électrogène, l’autre en a besoin environ un jour par an, la dernière seulement de temps à autre. Les utilisateurs raccordés au réseau peuvent ignorer cette option.",
    offlineFallback:
      "Oui. Après votre première visite, l’outil s’installe comme application hors ligne : les calculs de dimensionnement s’exécutent entièrement dans votre navigateur et, si le réseau tombe, utilisent les données météo typiques d’une année incluses pour la plus proche des 66 villes de référence.",
    batterySafety:
      "La prudence s’impose : les cellules au lithium stockent assez d’énergie pour déclencher un incendie et les arcs CC ne s’éteignent pas seuls. Ces guides exigent des fusibles adaptés, un BMS et le respect des normes, ainsi qu’un contrôle par un électricien agréé avant toute mise sous tension.",
    donationIntro:
      "C’est gratuit et cela le restera. Si cet outil vous a aidé et que vous souhaitez contribuer aux frais d’IA et d’hébergement, vous pouvez le faire ici.",
    donationRecipientPrefix: "Les contributions vont directement à",
    donationRecipientSuffix: "en personne.",
    donationTerms:
      "Veuillez lire avant tout envoi. Les contributions sont des dons volontaires à une personne, et non le paiement d’un service. Elles ne sont pas déductibles des impôts ; il ne s’agit ni d’une œuvre caritative ni d’un organisme sans but lucratif enregistré. Elles n’achètent rien : ni priorité, ni fonctionnalité, ni conseil personnalisé, ni obligation d’assistance, ni disponibilité continue de ce site. Tout le monde reçoit exactement le même outil gratuit, avec ou sans contribution. N’envoyez pas d’argent dont vous avez besoin. Si vous vouliez payer une aide professionnelle en ingénierie, adressez-vous plutôt à un ingénieur ou à un électricien agréé près de chez vous.",
    freeToolDisclaimer:
      "En bref : c’est un outil pédagogique gratuit qui fournit des estimations approximatives, géré par une personne et sans aucune garantie.",
    resultEstimateDisclaimer:
      "Le résultat est une estimation pédagogique automatisée. Ce n’est ni une étude d’ingénierie, ni un plan signé, ni un devis, ni une certification de sécurité. Il peut être erroné. Avant de construire ou de mettre sous tension un système réel, faites-le vérifier par un ingénieur ou un électricien agréé.",
    chatPrivacySummary:
      "Aucune inscription, aucun cookie publicitaire ni profil analytique. Le texte de votre conversation est envoyé au fournisseur d’IA pour générer une réponse et n’est pas conservé ici. N’y saisissez aucune information sensible.",
    emailWelcome: "Vous pouvez m’écrire par e-mail :",
    emailSupportExpectations:
      "Je suis une seule personne qui répond aux e-mails sur son temps libre, par gentillesse — ce n’est pas un service d’assistance. Je lis ce que je peux et réponds quand je le peux, sans pouvoir garantir une réponse ni un délai. Mes messages sont des avis amicaux destinés à vos recherches, pas des conseils professionnels en ingénierie, électricité ou finance, et ne créent aucune relation ni obligation professionnelle. Pour tout ce que vous comptez réellement construire, mettre sous tension ou payer, consultez un ingénieur ou un électricien agréé de votre région.",
    footerWarranty:
      "Fourni gratuitement en l’état, sans garantie d’aucune sorte, expresse ou implicite. Les estimations sont uniquement pédagogiques et peuvent être inexactes. Le travail sur des batteries, de forts courants CC et le câblage secteur peut provoquer un incendie, des blessures graves ou la mort — vous êtes responsable de votre sécurité, de vos décisions et du respect du code électrique local. Faites tout vérifier par un professionnel agréé avant de construire. - Blog - Références mondiales - Carte thermique - À propos - Conditions - Assistance - lucasballek@gmail.com",
    operatorDescription:
      "Cet outil pédagogique est gratuit, personnel et non commercial ; il est exploité par une personne, Lucas Ballek. Ce n’est ni une société ni une entreprise constituée, ni un cabinet agréé d’ingénierie, d’installation électrique ou de conseil financier. Rien sur ce site n’est à vendre et aucun service ne vous est proposé ni promis.",
    independentVerification:
      "Tous les résultats sont des estimations pédagogiques automatisées produites à partir des hypothèses que vous fournissez. Ce ne sont ni une conception, ni un plan signé, ni un devis, ni une évaluation de sécurité, ni un contrôle de conformité aux normes. Ils peuvent comporter des erreurs. Ne vous y fiez pas. Avant tout achat, toute construction ou mise sous tension, faites vérifier indépendamment chaque valeur — capacité, dimensionnement des câbles, calibre des fusibles et compatibilité des équipements — par un ingénieur professionnel ou un électricien agréé dans votre juridiction.",
    llmDisclaimer:
      "Vous échangez avec un grand modèle de langage. Il produit des textes fluides et assurés qui peuvent être factuellement erronés, y compris sur des nombres précis, des prix, des caractéristiques de produits et des réglementations. Considérez chaque réponse comme un point de départ non vérifié.",
    electricalSafetyDisclaimer:
      "Les batteries, les forts courants CC et le câblage secteur peuvent provoquer un arc électrique, une électrocution, un incendie, un dégagement de gaz toxiques, des blessures graves et la mort. Les cellules au lithium peuvent subir un emballement thermique. Vous êtes seul responsable de votre sécurité et de celle des personnes touchées par vos travaux. Vous êtes aussi seul responsable des permis, inspections et du respect des codes électriques et incendie locaux.",
    siteAsIs:
      "CE SITE ET SES RÉSULTATS SONT FOURNIS « EN L’ÉTAT » ET « SELON DISPONIBILITÉ », SANS GARANTIE D’AUCUNE SORTE, EXPRESSE OU IMPLICITE, Y COMPRIS, SANS S’Y LIMITER, LES GARANTIES DE QUALITÉ MARCHANDE, D’ADÉQUATION À UN USAGE PARTICULIER, D’EXACTITUDE ET D’ABSENCE DE CONTREFAÇON. Leur disponibilité, leur exactitude ou leur fonctionnement continu ne sont pas garantis ; le site peut changer ou disparaître à tout moment sans préavis.",
    liabilityLimitation:
      "Dans toute la mesure permise par le droit applicable, l’exploitant ne pourra être tenu responsable des dommages directs, indirects, accessoires, consécutifs, spéciaux ou punitifs — notamment des dommages matériels, incendies, blessures, économies perdues ou interruptions d’activité — résultant de l’utilisation de cet outil gratuit ou de la confiance qui lui est accordée. Certaines juridictions n’autorisent pas certaines exclusions ; elles ne s’appliquent alors que dans la mesure permise. Rien ici n’exclut une responsabilité qui ne peut légalement l’être, notamment en cas de décès ou de blessure causés par négligence, ou de fraude.",
    donationTermsPrefix:
      "Toute contribution que vous choisissez d’envoyer est un don volontaire à une personne. Elle n’est pas",
    donationNotTaxDeductible: "déductible des impôts",
    donationTermsSuffix:
      ", ne constitue pas le paiement de biens ou services, ne crée aucun contrat, ne vous donne droit à rien et n’est remboursable en échange d’aucune obligation. Votre contribution ne change en rien le service que vous recevez.",
    advisorPrivacyDisclosure:
      "Aucun compte n’est requis et aucune donnée personnelle n’est demandée. Le texte saisi dans le conseiller est transmis à un fournisseur d’IA tiers (Groq) pour générer une réponse, selon ses conditions. Ce site ne conserve pas les conversations. N’y saisissez aucune information personnelle, financière ou autrement sensible. Des compteurs de requêtes de base peuvent être enregistrés pour maintenir le service et prévenir les abus.",
    rateLimitDisclaimer:
      "N’automatisez pas, ne récupérez pas massivement et ne surchargez pas cet outil — une seule personne paie les appels à l’IA. Des limites de débit s’appliquent et les abus seront bloqués.",
  },
  de: {
    homeIntro:
      "Geben Sie Ihren Standort und Ihre durchschnittliche Stromrechnung ein. Wir simulieren 5 Jahre stündlicher NASA-Satellitenwetterdaten, um die passende Größe Ihrer Solarmodule und Batteriespeicher zu berechnen – einschließlich realistischer Amortisation über 20 Jahre, Austauschintervall der Batterie und Gerätekosten in Ihrer Landeswährung.",
    quickSetupTitle: "⚡ Schnellstart",
    quickSetupHint:
      "— Eingaben auswählen und dann System dimensionieren anklicken",
    preciseLocationHelp:
      "Die Schaltfläche für den genauen Standort trägt Ihre Koordinaten ein und ruft die Preise der nächstgelegenen Referenzregion ab. Für einen anderen Ort geben Sie eine Stadt oder einen Ort ein und drücken Enter oder Tab, um den Treffer auszuwählen. Klicken Sie anschließend auf System dimensionieren.",
    imageryPrivacy:
      "Satellitenbilder (ohne Konto) werden erst geladen, wenn Sie sie anfordern. Koordinaten werden an die Kartenkacheln und die NASA-Wetterdaten übermittelt; gespeichert wird nichts.",
    locationPrecision:
      "Eine Stadtsuche ist bequem, aber Ihr genauer Standort liefert die präziseste Wetter- und Solarschätzung. Geben Sie Breiten- und Längengrad manuell ein oder verwenden Sie Meinen aktuellen Standort für das GPS des Browsers.",
    monthlyBillLabel:
      "Ihre monatliche Stromrechnung — ein grober Wert genügt; er passt sich den Preisen an Ihrem Standort an",
    electricityRateLabel:
      "Strompreis an Ihrem Wohnort (bestimmt Rechnungsschätzung und Amortisation) — Ihr Preis pro kWh ($):",
    generatorAssumption:
      "Angenommen wird ein kleiner Generator bei typischer Teillast: Benzin 0.5 L/kWh, Diesel 0.35 L/kWh (nur Kraftstoff; Öl, Filter und Motorverschleiß erhöhen die tatsächlichen Kosten). Wenn Sie Ihre tatsächlichen Kosten in $/kWh kennen, geben Sie sie direkt ein.",
    feedInCreditLabel:
      "Vergütung für verkaufbaren Überschuss ($/kWh, optional — nur bei Netzanschluss):",
    fixedMonthlyChargeLabel:
      "Feste monatliche Gebühr auf Ihrer Rechnung ($/Monat, optional — Solar kann sie nicht senken):",
    applianceWattages:
      "Die Leistungen sind typische Werte; Ihre können abweichen. Geräte mit Taktbetrieb (Kühlschränke, Gefriergeräte, Klimaanlagen und Pumpen) verbrauchen nur während des Betriebs Strom: Der Regler zeigt die tatsächlichen Betriebsstunden pro Tag, begrenzt auf eine realistische Kompressorlaufzeit; jede Zeile zeigt den daraus berechneten 24-Stunden-Durchschnitt. Ein moderner Kühlschrank verbraucht beim Standardwert (100 W im Betrieb, etwa 10 h/Tag) tatsächlich rund 1 kWh/Tag.",
    fixedChargeTaxEstimate:
      "Rechnungen enthalten feste Gebühren und Steuern. Daher überschätzt diese Zahl den tatsächlichen Verbrauch leicht — ein sicherer Fehler in diese Richtung.",
    roofAreaLabel: "Optionale Dach- oder Grundstücksfläche (m²)",
    roofAreaHelp:
      "Eine grobe manuelle Schätzung genügt: etwa 6 m² je 400-W-Panel. Damit wird nur die gesuchte Solargröße begrenzt; für die normale Schätzung lassen Sie das Feld leer. Ihre Koordinaten werden nie gespeichert.",
    independenceTarget: "Unabhängigkeitsziel (gilt für alle drei Zellchemien):",
    billCutTarget:
      "Ziel für die Rechnungssenkung — steuert auch den Ergebnisregler:",
    fxRateHelp:
      "Wie viele Einheiten Ihrer Währung 1 US-Dollar entsprechen. Der Wert wird für Ihren Standort automatisch eingetragen; ändern Sie ihn nur, wenn Sie einen anderen Kurs kennen.",
    surplusTargetHelp:
      "Über 100 % wird das System so dimensioniert, dass es verkaufbaren Überschuss erzeugt. Ohne oben eingetragene Einspeisevergütung hat dieser Überschuss keinen Geldwert und wird als abgeregelte Verschwendung markiert. Die Matrixspalte „Ihr Ziel“ und die Preissenkungskurve folgen diesem Regler.",
    resultsIntro:
      "Hier erscheinen die Ergebnisse: zuerst ein empfohlener Weg, darunter Batterievergleiche und alle Optionen. Bei netzgekoppelten Plänen unterscheidet das Ergebnis außerdem zwischen Rechnungssenkung und Notstromversorgung.",
    bomSafetyNote:
      "Pädagogische Schätzung aus Ihrer Dimensionierung — kein Ingenieurplan und keine Einkaufsliste. Die Werte für Sicherungen und Kabel setzen Kupfer, eine konservative Strombelastbarkeit und eine kurze Strecke zwischen Batterie und Wechselrichter voraus. Lassen Sie alles vor dem Kauf oder Einschalten von einer zugelassenen Fachkraft anhand der örtlichen Elektrovorschriften prüfen.",
    assumptionsIntro:
      "Führen Sie zuerst eine Dimensionierung aus. Alle verwendeten Konstanten (Abminderungen, Temperaturmodell, Wirkungsgrade, Wetterdatenjahre und Quelle) sind hier aufgeführt.",
    partsListIntro:
      "Eine Referenzliste, damit Sie wissen, aus welchen Teilen das System besteht und was sie ungefähr kosten. Nichts davon wird auf dieser Website verkauft — die Richtpreise stammen aus dem freien Markt und ändern sich laufend.",
    lfpCells:
      "Fabrikneue prismatische LFP-Zellen der Güteklasse A. Konfiguration 16S je Pack (51.2 V nominal).",
    batteryManagementSpec:
      "Intelligenter aktiver Zellenausgleich (Ausgleichsstrom 2 A), zwei Temperaturfühler und RS485/CANbus-Kommunikation mit Sol-Ark und Victron.",
    breakerSpec:
      "AIC-Ausschaltvermögen 20 kA bei 160 V DC. Unterbricht sehr hohe DC-Kurzschlussströme in Millisekunden — zum Schutz von BMS und Verkabelung dimensioniert.",
    endplateSpec:
      "Endplatten mit Belleville-Federscheiben halten eine gleichmäßige Kompression aufrecht (etwa 3,000 N). Hersteller nennen Vorteile für die Zyklenlebensdauer; konkrete Verbesserungen gelten als nicht verifiziert.",
    faqIntro:
      "Kurze Antworten auf häufige Fragen. Der KI-Berater kann jede davon ausführlicher erklären.",
    estimateMethodDisclaimer:
      "Jede Zahl stammt aus prüfbarem Code, der Ihren genauen Standort mit fünf Jahren NASA-Satellitenwetterdaten simuliert — sie ist keine KI-Schätzung. Reale Ergebnisse hängen auch von Verschattung, Installationsqualität und Geräten ab. Lassen Sie jedes gebaute System von einer zugelassenen Fachkraft prüfen.",
    paybackClaim:
      "Wo Netzstrom teuer ist — etwa auf Hawaii und anderen Inseln sowie in großen Teilen Europas, Afrikas und Südasiens — amortisiert eine fachgerecht gebaute Solaranlage mit Speicher ihre Komponenten häufig in ein bis vier Jahren und läuft danach jahrzehntelang fast kostenlos. Der Rechner zeigt Ihre persönliche Amortisation auf Grundlage Ihres Tarifs.",
    batteryCostClaim:
      "Selbst gebaute Batteriespeicher aus prismatischen Zellen kosten meist etwa $80–125 je nutzbarer kWh einschließlich Versand und entrichteter Einfuhrabgaben; günstige Handelspacks liegen ungefähr bei $110–165. Module kommen mit etwa $0.16–0.38 je Watt hinzu. Jedes Ergebnis weist den Preisumfang transparent aus.",
    offgridTradeoff:
      "Nur wenn Sie während wochenlangen Schlechtwetters nahezu vollständig unabhängig sein möchten. Die drei netzfernen Optionen zeigen genau diesen Zielkonflikt: Eine benötigt nie einen Generator, eine braucht ihn ungefähr einen Tag pro Jahr, die dritte nur gelegentlich. Wer am Stromnetz bleibt, kann dies überspringen.",
    offlineFallback:
      "Ja. Nach Ihrem ersten Besuch installiert sich das Werkzeug als Offline-App: Die Berechnungen laufen vollständig im Browser. Bei einem Netzausfall werden mitgelieferte typische Wetterdaten für die nächstgelegene von 66 Referenzstädten verwendet.",
    batterySafety:
      "Das erfordert Respekt: Lithiumzellen speichern genug Energie, um Brände auszulösen, und DC-Lichtbögen schalten sich nicht von selbst ab. Die Anleitungen bestehen auf geeigneten Sicherungen, einem BMS und der Einhaltung der Vorschriften. Vor dem Einschalten soll eine zugelassene Elektrofachkraft alles prüfen.",
    donationIntro:
      "Das Werkzeug ist kostenlos und bleibt es auch. Wenn es Ihnen geholfen hat und Sie etwas zu den KI- und Hostingkosten beitragen möchten, können Sie das hier tun.",
    donationRecipientPrefix: "Beiträge gehen direkt an",
    donationRecipientSuffix: "persönlich.",
    donationTerms:
      "Bitte lesen Sie dies, bevor Sie etwas senden. Beiträge sind freiwillige Geschenke an eine Privatperson und keine Zahlung für eine Dienstleistung. Sie sind nicht steuerlich absetzbar — dies ist weder eine Wohltätigkeitsorganisation noch eine eingetragene gemeinnützige Organisation. Sie kaufen nichts: keine Priorität, Funktionen, persönliche Beratung, Supportpflicht oder fortgesetzte Verfügbarkeit dieser Website. Alle erhalten genau dasselbe kostenlose Werkzeug, unabhängig von einem Beitrag. Senden Sie kein Geld, das Sie benötigen. Für professionelle Ingenieurhilfe wenden Sie sich stattdessen an einen zugelassenen Ingenieur oder Elektriker vor Ort.",
    freeToolDisclaimer:
      "Kurz gesagt: Dies ist ein kostenloses Lernwerkzeug einer einzelnen Person, das grobe Schätzungen liefert und keinerlei Gewährleistung bietet.",
    resultEstimateDisclaimer:
      "Die Ausgabe ist eine automatisierte Lernschätzung. Sie ist weder Ingenieurarbeit noch ein genehmigter Entwurf, ein Angebot oder eine Sicherheitszertifizierung. Sie kann falsch sein. Lassen Sie ein reales System vor dem Bau oder Einschalten von einem zugelassenen Elektriker oder Ingenieur prüfen.",
    chatPrivacySummary:
      "Keine Anmeldung, keine Werbe-Cookies und kein Analyseprofil. Ihr Chattext wird zur Antwortgenerierung an den KI-Anbieter gesendet und hier nicht gespeichert. Geben Sie keine vertraulichen Informationen ein.",
    emailWelcome: "Sie können mir gern eine E-Mail schreiben:",
    emailSupportExpectations:
      "Ich bin eine einzelne Person, die in der Freizeit und aus Gefälligkeit E-Mails beantwortet — kein Supportteam. Ich lese, was ich kann, und antworte, wenn es möglich ist; eine Antwort oder einen Zeitrahmen kann ich nicht versprechen. Meine Rückmeldung ist eine freundliche Meinung für Ihre weitere Recherche, keine professionelle Beratung zu Ingenieurwesen, Elektrik oder Finanzen und begründet weder ein berufliches Verhältnis noch eine Verpflichtung. Wenn Sie etwas tatsächlich bauen, einschalten oder mit viel Geld bezahlen wollen, wenden Sie sich an einen zugelassenen Elektriker oder Ingenieur in Ihrer Nähe.",
    footerWarranty:
      "Kostenlos und wie besehen bereitgestellt, ohne Gewährleistung jeglicher Art, weder ausdrücklich noch stillschweigend. Die Schätzungen dienen nur der Information und können ungenau sein. Arbeiten an Batterien, hohen DC-Strömen und Netzleitungen können Brände, schwere Verletzungen und Tod verursachen — Sie sind für Ihre Sicherheit, Ihre Entscheidungen und die Einhaltung der örtlichen Elektrovorschriften verantwortlich. Lassen Sie vor dem Bau alles von einer zugelassenen Fachkraft prüfen. - Blog - Weltweite Referenzwerte - Heatmap - Über uns - Bedingungen - Support - lucasballek@gmail.com",
    operatorDescription:
      "Dies ist ein kostenloses, persönliches und nicht kommerzielles Lernwerkzeug, betrieben von einer Einzelperson, Lucas Ballek. Es ist weder ein Unternehmen noch eine Kapitalgesellschaft oder ein zugelassenes Ingenieur-, Elektroinstallations- oder Finanzberatungsbüro. Auf dieser Website wird nichts verkauft und Ihnen wird keine Dienstleistung angeboten oder versprochen.",
    independentVerification:
      "Alle Ausgaben sind automatisierte Lernschätzungen auf Grundlage Ihrer Angaben. Sie sind weder ein Entwurf noch eine genehmigte Zeichnung, ein Angebot, eine Sicherheitsbewertung oder eine Prüfung der Normenkonformität. Sie können Fehler enthalten. Verlassen Sie sich nicht darauf. Prüfen Sie vor Kauf, Bau oder Inbetriebnahme jede Zahl unabhängig — Kapazität, Kabeldimensionierung, Sicherungswerte und Gerätekompatibilität — mit einem zugelassenen Elektriker oder Ingenieur in Ihrem Rechtsgebiet.",
    llmDisclaimer:
      "Sie interagieren mit einem großen Sprachmodell. Es erzeugt flüssige, überzeugend klingende Texte, die sachlich falsch sein können, auch bei konkreten Zahlen, Preisen, Produktspezifikationen und Vorschriften. Behandeln Sie jede Antwort als ungeprüften Ausgangspunkt.",
    electricalSafetyDisclaimer:
      "Batteriespeicher, hohe DC-Ströme und Netzleitungen können Lichtbögen, Stromschläge, Brände, giftige Gase, schwere Verletzungen und Tod verursachen. Lithiumzellen können thermisch durchgehen. Sie sind allein für Ihre Sicherheit und die Sicherheit aller von Ihrem Bau betroffenen Personen verantwortlich. Sie sind ebenfalls allein für Genehmigungen, Prüfungen und die örtlichen Elektro- und Brandschutzvorschriften verantwortlich.",
    siteAsIs:
      "DIESE WEBSITE UND IHRE AUSGABEN WERDEN „WIE BESEHEN“ UND „NACH VERFÜGBARKEIT“ OHNE GEWÄHRLEISTUNG JEGLICHER ART BEREITGESTELLT, WEDER AUSDRÜCKLICH NOCH STILLSCHWEIGEND. DAS UMFASST UNTER ANDEREM GEWÄHRLEISTUNGEN DER MARKTGÄNGIGKEIT, EIGNUNG FÜR EINEN BESTIMMTEN ZWECK, RICHTIGKEIT UND NICHTVERLETZUNG. Verfügbarkeit, Richtigkeit und fortgesetzter Betrieb werden nicht garantiert; die Website kann sich jederzeit ohne Ankündigung ändern oder verschwinden.",
    liabilityLimitation:
      "Soweit nach geltendem Recht zulässig, haftet der Betreiber nicht für direkte, indirekte, beiläufige, Folge-, besondere oder Strafschäden — darunter Sachschäden, Brände, Personenschäden, entgangene Ersparnisse oder Betriebsunterbrechungen — die aus der Nutzung oder dem Vertrauen auf dieses kostenlose Werkzeug entstehen. Manche Rechtsordnungen erlauben bestimmte Ausschlüsse nicht; dort gelten sie nur im zulässigen Umfang. Nichts hierin schließt eine gesetzlich nicht ausschließbare Haftung aus, insbesondere bei Tod oder Körperverletzung durch Fahrlässigkeit oder bei Betrug.",
    donationTermsPrefix:
      "Jeder Beitrag, den Sie senden möchten, ist ein freiwilliges Geschenk an eine Privatperson. Er ist nicht",
    donationNotTaxDeductible: "steuerlich absetzbar",
    donationTermsSuffix:
      ", keine Zahlung für Waren oder Dienstleistungen, begründet keinen Vertrag, gewährt keinen Anspruch und ist nicht im Austausch gegen irgendeine Verpflichtung erstattbar. Ein Beitrag ändert die erhaltene Leistung in keiner Weise.",
    advisorPrivacyDisclosure:
      "Ein Konto ist nicht erforderlich und persönliche Angaben werden nicht verlangt. Der Text, den Sie dem Berater senden, wird zur Antwortgenerierung gemäß deren Bedingungen an einen externen KI-Anbieter (Groq) übertragen. Diese Website speichert Gespräche nicht. Geben Sie keine persönlichen, finanziellen oder sonstigen vertraulichen Informationen ein. Einfache Anfragezähler können erfasst werden, um den Dienst zu betreiben und Missbrauch zu verhindern.",
    rateLimitDisclaimer:
      "Automatisieren, scrapen oder überlasten Sie dieses Werkzeug nicht — eine einzelne Person bezahlt die KI-Aufrufe. Es gelten Nutzungslimits; Missbrauch wird blockiert.",
  },
  ar: {
    homeIntro:
      "أدخل موقعك ومتوسط فاتورة الكهرباء. نحاكي 5 سنوات من بيانات الطقس الساعية عبر الأقمار الصناعية التابعة لناسا لتحديد الحجم الدقيق للألواح الشمسية وتخزين البطارية الذي تحتاج إليه، مع فترة استرداد واقعية على مدى 20 عامًا، وتواتر استبدال البطارية، وتكاليف المعدات بعملتك المحلية.",
    quickSetupTitle: "⚡ إعداد سريع",
    quickSetupHint: "— اختر المدخلات، ثم انقر على تحديد حجم النظام",
    preciseLocationHelp:
      "يملأ زر تحديد الموقع الدقيق إحداثياتك الفعلية ويجلب أسعار المنطقة من أقرب منطقة مرجعية. لمكان آخر، اكتب اسم مدينة أو بلدة واضغط Enter أو Tab لاختيارها، ثم انقر على تحديد حجم النظام لإجراء الحساب.",
    imageryPrivacy:
      "لا تُحمّل صور الأقمار الصناعية (ولا تحتاج إلى حساب) إلا بعد طلبها. تُرسل الإحداثيات إلى مربعات الخريطة وبيانات الطقس التابعة لناسا؛ ولا يُحفظ أي شيء.",
    locationPrecision:
      "البحث عن مدينة مريح، لكن موقعك الدقيق يعطي التقدير الأكثر دقة للطقس والطاقة الشمسية. أدخل خط العرض والطول يدويًا، أو استخدم «استخدام موقعي الحالي» للاستفادة من GPS في المتصفح.",
    monthlyBillLabel:
      "فاتورة الكهرباء الشهرية — يكفي رقم تقريبي، وسيُعدّل تلقائيًا حسب أسعار منطقتك",
    electricityRateLabel:
      "سعر الكهرباء في مكان سكنك (يحدد تقدير الفاتورة وفترة الاسترداد) — سعرك لكل kWh ($):",
    generatorAssumption:
      "يفترض مولدًا صغيرًا عند حمل جزئي معتاد: بنزين 0.5 L/kWh وديزل 0.35 L/kWh (الوقود فقط؛ فالزيت والفلاتر وتآكل المحرك ترفع التكلفة الحقيقية). إذا كنت تعرف تكلفتك الفعلية لكل $/kWh فأدخلها مباشرة.",
    feedInCreditLabel:
      "رصيد بيع فائض الكهرباء ($/kWh، اختياري — للاتصال بالشبكة فقط):",
    fixedMonthlyChargeLabel:
      "الرسوم الشهرية الثابتة في الفاتورة ($/شهر، اختيارية — لا يمكن للطاقة الشمسية خفضها):",
    applianceWattages:
      "القدرات قيم نموذجية وقد تختلف لديك. الأجهزة التي تعمل بالدورات (الثلاجات والمجمدات ومكيفات الهواء والمضخات) لا تستهلك الطاقة إلا أثناء التشغيل: يحدد شريط التمرير ساعات التشغيل الفعلية يوميًا، مع حد أقصى واقعي لوقت عمل الضاغط، ويعرض كل صف متوسط الاستهلاك الناتج خلال 24 ساعة. تستهلك الثلاجة الحديثة عند القيمة الافتراضية (100 W أثناء التشغيل، نحو 10 ساعات يوميًا) حوالي 1 kWh يوميًا فعلًا.",
    fixedChargeTaxEstimate:
      "تشمل الفواتير رسومًا ثابتة وضرائب، لذلك يبالغ هذا قليلًا في تقدير الاستهلاك الحقيقي — وهو اتجاه أكثر أمانًا للخطأ.",
    roofAreaLabel: "مساحة اختيارية للسقف أو الأرض (m²)",
    roofAreaHelp:
      "يكفي تقدير يدوي تقريبي: نحو 6 m² لكل لوح بقدرة 400 W. هذا يضع حدًا لحجم الطاقة الشمسية الذي يجري البحث عنه فقط؛ اتركه فارغًا للتقدير العادي. لا تُخزّن إحداثياتك مطلقًا.",
    independenceTarget:
      "هدف الاستقلال عن الشبكة (يُطبّق على أنواع البطاريات الثلاثة):",
    billCutTarget: "هدف خفض الفاتورة — ويضبط أيضًا شريط تمرير النتائج:",
    fxRateHelp:
      "عدد وحدات عملتك التي تساوي 1 دولار أمريكي. يُملأ تلقائيًا حسب موقعك؛ غيّره فقط إذا كنت تعرف سعرًا مختلفًا.",
    surplusTargetHelp:
      "فوق 100%، يُحدّد حجم النظام لإنتاج فائض قابل للبيع. من دون إدخال رصيد بيع فائض الكهرباء أعلاه، لا تكون لهذا الفائض قيمة نقدية ويُشار إليه على أنه هدر مُقيّد. يتبع عمود «هدفك» في المصفوفة ومنحنى خفض السعر شريط التمرير هذا.",
    resultsIntro:
      "تظهر النتائج هنا: مسار موصى به أولًا، ثم مقارنات البطاريات وجميع الخيارات أدناه. وفي الخطط المتصلة بالشبكة، تفصل النتيجة أيضًا بين خفض الفاتورة وتوفير الطاقة أثناء الانقطاع.",
    bomSafetyNote:
      "تقدير تعليمي مبني على نتيجة تحديد الحجم — وليس تصميمًا هندسيًا ولا قائمة مشتريات. تفترض قيم المصهر والكابل استخدام النحاس، وسعة تيار محافظة، ومسافة قصيرة بين البطارية والعاكس. تحقّق من كل شيء وفق الكود الكهربائي المحلي مع مختص مرخّص قبل شراء أي شيء أو تشغيله.",
    assumptionsIntro:
      "أجرِ حساب تحديد الحجم أولًا — جميع الثوابت المستخدمة (معاملات الخفض، نموذج الحرارة، الكفاءات، سنوات بيانات الطقس ومصدرها) مدرجة هنا.",
    partsListIntro:
      "قائمة مرجعية توضّح مكوّنات النظام وتكلفتها التقريبية. لا يبيع هذا الموقع أيًا مما ورد هنا؛ فالأسعار استرشادية مأخوذة من السوق المفتوحة وتتغير باستمرار.",
    lfpCells:
      "خلايا LFP منشورية جديدة من الدرجة A. تكوين 16S لكل حزمة (51.2 V اسميًا).",
    batteryManagementSpec:
      "موازنة نشطة ذكية (تيار موازنة 2 A)، ومجسّا حرارة، واتصالات RS485/CANbus مع Sol-Ark وVictron.",
    breakerSpec:
      "قدرة فصل AIC تبلغ 20 kA عند 160 V DC. يفصل تيارات قصر DC العالية جدًا خلال أجزاء من الثانية — ومصمم لحماية BMS والأسلاك.",
    endplateSpec:
      "تحافظ الألواح الطرفية ذات الغسالات الزنبركية Belleville على ضغط متساوٍ (نحو 3,000 N). يذكر المصنعون فوائد لعمر الدورات؛ وتعامل مع أي مكاسب محددة على أنها غير موثقة.",
    faqIntro:
      "إجابات قصيرة عن أكثر الأسئلة شيوعًا. ويمكن لمستشار الذكاء الاصطناعي التوسع في أي منها.",
    estimateMethodDisclaimer:
      "يأتي كل رقم من كود قابل للاختبار يحاكي موقعك الدقيق باستخدام خمس سنوات من بيانات الطقس عبر أقمار ناسا — وليس من تخمين الذكاء الاصطناعي. تختلف النتائج الواقعية أيضًا حسب الظلال وجودة التركيب والمعدات؛ لذا اطلب من مختص مرخّص التحقق من أي نظام تبنيه.",
    paybackClaim:
      "في الأماكن التي ترتفع فيها تكلفة كهرباء الشبكة — هاواي والجزر وأجزاء واسعة من أوروبا وأفريقيا وجنوب آسيا — غالبًا ما يسترد نظام شمسي مع تخزين، مبني بشكل صحيح، تكلفة مكوّناته خلال سنة إلى أربع سنوات، ثم يعمل بتكلفة شبه معدومة لعقود. تعرض الحاسبة فترة الاسترداد الخاصة بك وفق تعرفة الكهرباء لديك.",
    batteryCostClaim:
      "تبلغ تكلفة حزم البطاريات التي تُجمع ذاتيًا من خلايا منشورية عادةً $80–125 لكل kWh قابل للاستخدام، شاملة الشحن والرسوم الجمركية المدفوعة؛ أما الحزم التجارية الاقتصادية فتبلغ نحو $110–165. وتضيف الألواح نحو $0.16–0.38 لكل واط. توضح كل نتيجة نطاق السعر بصدق.",
    offgridTradeoff:
      "فقط إذا كنت تريد استقلالًا شبه كامل خلال أسابيع الطقس السيئ. تعرض الخيارات الثلاثة خارج الشبكة هذه المقايضة بوضوح: أحدها لا يحتاج إلى مولد مطلقًا، والثاني يحتاج إليه نحو يوم في السنة، والثالث من حين إلى آخر فقط. يمكن لمن يبقى متصلًا بالشبكة تخطي ذلك.",
    offlineFallback:
      "نعم. بعد زيارتك الأولى، تثبّت الأداة نفسها كتطبيق يعمل دون اتصال: تُجرى حسابات تحديد الحجم بالكامل في المتصفح، وعند انقطاع الشبكة تستخدم بيانات طقس نموذجية لسنة واحدة المضمّنة لأقرب مدينة من 66 مدينة مرجعية.",
    batterySafety:
      "يتطلب الأمر احترامًا وحذرًا: تخزّن خلايا الليثيوم طاقة كافية لبدء حريق، ولا تنطفئ أقواس التيار المستمر تلقائيًا. تشدد الأدلة هنا على استخدام المصاهر المناسبة وBMS والامتثال للكود، وعلى فحص كهربائي مرخّص لكل شيء قبل تشغيله.",
    donationIntro:
      "هذه الأداة مجانية وستبقى كذلك. إذا أفادتك وأردت المساهمة في تكاليف الذكاء الاصطناعي والاستضافة، فإليك الطريقة.",
    donationRecipientPrefix: "تذهب المساهمات مباشرة إلى",
    donationRecipientSuffix: "شخصيًا.",
    donationTerms:
      "يرجى القراءة قبل إرسال أي مبلغ. المساهمات هدايا طوعية لفرد وليست مقابل خدمة. وهي غير قابلة للخصم الضريبي؛ فهذا ليس عملًا خيريًا ولا مؤسسة غير ربحية مسجلة. لا تشتري أي شيء: لا أولوية ولا ميزات ولا نصيحة شخصية ولا التزام دعم ولا ضمان استمرار هذا الموقع. يحصل الجميع على الأداة المجانية نفسها تمامًا سواء ساهموا أم لا. لا ترسل مالًا تحتاج إليه. وإذا كنت تريد دفع تكلفة مساعدة هندسية مهنية، فالأفضل إنفاقه لدى مهندس أو كهربائي محلي مرخّص.",
    freeToolDisclaimer:
      "باختصار: هذه أداة تعليمية مجانية يقدمها شخص واحد، وتنتج تقديرات تقريبية من دون أي ضمان من أي نوع.",
    resultEstimateDisclaimer:
      "المخرجات تقدير تعليمي آلي. وهي ليست عملًا هندسيًا ولا تصميمًا مختومًا ولا عرض سعر ولا شهادة سلامة. وقد تكون خاطئة. اطلب من كهربائي أو مهندس مرخّص مراجعة أي نظام فعلي قبل بنائه أو تشغيله.",
    chatPrivacySummary:
      "لا يلزم التسجيل، ولا توجد ملفات تعريف ارتباط إعلانية أو ملفات تحليلية. يُرسل نص محادثتك إلى مزود الذكاء الاصطناعي لإعداد الرد ولا يُخزّن هنا. لا تكتب معلومات حساسة.",
    emailWelcome: "يسعدني أن تراسلني عبر البريد الإلكتروني:",
    emailSupportExpectations:
      "أنا شخص واحد أجيب عن البريد في وقتي الخاص كمجاملة — ولست مكتب دعم. أقرأ ما أستطيع وأرد عندما يتاح لي ذلك، لكن لا أستطيع ضمان الرد أو موعده. ما أرسله رأي ودي لمساعدتك في بحثك، وليس نصيحة هندسية أو كهربائية أو مالية مهنية، ولا ينشئ علاقة أو التزامًا مهنيًا. لأي شيء تنوي بناءه أو تشغيله أو دفع مال حقيقي مقابله، تحدّث إلى كهربائي أو مهندس مرخّص في منطقتك.",
    footerWarranty:
      "تُقدّم الأداة مجانًا كما هي، من دون أي ضمان صريح أو ضمني. التقديرات تعليمية فقط وقد تكون غير دقيقة. قد يؤدي العمل بالبطاريات والتيارات العالية المستمرة وأسلاك الكهرباء الرئيسية إلى حريق أو إصابة خطيرة أو وفاة — وأنت مسؤول عن سلامتك وقراراتك والامتثال للكود الكهربائي المحلي. تحقّق من كل شيء مع مختص مرخّص قبل البناء. - المدونة - مراجع عالمية - خريطة حرارية - من نحن - الشروط - الدعم - lucasballek@gmail.com",
    operatorDescription:
      "هذه أداة تعليمية مجانية وشخصية وغير تجارية يديرها فرد هو Lucas Ballek. ليست شركة أو كيانًا مسجلًا، ولا ممارسة مرخّصة للهندسة أو المقاولات الكهربائية أو الاستشارات المالية. لا يُباع أي شيء على هذا الموقع، ولا يُعرض عليك أيٌّ من الخدمات أو يُوعَد به.",
    independentVerification:
      "جميع المخرجات تقديرات تعليمية آلية مبنية على الافتراضات التي تقدمها. وليست تصميمًا ولا رسمًا مختومًا ولا عرض سعر ولا تقييمًا للسلامة ولا مراجعة للامتثال للكود. وقد تتضمن أخطاء. لا تعتمد عليها. تحقّق بشكل مستقل من كل رقم — السعة ومقاسات الأسلاك وقيم المصاهر وتوافق المعدات — لدى كهربائي مرخّص أو مهندس محترف في نطاقك القضائي قبل الشراء أو البناء أو التشغيل.",
    llmDisclaimer:
      "أنت تتفاعل مع نموذج لغوي كبير. ينتج نصوصًا سلسة وواثقة قد تكون خاطئة من الناحية الواقعية، بما في ذلك الأرقام المحددة والأسعار ومواصفات المنتجات واللوائح. تعامل مع كل مخرجاته كنقطة بداية غير موثّقة.",
    electricalSafetyDisclaimer:
      "قد تتسبب حزم البطاريات والتيارات المستمرة العالية وأسلاك الكهرباء الرئيسية في وميض قوسي وصعق كهربائي وحريق وانبعاث غازات سامة وإصابة خطيرة ووفاة. وقد تدخل خلايا الليثيوم في حالة هروب حراري. أنت وحدك مسؤول عن سلامتك وسلامة كل من يتأثر بما تبنيه. وأنت وحدك مسؤول أيضًا عن التصاريح والفحوص والامتثال للأكواد الكهربائية وأكواد الحريق المحلية.",
    siteAsIs:
      "يُقدَّم هذا الموقع ومخرجاته «كما هي» و«حسب التوفر»، من دون أي ضمان صريح أو ضمني، بما في ذلك على سبيل المثال لا الحصر ضمانات قابلية التسويق والملاءمة لغرض معين والدقة وعدم التعدي. ولا يوجد ضمان للتوفر أو الصحة أو استمرار التشغيل؛ وقد يتغير الموقع أو يختفي في أي وقت دون إشعار.",
    liabilityLimitation:
      "إلى أقصى حد يسمح به القانون المعمول به، لا يكون المشغّل مسؤولًا عن أي أضرار مباشرة أو غير مباشرة أو عرضية أو تبعية أو خاصة أو عقابية — بما فيها تلف الممتلكات والحريق والإصابة الشخصية وفقدان المدخرات أو توقف الأعمال — الناشئة عن استخدامك لهذه الأداة المجانية أو اعتمادك عليها. لا تسمح بعض الولايات القضائية باستثناءات معينة، وعندئذ لا تسري إلا بالقدر المسموح به. لا يستثني أي شيء هنا مسؤولية لا يجوز استثناؤها قانونًا، بما في ذلك الوفاة أو الإصابة الشخصية الناتجة عن الإهمال أو الاحتيال.",
    donationTermsPrefix: "أي مساهمة تختار إرسالها هي هدية طوعية لفرد. وهي ليست",
    donationNotTaxDeductible: "قابلة للخصم الضريبي",
    donationTermsSuffix:
      "، وليست دفعًا مقابل سلع أو خدمات، ولا تنشئ عقدًا أو تمنحك حقًا، ولا تُسترد مقابل أي التزام. ولا تغيّر مساهمتك الخدمة التي تحصل عليها بأي شكل.",
    advisorPrivacyDisclosure:
      "لا يلزم وجود حساب ولا تُطلب بيانات شخصية. يُنقل النص الذي تكتبه للمستشار إلى مزود ذكاء اصطناعي خارجي (Groq) لإعداد رد، وفقًا لشروطه. لا يخزن هذا الموقع المحادثات. يُرجى عدم إدخال معلومات شخصية أو مالية أو أي معلومات حساسة أخرى. قد تُسجّل أعداد الطلبات الأساسية لتشغيل الخدمة ومنع إساءة الاستخدام.",
    rateLimitDisclaimer:
      "لا تؤتمت هذه الأداة أو تكشطها أو تثقلها بالطلبات — فهناك شخص واحد يدفع تكلفة استدعاءات الذكاء الاصطناعي. تُطبّق حدود للاستخدام وسيُحظر إساءة الاستخدام.",
  },
};

// Split copy around live controls so applying a locale keeps their DOM nodes.
const FOOTER_LINKS = {
  en: {
    footerBenchmarks: "Worldwide Benchmarks",
    footerHeatmap: "Heatmap",
    footerAbout: "About",
    footerTerms: "Terms",
  },
  es: {
    footerBenchmarks: "Referencias mundiales",
    footerHeatmap: "Mapa de calor",
    footerAbout: "Acerca de",
    footerTerms: "T\u00e9rminos",
  },
  pt: {
    footerBenchmarks: "Refer\u00eancias mundiais",
    footerHeatmap: "Mapa de calor",
    footerAbout: "Sobre",
    footerTerms: "Termos",
  },
  fr: {
    footerBenchmarks: "R\u00e9f\u00e9rences mondiales",
    footerHeatmap: "Carte thermique",
    footerAbout: "\u00c0 propos",
    footerTerms: "Conditions",
  },
  de: {
    footerBenchmarks: "Weltweite Vergleichswerte",
    footerHeatmap: "W\u00e4rmekarte",
    footerAbout: "\u00dcber uns",
    footerTerms: "Nutzungsbedingungen",
  },
  ar: {
    footerBenchmarks:
      "\u0627\u0644\u0645\u0639\u0627\u064a\u064a\u0631 \u0627\u0644\u0639\u0627\u0644\u0645\u064a\u0629",
    footerHeatmap:
      "\u062e\u0631\u064a\u0637\u0629 \u0627\u0644\u062d\u0631\u0627\u0631\u0629",
    footerAbout: "\u0645\u0646 \u0646\u062d\u0646",
    footerTerms: "\u0627\u0644\u0634\u0631\u0648\u0637",
  },
};

for (const [locale, copy] of Object.entries(HOME_COPY)) {
  const fullBillLabel = copy.monthlyBillLabel;
  const billBreak = fullBillLabel.match(/\s[\u2014\u2013]\s/);
  if (!billBreak)
    throw new Error(`monthlyBillLabel split missing for ${locale}`);
  copy.monthlyBillLabel = fullBillLabel.slice(0, billBreak.index).trimEnd();
  copy.monthlyBillHint = fullBillLabel.slice(billBreak.index).trim();

  const fullGeneratorNote = copy.generatorAssumption;
  const petrol = /0\.5\s*L/.exec(fullGeneratorNote);
  const diesel = /0\.35\s*L/.exec(fullGeneratorNote);
  if (!petrol || !diesel || petrol.index >= diesel.index)
    throw new Error(`generatorAssumption split missing for ${locale}`);
  copy.generatorAssumptionMiddle = fullGeneratorNote
    .slice(petrol.index + petrol[0].length, diesel.index)
    .trim();
  copy.generatorAssumptionSuffix = fullGeneratorNote
    .slice(diesel.index + diesel[0].length)
    .trimStart();
  copy.generatorAssumption = fullGeneratorNote.slice(0, petrol.index).trimEnd();
  Object.assign(copy, FOOTER_LINKS[locale]);
}
