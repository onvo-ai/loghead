#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const readline_1 = __importDefault(require("readline"));
async function main() {
    const argv = await (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
        .option("token", { type: "string", description: "Stream token" })
        .option("api", { type: "string", default: "http://localhost:4567", description: "API URL" })
        .help()
        .parse();
    const token = argv.token || process.env.LOGHEAD_TOKEN;
    if (!token) {
        console.error("Error: Missing token. Provide --token or set LOGHEAD_TOKEN env var.");
        process.exit(1);
    }
    const apiUrl = argv.api.replace(/\/$/, "");
    console.error(`[Loghead Terminal] Forwarding stdin to ${apiUrl}...`);
    const rl = readline_1.default.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });
    // Buffer logs to send in batches
    let batch = [];
    let timer = null;
    const flush = async () => {
        if (batch.length === 0)
            return;
        const logsToSend = [...batch];
        batch = [];
        if (timer)
            clearTimeout(timer);
        timer = null;
        try {
            const parts = token.split(".");
            if (parts.length !== 3)
                throw new Error("Invalid JWT token format");
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            const streamId = payload.sub;
            const res = await fetch(`${apiUrl}/api/ingest`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    streamId,
                    logs: logsToSend
                })
            });
            if (!res.ok) {
                console.error(`[Loghead] Failed to send logs: ${res.status} ${await res.text()}`);
            }
        }
        catch (e) {
            console.error(`[Loghead] Error sending logs:`, e);
        }
    };
    rl.on('line', (line) => {
        if (!line.trim())
            return;
        console.log(line); // Pass through
        batch.push(line);
        if (batch.length >= 10) {
            flush(); // Async but we don't await in event loop
        }
        else if (!timer) {
            timer = setTimeout(flush, 1000);
        }
    });
    rl.on('close', () => {
        flush();
    });
}
main();
