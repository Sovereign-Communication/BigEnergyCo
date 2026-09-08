// Best First Dollar: action ranking by cost-effectiveness.
// Uses the frontier's marginal costs to rank energy actions by cost per unit
// of bill reduction, resilience gained, or energy independence achieved.
// Pure functions for ranking; DOM rendering for UI.
import { findValueRange } from "./frontier.js?v=20260906o";
import { fullRange } from "./pricing.js?v=20260906o";

export const ACTION_TYPES = {
  EFFICIENCY: "efficiency",
  LOAD_SHIFTING: "load_shifting",
  SOLAR: "solar",
  BATTERY: "battery",
  GENERATOR: "generator",
};

export const ACTION_DEFS = {
  [ACTION_TYPES.EFFICIENCY]: {
    id: "efficiency",
    label: "Efficiency upgrades",
    description:
      "LED lighting, high-efficiency appliances, insulation, weatherization",
    icon: "\uD83D\uDCA1",
    category: "demand_reduction",
    costPerKwhPerYear: { lo: 0.02, hi: 0.08 },
    reductionKwhPerDay: { lo: 0.5, hi: 4.0 },
    resilienceScore: 0.1,
  },
  [ACTION_TYPES.LOAD_SHIFTING]: {
    id: "load_shifting",
    label: "Load shifting",
    description:
      "Shift flexible loads (EV, water heater, laundry) to solar hours",
    icon: "\uD83D\uDD04",
    category: "demand_management",
    costPerKwhPerYear: { lo: 0.0, hi: 0.02 },
    reductionKwhPerDay: { lo: 0.5, hi: 3.0 },
    resilienceScore: 0.05,
  },
  [ACTION_TYPES.SOLAR]: {
    id: "solar",
    label: "Solar panels",
    description: "Add PV capacity to generate your own power",
    icon: "\u2600\uFE0F",
    category: "generation",
    costPerKw: { lo: 280, hi: 380 },
    productionPerKwPerDay: { lo: 2.5, hi: 5.5 },
    resilienceScore: 0.4,
  },
  [ACTION_TYPES.BATTERY]: {
    id: "battery",
    label: "Battery storage",
    description: "Store solar for evening use and backup power",
    icon: "\uD83D\uDD0B",
    category: "storage",
    costPerKwhUsable: null,
    kwhPerKwSolar: { lo: 1.0, hi: 2.5 },
    resilienceScore: 0.9,
  },
  [ACTION_TYPES.GENERATOR]: {
    id: "generator",
    label: "Backup generator",
    description: "Fossil-fuel backup for extended outages",
    icon: "\u26A1",
    category: "backup",
    costPerKw: { lo: 300, hi: 800 },
    fuelCostPerKwh: { lo: 0.35, hi: 0.65 },
    resilienceScore: 1.0,
  },
};

export function computeMarginalCosts(frontier) {
  if (!frontier || !frontier.points || frontier.points.length < 2) return [];
  const range = findValueRange(frontier);
  if (!range || range.hiIndex <= 0) return [];
  const points = frontier.points.slice(range.loIndex, range.hiIndex + 1);
  const out = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const deltaCost = curr.capexUsd - prev.capexUsd;
    const deltaPct = curr.outcomePct - prev.outcomePct;
    if (deltaPct > 0) {
      out.push({
        fromPct: prev.outcomePct,
        toPct: curr.outcomePct,
        deltaPct: +deltaPct.toFixed(1),
        deltaCost: deltaCost,
        costPerPct: deltaCost / deltaPct,
        pvKw: curr.pvKw,
        battKwh: curr.battKwh,
        outcomePct: curr.outcomePct,
        capexUsd: curr.capexUsd,
      });
    }
  }
  return out;
}

function findClosestFrontierPoint(frontier, targetPvKw, targetBattKwh) {
  if (!frontier || !frontier.points || frontier.points.length === 0)
    return null;
  let best = null;
  let bestDist = Infinity;
  for (const pt of frontier.points) {
    const dist =
      Math.abs(pt.pvKw - (targetPvKw || 0)) +
      Math.abs(pt.battKwh - (targetBattKwh || 0));
    if (dist < bestDist) {
      bestDist = dist;
      best = pt;
    }
  }
  return best;
}

