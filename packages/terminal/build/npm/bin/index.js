#!/usr/bin/env node
const readline = require('readline');
const http = require('http');
const https = require('https');

const args = process.argv.slice(2);
const tokenArg = args.find(a => a.startsWith('--token='));
const apiArg = args.find(a => a.startsWith('--api='));

const token = tokenArg ? tokenArg.split('=')[1] : process.env.LOGGERHEAD_TOKEN;
const apiUrl = (apiArg ? apiArg.split('=')[1] : "http://localhost:4567").replace(/\/$/, "");

if (!token) {
  console.error("Error: Missing token. Provide --token=... or set LOGGERHEAD_TOKEN.");
  process.exit(1);
}

// Extract streamId from JWT
try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    var streamId = payload.sub;
} catch (e) {
    console.error("Invalid token format");
    process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

let batch = [];
let timer = null;

function flush() {
  if (batch.length === 0) return;
  const logs = [...batch];
  batch = [];
  if (timer) clearTimeout(timer);
  timer = null;

  const body = JSON.stringify({ streamId, logs });
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
      'Content-Length': Buffer.byteLength(body)
    }
  };

  const lib = apiUrl.startsWith('https') ? https : http;
  const req = lib.request(apiUrl + '/api/ingest', options, (res) => {
    if (res.statusCode >= 400) {
      console.error('Failed to send logs:', res.statusCode);
    }
  });
  
  req.on('error', (e) => console.error('Request error:', e));
  req.write(body);
  req.end();
}

rl.on('line', (line) => {
  console.log(line); // Pass through
  batch.push(line);
  if (batch.length >= 10) flush();
  else if (!timer) timer = setTimeout(flush, 1000);
});

rl.on('close', () => flush());
