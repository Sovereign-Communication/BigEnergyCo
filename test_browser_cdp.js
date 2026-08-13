const http = require('http');
const WebSocket = require('ws');

async function runTest() {
  http.get('http://127.0.0.1:9222/json', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', async () => {
      const targets = JSON.parse(data);
      console.log('Targets:', targets);
      const page = targets.find(t => t.type === 'page');
      if (!page) {
        console.error('No page target found');
        return;
      }
      
      const wsUrl = page.webSocketDebuggerUrl;
      console.log('Connecting CDP WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      let id = 1;

      function send(method, params = {}) {
        const msg = { id: id++, method, params };
        ws.send(JSON.stringify(msg));
        return msg.id;
      }

      ws.on('open', () => {
        console.log('CDP WebSocket connected!');
        send('Runtime.enable');
        send('Console.enable');
        
        // Evaluate button clicks in browser context
        setTimeout(() => {
          console.log('Testing openSizingModal()...');
          send('Runtime.evaluate', { expression: 'openSizingModal(); document.getElementById("sizingModal").style.display' });
        }, 1000);

        setTimeout(() => {
          console.log('Testing openLeadModal()...');
          send('Runtime.evaluate', { expression: 'openLeadModal(); document.getElementById("leadModal").style.display' });
        }, 2000);

        setTimeout(() => {
          process.exit(0);
        }, 3500);
      });

      ws.on('message', (msgStr) => {
        const msg = JSON.parse(msgStr);
        if (msg.method === 'Console.messageAdded' || msg.method === 'Runtime.consoleAPICalled') {
          console.log('[BROWSER CONSOLE]', msg.params);
        } else if (msg.result) {
          console.log('[CDP EVAL RESULT]', JSON.stringify(msg.result));
        }
      });
    });
  });
}

runTest();
