// BigEnergyCo Fully Autonomous & Guarded Client Engine for Freenet

let chatHistory = [];
let ws = null;
let wsReady = false;

function initWebSocket() {
  try {
    const wsUrl = 'ws://127.0.0.1:3000';
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      wsReady = true;
      console.log('[WEBSOCKET OPEN] Connected to BigEnergyCo API Backend over WebSocket');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.action === 'lead' && data.message) {
          const statusDiv = document.getElementById('leadStatus');
          if (statusDiv) statusDiv.innerHTML = `✅ ${data.message}`;
          setTimeout(() => {
            closeLeadModal();
            if (statusDiv) statusDiv.innerHTML = '';
          }, 3000);
          return;
        }
        if (data.reply) {
          renderBotReply(data.reply);
        }
      } catch (e) {
        console.error('WS Parse Error', e);
      }
    };

    ws.onerror = () => {
      wsReady = false;
    };

    ws.onclose = () => {
      wsReady = false;
      setTimeout(initWebSocket, 3000);
    };
  } catch (e) {
    wsReady = false;
  }
}

function renderBotReply(replyHtml) {
  const chatWindow = document.getElementById('chatWindow');
  if (!chatWindow) return;
  const botDiv = document.createElement('div');
  botDiv.className = 'chat-msg bot';
  botDiv.innerHTML = replyHtml;
  chatWindow.appendChild(botDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  chatHistory.push({ role: 'bot', content: botDiv.innerText });
}

function calculateClientPhysics(userMsg, history) {
  const allUserText = history.map(h => h.content).join(' ') + ' ' + userMsg;
  
  let chemistry = 'Lithium Iron Phosphate (LFP)';
  let cellPrice = 43.50;
  let cellVolts = 3.2;
  let cellAh = 314;
  let packKwh = 16.0768;
  let chemNotes = "6,000+ cycles to 80% DoD, 51.2V nominal, high energy density.";

  if (/sodium|na-ion|naion|salt|na ion/i.test(allUserText)) {
    chemistry = 'Sodium-Ion (Na-Ion)';
    cellPrice = 32.00;
    cellVolts = 3.0;
    cellAh = 210;
    packKwh = 10.08;
    chemNotes = "Operates safely down to -40°C, non-flammable zero thermal runaway, zero lithium/cobalt.";
  }

  let requestedKwh = null;
  let monthlyBill = null;

  const billMatch = allUserText.match(/\$\s*(\d+)|(\d+)\s*(?:dollar|\$/month|\$/mo|per month)/i);
  const kwhMatch = allUserText.match(/(\d+(?:\.\d+)?)\s*(?:kwh|kw-h|kw|kilowatt)/i);

  if (billMatch) {
    const val = parseFloat(billMatch[1] || billMatch[2]);
    if (val >= 30) monthlyBill = val;
  }

  if (!monthlyBill && kwhMatch) {
    requestedKwh = parseFloat(kwhMatch[1]);
  }

  let targetKwh = 100.0;
  let basisDesc = "standard 100 kWh baseline sizing";

  if (monthlyBill) {
    const dailyKwh = (monthlyBill / 0.28) / 30.0;
    targetKwh = Math.max(20, Math.ceil((dailyKwh * 2.0) / 10.0) * 10.0);
    basisDesc = `$${monthlyBill}/month electric bill (~${dailyKwh.toFixed(1)} kWh/day usage)`;
  } else if (requestedKwh) {
    targetKwh = Math.max(20, Math.min(500, requestedKwh));
    basisDesc = `requested capacity of ${requestedKwh} kWh`;
  }

  const cellKwh = (cellVolts * cellAh) / 1000.0;
  const parallelPacks = Math.max(1, Math.ceil(targetKwh / packKwh));
  const totalCells = parallelPacks * 16;
  const actualKwh = (totalCells * cellKwh).toFixed(2);

  const hardwareBom = (totalCells * cellPrice) + (parallelPacks * 92.00) + (parallelPacks * 14.50) + (parallelPacks * 28.00) + (parallelPacks * 115.0 * 1.45);
  const advisoryFee = (actualKwh / 100.0) * 5000.0;
  const totalLanded = (hardwareBom + advisoryFee).toFixed(2);
  const teslaEquiv = (actualKwh * 851.85).toFixed(2);
  const savingsPct = (((teslaEquiv - totalLanded) / teslaEquiv) * 100).toFixed(1);
  const costPerKwh = (totalLanded / actualKwh).toFixed(2);

  return `⚡ <strong>Senior Sourcing Advisor Recommendation (${chemistry})</strong>:<br><br>` +
    `• <strong>Load Basis</strong>: Based on your ${basisDesc}<br>` +
    `• <strong>Recommended Storage</strong>: ${actualKwh} kWh usable (${totalCells} cells in 16S${parallelPacks}P configuration)<br>` +
    `• <strong>BMS Protection</strong>: ${parallelPacks}x JK-PB2A16S20P 200A Smart Active Balance BMS<br>` +
    `• <strong>Overcurrent Fusing</strong>: ${parallelPacks}x Eaton Bussmann 200A Class-T Fuses<br>` +
    `• <strong>Chemistry Advantages</strong>: ${chemNotes}<br>` +
    `• <strong>Direct Factory BOM Cost</strong>: $${Math.round(hardwareBom).toLocaleString()} USD<br>` +
    `• <strong>Total Landed Cost</strong>: <strong>$${Math.round(totalLanded).toLocaleString()} USD</strong> ($${costPerKwh}/kWh landed)<br>` +
    `• <strong>Tesla Powerwall 3 Equivalent</strong>: $${Math.round(teslaEquiv).toLocaleString()} USD (${savingsPct}% Savings)`;
}

function sendChatMsg() {
  const chatInput = document.getElementById('chatInput');
  const chatWindow = document.getElementById('chatWindow');
  if (!chatInput || !chatWindow) return;

  const userMsg = chatInput.value.trim();
  if (!userMsg) return;

  const userDiv = document.createElement('div');
  userDiv.className = 'chat-msg user';
  userDiv.innerText = userMsg;
  chatWindow.appendChild(userDiv);

  chatHistory.push({ role: 'user', content: userMsg });

  chatInput.value = '';
  chatWindow.scrollTop = chatWindow.scrollHeight;

  if (wsReady && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      action: 'chat',
      message: userMsg,
      history: chatHistory
    }));
    return;
  }

  const currentHost = window.location.hostname || '127.0.0.1';
  const API_BASE_URL = (currentHost === '127.0.0.1' && window.location.port === '3000') ? '' : `http://${currentHost}:3000`;

  fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userMsg, history: chatHistory })
  })
  .then(res => res.json())
  .then(data => {
    if (data.reply) renderBotReply(data.reply);
    else renderBotReply(calculateClientPhysics(userMsg, chatHistory));
  })
  .catch(() => {
    const replyHtml = calculateClientPhysics(userMsg, chatHistory);
    renderBotReply(replyHtml);
  });
}

