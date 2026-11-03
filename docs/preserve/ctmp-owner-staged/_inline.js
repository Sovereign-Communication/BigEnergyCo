
Chart.defaults.font.size = 14;
Chart.defaults.font.family = '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
Chart.defaults.color = '#333';

let charts = {};
// STATE LOSS FIXES (2026-10-25, Item C):
// - selectedLedger persists across page reloads: a manual ledger-button
//   choice (or a mode-switch auto-select) is stored in localStorage;
//   with no stored choice, the first status load initializes the view
//   from the SERVER mode (so F5 in live mode no longer drops to paper).
// - Routine 5s polls NEVER overwrite editable controls (the old
//   fillSettings-on-every-refresh reverted any edit the moment its
//   control lost focus, before Save). Settings inputs are filled only
//   on initial load and after a server-confirmed save/mode change, and
//   a control edited since the last server sync (dataset.dirty) is
//   never overwritten by any fill. Simulation controls are independent
//   after initial load — server settings polls never touch them.
let selectedLedger = 'paper';
try {
  const stored = localStorage.getItem('kalshi_selected_ledger');
  if (stored === 'paper' || stored === 'live') selectedLedger = stored;
} catch (e) { /* storage unavailable: default paper, mode init below */ }
let lastStatus = null;
let settingsLoaded = false;  // first successful status load fills inputs
let ledgerViewInit = false;  // first load initializes view from mode/storage
function storeLedger(which) {
  try { localStorage.setItem('kalshi_selected_ledger', which); } catch (e) {}
}
const EMPTY_MSG = 'No data yet — start the trader or run a simulation';
const $ = id => document.getElementById(id);
const money = v => '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// --- Chart.js resize-on-tab-switch fix (mockup): charts in hidden tabs have
// zero size until visible, so resize every visible chart when a tab opens. ---
function resizeVisibleCharts() {
  Object.values(charts).forEach(c => {
    try { if (c && c.canvas && c.canvas.offsetParent !== null) c.resize(); } catch (e) {}
  });
}
function showTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  const panel = $('tab-' + id);
  if (panel) panel.classList.remove('hidden');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else document.querySelectorAll('.tab-btn').forEach(b => {
    if (b.textContent.trim().toLowerCase() === id) b.classList.add('active');
  });
  setTimeout(resizeVisibleCharts, 50);
}
function setEmpty(canvasId, isEmpty) {
  const emptyEl = $('empty-' + canvasId);
  const canvas = $(canvasId);
  if (emptyEl) { emptyEl.classList.toggle('hidden', !isEmpty); emptyEl.textContent = EMPTY_MSG; }
  if (canvas) canvas.classList.toggle('hidden', isEmpty);
}
function upsertChart(id, type, data, options) {
  const el = $(id);
  if (!el) return null;
  const opts = options || { responsive: true, maintainAspectRatio: true };
  if (charts[id] && charts[id].config.type === type) {
    charts[id].data = data;
    charts[id].options = opts;
    charts[id].update('none');
  } else {
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(el, { type, data, options: opts });
  }
  return charts[id];
}
function lineData(labels, values, label, color) {
  return { labels, datasets: [{ label, data: values, borderColor: color, backgroundColor: color + '22', fill: true, tension: 0.2, pointRadius: 0 }] };
}
function barData(labels, values, label, colors) {
  return { labels, datasets: [{ label, data: values, backgroundColor: colors }] };
}
const greenRed = vals => vals.map(v => v >= 0 ? '#28a745' : '#dc3545');
const moneyAxis = { ticks: { callback: v => '$' + Number(v).toLocaleString(), font: { size: 14 } }, grid: { color: '#f0f0f0' } };
const pctAxis = { ticks: { callback: v => v + '%', font: { size: 14 } }, grid: { color: '#f0f0f0' } };
const plainAxis = { ticks: { font: { size: 14 } }, grid: { color: '#f0f0f0' } };

