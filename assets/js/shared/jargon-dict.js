// Plain-language explanations for terms that appear in sizing results.
// Keep entries short enough for a tap tooltip and honest enough to stand alone.
export const JARGON = Object.freeze({
  kWh: {
    short: "energy used",
    long: "A kWh is a unit of energy: roughly what a 1,000-watt appliance uses in one hour.",
  },
  Wh: {
    short: "a small energy unit",
    long: "A Wh is one thousandth of a kWh. The calculator uses it for hour-by-hour arithmetic.",
  },
  kW: {
    short: "power size",
    long: "A kW is how fast electricity is being made or used. More kW means more appliances can run at once.",
  },
  DoD: {
    short: "how much of a battery we use",
    long: "Depth of discharge is the share of a battery emptied before it is recharged. Leaving a reserve usually helps it last longer.",
  },
  Ah: {
    short: "battery charge quantity",
    long: "Amp-hours describe electrical charge. Battery makers use them alongside voltage to describe stored energy.",
  },
  inverter: {
    short: "the electricity translator",
    long: "An inverter changes battery or panel electricity into the kind your appliances use, and may also charge the battery.",
  },
  MPPT: {
    short: "panel harvest controller",
    long: "MPPT is electronics that keeps panels operating near their most productive voltage as sunlight changes.",
  },
  autonomy: {
    short: "days without sun",
    long: "Autonomy is how long the battery can keep chosen loads running when panels make little or no energy.",
  },
  roundTripEfficiency: {
    short: "energy lost while storing",
    long: "Round-trip efficiency is the share of energy you get back after charging and discharging a battery.",
  },
  cycleLife: {
    short: "battery lifetime",
    long: "Cycle life is an estimate of how many full-use equivalents a battery can deliver before it loses capacity.",
  },
  usableCapacity: {
    short: "energy we can safely use",
    long: "Usable capacity leaves the reserve that protects the battery from damaging over-discharge.",
  },
  soiling: {
    short: "dust and dirt losses",
    long: "Soiling is the sunlight a panel loses when dust, pollen, salt, or grime covers it.",
  },
  derates: {
    short: "real-world loss factors",
    long: "Derates account for heat, dust, wiring, mismatched panels, and other losses between sunlight and useful electricity.",
  },
  NOCT: {
    short: "panel heat reference",
    long: "NOCT is a standard reference for estimating how warm a working panel becomes in sunlight.",
  },
  temperatureCoefficient: {
    short: "heat-related panel loss",
    long: "The temperature coefficient estimates how panel output changes as the panel gets hotter or colder.",
  },
  systemVoltage: {
    short: "battery bank voltage",
    long: "System voltage is the battery bank's electrical pressure. Higher voltage usually means less current in the cables.",
  },
  string: {
    short: "a series-connected group",
    long: "A string is a group of batteries or panels connected in series so their voltages add together.",
  },
  BMS: {
    short: "battery safety electronics",
    long: "A battery-management system watches cell voltage and temperature and can stop unsafe charging or discharging.",
  },
  LCOE: {
    short: "long-run energy price",
    long: "Levelized cost of energy spreads equipment, replacements, and delivered energy across the system's modeled life.",
  },
  paybackPeriod: {
    short: "time to recover cost",
    long: "The payback period is how long modeled bill savings take to equal the equipment cost. It is not a promise.",
  },
  tariff: {
    short: "your electricity price",
    long: "A tariff is the price your utility or generator charges for each unit of energy.",
  },
  unmetHours: {
    short: "hours needing backup",
    long: "Unmet hours are the hours the modeled panels and battery could not fully serve the selected load.",
  },
  reliabilityTier: {
    short: "how much backup you want",
    long: "A reliability tier sets how many hours per year may need a generator or grid connection.",
  },
  gridTie: {
    short: "solar while staying connected",
    long: "Grid-tie means the utility remains available when solar does not cover the load.",
  },
  offGrid: {
    short: "independent from the utility",
    long: "Off-grid means panels and storage must cover the load, with a generator or another backup for rare shortfalls.",
  },
});

