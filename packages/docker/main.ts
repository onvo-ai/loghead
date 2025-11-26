#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { spawn } from "child_process";
import readline from "readline";
import { Readable } from "stream";

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option("token", { type: "string", description: "Stream token" })
        .option("container", { type: "string", description: "Container ID/Name" })
        .option("api", { type: "string", default: "http://localhost:4567", description: "API URL" })
        .help()
        .parse();

    const token = argv.token || process.env.LOGHEAD_TOKEN;
    if (!token) {
        console.error("Error: Missing token. Provide --token or set LOGHEAD_TOKEN env var.");
        process.exit(1);
    }

    const container = argv.container;
    if (!container) {
        console.error("Error: Missing --container argument.");
        process.exit(1);
    }

    const apiUrl = (argv.api as string).replace(/\/$/, "");
    console.error(`[Loghead Docker] Attaching to ${container} and forwarding to ${apiUrl}...`);

    const child = spawn("docker", ["logs", "-f", container]);

    const processStream = async (stream: Readable, source: string) => {
        const rl = readline.createInterface({
            input: stream,
            terminal: false
        });

        let batch: any[] = [];
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

            batch.push({
                content: line,
                metadata: { source, container }
            });

            if (batch.length >= 10) {
                flush();
            } else if (!timer) {
                timer = setTimeout(flush, 1000);
            }
        });

        // Handle close if needed, though child.on('close') covers main exit
    };

    processStream(child.stdout, "STDOUT");
    processStream(child.stderr, "STDERR");

    child.on('close', (code) => {
        console.log(`Docker process exited with code ${code}`);
        process.exit(code || 0);
    });
}

main();
