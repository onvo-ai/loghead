import { ensureDir } from "jsr:@std/fs";

async function buildTerminalIngestor() {
  const name = "@loghead/terminal";
  const npmDir = `./packages/terminal/build/npm`;

  console.log(`Building NPM package for ${name}...`);

  try { await Deno.remove(npmDir, { recursive: true }); } catch { /* ignore */ }
  await ensureDir(`${npmDir}/bin`);

  const packageJson = {
    name: "@loghead/terminal",
    version: "0.1.0",
    description: "Terminal log ingestor for Loghead",
    bin: { "loghead-terminal": "./bin/index.js" },
    scripts: { "start": "node bin/index.js" },
    author: "Onvo AI",
    license: "MIT",
    publishConfig: { "access": "public" }
  };
  await Deno.writeTextFile(`${npmDir}/package.json`, JSON.stringify(packageJson, null, 2));

  const indexJs = `#!/usr/bin/env node
const readline = require('readline');
const http = require('http');
const https = require('https');

const args = process.argv.slice(2);
const tokenArg = args.find(a => a.startsWith('--token='));
const apiArg = args.find(a => a.startsWith('--api='));

const token = tokenArg ? tokenArg.split('=')[1] : process.env.LOGHEAD_TOKEN;
const apiUrl = (apiArg ? apiArg.split('=')[1] : "http://localhost:4567").replace(/\\/$/, "");

if (!token) {
  console.error("Error: Missing token. Provide --token=... or set LOGHEAD_TOKEN.");
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
`;

  await Deno.writeTextFile(`${npmDir}/bin/index.js`, indexJs);
  await Deno.chmod(`${npmDir}/bin/index.js`, 0o755);

  console.log(`${name} prepared in ${npmDir}`);
}

async function buildDockerIngestor() {
  const name = "@loghead/docker";
  const npmDir = `./packages/docker/build/npm`;

  console.log(`Building NPM package for ${name}...`);

  try { await Deno.remove(npmDir, { recursive: true }); } catch { /* ignore */ }
  await ensureDir(`${npmDir}/bin`);

  const packageJson = {
    name: "@loghead/docker",
    version: "0.1.0",
    description: "Docker log ingestor for Loghead",
    bin: { "loghead-docker": "./bin/index.js" },
    dependencies: { "child_process": "*" }, // Built-in
    author: "Onvo AI",
    license: "MIT",
    publishConfig: { "access": "public" }
  };
  await Deno.writeTextFile(`${npmDir}/package.json`, JSON.stringify(packageJson, null, 2));

  const indexJs = `#!/usr/bin/env node
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');
const readline = require('readline');

const args = process.argv.slice(2);
const tokenArg = args.find(a => a.startsWith('--token='));
const apiArg = args.find(a => a.startsWith('--api='));
const containerArg = args.find(a => a.startsWith('--container='));

const token = tokenArg ? tokenArg.split('=')[1] : process.env.LOGHEAD_TOKEN;
const apiUrl = (apiArg ? apiArg.split('=')[1] : "http://localhost:4567").replace(/\\/$/, "");
const container = containerArg ? containerArg.split('=')[1] : null;

if (!token) {
  console.error("Error: Missing token. Provide --token=... or set LOGHEAD_TOKEN.");
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
`;

  await Deno.writeTextFile(`${npmDir}/bin/index.js`, indexJs);
  await Deno.chmod(`${npmDir}/bin/index.js`, 0o755);

  console.log(`${name} prepared in ${npmDir}`);
}

await buildTerminalIngestor();
await buildDockerIngestor();
