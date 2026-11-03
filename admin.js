// BigEnergyCo Internal Admin 24-Month Financial Simulation Engine

const SIM_DATA = {
  '0pct': {
    title: "Scenario A: 100% Full AI Automation (0% Human Involvement)",
    mrr: "$19,850 / mo",
    mrr24: "$48,600 / mo",
    gross24: "$384,500",
    net24: "$361,850",
    margin: "94.20%",
    hours: "0 hrs / wk",
    desc: "100% passive digital platform. Pure automated sales of $47 Blueprint Bundles and $299 AI Turnkey Sourcing Packages. Zero manual emails, phone calls, or video consults by the founder.",
    fund: "$198,420",
    cac: "$8.40",
    ltv: "14.2x",
    // Base monthly scaling factors (M1 to M24)
    baseRevenue: [150, 350, 750, 1400, 2800, 5200, 8100, 11500, 14800, 17200, 18500, 19850, 22100, 24800, 27900, 31200, 34800, 38500, 41200, 43800, 45200, 46500, 47800, 48600],
    marginPct: 0.942
  },
  '1pct': {
    title: "Scenario B: 1% Human Involvement (Recommended Baseline - $999 VIP Calls)",
    mrr: "$23,915 / mo",
    mrr24: "$58,900 / mo",
    gross24: "$485,200",
    net24: "$453,468",
    margin: "93.45%",
    hours: "~1 hr / wk",
    desc: "AI handles 99% of customer intake, sizing calculations, PDF quotes, and clickwrap execution. The founder spends ~1 hour per week taking 2–4 high-ticket VIP human escalation calls ($999/session) for complex commercial microgrids or farms.",
    fund: "$248,650",
    cac: "$11.80",
    ltv: "18.5x",
    baseRevenue: [350, 750, 1450, 2800, 4500, 6500, 9800, 13400, 17200, 20100, 22400, 23915, 26800, 30200, 34100, 38500, 42900, 47200, 51000, 53800, 55900, 57200, 58100, 58900],
    marginPct: 0.9345
  },
  '10pct': {
    title: "Scenario C: 10% Human Involvement (High-Touch Advisory - $499 Consults)",
    mrr: "$38,400 / mo",
    mrr24: "$92,500 / mo",
    gross24: "$798,400",
    net24: "$711,374",
    margin: "89.10%",
    hours: "~8 hrs / wk",
    desc: "AI handles 90% of lead intake. The founder offers an optional 60-minute 1-on-1 strategy call ($499) chosen by 10% of buyers, generating higher MRR while requiring ~8 hours per week of human consulting time.",
    fund: "$385,400",
    cac: "$18.50",
    ltv: "24.1x",
    baseRevenue: [650, 1450, 2800, 5200, 8400, 11200, 16800, 22400, 28900, 33500, 36200, 38400, 43500, 49800, 56200, 63100, 70400, 77800, 83200, 87400, 89800, 91200, 92000, 92500],
    marginPct: 0.8910
  }
};

function renderMonthTable(data) {
  const tbody = document.getElementById('monthTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  let cumulativeNet = 0;
  let cumulativeFund = 0;

  data.baseRevenue.forEach((gross, index) => {
    const monthNum = index + 1;
    const leads = Math.round(gross / 42); // Average yield per lead
    const net = Math.round(gross * data.marginPct);
    const costs = gross - net;
    cumulativeNet += net;
    
    // 60% of net profit goes to Hawaii Dream Home Fund waterfall
    const fundTransfer = Math.round(net * 0.60);
    cumulativeFund += fundTransfer;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-weight:700; color:var(--primary-accent);">Month ${monthNum}</td>
      <td>${leads.toLocaleString()}</td>
      <td>$${gross.toLocaleString()}</td>
      <td style="color:var(--text-muted);">$${costs.toLocaleString()}</td>
      <td style="color:var(--primary-accent); font-weight:700;">$${net.toLocaleString()}</td>
      <td style="color:var(--text-bright);">$${cumulativeNet.toLocaleString()}</td>
      <td style="color:#60a5fa; font-weight:700;">$${cumulativeFund.toLocaleString()}</td>
    `;
    tbody.appendChild(row);
  });
}

function selectSimScenario(scenarioKey) {
  const data = SIM_DATA[scenarioKey];
  if (!data) return;

  // Update tab buttons active state
  const tabs = document.querySelectorAll('.sim-toggle-group .tab-btn');
  tabs.forEach(tab => tab.classList.remove('active'));
  
  if (scenarioKey === '0pct' && tabs[0]) tabs[0].classList.add('active');
  if (scenarioKey === '1pct' && tabs[1]) tabs[1].classList.add('active');
  if (scenarioKey === '10pct' && tabs[2]) tabs[2].classList.add('active');

  // Update DOM elements safely
  const simMrrVal = document.getElementById('simMrrVal');
  if (simMrrVal) simMrrVal.innerText = data.mrr;

  const simMrr24Val = document.getElementById('simMrr24Val');
  if (simMrr24Val) simMrr24Val.innerText = data.mrr24;

  const simMarginVal = document.getElementById('simMarginVal');
  if (simMarginVal) simMarginVal.innerText = data.margin;

  const simHoursVal = document.getElementById('simHoursVal');
  if (simHoursVal) simHoursVal.innerText = data.hours;

  const simTitle = document.getElementById('simTitle');
  if (simTitle) simTitle.innerText = data.title;

  const simDesc = document.getElementById('simDesc');
  if (simDesc) simDesc.innerText = data.desc;

  const simGross24Val = document.getElementById('simGross24Val');
  if (simGross24Val) simGross24Val.innerText = data.gross24;

  const simNet24Val = document.getElementById('simNet24Val');
  if (simNet24Val) simNet24Val.innerText = data.net24;

  const simFundVal = document.getElementById('simFundVal');
  if (simFundVal) simFundVal.innerText = data.fund;

  const simCacVal = document.getElementById('simCacVal');
  if (simCacVal) simCacVal.innerText = data.cac;

  renderMonthTable(data);
}

document.addEventListener('DOMContentLoaded', () => {
  selectSimScenario('1pct');
});