async function api(path, method, body) {
  const r = await fetch(path, { method: method || 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let j = {};
  try { j = await r.json(); } catch (e) { j = { ok: false, error: 'Server returned a non-JSON response.' }; }
  return j;
}
function showEl(id, msg, isError) {
  const e = $(id); if (!e) return;
  if (msg) { e.textContent = msg; e.classList.remove('hidden'); }
  else e.classList.add('hidden');
}

// --- Strategy descriptions (see updateAggDesc) ---
const AGG_DESC = {
  conservative: 'Conservative — 1% risk, filter ON, no extreme.',
  balanced: 'Balanced — risk ladder 1/2/3/4%, filter ON, extreme ON.',
  aggressive: 'Aggressive — risk ladder + confidence (risk% doubles on 3+ win streak), filter ON, extreme ON. Paper-ledger sizing only — live always runs filter ON + ladder sizing unless risk override > 0.'
};
function updateAggDesc() { const d = $('agg-desc'); if (d) d.textContent = AGG_DESC[$('agg-select').value] || ''; }
$('agg-select').addEventListener('change', updateAggDesc);

// PHASE 2 (D7): the stats label is a parameter, not a hardcoded
// "simulated" string — the live stats block previously inherited the
// paper label. Callers pass the ledger's own label: the server's
// paper_ledger_label for paper, "Live ledger bankroll (session)"
// for live.
function statsHtml(s, label) {
  if (!s) return '';
  return '<div class="stat"><span>' + (label || 'Ledger bankroll') + '</span><strong>' + money(s.bankroll) + '</strong></div>'
    + '<div class="stat"><span>P&amp;L</span><strong class="' + (s.pnl >= 0 ? 'win' : 'loss') + '">' + money(s.pnl) + '</strong></div>'
    + '<div class="stat"><span>Trades</span><strong>' + s.trades + '</strong></div>'
    + '<div class="stat"><span>Win rate</span><strong>' + s.win_rate + '%</strong></div>'
    + '<div class="stat"><span>Max drawdown</span><strong>' + s.max_drawdown_pct + '%</strong></div>'
    + '<div class="stat"><span>Daily loss / trades</span><strong>' + money(s.daily_loss) + ' / ' + s.daily_trades + '</strong></div>';
}
function renderSelectedStats(s, status, lastUpdate) {
  $('stat-bankroll').textContent = money(s.bankroll);
  const pnlEl = $('stat-pnl'); pnlEl.textContent = money(s.pnl); pnlEl.className = 'num ' + (s.pnl >= 0 ? 'win' : 'loss');
  $('stat-trades').textContent = s.trades;
  $('stat-winrate').textContent = s.win_rate + '%';
  $('stat-maxdd').textContent = s.max_drawdown_pct + '%';
  $('stat-daily').textContent = money(s.daily_loss) + ' / ' + s.daily_trades;
  $('stat-status').textContent = status || '—';
  $('stat-lastupdate').textContent = lastUpdate || '—';
}
function renderLedgerCharts(led) {
  // (a) Bankroll over time
  const hist = led.bankroll_history || [];
  setEmpty('chart-bankroll', hist.length === 0);
  if (hist.length) upsertChart('chart-bankroll', 'line',
    lineData(hist.map(h => h.t), hist.map(h => h.bankroll), 'Bankroll ($)', selectedLedger === 'live' ? '#dc3545' : '#28a745'),
    { responsive: true, scales: { y: moneyAxis, x: { ticks: { autoSkip: true, maxTicksLimit: 12, font: { size: 14 } }, grid: { color: '#f0f0f0' } } } });
  // (b) P&L by trade (recent 100; backend recent_trades holds the last 100)
  const rt = (led.recent_trades || []).slice(-100);
  setEmpty('chart-pnl', rt.length === 0);
  if (rt.length) upsertChart('chart-pnl', 'bar',
    barData(rt.map((t, i) => '#' + (i + 1)), rt.map(t => t.pnl), 'P&L per trade ($)', greenRed(rt.map(t => t.pnl))),
    { responsive: true, plugins: { legend: { display: false } }, scales: { y: moneyAxis, x: { ticks: { display: false }, grid: { color: '#f0f0f0' } } } });
  // (c) Win rate over time, rolling 20
  const rw = led.rolling_wr || [];
  setEmpty('chart-winrate', rw.length === 0);
  if (rw.length) upsertChart('chart-winrate', 'line',
    { labels: rw.map(r => r.t), datasets: [
      { label: 'Rolling 20-trade win rate %', data: rw.map(r => r.win_rate), borderColor: '#1f77b4', borderWidth: 3, pointRadius: 0 },
      { label: 'Breakeven 50%', data: rw.map(() => 50), borderColor: '#dc3545', borderDash: [6, 6], borderWidth: 2, pointRadius: 0 }] },
    { responsive: true, scales: { y: pctAxis, x: { ticks: { autoSkip: true, maxTicksLimit: 12, font: { size: 14 } }, grid: { color: '#f0f0f0' } } } });
  // Edge-health warning: sustained = last 5 rolling values all below 50%
  // (or the last value below 50% when fewer than 5 points exist).
  const warn = $('edge-warning');
  if (warn) {
    const tail = rw.slice(-5);
    const sustained = tail.length > 0 && tail.every(r => r.win_rate < 50);
    warn.classList.toggle('hidden', !sustained);
  }
  // (d) Drawdown over time (backend series; fall back to computing from history)
  let dd = led.drawdown_series || [];
  if (!dd.length && hist.length) {
    let peak = 0;
    dd = hist.map(h => { peak = Math.max(peak, h.bankroll); return { t: h.t, drawdown_pct: peak > 0 ? +((peak - h.bankroll) / peak * 100).toFixed(2) : 0 }; });
  }
  setEmpty('chart-drawdown', dd.length === 0);
  if (dd.length) upsertChart('chart-drawdown', 'line',
    lineData(dd.map(d => d.t), dd.map(d => d.drawdown_pct), 'Drawdown (%)', '#dc3545'),
    { responsive: true, plugins: { legend: { display: false } }, scales: { y: pctAxis, x: { ticks: { autoSkip: true, maxTicksLimit: 12, font: { size: 14 } }, grid: { color: '#f0f0f0' } } } });
  // Analysis charts (same selected ledger — never mixed with the other ledger)
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const byHour = led.by_hour || {};
  const hourVals = hours.map(h => (byHour[h] || byHour[String(h)] || { pnl: 0 }).pnl);
  const hourHas = hours.some(h => (byHour[h] || byHour[String(h)] || { trades: 0 }).trades > 0);
  setEmpty('chart-hour', !hourHas);
  if (hourHas) upsertChart('chart-hour', 'bar',
    barData(hours.map(h => String(h).padStart(2, '0')), hourVals, 'P&L ($)',
      // Bars colored by P&L sign only. The old hour-highlight coloring
      // was removed: those hour labels did not replicate in the 1-year
      // backtest and are unproven until live data confirms them.
      hours.map(h => hourVals[h] >= 0 ? '#28a745' : '#dc3545')),
    { responsive: true, plugins: { legend: { display: false } }, scales: { y: moneyAxis, x: { title: { display: true, text: 'Hour (UTC)', font: { size: 14 } }, ticks: { font: { size: 14 } }, grid: { color: '#f0f0f0' } } } });
  const cryptoKeys = Object.keys(led.by_crypto || {});
  setEmpty('chart-crypto', cryptoKeys.length === 0);
  if (cryptoKeys.length) upsertChart('chart-crypto', 'bar',
    barData(cryptoKeys, cryptoKeys.map(k => led.by_crypto[k].pnl), 'P&L ($)', greenRed(cryptoKeys.map(k => led.by_crypto[k].pnl))),
    { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } }, scales: { x: moneyAxis, y: plainAxis } });
  const bySide = led.by_side || {};
  const sideHas = (bySide.yes && bySide.yes.trades) || (bySide.no && bySide.no.trades);
  setEmpty('chart-side', !sideHas);
  if (sideHas) upsertChart('chart-side', 'bar',
    barData(['YES (dips)', 'NO (spikes)'], [(bySide.yes || { pnl: 0 }).pnl, (bySide.no || { pnl: 0 }).pnl], 'P&L ($)', ['#28a745', '#dc3545']),
    { responsive: true, plugins: { legend: { display: false } }, scales: { y: moneyAxis, x: plainAxis } });
  const mKeys = Object.keys(led.monthly || {}).sort();
  setEmpty('chart-monthly', mKeys.length === 0);
  if (mKeys.length) upsertChart('chart-monthly', 'bar',
    barData(mKeys, mKeys.map(k => led.monthly[k]), 'Monthly P&L ($)', greenRed(mKeys.map(k => led.monthly[k]))),
    { responsive: true, plugins: { legend: { display: false } }, scales: { y: moneyAxis, x: plainAxis } });
  // Trade log (selected ledger only)
  const tbody = document.querySelector('#trade-log tbody');
  const trades = (led.recent_trades || []).slice().reverse();
  const logEmpty = $('empty-trade-log');
  if (logEmpty) logEmpty.classList.toggle('hidden', trades.length > 0);
  if (tbody) tbody.innerHTML = trades.map(t =>
    '<tr><td>' + esc(t.t) + '</td><td>' + esc(t.market || '') + '</td><td><span class="tag ' + (t.side === 'no' ? 'live-tag' : 'paper-tag') + '">' + esc(String(t.side || '').toUpperCase()) + '</span></td>'
    + '<td>' + esc(t.contracts) + '</td><td>' + esc(t.entry_cents) + 'c</td><td>' + esc(t.exit_cents) + 'c</td>'
    + '<td class="' + (t.pnl >= 0 ? 'win' : 'loss') + '">' + money(t.pnl) + '</td><td>' + esc(t.reason || '') + '</td></tr>').join('');
}
function renderCompareCharts(paper, live) {
  const ph = paper.bankroll_history || [], lh = live.bankroll_history || [];
  setEmpty('chart-paper-compare', ph.length === 0);
  if (ph.length) upsertChart('chart-paper-compare', 'line', lineData(ph.map(h => h.t), ph.map(h => h.bankroll), 'Paper bankroll ($)', '#28a745'),
    { responsive: true, plugins: { legend: { display: false } }, scales: { y: moneyAxis, x: { ticks: { display: false }, grid: { color: '#f0f0f0' } } } });
  setEmpty('chart-live-compare', lh.length === 0);
  if (lh.length) upsertChart('chart-live-compare', 'line', lineData(lh.map(h => h.t), lh.map(h => h.bankroll), 'Live bankroll ($)', '#dc3545'),
    { responsive: true, plugins: { legend: { display: false } }, scales: { y: moneyAxis, x: { ticks: { display: false }, grid: { color: '#f0f0f0' } } } });
}
function renderSim(sim) {
  if (!sim) return;
  $('sim-summary').textContent =
    'SIMULATION — HISTORICAL DATA · ' + sim.symbol + ' · ' + sim.strategy + ' · direction: ' + sim.direction
    + ' · ' + sim.start + ' to ' + sim.end + ' · $' + sim.starting_bankroll + ' → $' + sim.final_bankroll
    + ' · ' + sim.trades + ' trades · ' + sim.wins + ' wins · ' + sim.win_rate + '% win';
  const warn = $('sim-synthetic-warning');
  if (warn) {
    if (sim.synthetic_fallback) { warn.textContent = 'Warning: synthetic fallback data — Binance candles were unreachable, so this simulation used generated prices, not real history.'; warn.classList.remove('hidden'); }
    else warn.classList.add('hidden');
  }
  const hist = sim.history || [];
  setEmpty('chart-sim', hist.length === 0);
  if (hist.length) upsertChart('chart-sim', 'line', lineData(hist.map(h => h.t.slice(0, 10)), hist.map(h => h.bankroll), 'Sim bankroll ($)', '#e6a700'),
    { responsive: true, scales: { y: moneyAxis, x: { ticks: { autoSkip: true, maxTicksLimit: 12, font: { size: 14 } }, grid: { color: '#f0f0f0' } } } });
  const mKeys = Object.keys(sim.monthly || {}).sort();
  setEmpty('chart-sim-monthly', mKeys.length === 0);
  if (mKeys.length) upsertChart('chart-sim-monthly', 'bar',
    barData(mKeys, mKeys.map(k => sim.monthly[k]), 'Monthly P&L ($)', greenRed(mKeys.map(k => sim.monthly[k]))),
    { responsive: true, plugins: { legend: { display: false } }, scales: { y: moneyAxis, x: plainAxis } });
  const dKeys = Object.keys(sim.per_day || {}).sort().slice(-30);
  setEmpty('chart-sim-perday', dKeys.length === 0);
  if (dKeys.length) upsertChart('chart-sim-perday', 'bar',
    barData(dKeys, dKeys.map(d => sim.per_day[d]), 'Trades/day', '#e6a700'),
    { responsive: true, plugins: { legend: { display: false } }, scales: { y: plainAxis, x: { ticks: { autoSkip: true, maxTicksLimit: 10, font: { size: 14 } }, grid: { color: '#f0f0f0' } } } });
}
function renderSimVsActual(sim, paper) {
  // CHART_PLAN #20: Simulation vs Actual delta. Compares the historical
  // simulation against the paper ledger (actual paper trading). Different
  // data sources — informational only, never a performance claim.
  const card = $('sim-vs-actual-card');
  if (!card) return;
  const emptyEl = $('empty-sim-vs-actual');
  const tbody = document.querySelector('#sim-vs-actual-table tbody');
  if (!sim) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');
  if (emptyEl) emptyEl.classList.add('hidden');
  const p = paper || {};
  const pBank = (p.bankroll !== undefined) ? p.bankroll : null;
  const pPnl = (p.pnl !== undefined) ? p.pnl : null;
  const pWr = (p.win_rate !== undefined) ? p.win_rate : null;
  const pTrades = (p.trades !== undefined) ? p.trades : 0;
  const moneyDelta = (a, b) => (a === null || b === null) ? '—' : money(a - b);
  const pctDelta = (a, b) => (a === null || b === null) ? '—' : ((a - b >= 0 ? '+' : '') + (a - b).toFixed(1) + 'pp');
  const rows = [
    ['Final bankroll', money(sim.final_bankroll), pBank === null ? '—' : money(pBank), moneyDelta(pBank, sim.final_bankroll)],
    ['Total P&L', money(sim.total_pnl), pPnl === null ? '—' : money(pPnl), moneyDelta(pPnl, sim.total_pnl)],
    ['Win rate', sim.win_rate + '%', pWr === null ? '—' : pWr + '%', pctDelta(pWr, sim.win_rate)],
    ['Trades', String(sim.trades), String(pTrades), String(pTrades - sim.trades)],
  ];
  if (tbody) tbody.innerHTML = rows.map(r =>
    '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td><td>' + esc(r[3]) + '</td></tr>').join('');
  const note = $('sim-vs-actual-note');
  if (note) note.textContent = pTrades === 0
    ? 'Paper has no trades yet — delta reflects starting bankroll only and will move once paper trading runs.'
    : 'Simulation is historical backtest data; paper is live-simulated trading. The delta compares different periods and methods.';
}
function showTest(r) {
  $('test-card').classList.remove('hidden');
  const v = $('test-verdict');
  v.textContent = r.verdict;
  v.className = r.verdict === 'FEASIBLE' ? 'win' : (r.verdict === 'NOT_FEASIBLE' ? 'loss' : 'inconclusive');
  $('test-detail').textContent =
    r.market + ' · ' + r.strategy + ' · direction: ' + r.direction + ' · ' + r.aggressiveness
    + ' · ' + r.trades_run + ' trades · ' + r.wins + ' wins · ' + r.win_rate + '% win · $10 → $' + r.final_bankroll + '. ' + (r.note || '');
  document.querySelector('#test-trades tbody').innerHTML = (r.trades || []).map((t, i) =>
    '<tr><td>' + (i + 1) + '</td><td><span class="tag ' + (t.side === 'no' ? 'live-tag' : 'paper-tag') + '">' + esc(String(t.side || '').toUpperCase()) + '</span></td>'
    + '<td>' + esc(t.entry) + 'c</td><td>' + esc(t.exit) + 'c</td><td class="' + (t.pnl >= 0 ? 'win' : 'loss') + '">' + money(t.pnl) + '</td><td>' + esc(t.reason || '') + '</td></tr>').join('');
}
function updateFeeVisibility() {
  // Fee inputs are mode-gated in the UI (backend validates any field sent
  // regardless of mode): tolerance only in Tolerance mode, caps only in
  // Cap mode. Hidden inputs still keep their values for the payload.
  const mode = $('fee-mode-select') ? $('fee-mode-select').value : 'zero';
  const show = (id, on) => { const el = $(id); if (el) el.style.display = on ? '' : 'none'; };
  show('fee-tolerance-label', mode === 'tolerance');
  show('fee-caps-label', mode === 'cap');
  show('fee-cap-total-label', mode === 'cap');
  show('fee-cap-alpha-label', mode === 'cap');
  show('fee-cap-beta-label', mode === 'cap');
}
$('fee-mode-select').addEventListener('change', updateFeeVisibility);
function fillSettings(s) {
  // Fill settings inputs ONLY on initial load and after a
  // server-confirmed save/mode change — NEVER on routine polls
  // (Item C.2: the old every-refresh fill reverted unsaved edits the
  // moment a control lost focus). Two further guards: a control the
  // user edited since the last server sync (dataset.dirty) is never
  // overwritten, and simulation controls are NOT settings — they are
  // filled once by fillSimOnce and never touched again here (C.4).
  const active = document.activeElement;
  const set = (id, val) => {
    const el = $(id);
    // Skip dirty controls AND the focused element (F3c): a routine
    // fill must never overwrite an in-progress edit.
    if (el && val !== undefined && val !== null && !el.dataset.dirty && el !== active) el.value = val;
  };
  set('market-select', s.market); set('market-select-dash', s.market);
  set('strategy-select', s.strategy); set('strategy-select-dash', s.strategy);
  set('direction-select', s.direction); set('direction-select-dash', s.direction);
  set('agg-select', s.aggressiveness); set('agg-select-dash', s.aggressiveness);
  set('paper-engine-select', s.paper_engine);
  set('bankroll-input', s.starting_bankroll); set('daily-loss-input', s.daily_loss_pct);
  set('trade-cost-input', s.per_trade_cost_pct); set('test-limit-input', s.test_limit_pct);
  set('contracts-input', s.risk_pct_override); set('mode-select', s.mode);
  set('fee-mode-select', s.fee_mode); set('fee-tolerance-input', s.fee_tolerance);
  set('fee-caps-select', s.fee_caps); set('fee-cap-total-input', s.fee_cap_total_pct);
  set('fee-cap-alpha-input', s.fee_cap_alpha); set('fee-cap-beta-input', s.fee_cap_beta);
  $('confirm-wrap').classList.toggle('hidden', s.mode !== 'live');
  updateFeeVisibility();
  updateAggDesc();
}
function fillSimOnce(s) {
  // Simulation setup is independent after initial load (Item C.4).
  const set = (id, val) => { const el = $(id); if (el && val !== undefined && val !== null) el.value = val; };
  set('sim-market', s.market); set('sim-strategy', s.strategy); set('sim-direction', s.direction);
}
// DIRTY TRACKING + MIRROR SYNC (Item C.2/C.3): any edit marks its
// control dirty (fillSettings will never overwrite it); changing a
// dashboard control immediately updates its Settings-tab counterpart
// (and vice versa) so both tabs always agree before any save. This
// REPLACES the old FIELD_PAIRS sync, which was direction-broken: its
// handler always copied settings->dash FIRST, so a dash-side edit was
// reverted to the settings value the moment it fired 'change' (only
// settings->dash edits ever survived). A programmatic .value
// assignment fires no event, so mirroring cannot loop. The mirrored
// control is NOT marked dirty — its value already equals the source,
// and the source's dirty flag protects the pair.
const MIRROR_PAIRS = [
  ['market-select', 'market-select-dash'],
  ['strategy-select', 'strategy-select-dash'],
  ['direction-select', 'direction-select-dash'],
  ['agg-select', 'agg-select-dash'],
];
MIRROR_PAIRS.forEach(([a, b]) => {
  const elA = $(a), elB = $(b);
  if (elA) elA.addEventListener('input', () => { elA.dataset.dirty = '1'; if (elB) elB.value = elA.value; });
  if (elB) elB.addEventListener('input', () => { elB.dataset.dirty = '1'; if (elA) elA.value = elB.value; });
  if (elA) elA.addEventListener('change', () => { elA.dataset.dirty = '1'; if (elB) elB.value = elA.value; });
  if (elB) elB.addEventListener('change', () => { elB.dataset.dirty = '1'; if (elA) elA.value = elB.value; });
});
// Every other settings input marks itself dirty on edit.
['bankroll-input', 'daily-loss-input', 'trade-cost-input', 'test-limit-input',
 'contracts-input', 'fee-mode-select', 'fee-tolerance-input', 'fee-caps-select',
 'fee-cap-total-input', 'fee-cap-alpha-input', 'fee-cap-beta-input',
 'mode-select'].forEach(id => {
  const el = $(id);
  if (el) {
    el.addEventListener('input', () => { el.dataset.dirty = '1'; });
    el.addEventListener('change', () => { el.dataset.dirty = '1'; });
  }
});
function updateBankrollWarning() {
  const el = $('bankroll-input'), warn = $('bankroll-warning');
  if (!el || !warn) return;
  const serverVal = lastStatus ? lastStatus.starting_bankroll : null;
  const cur = parseFloat(el.value);
  const differs = serverVal !== null && serverVal !== undefined && !isNaN(cur) && cur !== serverVal;
  warn.classList.toggle('hidden', !differs);
}
if ($('bankroll-input')) {
  $('bankroll-input').addEventListener('input', updateBankrollWarning);
  $('bankroll-input').addEventListener('change', updateBankrollWarning);
}
// DAILY-LIMIT SOURCE (settings cross-reference audit, 2026-10-27): the
// limit the dashboard shows must be the limit the SELECTED ledger is
// actually bound by. The trader (live and live-window paper) enforces its
// own FIXED daily loss limit — it takes no CLI flag, so the GUI's
// daily_loss_pct setting cannot reach it — while the synthetic demo
// engine halts on that setting. The server reports the trader's fixed
// value as trader_daily_loss_pct; 50 is the fallback for older payloads.
const TRADER_DAILY_LOSS_PCT = 50;
function dailyLimitFor(s) {
  const traderPct = (typeof s.trader_daily_loss_pct === 'number'
    && isFinite(s.trader_daily_loss_pct)) ? s.trader_daily_loss_pct : TRADER_DAILY_LOSS_PCT;
  if (selectedLedger === 'paper' && s.paper_engine === 'synthetic') {
    return { pct: s.daily_loss_pct, source: 'synthetic demo setting — demo engine only' };
  }
  return {
    pct: traderPct,
    source: selectedLedger === 'live'
      ? 'live trader — fixed limit, not a settings value'
      : 'live-window paper trader — fixed limit, not a settings value',
  };
}