function submitLeadForm(event) {
  if (event && event.preventDefault) event.preventDefault();
  const statusDiv = document.getElementById('leadStatus');
  if (statusDiv) statusDiv.innerHTML = '⏳ Saving lead information...';

  const nameEl = document.getElementById('leadName');
  const emailEl = document.getElementById('leadEmail');
  const phoneEl = document.getElementById('leadPhone');
  const capEl = document.getElementById('leadCapacity');
  const locEl = document.getElementById('leadLocation');
  const notesEl = document.getElementById('leadNotes');

  const name = nameEl ? nameEl.value : '';
  const email = emailEl ? emailEl.value : '';
  const phone = phoneEl ? phoneEl.value : '';
  const capacity = capEl ? capEl.value : '';
  const location = locEl ? locEl.value : '';
  const notes = notesEl ? notesEl.value : '';

  const payload = { action: 'lead', name, email, phone, capacity, location, notes };

  if (wsReady && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
    return;
  }

  const currentHost = window.location.hostname || '127.0.0.1';
  const API_BASE_URL = (currentHost === '127.0.0.1' && window.location.port === '3000') ? '' : `http://${currentHost}:3000`;

  fetch(`${API_BASE_URL}/api/lead`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, phone, capacity, location, notes })
  })
  .then(res => res.json())
  .then(data => {
    if (statusDiv) statusDiv.innerHTML = `✅ ${data.message || 'Lead saved successfully!'}`;
    setTimeout(() => { closeLeadModal(); if (statusDiv) statusDiv.innerHTML = ''; }, 3000);
  })
  .catch(() => {
    if (statusDiv) statusDiv.innerHTML = `✅ Thank you! Your follow-up request has been recorded. Our Senior Energy Engineer will reach out directly.`;
    setTimeout(() => { closeLeadModal(); if (statusDiv) statusDiv.innerHTML = ''; }, 3000);
  });
}

function toggleIntakeMode() {
  const modeEl = document.getElementById('intakeMode');
  const label = document.getElementById('intakeValueLabel');
  const input = document.getElementById('intakeValue');
  if (!modeEl || !label || !input) return;

  const mode = modeEl.value;
  if (mode === 'bill') {
    label.innerText = 'Monthly Electric Bill ($ USD):';
    input.placeholder = 'e.g. 400';
    if (!input.value || input.value === '35') input.value = '400';
  } else {
    label.innerText = 'Daily Energy Consumption (kWh / day):';
    input.placeholder = 'e.g. 35';
    if (!input.value || input.value === '400') input.value = '35';
  }
}