export const JARGON_TERMS = Object.freeze(Object.keys(JARGON));

// Translation overlays are intentionally partial: callers should fall back to
// the English explanation for any missing term, just like the UI locale layer.
export const JARGON_LOCALES = Object.freeze({
  es: {
    kWh: {
      short: "energía usada",
      long: "Una kWh es una unidad de energía: aproximadamente lo que usa un aparato de 1.000 vatios en una hora.",
    },
    inverter: {
      short: "traductor de electricidad",
      long: "El inversor convierte la electricidad de los paneles o la batería al tipo que usan tus aparatos.",
    },
    tariff: {
      short: "precio de la electricidad",
      long: "La tarifa es el precio que cobra la red o el generador por cada unidad de energía.",
    },
  },
  pt: {
    kWh: {
      short: "energia usada",
      long: "Um kWh é uma unidade de energia: aproximadamente o que um aparelho de 1.000 watts usa em uma hora.",
    },
    inverter: {
      short: "tradutor de eletricidade",
      long: "O inversor transforma a eletricidade dos painéis ou da bateria no tipo usado pelos aparelhos.",
    },
    tariff: {
      short: "preço da eletricidade",
      long: "A tarifa é o preço cobrado pela rede ou pelo gerador por cada unidade de energia.",
    },
  },
  fr: {
    kWh: {
      short: "énergie utilisée",
      long: "Un kWh est une unité d'énergie : environ ce qu'un appareil de 1 000 watts utilise en une heure.",
    },
    inverter: {
      short: "traducteur électrique",
      long: "L'onduleur transforme l'électricité des panneaux ou de la batterie pour vos appareils.",
    },
    tariff: {
      short: "prix de l'électricité",
      long: "Le tarif est le prix facturé par le réseau ou le groupe électrogène pour chaque unité d'énergie.",
    },
  },
  de: {
    kWh: {
      short: "verbrauchte Energie",
      long: "Eine kWh ist eine Energieeinheit — ungefähr das, was ein Gerät mit 1.000 Watt in einer Stunde verbraucht.",
    },
    inverter: {
      short: "Stromübersetzer",
      long: "Der Wechselrichter wandelt den Strom von Panelen oder Batterie in die Form für deine Geräte um.",
    },
    tariff: {
      short: "Strompreis",
      long: "Der Tarif ist der Preis, den Netz oder Generator pro Energieeinheit berechnen.",
    },
  },
  ar: {
    kWh: {
      short: "الطاقة المستخدمة",
      long: "الكيلوواط ساعة وحدة للطاقة، وهي تقريبًا ما يستهلكه جهاز بقدرة 1000 واط خلال ساعة.",
    },
    inverter: {
      short: "محوّل الكهرباء",
      long: "يحوّل العاكس كهرباء الألواح أو البطارية إلى النوع الذي تستخدمه أجهزتك.",
    },
    tariff: {
      short: "سعر الكهرباء",
      long: "التعرفة هي السعر الذي تفرضه الشبكة أو المولد لكل وحدة طاقة.",
    },
  },
});

export function jargonEntry(term, lang) {
  // Translation overlays are intentionally partial: any term missing from the
  // requested locale falls back to the English explanation, exactly like the
  // UI locale layer. Unknown terms return null so callers can skip wiring.
  if (lang && JARGON_LOCALES[lang]?.[term]) return JARGON_LOCALES[lang][term];
  return JARGON[term] || null;
}

export function explainElement(element, term, lang) {
  const entry = jargonEntry(term, lang);
  if (!element || !entry) return false;
  element.setAttribute("data-eli5", entry.long);
  element.setAttribute("title", `${entry.short}: ${entry.long}`);
  element.setAttribute("tabindex", "0");
  element.setAttribute("aria-label", `${term}: ${entry.long}`);
  return true;
}
