const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {gateway, headers, guests} = require('../tests/helpers/rsvp-gateway.cjs');
const root = path.resolve(__dirname, '..');
const previewGuests = [headers, ...guests,
  ['fam123', 20, 'Estella', 'Family', '', 'Taylor Koh', 'Yes', '', 'No', '', '', ''],
  ['fam123', 20, 'Estella', 'Family', '', 'Robin Tan', 'Yes', '', 'No', '', '', ''],
  ['', 30, 'Gabriel', 'Friends', '', 'Morgan Lee', 'Yes', '', 'No', '', '', '']];
const mock = gateway({guestRows: previewGuests});
mock.submit(mock.payload(mock.code(30)));
const types = {'.png': 'image/png', '.webp': 'image/webp', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml'};
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const security = {'Cache-Control': 'no-store', 'Content-Security-Policy': "connect-src 'self'; form-action 'none'"};
  const send = (status, type, body) => { response.writeHead(status, {...security, 'Content-Type': type}); response.end(body); };
  if (url.pathname === '/__qa-rsvp' && request.method === 'POST') {
    let body = '';
    request.on('data', chunk => { body += chunk; if (body.length > 100000) request.destroy(); });
    request.on('end', () => {
      try { send(200, 'application/json', JSON.stringify(mock.api(JSON.parse(body)))); }
      catch { send(400, 'application/json', JSON.stringify({ok: false, error: 'Invalid preview request'})); }
    }); return;
  }
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
      .replace(/const RSVP_ENDPOINT = '[^']+';/, "const RSVP_ENDPOINT = '/__qa-rsvp';");
    if (source.includes('script.google.com')) return send(500, 'text/plain', 'Preview isolation failed.');
    return send(200, 'text/html; charset=utf-8', source);
  }
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(path.join(root, 'assets') + path.sep) || !types[path.extname(file)] || !fs.existsSync(file) || !fs.realpathSync(file).startsWith(path.join(root, 'assets') + path.sep)) return send(404, 'text/plain', 'Not found');
  send(200, types[path.extname(file)], fs.readFileSync(file));
});
let port = 4173;
server.on('error', error => {
  if (error.code === 'EADDRINUSE' && port < 4180) server.listen(++port, '127.0.0.1');
  else { console.error(error.message); process.exitCode = 1; }
});
server.on('listening', () => console.log(`FICTIONAL DATA ONLY:\nhttp://127.0.0.1:${port}/?inv=${mock.code(10)}#rsvp (two friends)\nhttp://127.0.0.1:${port}/?inv=${mock.code(20)}#rsvp (three family members)\nhttp://127.0.0.1:${port}/?inv=${mock.code(30)}#rsvp (one saved reply)\nNothing is sent to Google.`));
server.listen(port, '127.0.0.1');