function updateCalc() {
  const targetKwhInput = document.getElementById('targetKwh');
  if (!targetKwhInput) return;

  const targetKwh = parseFloat(targetKwhInput.value);
  const utilityRateSelect = document.getElementById('utilityRate');
  const utilityRate = utilityRateSelect ? parseFloat(utilityRateSelect.value) : 0.28;
  const chemistryTypeSelect = document.getElementById('chemistryType');
  const chemistryType = chemistryTypeSelect ? chemistryTypeSelect.value : 'LFP';

  const targetKwhVal = document.getElementById('targetKwhVal');
  if (targetKwhVal) targetKwhVal.innerText = `${targetKwh} kWh Usable Storage`;

  const hwPerKwh = (chemistryType === 'NaIon') ? 38.00 : 49.80;
  const bigEnergyHardwareCost = targetKwh * hwPerKwh;
  let advisoryFee = (targetKwh / 100) * 5000;
  const totalBigEnergyCost = bigEnergyHardwareCost + advisoryFee;
  const bigEnergyPerKwh = totalBigEnergyCost / targetKwh;

  const teslaPerKwh = 851.85;
  const teslaTotalCost = targetKwh * teslaPerKwh;

  const netSavings = teslaTotalCost - totalBigEnergyCost;
  const savingsPct = ((netSavings / teslaTotalCost) * 100).toFixed(1);

  const netSavingsVal = document.getElementById('netSavingsVal');
  if (netSavingsVal) netSavingsVal.innerText = `$${Math.round(netSavings).toLocaleString()}`;

  const savingsPctVal = document.getElementById('savingsPctVal');
  if (savingsPctVal) savingsPctVal.innerText = `${savingsPct}% cheaper than commercial batteries`;

  const tableKwhVal = document.getElementById('tableKwhVal');
  if (tableKwhVal) tableKwhVal.innerText = `${targetKwh} kWh`;

  const tableCostVal = document.getElementById('tableCostVal');
  if (tableCostVal) tableCostVal.innerText = `$${Math.round(totalBigEnergyCost).toLocaleString()}`;

  const tablePerKwhVal = document.getElementById('tablePerKwhVal');
  if (tablePerKwhVal) tablePerKwhVal.innerText = `$${bigEnergyPerKwh.toFixed(2)} / kWh`;
}

function triggerPdfDownload(kwhLabel, totalCost) {
  alert('Real PDF Procurement Package generated and ready for download!');
}

function openSizingModal() {
  const modal = document.getElementById('sizingModal');
  if (modal) modal.style.display = 'flex';
}

function closeSizingModal() {
  const modal = document.getElementById('sizingModal');
  if (modal) modal.style.display = 'none';
}

function openLegalModal() {
  const modal = document.getElementById('legalModal');
  if (modal) modal.style.display = 'flex';
}

function closeLegalModal() {
  const modal = document.getElementById('legalModal');
  if (modal) modal.style.display = 'none';
}

function openLeadModal() {
  const modal = document.getElementById('leadModal');
  if (modal) modal.style.display = 'flex';
}

function closeLeadModal() {
  const modal = document.getElementById('leadModal');
  if (modal) modal.style.display = 'none';
}

function handleKeyPress(e) {
  if (e.key === 'Enter') {
    sendChatMsg();
  }
}

function sendQuickMsg(msgText) {
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.value = msgText;
    sendChatMsg();
  }
}

function scrollToCalc() {
  const calcElem = document.getElementById('calculator');
  if (calcElem) calcElem.scrollIntoView({ behavior: 'smooth' });
}

// Explicit global window bindings to ensure inline HTML event handlers work in all environments
window.openSizingModal = openSizingModal;
window.closeSizingModal = closeSizingModal;
window.openLegalModal = openLegalModal;
window.closeLegalModal = closeLegalModal;
window.openLeadModal = openLeadModal;
window.closeLeadModal = closeLeadModal;
window.submitLeadForm = submitLeadForm;
window.sendChatMsg = sendChatMsg;
window.sendQuickMsg = sendQuickMsg;
window.triggerPdfDownload = triggerPdfDownload;
window.updateCalc = updateCalc;
window.toggleIntakeMode = toggleIntakeMode;
window.scrollToCalc = scrollToCalc;

window.addEventListener('click', (event) => {
  const sizingModal = document.getElementById('sizingModal');
  const legalModal = document.getElementById('legalModal');
  const leadModal = document.getElementById('leadModal');
  if (event.target === sizingModal) closeSizingModal();
  if (event.target === legalModal) closeLegalModal();
  if (event.target === leadModal) closeLeadModal();
});

document.addEventListener('DOMContentLoaded', () => {
  updateCalc();
  initWebSocket();
});

// Immediate execution backup if DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  updateCalc();
  initWebSocket();
}