export function estimateActionSavings(action, frontier, payload) {
  const dailyKwh = payload.dailyKwh || 0;
  const tariffUsd = payload.tariff || 0;
  const exportRate = payload.exportRate || 0;
  const annualKwh = dailyKwh * 365;

  switch (action.id) {
    case "efficiency": {
      const redKwhDay =
        (action.reductionKwhPerDay && action.reductionKwhPerDay.hi) || 2.0;
      const annualKwhSaved = redKwhDay * 365;
      const avgCostPerKwh =
        ((action.costPerKwhPerYear.lo || 0) +
          (action.costPerKwhPerYear.hi || 0)) /
        2;
      const implementationCost = annualKwhSaved * avgCostPerKwh;
      const annualSavingsUsd = annualKwhSaved * tariffUsd;
      return {
        annualKwhSaved,
        annualSavingsUsd,
        implementationCost,
        paybackYears:
          annualSavingsUsd > 0
            ? implementationCost / annualSavingsUsd
            : Infinity,
        resilienceGain: action.resilienceScore || 0,
      };
    }

    case "load_shifting": {
      const shiftableKwhPerDay =
        (action.reductionKwhPerDay && action.reductionKwhPerDay.hi) || 1.5;
      const annualKwhShifted = shiftableKwhPerDay * 365;
      const billSavings = annualKwhShifted * tariffUsd;
      const exportValue = annualKwhShifted * exportRate;
      const implementationCost = 500;
      const annualSavingsUsd = billSavings + exportValue;
      return {
        annualKwhShifted,
        annualSavingsUsd,
        implementationCost,
        paybackYears:
          annualSavingsUsd > 0
            ? implementationCost / annualSavingsUsd
            : Infinity,
        resilienceGain: 0.05,
      };
    }

    case "solar": {
      const matchingPoint = findClosestFrontierPoint(frontier, 5, 0);
      if (!matchingPoint) return null;
      const annualProduction = 5 * 365 * 4.0;
      const selfConsumption = Math.min(annualKwh * 0.4, annualProduction);
      const exportKwh = Math.max(0, annualProduction - selfConsumption);
      const billSavings = selfConsumption * tariffUsd;
      const exportValue = exportKwh * exportRate;
      const annualSavingsUsd = billSavings + exportValue;
      let cost = 0;
      try {
        cost = fullRange(5, 0, "lfp", 1, 5).objectiveMid;
      } catch (_) {
        cost = 2500;
      }
      return {
        annualProduction,
        annualSavingsUsd,
        implementationCost: cost,
        paybackYears: annualSavingsUsd > 0 ? cost / annualSavingsUsd : Infinity,
        resilienceGain: 0.4,
      };
    }

    case "battery": {
      let cost = 0;
      try {
        cost = fullRange(0, 10, "lfp", 1, 0).objectiveMid;
      } catch (_) {
        cost = 5000;
      }
      const shiftedSolarValue = tariffUsd * 1825 * 0.3;
      const backupValue = 500;
      const annualSavingsUsd = shiftedSolarValue + backupValue;
      return {
        annualSavingsUsd,
        implementationCost: cost,
        paybackYears: annualSavingsUsd > 0 ? cost / annualSavingsUsd : Infinity,
        resilienceGain: 0.9,
      };
    }

    case "generator": {
      const installCost = 3000;
      const annualFuelCost = 7 * 50 * 0.5;
      return {
        implementationCost: installCost,
        annualSavingsUsd: 0,
        annualCost: annualFuelCost,
        paybackYears: Infinity,
        resilienceGain: 1.0,
      };
    }

    default:
      return null;
  }
}

function computeActionScore(action, estimate) {
  if (!estimate) return -Infinity;
  const { implementationCost, annualSavingsUsd, paybackYears, resilienceGain } =
    estimate;
  if (!implementationCost || implementationCost <= 0) return -Infinity;
  const savingsRatio = (annualSavingsUsd || 0) / implementationCost;
  const paybackFactor = paybackYears > 0 ? Math.min(20 / paybackYears, 5) : 1;
  const resilienceBonus = (resilienceGain || 0) * 0.5;
  return savingsRatio * paybackFactor * (1 + resilienceBonus);
}

export function rankActions(payload, frontier) {
  if (!frontier || !frontier.points || frontier.points.length < 2) return [];
  const actionList = Object.values(ACTION_DEFS)
    .map((actionDef) => {
      const estimate = estimateActionSavings(actionDef, frontier, payload);
      if (!estimate) return null;
      const score = computeActionScore(actionDef, estimate);
      return { ...actionDef, estimate, score };
    })
    .filter(Boolean);
  return actionList.sort((a, b) => b.score - a.score);
}

let lastRankedActions = null;

function el(tag, attrs, children) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v;
      else e.setAttribute(k, v);
    }
  }
  if (Array.isArray(children)) {
    for (const c of children) {
      if (typeof c === "string") e.appendChild(document.createTextNode(c));
      else if (c) e.appendChild(c);
    }
  } else if (typeof children === "string") {
    e.textContent = children;
  }
  return e;
}

