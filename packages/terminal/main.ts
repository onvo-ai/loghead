import { parseArgs } from "@std/cli/parse-args";
import { TextLineStream } from "@std/streams";

async function main() {
    const args = parseArgs(Deno.args, {
        string: ["token", "api"],
        default: {
            api: "http://localhost:4567"
        }
    });

    const token = args.token || Deno.env.get("LOGHEAD_TOKEN");
    if (!token) {
        console.error("Error: Missing token. Provide --token or set LOGHEAD_TOKEN env var.");
        Deno.exit(1);
    }

    const apiUrl = args.api.replace(/\/$/, "");
    console.error(`[Loghead Terminal] Forwarding stdin to ${apiUrl}...`);

    const reader = Deno.stdin.readable
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new TextLineStream());

    // Buffer logs to send in batches
    let batch: string[] = [];
    let timer: number | null = null;

    const flush = async () => {
        if (batch.length === 0) return;
        const logsToSend = [...batch];
        batch = [];
        if (timer) clearTimeout(timer);
        timer = null;

        try {
            // Parse token to get streamId if possible, otherwise we rely on the server validating the token
            // Actually the API requires 'streamId' in the body. 
            // But since we have a token, we can extract the streamId (sub) from it if it's a JWT?
            // OR we pass the token and let the server figure it out? 
            // Current API: POST /api/ingest { streamId, logs }
            // And requires Auth header.
            // We need to extract streamId from the JWT payload.

            const parts = token.split(".");
            if (parts.length !== 3) throw new Error("Invalid JWT token format");
            const payload = JSON.parse(atob(parts[1]));
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

    for await (const line of reader) {
        if (!line.trim()) continue;

        // Print to stdout so it acts like a transparent pipe
        console.log(line);

        batch.push(line);
        if (batch.length >= 10) {
            await flush();
        } else if (!timer) {
            timer = setTimeout(flush, 1000);
        }
    }

    await flush();
}

if (import.meta.main) {
    main();
}