// PHASE 2 (server-unreachable badge): consecutive failed refreshes.
// After 2 failures the badge shows the last successful update time;
// the first success clears it. The dashboard never auto-retries the
// trader from this badge — it only reports staleness.
let refreshFailures = 0;
let lastGoodUpdate = null;
async function refresh() {
  try {
    const s = await api('/api/status');
    refreshFailures = 0;
    lastGoodUpdate = s.last_update || lastGoodUpdate;
    const sb = $('server-badge'); if (sb) sb.classList.add('hidden');
    lastStatus = s;
    const banner = $('mode-banner');
    if (s.mode === 'live') { banner.textContent = 'LIVE — REAL MONEY'; banner.className = 'banner live'; }
    else { banner.textContent = 'PAPER — NO REAL MONEY'; banner.className = 'banner paper'; }
    const badge = $('status-badge');
    badge.textContent = s.status; badge.className = 'badge ' + s.status;
    updateToggleButtons();
    $('status-message').textContent = s.status_message || '';
    // Trader-log age (2026-10-25 logging overhaul): with per-poll POLL
    // heartbeats the JSONL is a real activity feed; surface the newest
    // line's age, and warn when it goes stale >90s while running
    // (complement to poll()-based liveness, not a replacement: a hung
    // process stops writing lines long before anything else notices).
    // Normal lag is ~25s worst case, so 90s is safely above noise.
    const llEl = $('live-log-line');
    if (llEl) {
      if (s.mode === 'live' && s.live_last_log_event) {
        llEl.classList.remove('hidden');
        $('live-log-event').textContent = s.live_last_log_event;
        const age = s.live_log_age_sec;
        let ageTxt = (age === null || age === undefined) ? 'age unknown' : (age < 5 ? 'just now' : age + 's ago');
        if (s.status === 'running' && age !== null && age !== undefined && age > 90) {
          ageTxt += ' — STALE: no trader log line for over 90s, the live process may be stuck (check the subprocess log file)';
          llEl.className = 'error';
        } else llEl.className = 'note';
        $('live-log-age').textContent = ageTxt;
      } else if (s.mode === 'live' && s.status === 'running') {
        // ITEM D.4: the old stale warning only rendered when a log
        // event already existed, so a trader stuck at startup showed
        // NOTHING. When live + running but no JSONL line has ever been
        // seen, say so explicitly — stuck-vs-running must be visible
        // without opening log files.
        llEl.classList.remove('hidden');
        llEl.className = 'warning';
        $('live-log-event').textContent = 'No trader activity yet';
        $('live-log-age').textContent = 'the live trader has not written any log line — if this persists, check the subprocess log file';
      } else llEl.classList.add('hidden');
    }
    // Settings-load warning (Item C.1): a corrupt/partial settings file
    // must surface, not silently revert.
    showEl('settings-warning', s.settings_warning || null);
    showEl('status-error', s.error || null);
    // Kalshi account balance (truthfulness fix 2026-10-25): null renders
    // a dash — NEVER a dollar figure (the old $10 was the simulated
    // ledger's starting capital, not the account). A real number renders
    // as dollars; 0 is a real balance ($0.00), not null.
    const kb = $('kalshi-balance');
    if (kb) kb.textContent = (s.kalshi_balance === null || s.kalshi_balance === undefined) ? '—' : money(s.kalshi_balance);
    // Exchange-status line (live only; paper shows not-applicable, never faked).
    const exEl = $('exchange-status-line');
    if (exEl) {
      if (s.mode === 'live') {
        const ex = s.exchange_status;
        if (!ex || ex.applicable === false) exEl.textContent = 'Exchange status: checking…';
        else if (ex.state === 'ok') exEl.textContent = 'Exchange: ACTIVE — trading permitted.';
        else if (ex.state === 'exchange_inactive') exEl.textContent = 'Exchange: INACTIVE — entries skipped (core exchange not taking state changes)' + (ex.resume_time ? ' — estimated resume: ' + ex.resume_time : '');
        else if (ex.state === 'unknown') exEl.textContent = 'Exchange: status UNKNOWN — entries skipped until the exchange confirms trading is permitted.';
        else exEl.textContent = 'Exchange: PAUSED — entries skipped (exchange not permitting trading)' + (ex.resume_time ? ' — estimated resume: ' + ex.resume_time : '');
      } else exEl.textContent = 'Exchange status: not applicable in paper mode.';
    }
    $('last-update').textContent = s.last_update || '—';
    $('open-positions').textContent = Array.isArray(s.open_positions) ? s.open_positions.length : 0;
    // Keys indicator: boolean ONLY, never a key value.
    const kp = s.keys_present ? 'Yes' : 'No';
    $('keys-status-line').textContent = 'Keys Present: ' + kp;
    const ks = $('keys-status'); if (ks) ks.innerHTML = '<strong>Keys Present: ' + kp + '</strong>';
    // Finnhub indicator: boolean ONLY, never the key value.
    const fp = s.finnhub_key_present ? 'Yes' : 'No';
    const fsl = $('finnhub-status-line'); if (fsl) fsl.textContent = 'Finnhub key: ' + fp;
    const fs = $('finnhub-status'); if (fs) fs.innerHTML = '<strong>Finnhub key present: ' + fp + '</strong>';
    if (s.finnhub_test_result) $('finnhub-test-result').textContent = (s.finnhub_test_result.ok ? 'Last Finnhub test: OK — ' : 'Last Finnhub test: FAILED — ') + (s.finnhub_test_result.message || '');
    if (s.typesafe_test_result) $('typesafe-test-result').textContent = (s.typesafe_test_result.ok ? 'Last TypeSafe test: OK — ' : 'Last TypeSafe test: FAILED — ') + (s.typesafe_test_result.message || '');
    if (s.key_test_result) $('key-test-result').textContent = (s.key_test_result.ok ? 'Last key test: OK — ' : 'Last key test: FAILED — ') + (s.key_test_result.message || '');
    // STATE LOSS (Item C.2/C.4/C.6): routine polls NEVER fill settings
    // inputs or simulation controls. On the FIRST successful load only:
    // fill settings inputs, fill simulation controls once, and
    // initialize the ledger view (stored choice wins, else server mode).
    if (!settingsLoaded) {
      fillSettings(s);
      fillSimOnce(s);
      settingsLoaded = true;
    }
    if (!ledgerViewInit) {
      let stored = null;
      try { stored = localStorage.getItem('kalshi_selected_ledger'); } catch (e) {}
      if (stored !== 'paper' && stored !== 'live') {
        setLedger(s.mode === 'live' ? 'live' : 'paper', false);
      } else {
        setLedger(stored, false);
      }
      ledgerViewInit = true;
    }
    const selected = selectedLedger === 'live' ? s.live : s.paper;
    // ITEM B labels: the three numbers must be unmistakable at a glance.
    // The account balance line is the real Kalshi balance (or a dash).
    // The ledger stat label + info line say exactly which ledger is
    // shown and what it counts. The live ledger is session P&L only:
    // open positions are NOT counted until closed, and manual trades
    // placed in the Kalshi app itself never appear in it (only the
    // account balance reflects them).
    const lbl = $('stat-bankroll-label');
    const info = $('ledger-info');
    if (selectedLedger === 'live') {
      if (lbl) lbl.textContent = 'Live ledger bankroll (session)';
      if (info) {
        if (s.live_start_capital !== null && s.live_start_capital !== undefined) {
          info.textContent = 'Live ledger (GUI trader session, starting ' + money(s.live_start_capital) +
            (s.live_start_time ? ' at ' + s.live_start_time : '') +
            ') — session P&L only; open positions are not counted until closed, and manual trades placed in the Kalshi app do not appear here (only the account balance reflects them).';
        } else {
          info.textContent = 'Live ledger (GUI trader session, not yet synced — start live to sync with your Kalshi account balance). Session P&L only; open positions are not counted until closed.';
        }
      }
    } else {
      // PHASE 2 (D6/D7): the paper label follows the paper engine.
      // Live-window paper is NOT "simulated" — it runs on real
      // Kalshi binaries + Finnhub spot with simulated fills only.
      if (lbl) lbl.textContent = s.paper_ledger_label || 'Ledger bankroll (simulated)';
      if (info) info.textContent = (s.paper_engine === 'synthetic')
        ? 'Synthetic demo — random prices, not strategy paper. The real paper test is live-window paper (CLI --paper).'
        : 'Paper ledger (live-window) — real Kalshi binaries + Finnhub spot, simulated fills, no real money.';
    }
    renderSelectedStats(selected, s.status, s.last_update);
    renderLedgerCharts(selected);
    $('paper-stats').innerHTML = statsHtml(s.paper, s.paper_ledger_label || 'Ledger bankroll (simulated)');
    $('live-stats').innerHTML = statsHtml(s.live, 'Live ledger bankroll (session)');
    renderCompareCharts(s.paper, s.live);
    // Daily P&L vs limit (selected ledger; v2.3: limit $ = % x day-start bankroll)
    const limit = dailyLimitFor(s);
    const dailyLimitDollars = (limit.pct / 100) * (selected.day_start_bankroll || s.starting_bankroll);
    const pct = dailyLimitDollars > 0 ? Math.min(100, (selected.daily_loss / dailyLimitDollars) * 100) : 0;
    $('daily-limit-text').textContent = 'Daily loss ' + money(selected.daily_loss) + ' of ' + money(dailyLimitDollars) + ' limit (' + limit.pct + '% of day-start bankroll · ' + limit.source + ') · ' + selected.daily_trades + ' trades today';
    $('daily-limit-bar').style.width = pct + '%';
    $('daily-limit-bar').className = 'progress-fill' + (pct >= 100 ? ' full' : (pct >= 80 ? ' warn' : ''));
    if (s.simulation) renderSim(s.simulation);
    if (s.simulation) renderSimVsActual(s.simulation, s.paper);
    if (s.test_result) showTest(s.test_result);
  } catch (e) {
    // PHASE 2: after 2 consecutive failed refreshes, say so and
    // name the last good view instead of silently showing stale data.
    refreshFailures += 1;
    if (refreshFailures >= 2) {
      const sb = $('server-badge');
      if (sb) {
        sb.textContent = 'Server unreachable — showing last view from ' + (lastGoodUpdate || 'unknown') + '.';
        sb.classList.remove('hidden');
      }
    }
  }
}
async function refreshKeys() {
  try {
    const r = await api('/api/keys/status');
    const kp = r.keys_present ? 'Yes' : 'No';
    $('keys-status-line').textContent = 'Keys Present: ' + kp;
    const ks = $('keys-status'); if (ks) ks.innerHTML = '<strong>Keys Present: ' + kp + '</strong>';
  } catch (e) { /* keep last indicator */ }
}
async function refreshFinnhub() {
  try {
    const r = await api('/api/finnhub/status');
    const fp = r.finnhub_key_present ? 'Yes' : 'No';
    const fsl = $('finnhub-status-line'); if (fsl) fsl.textContent = 'Finnhub key: ' + fp;
    const fs = $('finnhub-status'); if (fs) fs.innerHTML = '<strong>Finnhub key present: ' + fp + '</strong>';
  } catch (e) { /* keep last indicator */ }
}
async function refreshTypesafe() {
  try {
    const r = await api('/api/typesafe/status');
    const tp = r.typesafe_key_present ? 'Yes' : 'No';
    const ts = $('typesafe-status'); if (ts) ts.innerHTML = '<strong>TypeSafe key present: ' + tp + '</strong>';
  } catch (e) { /* keep last indicator */ }
}
function setLedger(which, persist) {
  selectedLedger = which;
  if (persist !== false) storeLedger(which);
  $('ledger-label').textContent = which === 'live' ? 'Live' : 'Paper';
  $('btn-ledger-paper').className = which === 'paper' ? 'primary' : '';
  $('btn-ledger-live').className = which === 'live' ? 'primary' : '';
  if (lastStatus) { renderSelectedStats(which === 'live' ? lastStatus.live : lastStatus.paper, lastStatus.status, lastStatus.last_update); renderLedgerCharts(which === 'live' ? lastStatus.live : lastStatus.paper); }
}
$('btn-ledger-paper').addEventListener('click', () => setLedger('paper'));
$('btn-ledger-live').addEventListener('click', () => setLedger('live'));

