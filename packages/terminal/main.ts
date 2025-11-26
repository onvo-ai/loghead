#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import readline from "readline";

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option("token", { type: "string", description: "Stream token" })
        .option("api", { type: "string", default: "http://localhost:4567", description: "API URL" })
        .help()
        .parse();

    const token = argv.token || process.env.LOGHEAD_TOKEN;
    if (!token) {
        console.error("Error: Missing token. Provide --token or set LOGHEAD_TOKEN env var.");
        process.exit(1);
    }

    const apiUrl = (argv.api as string).replace(/\/$/, "");
    console.error(`[Loghead Terminal] Forwarding stdin to ${apiUrl}...`);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });

    // Buffer logs to send in batches
    let batch: string[] = [];
    let timer: NodeJS.Timeout | null = null;

    const flush = async () => {
        if (batch.length === 0) return;
        const logsToSend = [...batch];
        batch = [];
        if (timer) clearTimeout(timer);
        timer = null;

        try {
            const parts = token.split(".");
            if (parts.length !== 3) throw new Error("Invalid JWT token format");
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
        } catch (e) {
            console.error(`[Loghead] Error sending logs:`, e);
        }
    };

    rl.on('line', (line) => {
        if (!line.trim()) return;

        console.log(line); // Pass through

        batch.push(line);
        if (batch.length >= 10) {
            flush(); // Async but we don't await in event loop
        } else if (!timer) {
            timer = setTimeout(flush, 1000);
        }
    });

    rl.on('close', () => {
        flush();
    });
}

main();
