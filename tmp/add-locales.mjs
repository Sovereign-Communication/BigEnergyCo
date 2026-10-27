// One-shot: insert the new UI keys into every locale block of locales.js.
// Terms follow scripts/lib/translation-terminology.mjs (battery/bill/offgrid).
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "assets/js/shared/locales.js";

const K = {
  roofCapNote: {
    en: "Caps the search at {count} × {watts} W panels ≈ {kw} kW of solar (≈6 m² per panel with access space). Clear the box to remove the cap.",
    es: "Limita la búsqueda a {count} paneles de {watts} W ≈ {kw} kW de solar (≈6 m² por panel con espacio de acceso). Borra la casilla para quitar el límite.",
    pt: "Limita a busca a {count} painéis de {watts} W ≈ {kw} kW de solar (≈6 m² por painel com espaço de acesso). Apague a caixa para remover o limite.",
    fr: "Limite la recherche à {count} panneaux de {watts} W ≈ {kw} kW de solaire (≈6 m² par panneau avec espace d'accès). Effacez la case pour retirer la limite.",
    de: "Begrenzt die Suche auf {count} Panels mit {watts} W ≈ {kw} kW Solarleistung (≈6 m² pro Panel mit Zugangsfläche). Lösche das Feld, um die Grenze aufzuheben.",
    nl: "Beperkt de zoektocht tot {count} panelen van {watts} W ≈ {kw} kW zonnevermogen (≈6 m² per paneel met toegangsruimte). Wis het vak om de limiet op te heffen.",
    ar: "يحدّ البحث بـ {count} ألواح بقدرة {watts} واط ≈ {kw} كيلوواط شمسية (≈6 م² لكل لوح مع مساحة الوصول). امسح الحقل لإزالة الحد.",
  },
  roofMapNeedCity: {
    en: "Choose a city or use your location first.",
    es: "Elige una ciudad o usa tu ubicación primero.",
    pt: "Escolha uma cidade ou use a sua localização primeiro.",
    fr: "Choisissez d'abord une ville ou utilisez votre position.",
    de: "Wähle zuerst eine Stadt oder nutze deinen Standort.",
    nl: "Kies eerst een stad of gebruik uw locatie.",
    ar: "اختر مدينة أو استخدم موقعك أولًا.",
  },
  roofMapLoading: {
    en: "Loading the optional map…",
    es: "Cargando el mapa opcional…",
    pt: "Carregando o mapa opcional…",
    fr: "Chargement de la carte facultative…",
    de: "Optionale Karte wird geladen…",
    nl: "Optionele kaart laden…",
    ar: "جارٍ تحميل الخريطة الاختيارية…",
  },
  roofMapTapFirst: {
    en: "Tap 3 corners: first one roof corner, then the next corner along the same edge, then the opposite edge.",
    es: "Toca 3 esquinas: primero una esquina del tejado, luego la siguiente esquina del mismo borde y después el borde opuesto.",
    pt: "Toque em 3 cantos: primeiro um canto do telhado, depois o próximo canto ao longo da mesma borda e então a borda oposta.",
    fr: "Touchez 3 coins : d'abord un coin du toit, puis le coin suivant sur le même bord, enfin le bord opposé.",
    de: "Tippe auf 3 Ecken: zuerst eine Dachecke, dann die nächste Ecke am selben Rand, danach die gegenüberliegende Kante.",
    nl: "Tik 3 hoeken: eerst een hoek van het dak, dan de volgende hoek langs dezelfde rand, en daarna de tegenoverliggende rand.",
    ar: "اضغط على 3 زوايا: أولًا زاوية من السقف، ثم الزاوية التالية على نفس الحافة، ثم الحافة المقابلة.",
  },
  roofMapTapSecond: {
    en: "Now tap the next corner along the same roof edge.",
    es: "Ahora toca la siguiente esquina del mismo borde del tejado.",
    pt: "Agora toque no próximo canto ao longo da mesma borda do telhado.",
    fr: "Touchez maintenant le coin suivant sur le même bord du toit.",
    de: "Tippe jetzt auf die nächste Ecke am selben Dachrand.",
    nl: "Tik nu op de volgende hoek langs dezelfde dakrand.",
    ar: "الآن اضغط على الزاوية التالية على نفس حافة السقف.",
  },
  roofMapTapThird: {
    en: "Now tap anywhere on the opposite roof edge to set the width.",
    es: "Ahora toca cualquier punto del borde opuesto del tejado para fijar el ancho.",
    pt: "Agora toque em qualquer ponto da borda oposta do telhado para definir a largura.",
    fr: "Touchez maintenant n'importe où sur le bord opposé du toit pour définir la largeur.",
    de: "Tippe jetzt irgendwo auf die gegenüberliegende Dachkante, um die Breite festzulegen.",
    nl: "Tik nu ergens op de tegenoverliggende dakrand om de breedte in te stellen.",
    ar: "الآن اضغط في أي مكان على حافة السقف المقابلة لتحديد العرض.",
  },
  roofMapNotRectangle: {
    en: "Those taps don't form a rectangle — tap three corners again, starting along one roof edge.",
    es: "Esas tocas no forman un rectángulo — toca tres esquinas de nuevo, empezando por un borde del tejado.",
    pt: "Esses toques não formam um retângulo — toque em três cantos de novo, começando ao longo de uma borda do telhado.",
    fr: "Ces touches ne forment pas un rectangle — touchez trois coins à nouveau, en commençant le long d'un bord du toit.",
    de: "Diese Tipps ergeben kein Rechteck — tippe erneut auf drei Ecken, beginnend an einer Dachkante.",
    nl: "Die tikken vormen geen rechthoek — tik opnieuw op drie hoeken, beginnend langs een dakrand.",
    ar: "هذه الضغطات لا تُشكّل مستطيلًا — اضغط على ثلاث زوايا مجددًا، بدءًا من حافة السقف.",
  },
  roofPanelEstimate: {
    en: "{area} m² is about {panels} panels at ~{panelArea} m² each.",
    es: "{area} m² son unos {panels} paneles de ~{panelArea} m² cada uno.",
    pt: "{area} m² equivalem a cerca de {panels} painéis de ~{panelArea} m² cada.",
    fr: "{area} m² représentent environ {panels} panneaux de ~{panelArea} m² chacun.",
    de: "{area} m² sind etwa {panels} Panels mit je ~{panelArea} m².",
    nl: "{area} m² is ongeveer {panels} panelen van elk ~{panelArea} m².",
    ar: "{area} م² تعادل نحو {panels} لوحًا بمساحة ~{panelArea} م² لكل منها.",
  },
  roofMapAreaHint: {
    en: "{hint} This caps the searched PV size; it does not certify structural or shading suitability.",
    es: "{hint} Esto limita el tamaño FV buscado; no certifica la idoneidad estructural ni la de sombras.",
    pt: "{hint} Isso limita o tamanho FV pesquisado; não certifica adequação estrutural ou de sombreamento.",
    fr: "{hint} Cela limite la taille PV recherchée ; cela ne certifie ni la solidité structurelle ni l'ombrage.",
    de: "{hint} Das begrenzt die gesuchte PV-Größe; es bestätigt weder die statische Eignung noch Verschattung.",
    nl: "{hint} Dit beperkt de gezochte PV-omvang; het certificeert geen constructieve of schaduweigenschappen.",
    ar: "{hint} هذا يحدّ من حجم الطاقة الكهروضوئية المبحوث عنها؛ ولا يثبت الملاءمة الإنشائية أو الظلّية.",
  },
  roofMapSelected: {
    en: "{area} m² selected. You can close the map or tap three new corners.",
    es: "{area} m² seleccionados. Puedes cerrar el mapa o tocar tres esquinas nuevas.",
    pt: "{area} m² selecionados. Você pode fechar o mapa ou tocar em três novos cantos.",
    fr: "{area} m² sélectionnés. Vous pouvez fermer la carte ou toucher trois nouveaux coins.",
    de: "{area} m² ausgewählt. Du kannst die Karte schließen oder drei neue Ecken antippen.",
    nl: "{area} m² geselecteerd. U kunt de kaart sluiten of drie nieuwe hoeken tikken.",
    ar: "تم تحديد {area} م². يمكنك إغلاق الخريطة أو الضغط على ثلاث زوايا جديدة.",
  },
  roofMapLoadFailed: {
    en: "The optional map could not load.",
    es: "El mapa opcional no pudo cargar.",
    pt: "O mapa opcional não pôde carregar.",
    fr: "La carte facultative n'a pas pu se charger.",
    de: "Die optionale Karte konnte nicht geladen werden.",
    nl: "De optionele kaart kon niet laden.",
    ar: "تعذّر تحميل الخريطة الاختيارية.",
  },
  roofMapUseManual: {
    en: "{message} Use the manual area box below instead.",
    es: "{message} Usa el cuadro de área manual de abajo en su lugar.",
    pt: "{message} Use a caixa de área manual abaixo como alternativa.",
    fr: "{message} Utilisez plutôt le champ de surface manuel ci-dessous.",
    de: "{message} Nutze stattdessen das manuelle Flächenfeld unten.",
    nl: "{message} Gebruik in plaats daarvan het handmatige oppervlakteveld hieronder.",
    ar: "{message} استخدم مربع المساحة اليدوي أدناه بدلاً من ذلك.",
  },
  modeTitleGt: {
    en: "Find your cheapest path to lower bills",
    es: "Encuentra tu camino más barato para bajar la factura",
    pt: "Encontre o caminho mais barato para reduzir a conta",
    fr: "Trouvez le chemin le moins cher pour réduire votre facture",
    de: "Finde den günstigsten Weg zu niedrigeren Rechnungen",
    nl: "Vind uw goedkoopste weg naar een lagere rekening",
    ar: "اعثر على أرخص طريق لخفض فاتورتك",
  },
  modeDescGt: {
    en: "Set your monthly electric bill and location, then click Size My System to compare the optimal solar and battery paths. The results cover chemistries, 20-year true costs, and wholesale hardware savings.",
    es: "Indica tu factura eléctrica mensual y tu ubicación y haz clic en Dimensionar mi sistema para comparar las vías óptimas de solar y batería. Los resultados cubren químicas, costes reales a 20 años y ahorro en hardware al por mayor.",
    pt: "Informe sua conta mensal de energia e sua localização e clique em Dimensionar meu sistema para comparar os caminhos solares e de bateria ideais. Os resultados cobrem químicas, custos reais de 20 anos e economia em hardware por atacado.",
    fr: "Indiquez votre facture d'électricité mensuelle et votre position, puis cliquez sur Dimensionner pour comparer les voies solaires et batterie optimales. Les résultats couvrent les chimies, les coûts réels sur 20 ans et l'économie de matériel en gros.",
    de: "Gib deine monatliche Stromrechnung und deinen Standort ein und klicke auf „System dimensionieren“, um die optimalen Solar- und Batteriewege zu vergleichen. Die Ergebnisse zeigen Chemien, echte 20-Jahres-Kosten und Großhandelsersparnis bei der Hardware.",
    nl: "Vul uw maandelijkse rekening en locatie in en klik op Systeem dimensioneren om de optimale zonne- en accupaden te vergelijken. De resultaten behandelen accuchemie, echte 20-jaarskosten en groothandelsbesparing op hardware.",
    ar: "أدخل فاتورة الكهرباء الشهرية وموقعك ثم انقر على «احسب نظامي» لمقارنة مسارات الطاقة الشمسية والبطاريات المثالية. تغطي النتائج أنواع البطاريات والتكاليف الحقيقية على 20 عامًا والتوفير بالجملة على المعدات.",
  },
  modeTitleOff: {
    en: "Size your off-grid solar & battery bank",
    es: "Dimensiona tu solar y banco de baterías fuera de la red",
    pt: "Dimensione seu solar e banco de baterias fora da rede",
    fr: "Dimensionnez votre solaire et parc de batteries hors réseau",
    de: "Netzunabhängige Solaranlage und Batteriebank auslegen",
    nl: "Dimensioneer uw off-grid zonne- en accubank",
    ar: "قيّم نظامك الشمسي وبنك البطاريات خارج الشبكة",
  },
  modeDescOff: {
    en: "Size a self-reliant solar and battery storage system for your cabin, camper van, backup, or homestead. Enter your daily kWh or pick your appliances — hourly weather simulations ensure you never run out of power.",
    es: "Dimensiona un sistema solar y de almacenamiento en batería autosuficiente para tu cabaña, furgoneta, respaldo o granja. Introduce tu kWh diario o elige tus electrodomésticos — las simulaciones meteorológicas horarias garantizan que nunca te quedes sin energía.",
    pt: "Dimensione um sistema solar e de armazenamento em bateria autossuficiente para sua cabana, van, reserva ou sítio. Informe seu kWh diário ou escolha seus aparelhos — as simulações meteorológicas por hora garantem que você nunca fique sem energia.",
    fr: "Dimensionnez un système solaire et de stockage sur batterie autonome pour votre cabane, van, secours ou ferme. Indiquez vos kWh quotidiens ou choisissez vos appareils — les simulations météo horaires garantissent que vous ne manquerez jamais d'énergie.",
    de: "Lege eine autarke Solar- und Batteriespeicheranlage für deine Hütte, deinen Camper, die Notstromversorgung oder deinen Hof aus. Gib deinen täglichen kWh-Wert an oder wähle deine Geräte — stündliche Wettersimulationen sorgen dafür, dass dir nie der Strom ausgeht.",
    nl: "Dimensioneer een zelfvoorzienend zonne- en accu-opslagsysteem voor uw hut, camper, noodstalizing of boerderij. Vul uw dagelijkse kWh in of kies uw apparaten — uursimulaties van het weer zorgen ervoor dat u nooit zonder stroom komt te zitten.",
    ar: "قيّم نظامًا شمسيًا ومخزنًا للطاقة بالبطاريات مستقلًا لكوخك أو سيارتك أو احتياطك أو مزرعتك. أدخل استهلاكك اليومي بالكيلوواط ساعة أو اختر أجهزتك — تضمن محاكاة الطقس الساعية ألا تنفد طاقتك أبدًا.",
  },
  focusNoteRec: {
    en: "Recommendation stays {chem} {pv} kW + {batt} kWh (~{cost} over 20 years).",
    es: "La recomendación sigue siendo {chem} {pv} kW + {batt} kWh (~{cost} en 20 años).",
    pt: "A recomendação continua {chem} {pv} kW + {batt} kWh (~{cost} em 20 anos).",
    fr: "La recommandation reste {chem} {pv} kW + {batt} kWh (~{cost} sur 20 ans).",
    de: "Die Empfehlung bleibt {chem} {pv} kW + {batt} kWh (~{cost} über 20 Jahre).",
    nl: "De aanbeveling blijft {chem} {pv} kW + {batt} kWh (~{cost} over 20 jaar).",
    ar: "تبقى التوصية {chem} {pv} كيلوواط + {batt} كيلوواط ساعة (~{cost} على 20 عامًا).",
  },
  billCutImpossible: {
    en: "Even a large array can't cut the bill this far at this location - check the off-grid sizer instead.",
    es: "Ni un gran array puede recortar la factura hasta ahí en esta ubicación: prueba el dimensionador fuera de la red.",
    pt: "Nem um grande arranho consegue cortar a conta até aí nesta localização — experimente o dimensionador fora da rede.",
    fr: "Même une grande installation ne peut pas réduire la facture autant à cette adresse — essayez plutôt le dimensionnement hors réseau.",
    de: "Selbst eine große Anlage kann die Rechnung an diesem Standort nicht so weit senken — probiere stattdessen den netzunabhängigen Ausleger.",
    nl: "Zelfs een groot veld kan de rekening op deze locatie niet zover verlagen — probeer de off-grid dimensionering.",
    ar: "حتى مصفوفة كبيرة لا تستطيع خفض الفاتورة إلى هذا الحد في هذا الموقع — جرّب أداة القياس خارج الشبكة بدلاً من ذلك.",
  },
  eli5Heading: {
    en: "📖 What This System Actually Looks Like in Real Life (Plain English)",
    es: "📖 Cómo es realmente este sistema en la vida real (en lenguaje sencillo)",
    pt: "📖 Como este sistema realmente é na vida real (em linguagem simples)",
    fr: "📖 À quoi ressemble vraiment ce système dans la vie réel (en clair)",
    de: "📖 Wie dieses System im wirklichen Leben aussieht (in Klartext)",
    nl: "📖 Hoe dit systeem er in het echt uitziet (in gewone taal)",
    ar: "📖 كيف يبدو هذا النظام فعليًا في الحياة الحقيقية (بلغة مبسطة)",
  },
  eli5SolarHeading: {
    en: "🌞 The Solar Array",
    es: "🌞 El campo solar",
    pt: "🌞 O arranjo solar",
    fr: "🌞 L'installation solaire",
    de: "🌞 Das Solarfeld",
    nl: "🌞 Het zonneveld",
    ar: "🌞 المصفوفة الشمسية",
  },
  eli5BatteryHeading: {
    en: "🔋 The Battery Bank",
    es: "🔋 El banco de baterías",
    pt: "🔋 O banco de baterias",
    fr: "🔋 Le parc de batteries",
    de: "🔋 Die Batteriebank",
    nl: "🔋 De accubank",
    ar: "🔋 بنك البطاريات",
  },
  eli5EstimateNote: {
    en: "The result is an estimate, not a promise. Battery storage is the bucket that carries energy from sunny hours into dark hours.",
    es: "El resultado es una estimación, no una promesa. El almacenamiento en batería es el cubo que lleva energía de las horas soleadas a las horas oscuras.",
    pt: "O resultado é uma estimativa, não uma promessa. O armazenamento em bateria é o balde que leva energia das horas ensolaradas para as horas escuras.",
    fr: "Le résultat est une estimation, pas une promesse. Le stockage sur batterie est le seau qui transporte l'énergie des heures ensoleillées vers les heures sombres.",
    de: "Das Ergebnis ist eine Schätzung, kein Versprechen. Der Batteriespeicher ist der Eimer, der Energie von sonnigen Stunden in dunkle Stunden trägt.",
    nl: "Het resultaat is een schatting, geen belofte. Accuopslag is de emmer die energie van zonnige uren naar donkere uren draagt.",
    ar: "النتيجة تقدير، ليس وعدًا. تخزين الطاقة بالبطاريات هو الدلو الذي ينقل الطاقة من ساعات المشمسة إلى ساعات الظلام.",
  },
  eli5ClimateNote: {
    en: " Weather suggests {climate} conditions, so dust losses are included.",
    es: " El clima sugiere condiciones de {climate}, así que se incluyen pérdidas por polvo.",
    pt: " O clima sugere condições de {climate}, então as perdas por poeira estão incluídas.",
    fr: " La météo suggère des conditions {climate}, les pertes par poussière sont donc incluses.",
    de: " Das Wetter deutet auf {climate}-Bedingungen hin, daher sind Staubverluste enthalten.",
    nl: " Het weer suggereert {climate} omstandigheden, dus stofverliezen zijn inbegrepen.",
    ar: " يشير الطقس إلى ظروف {climate}، لذا تُحتسب خسائر الغبار.",
  },
  worstMonthNote: {
    en: "Darkest month: {month} — about {avg} kWh/m²/day of average sun. Size for this month, not the yearly average, or the system will fall short on gray weeks.",
    es: "Mes más oscuro: {month} — unos {avg} kWh/m²/día de sol medio. Dimensiona para este mes, no para la media anual, o el sistema se quedará corto en semanas grises.",
    pt: "Mês mais escuro: {month} — cerca de {avg} kWh/m²/dia de sol médio. Dimensione para este mês, não para a média anual, ou o sistema ficará aquém em semanas cinzentas.",
    fr: "Mois le plus sombre : {month} — environ {avg} kWh/m²/jour de soleil moyen. Dimensionnez pour ce mois, pas pour la moyenne annuelle, sinon le système manquera lors des semaines grises.",
    de: "Dunkelster Monat: {month} — etwa {avg} kWh/m²/Tag durchschnittliche Sonne. Plane für diesen Monat, nicht für den Jahresdurchschnitt, sonst reicht das System in grauen Wochen nicht.",
    nl: "Donkerste maand: {month} — ongeveer {avg} kWh/m²/dag gemiddelde zon. Dimensioneer voor deze maand, niet voor het jaargemiddelde, anders schiet het systeem tekort in grijze weken.",
    ar: "الأشهر الأكثر عتمة: {month} — نحو {avg} كيلوواط ساعة/م²/يوم من الشمس المتوسطة. صمّم لهذا الشهر، لا للمتوسط السنوي، وإلا لن يكفِ النظام في الأسابيع الغائمة.",
  },
  bomSelectedSystem: {
    en: "Selected system",
    es: "Sistema seleccionado",
    pt: "Sistema selecionado",
    fr: "Système sélectionné",
    de: "Ausgewähltes System",
    nl: "Geselecteerd systeem",
    ar: "النظام المحدد",
  },
  fxAsOfNote: {
    en: "Live rates as of {asOf}.",
    es: "Tipos en vivo a fecha de {asOf}.",
    pt: "Câmbio ao vivo em {asOf}.",
    fr: "Taux en cours au {asOf}.",
    de: "Live-Kurse Stand {asOf}.",
    nl: "Live koersen per {asOf}.",
    ar: "أسعار مباشرة حتى {asOf}.",
  },
  advisorIntakeBillLabel: {
    en: "Monthly Electric Bill ($ USD):",
    es: "Factura eléctrica mensual ($ USD):",
    pt: "Conta mensal de energia ($ USD):",
    fr: "Facture d'électricité mensuelle ($ USD) :",
    de: "Monatliche Stromrechnung ($ USD):",
    nl: "Maandelijkse energierekening ($ USD):",
    ar: "فاتورة الكهرباء الشهرية ($ دولار أمريكي):",
  },
  advisorIntakeKwhLabel: {
    en: "Daily Energy Consumption (kWh / day):",
    es: "Consumo energético diario (kWh / día):",
    pt: "Consumo diário de energia (kWh / dia):",
    fr: "Consommation d'énergie quotidienne (kWh / jour) :",
    de: "Täglicher Energieverbrauch (kWh / Tag):",
    nl: "Dagelijks energieverbruik (kWh / dag):",
    ar: "استهلاك الطاقة اليومي (كيلوواط ساعة / اليوم):",
  },
  advisorIntakeBillPh: {
    en: "e.g. 400",
    es: "p. ej. 400",
    pt: "ex. 400",
    fr: "p. ex. 400",
    de: "z. B. 400",
    nl: "bijv. 400",
    ar: "مثال: 400",
  },
  advisorIntakeKwhPh: {
    en: "e.g. 35",
    es: "p. ej. 35",
    pt: "ex. 35",
    fr: "p. ex. 35",
    de: "z. B. 35",
    nl: "bijv. 35",
    ar: "مثال: 35",
  },
  heatmapHighest: {
    en: "🔴 Highest Electricity Cost ({basis})",
    es: "🔴 Coste eléctrico más alto ({basis})",
    pt: "🔴 Maior custo de eletricidade ({basis})",
    fr: "🔴 Coût de l'électricité le plus élevé ({basis})",
    de: "🔴 Höchste Stromkosten ({basis})",
    nl: "🔴 Hoogste elektriciteitskosten ({basis})",
    ar: "🔴 أعلى تكلفة كهرباء ({basis})",
  },
  heatmapLowest: {
    en: "⚡ Lowest Electricity Cost ({basis})",
    es: "⚡ Coste eléctrico más bajo ({basis})",
    pt: "⚡ Menor custo de eletricidade ({basis})",
    fr: "⚡ Coût de l'électricité le plus bas ({basis})",
    de: "⚡ Niedrigste Stromkosten ({basis})",
    nl: "⚡ Laagste elektriciteitskosten ({basis})",
    ar: "⚡ أدنى تكلفة كهرباء ({basis})",
  },
  heatmapMapFailed: {
    en: "The interactive map library failed to load. Reload this page to try again.",
    es: "La biblioteca del mapa interactivo no pudo cargar. Recarga esta página para intentarlo de nuevo.",
    pt: "A biblioteca do mapa interativo não pôde carregar. Recarregue esta página para tentar de novo.",
    fr: "La bibliothèque de carte interactive n'a pas pu se charger. Rechargez cette page pour réessayer.",
    de: "Die interaktive Kartbibliothek konnte nicht geladen werden. Lade die Seite neu, um es erneut zu versuchen.",
    nl: "De interactieve kaartbibliotheek kon niet laden. Herlaad deze pagina om het opnieuw te proberen.",
    ar: "فشل تحميل مكتبة الخريطة التفاعلية. أعد تحميل هذه الصفحة للمحاولة مرة أخرى.",
  },
};