function settingsPayloadFromSettingsTab() {
  return {
    market: $('market-select').value, strategy: $('strategy-select').value,
    direction: $('direction-select').value, aggressiveness: $('agg-select').value,
    paper_engine: $('paper-engine-select').value,
    starting_bankroll: parseFloat($('bankroll-input').value),
    daily_loss_pct: parseFloat($('daily-loss-input').value),
    per_trade_cost_pct: parseFloat($('trade-cost-input').value),
    test_limit_pct: parseFloat($('test-limit-input').value),
    risk_pct_override: parseFloat($('contracts-input').value),
    fee_mode: $('fee-mode-select').value,
    fee_tolerance: parseFloat($('fee-tolerance-input').value),
    fee_caps: $('fee-caps-select').value,
    fee_cap_total_pct: parseFloat($('fee-cap-total-input').value),
    fee_cap_alpha: parseFloat($('fee-cap-alpha-input').value),
    fee_cap_beta: parseFloat($('fee-cap-beta-input').value),
  };
}
async function saveSettings(payload, errId) {
  showEl(errId, null); showEl('form-success', null); showEl('form-success-dash', null);
  const r = await api('/api/settings', 'POST', payload);
  if (!r.ok) {
    // STATE LOSS (Item C.8): a 400 (e.g. settings blocked while
    // running) must preserve the user's edits — show the backend error
    // verbatim and overwrite NOTHING. Routine polls never refill inputs
    // (C.2) and dirty flags protect edited controls from any fill, so
    // the attempted values stay exactly as typed.
    showEl(errId, r.error || 'Settings save failed.');
  } else {
    // Server-confirmed save: clear the dirty flag ONLY for controls
    // whose current value still equals the saved payload value. A
    // control edited mid-flight (value differs from the payload) keeps
    // its dirty flag, so the refill below cannot overwrite the newer
    // edit with the older server value.
    const KEY_TO_CONTROL = {
      market: 'market-select', strategy: 'strategy-select',
      direction: 'direction-select', aggressiveness: 'agg-select',
      paper_engine: 'paper-engine-select',
      starting_bankroll: 'bankroll-input', daily_loss_pct: 'daily-loss-input',
      per_trade_cost_pct: 'trade-cost-input', test_limit_pct: 'test-limit-input',
      risk_pct_override: 'contracts-input', fee_mode: 'fee-mode-select',
      fee_tolerance: 'fee-tolerance-input', fee_caps: 'fee-caps-select',
      fee_cap_total_pct: 'fee-cap-total-input', fee_cap_alpha: 'fee-cap-alpha-input',
      fee_cap_beta: 'fee-cap-beta-input',
    };
    const DASH_KEY_TO_CONTROL = {
      market: 'market-select-dash', strategy: 'strategy-select-dash',
      direction: 'direction-select-dash', aggressiveness: 'agg-select-dash',
    };
    const mapping = errId === 'form-error-dash' ? DASH_KEY_TO_CONTROL : KEY_TO_CONTROL;
    Object.keys(payload).forEach(key => {
      const id = mapping[key];
      if (!id) return;
      const el = $(id);
      if (!el) return;
      const saved = payload[key];
      const same = (typeof saved === 'number')
        ? parseFloat(el.value) === saved
        : el.value === String(saved);
      if (same) delete el.dataset.dirty;
    });
    let msg = 'Settings saved.';
    if (r.ledgers_reset) msg += ' Starting capital changed: both ledgers reset.';
    // FEEDBACK ROUTING (2026-10-27): the success line must appear on the
    // tab the save came from. The dashboard used to write its success text
    // into the Settings tab's line (hidden while you are on the Dashboard),
    // so a dashboard save looked like nothing had happened until the next
    // poll. Each tab now has its own line; the Settings tab is cleared of
    // only its own stale messages by the cross-tab saves.
    showEl('form-success', errId === 'form-error' ? msg : null);
    showEl('form-success-dash', errId === 'form-error-dash' ? msg : null);
    if (errId !== 'form-error') showEl('form-error', null);
    const bw = $('bankroll-warning'); if (bw) bw.classList.add('hidden');
    if (r.settings) fillSettings(r.settings);
    refresh();
  }
  return r;
}
$('btn-apply').addEventListener('click', async () => { await saveSettings(settingsPayloadFromSettingsTab(), 'form-error'); });
$('btn-apply-dash').addEventListener('click', async () => {
  await saveSettings({
    market: $('market-select-dash').value, strategy: $('strategy-select-dash').value,
    direction: $('direction-select-dash').value, aggressiveness: $('agg-select-dash').value,
  }, 'form-error-dash');
});
$('mode-select').addEventListener('change', e => {
  $('confirm-wrap').classList.toggle('hidden', e.target.value !== 'live');
});
$('btn-mode').addEventListener('click', async () => {
  showEl('mode-error', null); $('mode-message').textContent = '';
  const mode = $('mode-select').value;
  const r = await api('/api/mode', 'POST', { mode, confirm: $('live-confirm').value });
  if (!r.ok) {
    showEl('mode-error', r.error || 'Mode switch failed.');
    // Failed switch: restore the select to the server-confirmed mode
    // (a server-confirmed correction, not a poll overwrite — the
    // attempted value must not linger as if it had applied).
    if (lastStatus && lastStatus.mode) $('mode-select').value = lastStatus.mode;
  }
  else { $('mode-message').textContent = 'Mode is now ' + r.mode + '.';
    // LEDGER-VIEW FIX (2026-10-25): the main stats/charts render
    // selectedLedger, which previously changed ONLY via the Paper/Live
    // ledger buttons — so after a mode switch the LIVE banner sat over
    // PAPER numbers, looking exactly like paper trades carried onto
    // live (the ledgers themselves were always separate). A successful
    // mode switch now auto-selects the matching ledger; the manual
    // buttons still allow inspecting the other ledger afterwards.
    // setLedger uses the server-confirmed r.mode, then refresh()
    // re-renders with fresh status for that ledger.
    setLedger(r.mode); refresh(); }
});
function updateToggleButtons() {
  const running = lastStatus && lastStatus.status === 'running';
  const label = running ? '■ Stop Trader' : '▶ Start Trader';
  const t1 = $('btn-toggle'), t2 = $('btn-toggle-settings');
  if (t1) { t1.textContent = label; t1.classList.toggle('primary', !running); }
  if (t2) { t2.textContent = label; t2.classList.toggle('primary', !running); }
}
async function toggleTrader() {
  showEl('form-error', null); showEl('form-error-dash', null);
  const running = lastStatus && lastStatus.status === 'running';
  const btns = [$('btn-toggle'), $('btn-toggle-settings')].filter(Boolean);
  btns.forEach(b => b.disabled = true);
  const r = await api(running ? '/api/stop' : '/api/start', 'POST', {});
  if (!r.ok) { showEl('form-error', r.error); showEl('form-error-dash', r.error); }
  await refresh();
  btns.forEach(b => b.disabled = false);
}
$('btn-toggle').addEventListener('click', toggleTrader);
$('btn-toggle-settings').addEventListener('click', toggleTrader);
async function runTest() {
  showEl('form-error', null);
  const r = await api('/api/test_run', 'POST', {});
  if (r.ok) showTest(r.result); else showEl('form-error', r.error || 'Test run failed.');
}
$('btn-test').addEventListener('click', runTest);
$('btn-simulate').addEventListener('click', async () => {
  showEl('sim-error', null);
  const r = await api('/api/simulate', 'POST', {
    market: $('sim-market').value, strategy: $('sim-strategy').value,
    direction: $('sim-direction').value, start: $('sim-start').value, end: $('sim-end').value,
  });
  if (r.ok) { renderSim(r.result); renderSimVsActual(r.result, lastStatus ? lastStatus.paper : null); } else showEl('sim-error', r.error || 'Simulation failed.');
});
// Keys tab — values are sent to the backend only; nothing from any keys
// response is ever rendered back (responses carry booleans/messages only).
$('btn-save-keys').addEventListener('click', async () => {
  showEl('keys-error', null); $('keys-message').textContent = '';
  const r = await api('/api/keys/save', 'POST', { key_id: $('key-id-input').value, private_key: $('private-key-input').value });
  if (!r.ok) showEl('keys-error', r.error || 'Save failed.');
  else {
    $('keys-message').textContent = r.message || 'Keys saved.';
    $('key-id-input').value = ''; $('private-key-input').value = '';
  }
  refreshKeys();
});
$('btn-test-keys').addEventListener('click', async () => {
  showEl('keys-error', null); $('keys-message').textContent = '';
  const r = await api('/api/keys/test', 'POST', {});
  if (r.ok) $('keys-message').textContent = r.message || 'Keys work.';
  else showEl('keys-error', r.message || r.error || 'Key test failed.');
  refreshKeys();
});
$('btn-remove-keys').addEventListener('click', async () => {
  showEl('keys-error', null); $('keys-message').textContent = '';
  const r = await api('/api/keys/remove', 'POST', {});
  if (r.ok) $('keys-message').textContent = r.message || 'Keys removed.';
  else showEl('keys-error', r.error || 'Remove failed.');
  $('key-id-input').value = ''; $('private-key-input').value = '';
  refreshKeys(); refresh();
});
// Finnhub key section — same secrecy rule as Kalshi keys: the key value
// is sent to the backend only and nothing from any Finnhub response is
// ever rendered back (responses carry booleans/messages only).
$('btn-save-finnhub').addEventListener('click', async () => {
  showEl('finnhub-error', null); $('finnhub-message').textContent = '';
  const r = await api('/api/finnhub/save', 'POST', { api_key: $('finnhub-key-input').value });
  if (!r.ok) showEl('finnhub-error', r.error || 'Save failed.');
  else {
    $('finnhub-message').textContent = r.message || 'Finnhub key saved.';
    $('finnhub-key-input').value = '';
  }
  refreshFinnhub();
});
$('btn-test-finnhub').addEventListener('click', async () => {
  showEl('finnhub-error', null); $('finnhub-message').textContent = '';
  const r = await api('/api/finnhub/test', 'POST', {});
  if (r.ok) $('finnhub-message').textContent = r.message || 'Finnhub key works.';
  else showEl('finnhub-error', r.message || r.error || 'Finnhub test failed.');
  refreshFinnhub();
});
$('btn-remove-finnhub').addEventListener('click', async () => {
  showEl('finnhub-error', null); $('finnhub-message').textContent = '';
  const r = await api('/api/finnhub/remove', 'POST', {});
  if (r.ok) $('finnhub-message').textContent = r.message || 'Finnhub key removed.';
  else showEl('finnhub-error', r.error || 'Remove failed.');
  $('finnhub-key-input').value = '';
  refreshFinnhub(); refresh();
});
// TypeSafe key section — same secrecy rule as the other key blocks: the
// key value is sent to the backend only; responses carry booleans and
// messages only, never the key. Optional by design (see the card copy).
$('btn-save-typesafe').addEventListener('click', async () => {
  showEl('typesafe-error', null); $('typesafe-message').textContent = '';
  const r = await api('/api/typesafe/save', 'POST', { api_key: $('typesafe-key-input').value });
  if (!r.ok) showEl('typesafe-error', r.error || 'Save failed.');
  else {
    $('typesafe-message').textContent = r.message || 'TypeSafe key saved.';
    $('typesafe-key-input').value = '';
  }
  refreshTypesafe();
});
$('btn-test-typesafe').addEventListener('click', async () => {
  showEl('typesafe-error', null); $('typesafe-message').textContent = '';
  const r = await api('/api/typesafe/test', 'POST', {});
  if (r.ok) $('typesafe-message').textContent = r.message || 'TypeSafe key works.';
  else showEl('typesafe-error', r.message || r.error || 'TypeSafe test failed.');
  refreshTypesafe();
});
$('btn-remove-typesafe').addEventListener('click', async () => {
  showEl('typesafe-error', null); $('typesafe-message').textContent = '';
  const r = await api('/api/typesafe/remove', 'POST', {});
  if (r.ok) $('typesafe-message').textContent = r.message || 'TypeSafe key removed.';
  else showEl('typesafe-error', r.error || 'Remove failed.');
  $('typesafe-key-input').value = '';
  refreshTypesafe(); refresh();
});

