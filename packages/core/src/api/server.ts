import { DbService } from "../services/db.ts";
import { AuthService } from "../services/auth.ts";
import { colors } from "@cliffy/ansi/colors";

const auth = new AuthService();

export async function startApiServer(db: DbService) {
    // Find a free port starting from 4567
    let port = 4567;
    while (true) {
        try {
            const listener = Deno.listen({ port });
            listener.close();
            break;
        } catch (e) {
            if (e instanceof Deno.errors.AddrInUse) {
                port++;
            } else {
                throw e;
            }
        }
    }

    const baseUrl = `http://localhost:${port}`;

    console.log(colors.bold.green(`✔ Loghead Core API Server running on ${baseUrl}`));

    await auth.initialize();

    const httpServer = Deno.serve({
        port,
        onListen: () => { } // Silence default listening log
    }, async (req) => {
        // CORS & Private Network Access (PNA) Handling
        const origin = req.headers.get("Origin") || "*";
        const corsHeaders = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Private-Network": "true",
            "Vary": "Origin",
        };

        if (req.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        const url = new URL(req.url);

        if (url.pathname === "/api/ingest") {
            return await handleIngest(req, db, corsHeaders);
        }

        if (url.pathname === "/api/projects" && (req.method === "POST" || req.method === "GET")) {
            const projects = db.listProjects();
            return new Response(JSON.stringify(projects), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

        if (url.pathname === "/api/streams") {
            let projectId: string | null = null;

            if (req.method === "GET") {
                projectId = url.searchParams.get("projectId");
            } else if (req.method === "POST") {
                const body = await req.json();
                projectId = body.projectId;
            }

            if (projectId) {
                const streams = db.listStreams(projectId);
                return new Response(JSON.stringify(streams), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
        }

        if (url.pathname === "/api/streams/create" && req.method === "POST") {
            const body = await req.json();
            const stream = await db.createStream(body.projectId, body.type, body.name, {});
            return new Response(JSON.stringify(stream), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

        if (url.pathname === "/api/logs" && req.method === "GET") {
            const streamId = url.searchParams.get("streamId");
            if (!streamId) {
                return new Response("Missing streamId", { status: 400, headers: corsHeaders });
            }
            const limit = parseInt(url.searchParams.get("limit") || "50");
            const query = url.searchParams.get("q");

            let logs;
            if (query) {
                logs = await db.searchLogs(streamId, query, limit);
            } else {
                logs = db.getRecentLogs(streamId, limit);
            }
            return new Response(JSON.stringify(logs), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

        return new Response("Not Found", { status: 404, headers: corsHeaders });
    });

    await httpServer.finished;
}

async function handleIngest(req: Request, db: DbService, corsHeaders: HeadersInit): Promise<Response> {
    try {
        if (req.method !== "POST") {
            return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
        }

        // Auth Check
        const authHeader = req.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return new Response("Unauthorized: Missing token", { status: 401, headers: corsHeaders });
        }
        const token = authHeader.split(" ")[1];
        const payload = await auth.verifyToken(token);
        if (!payload || !payload.streamId) {
            return new Response("Unauthorized: Invalid token", { status: 401, headers: corsHeaders });
        }

        const body = await req.json();
        const { streamId, logs } = body;

        // Verify streamId matches token
        if (streamId !== payload.streamId) {
            return new Response("Forbidden: Token does not match streamId", { status: 403, headers: corsHeaders });
        }

        if (!logs) {
            return new Response("Missing logs", { status: 400, headers: corsHeaders });
        }

        const logEntries = Array.isArray(logs) ? logs : [logs];

        for (const log of logEntries) {
            let content = "";
            let metadata = {};

            if (typeof log === "string") {
                content = log;
            } else if (typeof log === "object") {
                content = log.content || JSON.stringify(log);
                metadata = log.metadata || {};
            }

            if (content) {
                await db.addLog(streamId, content, metadata);
            }
        }

        return new Response(JSON.stringify({ success: true, count: logEntries.length }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
        });
    } catch (e) {
        console.error("Ingest error:", e);
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
}
