#!/usr/bin/env node
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');
const readline = require('readline');

const args = process.argv.slice(2);
const tokenArg = args.find(a => a.startsWith('--token='));
const apiArg = args.find(a => a.startsWith('--api='));
const containerArg = args.find(a => a.startsWith('--container='));

const token = tokenArg ? tokenArg.split('=')[1] : process.env.LOGGERHEAD_TOKEN;
const apiUrl = (apiArg ? apiArg.split('=')[1] : "http://localhost:4567").replace(/\/$/, "");
const container = containerArg ? containerArg.split('=')[1] : null;

if (!token) {
  console.error("Error: Missing token. Provide --token=... or set LOGGERHEAD_TOKEN.");
  process.exit(1);
}
if (!container) {
    console.error("Error: Missing container. Provide --container=...");
    process.exit(1);
}

// Extract streamId
try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    var streamId = payload.sub;
} catch (e) {
    console.error("Invalid token format");
    process.exit(1);
}

console.log("Attaching to docker container: " + container);

const docker = spawn('docker', ['logs', '-f', container]);

function processStream(stream, source) {
    const rl = readline.createInterface({ input: stream });
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
            if (res.statusCode >= 400) console.error('Failed to send logs:', res.statusCode);
        });
        req.on('error', (e) => console.error('Request error:', e));
        req.write(body);
        req.end();
    }

    rl.on('line', (line) => {
        // console.log(source + ": " + line);
        batch.push({ content: line, metadata: { source, container } });
        if (batch.length >= 10) flush();
        else if (!timer) timer = setTimeout(flush, 1000);
    });
}

processStream(docker.stdout, 'STDOUT');
processStream(docker.stderr, 'STDERR');

docker.on('close', (code) => {
    console.log('Docker process exited with code ' + code);
});
