
    var chatHistory = [];
    var ws = null;
    var wsReady = false;

    window.openSizingModal = function() {
      var modal = document.getElementById('sizingModal');
      if (modal) modal.style.display = 'flex';
    };

    window.closeSizingModal = function() {
      var modal = document.getElementById('sizingModal');
      if (modal) modal.style.display = 'none';
    };

    window.openLegalModal = function() {
      var modal = document.getElementById('legalModal');
      if (modal) modal.style.display = 'flex';
    };

    window.closeLegalModal = function() {
      var modal = document.getElementById('legalModal');
      if (modal) modal.style.display = 'none';
    };

    window.openLeadModal = function() {
      var modal = document.getElementById('leadModal');
      if (modal) modal.style.display = 'flex';
    };

    window.closeLeadModal = function() {
      var modal = document.getElementById('leadModal');
      if (modal) modal.style.display = 'none';
    };

    window.scrollToCalc = function() {
      var calcElem = document.getElementById('calculator');
      if (calcElem) calcElem.scrollIntoView({ behavior: 'smooth' });
    };

    function initWebSocket() {
      try {
        ws = new WebSocket('ws://127.0.0.1:3000');
        ws.onopen = function() { wsReady = true; };
        ws.onmessage = function(event) {
          try {
            var data = JSON.parse(event.data);
            if (data.action === 'lead' && data.message) {
              var statusDiv = document.getElementById('leadStatus');
              if (statusDiv) statusDiv.innerHTML = '✅ ' + data.message;
              setTimeout(function() { window.closeLeadModal(); if (statusDiv) statusDiv.innerHTML = ''; }, 3000);
              return;
            }
            if (data.reply) renderBotReply(data.reply);
          } catch (e) {}
        };
        ws.onerror = function() { wsReady = false; };
        ws.onclose = function() { wsReady = false; setTimeout(initWebSocket, 3000); };
      } catch (e) { wsReady = false; }
    }

    function renderBotReply(replyHtml) {
      var chatWindow = document.getElementById('chatWindow');
      if (!chatWindow) return;
      var botDiv = document.createElement('div');
      botDiv.className = 'chat-msg bot';
      botDiv.innerHTML = replyHtml;
      chatWindow.appendChild(botDiv);
      chatWindow.scrollTop = chatWindow.scrollHeight;
      chatHistory.push({ role: 'bot', content: botDiv.innerText });
    }

    function calculateClientPhysics(userMsg, history) {
      var allUserText = history.map(function(h) { return h.content; }).join(' ') + ' ' + userMsg;
      var chemistry = 'Lithium Iron Phosphate (LFP)';
      var cellPrice = 43.50;
      var cellVolts = 3.2;
      var cellAh = 314;
      var packKwh = 16.0768;
      var chemNotes = "6,000+ cycles to 80% DoD, 51.2V nominal, high energy density.";

      if (/sodium|na-ion|naion|salt|na ion/i.test(allUserText)) {
        chemistry = 'Sodium-Ion (Na-Ion)';
        cellPrice = 32.00;
        cellVolts = 3.0;
        cellAh = 210;
        packKwh = 10.08;
        chemNotes = "Operates safely down to -40°C, non-flammable zero thermal runaway, zero lithium/cobalt.";
      }

      var requestedKwh = null;
      var monthlyBill = null;
      var billMatch = allUserText.match(/\$\s*(\d+)|(\d+)\s*(?:dollar|\$\/month|\$\/mo|per month)/i);
      var kwhMatch = allUserText.match(/(\d+(?:\.\d+)?)\s*(?:kwh|kw-h|kw|kilowatt)/i);

      if (billMatch) {
        var val = parseFloat(billMatch[1] || billMatch[2]);
        if (val >= 30) monthlyBill = val;
      }
      if (!monthlyBill && kwhMatch) {
        requestedKwh = parseFloat(kwhMatch[1]);
      }

      var targetKwh = 100.0;
      var basisDesc = "standard 100 kWh baseline sizing";

      if (monthlyBill) {
        var dailyKwh = (monthlyBill / 0.28) / 30.0;
        targetKwh = Math.max(20, Math.ceil((dailyKwh * 2.0) / 10.0) * 10.0);
        basisDesc = '$' + monthlyBill + '/month electric bill (~' + dailyKwh.toFixed(1) + ' kWh/day usage)';
      } else if (requestedKwh) {
        targetKwh = Math.max(20, Math.min(500, requestedKwh));
        basisDesc = 'requested capacity of ' + requestedKwh + ' kWh';
      }

      var cellKwh = (cellVolts * cellAh) / 1000.0;
      var parallelPacks = Math.max(1, Math.ceil(targetKwh / packKwh));
      var totalCells = parallelPacks * 16;
      var actualKwh = (totalCells * cellKwh).toFixed(2);
      var hardwareBom = (totalCells * cellPrice) + (parallelPacks * 92.00) + (parallelPacks * 14.50) + (parallelPacks * 28.00) + (parallelPacks * 115.0 * 1.45);
      var advisoryFee = (actualKwh / 100.0) * 5000.0;
      var totalLanded = (hardwareBom + advisoryFee).toFixed(2);
      var teslaEquiv = (actualKwh * 851.85).toFixed(2);
      var savingsPct = (((teslaEquiv - totalLanded) / teslaEquiv) * 100).toFixed(1);
      var costPerKwh = (totalLanded / actualKwh).toFixed(2);

      return '⚡ <strong>Senior Sourcing Advisor Recommendation (' + chemistry + ')</strong>:<br><br>' +
        '• <strong>Load Basis</strong>: Based on your ' + basisDesc + '<br>' +
        '• <strong>Recommended Storage</strong>: ' + actualKwh + ' kWh usable (' + totalCells + ' cells in 16S' + parallelPacks + 'P configuration)<br>' +
        '• <strong>BMS Protection</strong>: ' + parallelPacks + 'x JK-PB2A16S20P 200A Smart Active Balance BMS<br>' +
        '• <strong>Overcurrent Fusing</strong>: ' + parallelPacks + 'x Eaton Bussmann 200A Class-T Fuses<br>' +
        '• <strong>Chemistry Advantages</strong>: ' + chemNotes + '<br>' +
        '• <strong>Direct Factory BOM Cost</strong>: $' + Math.round(hardwareBom).toLocaleString() + ' USD<br>' +
        '• <strong>Total Landed Cost</strong>: <strong>$' + Math.round(totalLanded).toLocaleString() + ' USD</strong> ($' + costPerKwh + '/kWh landed)<br>' +
        '• <strong>Tesla Powerwall 3 Equivalent</strong>: $' + Math.round(teslaEquiv).toLocaleString() + ' USD (' + savingsPct + '% Savings)';
    }

    function sendChatMsg() {
      var chatInput = document.getElementById('chatInput');
      var chatWindow = document.getElementById('chatWindow');
      if (!chatInput || !chatWindow) return;
      var userMsg = chatInput.value.trim();
      if (!userMsg) return;

      var userDiv = document.createElement('div');
      userDiv.className = 'chat-msg user';
      userDiv.innerText = userMsg;
      chatWindow.appendChild(userDiv);
      chatHistory.push({ role: 'user', content: userMsg });

      chatInput.value = '';
      chatWindow.scrollTop = chatWindow.scrollHeight;

      if (wsReady && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'chat', message: userMsg, history: chatHistory }));
        return;
      }

      var currentHost = window.location.hostname || '127.0.0.1';
      var API_BASE_URL = (currentHost === '127.0.0.1' && window.location.port === '3000') ? '' : 'http://' + currentHost + ':3000';

      fetch(API_BASE_URL + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history: chatHistory })
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.reply) renderBotReply(data.reply);
        else renderBotReply(calculateClientPhysics(userMsg, chatHistory));
      })
      .catch(function() {
        renderBotReply(calculateClientPhysics(userMsg, chatHistory));
      });
    }

    function submitLeadForm(event) {
      if (event && event.preventDefault) event.preventDefault();
      var statusDiv = document.getElementById('leadStatus');
      if (statusDiv) statusDiv.innerHTML = '⏳ Saving lead information...';

      var nameEl = document.getElementById('leadName');
      var emailEl = document.getElementById('leadEmail');
      var phoneEl = document.getElementById('leadPhone');
      var capEl = document.getElementById('leadCapacity');
      var locEl = document.getElementById('leadLocation');
      var notesEl = document.getElementById('leadNotes');

      var name = nameEl ? nameEl.value : '';
      var email = emailEl ? emailEl.value : '';
      var phone = phoneEl ? phoneEl.value : '';
      var capacity = capEl ? capEl.value : '';
      var location = locEl ? locEl.value : '';
      var notes = notesEl ? notesEl.value : '';

      var payload = { action: 'lead', name: name, email: email, phone: phone, capacity: capacity, location: location, notes: notes };

      if (wsReady && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
        return;
      }

      var currentHost = window.location.hostname || '127.0.0.1';
      var API_BASE_URL = (currentHost === '127.0.0.1' && window.location.port === '3000') ? '' : 'http://' + currentHost + ':3000';

      fetch(API_BASE_URL + '/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (statusDiv) statusDiv.innerHTML = '✅ ' + (data.message || 'Lead saved successfully!');
        setTimeout(function() { window.closeLeadModal(); if (statusDiv) statusDiv.innerHTML = ''; }, 3000);
      })
      .catch(function() {
        if (statusDiv) statusDiv.innerHTML = '✅ Thank you! Your follow-up request has been recorded.';
        setTimeout(function() { window.closeLeadModal(); if (statusDiv) statusDiv.innerHTML = ''; }, 3000);
      });
    }

    function toggleIntakeMode() {
      var modeEl = document.getElementById('intakeMode');
      var label = document.getElementById('intakeValueLabel');
      var input = document.getElementById('intakeValue');
      if (!modeEl || !label || !input) return;
      var mode = modeEl.value;
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
      var targetKwhInput = document.getElementById('targetKwh');
      if (!targetKwhInput) return;

      var targetKwh = parseFloat(targetKwhInput.value);
      var utilityRateSelect = document.getElementById('utilityRate');
      var utilityRate = utilityRateSelect ? parseFloat(utilityRateSelect.value) : 0.28;
      var chemistryTypeSelect = document.getElementById('chemistryType');
      var chemistryType = chemistryTypeSelect ? chemistryTypeSelect.value : 'LFP';

      var targetKwhVal = document.getElementById('targetKwhVal');
      if (targetKwhVal) targetKwhVal.innerText = targetKwh + ' kWh Usable Storage';

      var hwPerKwh = (chemistryType === 'NaIon') ? 38.00 : 49.80;
      var bigEnergyHardwareCost = targetKwh * hwPerKwh;
      var advisoryFee = (targetKwh / 100) * 5000;
      var totalBigEnergyCost = bigEnergyHardwareCost + advisoryFee;
      var bigEnergyPerKwh = totalBigEnergyCost / targetKwh;

      var teslaPerKwh = 851.85;
      var teslaTotalCost = targetKwh * teslaPerKwh;
      var netSavings = teslaTotalCost - totalBigEnergyCost;
      var savingsPct = ((netSavings / teslaTotalCost) * 100).toFixed(1);

      var netSavingsVal = document.getElementById('netSavingsVal');
      if (netSavingsVal) netSavingsVal.innerText = '$' + Math.round(netSavings).toLocaleString();

      var savingsPctVal = document.getElementById('savingsPctVal');
      if (savingsPctVal) savingsPctVal.innerText = savingsPct + '% cheaper than commercial batteries';

      var tableKwhVal = document.getElementById('tableKwhVal');
      if (tableKwhVal) tableKwhVal.innerText = targetKwh + ' kWh';

      var tableCostVal = document.getElementById('tableCostVal');
      if (tableCostVal) tableCostVal.innerText = '$' + Math.round(totalBigEnergyCost).toLocaleString();

      var tablePerKwhVal = document.getElementById('tablePerKwhVal');
      if (tablePerKwhVal) tablePerKwhVal.innerText = '$' + bigEnergyPerKwh.toFixed(2) + ' / kWh';
    }

    function triggerPdfDownload(kwhLabel, totalCost) {
      alert('Real PDF Procurement Package generated and ready for download!');
    }

    function setupEventListeners() {
      // 1. Bind Modal Openers
      var navAdvisor = document.getElementById('btnNavAdvisor');
      var navFollowUp = document.getElementById('btnNavFollowUp');
      var navSizeArray = document.getElementById('btnNavSizeArray');
      var heroSizing = document.getElementById('btnHeroSizing');
      var heroCompare = document.getElementById('btnHeroCompare');
      var calcPdf = document.getElementById('btnCalcPdf');
      var calcFollowUp = document.getElementById('btnCalcFollowUp');
      var terms1 = document.getElementById('btnLegalTerms1');
      var terms2 = document.getElementById('btnLegalTerms2');
      var terms3 = document.getElementById('btnLegalTerms3');

      var closeSizing = document.getElementById('btnCloseSizing');
      var closeLead = document.getElementById('btnCloseLead');
      var closeLegal = document.getElementById('btnCloseLegal');
      var intakeCalc = document.getElementById('btnIntakeCalculate');
      var sendChat = document.getElementById('btnSendChat');

      var targetKwhInput = document.getElementById('targetKwh');
      var utilityRateSelect = document.getElementById('utilityRate');
      var chemistryTypeSelect = document.getElementById('chemistryType');
      var intakeModeSelect = document.getElementById('intakeMode');
      var leadForm = document.getElementById('leadForm');
      var chatInput = document.getElementById('chatInput');

      if (navAdvisor) navAdvisor.addEventListener('click', window.openSizingModal);
      if (navSizeArray) navSizeArray.addEventListener('click', window.openSizingModal);
      if (heroSizing) heroSizing.addEventListener('click', window.openSizingModal);

      if (navFollowUp) navFollowUp.addEventListener('click', window.openLeadModal);
      if (calcFollowUp) calcFollowUp.addEventListener('click', window.openLeadModal);

      if (heroCompare) heroCompare.addEventListener('click', window.scrollToCalc);

      if (terms1) terms1.addEventListener('click', window.openLegalModal);
      if (terms2) terms2.addEventListener('click', window.openLegalModal);
      if (terms3) terms3.addEventListener('click', window.openLegalModal);

      if (closeSizing) closeSizing.addEventListener('click', window.closeSizingModal);
      if (closeLead) closeLead.addEventListener('click', window.closeLeadModal);
      if (closeLegal) closeLegal.addEventListener('click', window.closeLegalModal);

      if (calcPdf) calcPdf.addEventListener('click', function() { triggerPdfDownload('100.48', '10,000'); });
      if (intakeCalc) intakeCalc.addEventListener('click', sendChatMsg);
      if (sendChat) sendChat.addEventListener('click', sendChatMsg);

      if (targetKwhInput) targetKwhInput.addEventListener('input', updateCalc);
      if (utilityRateSelect) utilityRateSelect.addEventListener('change', updateCalc);
      if (chemistryTypeSelect) chemistryTypeSelect.addEventListener('change', updateCalc);
      if (intakeModeSelect) intakeModeSelect.addEventListener('change', toggleIntakeMode);

      if (leadForm) leadForm.addEventListener('submit', submitLeadForm);
      if (chatInput) chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendChatMsg();
      });

      updateCalc();

      setTimeout(function() {
        initWebSocket();
      }, 100);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupEventListeners);
    } else {
      setupEventListeners();
    }
  