function fmtUsd(n) {
  if (!Number.isFinite(n)) return "\u2014";
  return "$" + Math.round(n).toLocaleString();
}

function fmtPayback(y) {
  if (!Number.isFinite(y)) return "> 20 yr";
  if (y < 0.5) return "< 1 yr";
  return "~" + Math.round(y) + " yr";
}

function tFallback(key, params) {
  const fallbacks = {
    bestFirstTitle: "Best First Dollar",
    bestFirstSubtitle: "What to do first for the biggest impact",
    bestFirstNote: "{count} actions ranked by cost-effectiveness",
    noActionsAvailable: "No actions available for this configuration.",
  };
  let str = fallbacks[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp("\\{" + k + "\\}", "g"), v);
    }
  }
  return str;
}

function getT() {
  if (typeof window !== "undefined" && typeof window.t === "function")
    return window.t;
  return tFallback;
}

function getMoneyFn() {
  if (typeof window !== "undefined" && typeof window.money === "function")
    return window.money;
  return fmtUsd;
}

export function renderBestFirstDollar(container, payload) {
  if (!container) return;
  const show =
    payload &&
    payload.frontier &&
    payload.frontier.points &&
    payload.frontier.points.length;
  container.style.display = show ? "" : "none";
  if (!show) {
    container.innerHTML = "";
    return;
  }

  const t = getT();
  const money = getMoneyFn();
  const ranked = rankActions(payload, payload.frontier);
  lastRankedActions = ranked;

  container.innerHTML = "";

  if (!ranked.length) {
    container.appendChild(
      el("p", { style: "color:var(--text-muted)" }, t("noActionsAvailable")),
    );
    return;
  }

  const header = el("div", { class: "best-first-header" }, [
    el("h2", { class: "best-first-title" }, t("bestFirstTitle")),
    el("p", { class: "best-first-subtitle" }, t("bestFirstSubtitle")),
  ]);
  container.appendChild(header);

  const grid = el("div", { class: "action-grid" });
  ranked.forEach((action, idx) => {
    grid.appendChild(buildActionCard(action, idx, money));
  });
  container.appendChild(grid);

  container.appendChild(
    el(
      "p",
      { class: "best-first-note" },
      t("bestFirstNote", { count: String(ranked.length) }),
    ),
  );
}

function buildActionCard(action, index, money) {
  const card = el("div", {
    class: "action-card" + (index === 0 ? " best-first" : ""),
  });
  card.setAttribute("data-action-id", action.id);

  const rankBadge = el("div", { class: "rank-badge" }, "#" + (index + 1));
  card.appendChild(rankBadge);

  const hdr = el("div", { class: "action-header" }, [
    el("span", { class: "action-icon" }, action.icon || "\u26A1"),
    el("h3", { class: "action-title" }, action.label),
  ]);
  card.appendChild(hdr);

  if (action.description) {
    card.appendChild(el("p", { class: "action-desc" }, action.description));
  }

  if (action.estimate) {
    const est = action.estimate;
    const rows = [];
    if (est.implementationCost) {
      rows.push(
        el("div", { class: "estimate-row" }, [
          el("span", { class: "estimate-label" }, "Up-front cost"),
          el(
            "span",
            { class: "estimate-value" },
            "~" + money(est.implementationCost),
          ),
        ]),
      );
    }
    if (est.annualSavingsUsd) {
      rows.push(
        el("div", { class: "estimate-row" }, [
          el("span", { class: "estimate-label" }, "Annual savings"),
          el(
            "span",
            { class: "estimate-value" },
            money(est.annualSavingsUsd) + "/yr",
          ),
        ]),
      );
    }
    if (Number.isFinite(est.paybackYears)) {
      rows.push(
        el("div", { class: "estimate-row" }, [
          el("span", { class: "estimate-label" }, "Payback"),
          el("span", { class: "estimate-value" }, fmtPayback(est.paybackYears)),
        ]),
      );
    }
    if (action.resilienceScore !== undefined) {
      rows.push(
        el("div", { class: "estimate-row resilience" }, [
          el("span", { class: "estimate-label" }, "Resilience"),
          el(
            "span",
            { class: "estimate-value" },
            Math.round(action.resilienceScore * 100) + "%",
          ),
        ]),
      );
    }
    if (rows.length) {
      card.appendChild(el("div", { class: "action-estimate" }, rows));
    }
  }

  card.addEventListener("click", () => {
    document
      .querySelectorAll(".action-card")
      .forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
  });

  return card;
}

export { findClosestFrontierPoint, computeActionScore };