/* ---- Multi-lane paper (PAPER ONLY, both modes) ---- */
const ML_CONFIRMED = ['ETH', 'BTC', 'SOL', 'DOGE', 'XRP', 'NEAR'];
const ML_FA_UNIVERSE = ['BTC', 'ETH', 'XRP', 'SOL', 'DOGE', 'HYPE', 'ZEC', 'NEAR', 'BNB'];
(function buildMlMarkets() {
  const wrap = $('ml-markets');
  if (!wrap) return;
  ML_CONFIRMED.forEach(m => {
    const lab = document.createElement('label');
    lab.innerHTML = '<input type="checkbox" class="ml-market" value="' + m + '"> ' + m +
      ' &nbsp; bankroll: <input type="number" class="ml-bankroll" data-market="' + m + '" placeholder="default" min="0" step="0.01" style="width:90px">';
    wrap.appendChild(lab);
  });
})();
function mlSelected() {
  return Array.from(document.querySelectorAll('.ml-market:checked')).map(e => e.value);
}
function mlBudgetLocal() {
  const mode = $('ml-mode-select').value;
  const n = mlSelected().length;
  const lane = mode === 'confirmed' ? n * 4 : 0;
  const engine = mode === 'fullauto' ? 36 : 0;
  const coll = ($('ml-collectors-running').checked && !$('ml-collectors-paused').checked) ? 34 : 0;
  const val = $('ml-validation-running').checked ? 36 : 0;
  const total = lane + engine + coll + val;
  const el = $('ml-budget-text');
  if (el) el.textContent = 'Budget projection: ' + total + '/min (limit 60) — lanes ' + lane + ', engine ' + engine + ', collectors ' + coll + ', validation ' + val + '.' + (total > 60 ? ' OVER LIMIT — the server will refuse this start.' : (total >= 50 ? ' Near the limit — 429s remain possible.' : ''));
}
function mlRender(m) {
  if (!m) return;
  $('ml-status').textContent = m.status + (m.mode ? ' (' + m.mode + ')' : '');
  $('ml-message').textContent = m.message || '';
  const errEl = $('ml-error');
  if (m.error) { errEl.textContent = m.error; errEl.classList.remove('hidden'); }
  else { errEl.textContent = ''; errEl.classList.add('hidden'); }
  const tb = $('ml-lanes-tbody');
  tb.innerHTML = '';
  (m.lanes || []).forEach(l => {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + l.symbol + '</td><td>' + l.status + '</td><td>' + (l.bankroll != null ? '$' + l.bankroll : '—') + '</td><td>' + (l.pnl != null ? '$' + l.pnl : '—') + '</td><td>' + (l.trades != null ? l.trades : '—') + '</td><td>' + (l.win_rate != null ? l.win_rate + '%' : '—') + '</td><td>' + (l.last_log_event || '—') + '</td>';
    tb.appendChild(tr);
  });
  $('ml-combined').textContent = m.combined ? ('Combined (sum of separate paper lanes — not a shared bankroll): $' + m.combined.bankroll_sum + ' from $' + m.combined.starting_bankroll_sum + ', P&L $' + m.combined.pnl_sum + ', ' + m.combined.trades_sum + ' trades across ' + m.combined.lane_count + ' lanes.') : '';
  const faPanel = $('ml-fullauto-panel');
  if (m.mode === 'fullauto' && m.fullauto) {
    faPanel.classList.remove('hidden');
    const led = m.fullauto.ledgers || {};
    const parts = [];
    Object.keys(led).forEach(k => {
      const v = led[k];
      if (v && typeof v === 'object') parts.push(k + ': $' + (v.bankroll != null ? v.bankroll : '?') + ' (' + (v.trades != null ? v.trades : '?') + ' trades, ' + (v.wins != null ? v.wins : '?') + ' wins)');
    });
    $('ml-fa-ledgers').textContent = parts.length ? parts.join(' · ') : 'No engine ledgers yet.';
    $('ml-fa-heartbeat').textContent = 'Engine polls: ' + (m.fullauto.poll_idx != null ? m.fullauto.poll_idx : '—') + ' · heartbeat age: ' + (m.fullauto.heartbeat_age_sec != null ? m.fullauto.heartbeat_age_sec + 's' : '—') + (m.fullauto.error ? ' · ERROR: ' + m.fullauto.error : '');
  } else {
    faPanel.classList.add('hidden');
  }
}
async function refreshMultilane() {
  try {
    const r = await api('/api/multilane/status');
    if (r && !r.error) mlRender(r);
  } catch (e) { /* multilane panel must never break the main refresh */ }
}
function mlSyncPickers() {
  const fa = $('ml-mode-select').value === 'fullauto';
  $('ml-confirmed-picker').classList.toggle('hidden', fa);
  $('ml-fullauto-picker').classList.toggle('hidden', !fa);
  mlBudgetLocal();
}
$('ml-mode-select').addEventListener('change', mlSyncPickers);
['ml-collectors-running', 'ml-validation-running', 'ml-collectors-paused'].forEach(id => {
  $(id).addEventListener('change', mlBudgetLocal);
});
document.querySelectorAll('.ml-market').forEach(e => e.addEventListener('change', mlBudgetLocal));
$('ml-btn-start').addEventListener('click', async () => {
  showEl('ml-error', null); $('ml-message').textContent = 'Starting…';
  const mode = $('ml-mode-select').value;
  const bankrolls = {};
  document.querySelectorAll('.ml-bankroll').forEach(el => {
    const v = parseFloat(el.value);
    if (!isNaN(v)) bankrolls[el.dataset.market] = v;
  });
  const r = await api('/api/multilane/start', 'POST', {
    mode: mode,
    markets: mode === 'confirmed' ? mlSelected() : [],
    bankrolls: bankrolls,
    collectors_running: $('ml-collectors-running').checked,
    validation_running: $('ml-validation-running').checked,
    collectors_paused_asserted: $('ml-collectors-paused').checked,
  });
  if (!r.ok) showEl('ml-error', r.error);
  else if (r.multilane) mlRender(r.multilane);
  await refreshMultilane();
});
$('ml-btn-stop').addEventListener('click', async () => {
  const r = await api('/api/multilane/stop', 'POST', {});
  if (!r.ok) showEl('ml-error', r.error);
  await refreshMultilane();
});
mlSyncPickers();
refreshMultilane();
setInterval(refreshMultilane, 5000);

refresh();
refreshKeys();
refreshFinnhub();
refreshTypesafe();
setInterval(refresh, 5000);
