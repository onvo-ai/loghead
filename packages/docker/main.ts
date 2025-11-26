import { parseArgs } from "@std/cli/parse-args";
import { TextLineStream } from "@std/streams";

async function main() {
    const args = parseArgs(Deno.args, {
        string: ["token", "container", "api"],
        default: {
            api: "http://localhost:4567"
        }
    });

    const token = args.token || Deno.env.get("LOGHEAD_TOKEN");
    if (!token) {
        console.error("Error: Missing token. Provide --token or set LOGHEAD_TOKEN env var.");
        Deno.exit(1);
    }

    const container = args.container;
    if (!container) {
        console.error("Error: Missing --container argument.");
        Deno.exit(1);
    }

    const apiUrl = args.api.replace(/\/$/, "");
    console.error(`[Loghead Docker] Attaching to ${container} and forwarding to ${apiUrl}...`);

    const cmd = new Deno.Command("docker", {
        args: ["logs", "-f", container],
        stdout: "piped",
        stderr: "piped"
    });

    const child = cmd.spawn();

    const processStream = async (stream: ReadableStream<Uint8Array>, source: string) => {
        const reader = stream
            .pipeThrough(new TextDecoderStream())
            .pipeThrough(new TextLineStream());

        let batch: any[] = [];
        let timer: number | null = null;

        const flush = async () => {
            if (batch.length === 0) return;
            const logsToSend = [...batch];
            batch = [];
            if (timer) clearTimeout(timer);
            timer = null;

            try {
                const parts = token.split(".");
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
            // console.log(`${source}: ${line}`); // Optional: Print to stdout?

            batch.push({
                content: line,
                metadata: { source, container }
            });

            if (batch.length >= 10) {
                await flush();
            } else if (!timer) {
                timer = setTimeout(flush, 1000);
            }
        }
        await flush();
    };

    await Promise.all([
        processStream(child.stdout, "STDOUT"),
        processStream(child.stderr, "STDERR"),
        child.status
    ]);
}

if (import.meta.main) {
    main();
}