const KEYS = Object.keys(K);
const LOCALES = ["en", "es", "pt", "fr", "de", "nl", "ar"];

// Placeholders must match across locales or the parity gate fails later —
// assert it here so a typo fails this script loudly.
for (const key of KEYS) {
  const ph = (s) =>
    [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  const base = ph(K[key].en);
  for (const loc of LOCALES) {
    if (ph(K[key][loc]) !== base) {
      console.error(`placeholder mismatch ${key}.${loc}: ${ph(K[key][loc])} != ${base}`);
      process.exit(1);
    }
  }
}

let src = readFileSync(FILE, "utf8");
for (const loc of LOCALES) {
  const open = new RegExp(`^  ${loc}: \\{`, "m");
  const m = open.exec(src);
  if (!m) throw new Error(`block ${loc} not found`);
  // find the closing "  }," at the same indent after this block opens
  const after = src.slice(m.index + m[0].length);
  const c = /^  \},$/m.exec(after);
  if (!c) throw new Error(`close of ${loc} not found`);
  const at = m.index + m[0].length + c.index;
  const block = KEYS.map((key) => `    ${key}: ${JSON.stringify(K[key][loc])},`).join("\n");
  src = src.slice(0, at) + block + "\n" + src.slice(at);
}
writeFileSync(FILE, src);
console.log("inserted", KEYS.length, "keys x", LOCALES.length, "locales");
