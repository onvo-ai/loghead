import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
    ErrorCode,
    McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { DbService } from "../services/db.ts";
import { colors } from "@cliffy/ansi/colors";
import { Project } from "../types.ts";

class DenoSseTransport implements Transport {
    private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
    public sessionId: string;
    public onclose?: () => void;
    public onerror?: (error: Error) => void;
    public onmessage?: (message: JSONRPCMessage) => void;

    constructor(sessionId: string, controller: ReadableStreamDefaultController<Uint8Array>) {
        this.sessionId = sessionId;
        this.controller = controller;
    }

    start(): Promise<void> {
        // No-op, stream is already open
        return Promise.resolve();
    }

    send(message: JSONRPCMessage): Promise<void> {
        if (!this.controller) return Promise.resolve();
        const event = `event: message\ndata: ${JSON.stringify(message)}\n\n`;
        this.controller.enqueue(new TextEncoder().encode(event));
        return Promise.resolve();
    }

    close(): Promise<void> {
        if (this.controller) {
            try {
                this.controller.close();
            } catch { /* ignore if already closed */ }
            this.controller = null;
        }
        this.onclose?.();
        return Promise.resolve();
    }

    handlePostMessage(message: JSONRPCMessage) {
        this.onmessage?.(message);
    }
}

export function createServer(db: DbService) {
    const server = new Server(
        { name: "loggerhead", version: "0.1.0" },
        { capabilities: { resources: {}, tools: {} } }
    );

    // List Resources (Projects and Streams)
    server.setRequestHandler(ListResourcesRequestSchema, () => {
        const projects = db.listProjects();
        return Promise.resolve({
            resources: projects.map((p: Project) => ({
                uri: `loggerhead://project/${p.id}`,
                name: p.name,
                mimeType: "application/json",
                description: `Project: ${p.name}`,
            })),
        });
    });

    // Read Resource (Get Project details or Stream details)
    server.setRequestHandler(ReadResourceRequestSchema, (request: { params: { uri: string; }; }) => {
        const uri = request.params.uri;
        const id = new URL(uri).pathname.split("/")[1];

        if (uri.startsWith("loggerhead://project/")) {
            const streams = db.listStreams(id);
            return Promise.resolve({
                contents: [
                    {
                        uri: uri,
                        mimeType: "application/json",
                        text: JSON.stringify(streams, null, 2),
                    },
                ],
            });
        }

        throw new McpError(ErrorCode.InvalidRequest, "Unknown resource");
    });

    // List Tools
    server.setRequestHandler(ListToolsRequestSchema, () => {
        return Promise.resolve({
            tools: [
                {
                    name: "list_projects",
                    description: "Lists all the projects and their streams",
                    inputSchema: { type: "object", properties: {} },
                },
                {
                    name: "query_logs",
                    description: "Search or retrieve logs",
                    inputSchema: {
                        type: "object",
                        properties: {
                            streamId: { type: "string" },
                            query: { type: "string" },
                            limit: { type: "number" },
                            mode: { type: "string", enum: ["recent", "search"] },
                        },
                        required: ["streamId"],
                    },
                },
                {
                    name: "create_project",
                    description: "Create a new project",
                    inputSchema: {
                        type: "object",
                        properties: {
                            name: { type: "string" }
                        },
                        required: ["name"],
                    },
                },
                {
                    name: "delete_project",
                    description: "Delete a project and all its streams/logs",
                    inputSchema: {
                        type: "object",
                        properties: {
                            id: { type: "string" }
                        },
                        required: ["id"],
                    },
                },
                {
                    name: "delete_stream",
                    description: "Delete a log stream and its logs",
                    inputSchema: {
                        type: "object",
                        properties: {
                            id: { type: "string" }
                        },
                        required: ["id"],
                    },
                },
            ],
        });
    });

    // Call Tool
    server.setRequestHandler(CallToolRequestSchema, async (request: { params: { name: string; arguments?: Record<string, unknown>; }; }) => {
        const name = request.params.name;
        const args = request.params.arguments || {};

        switch (name) {
            case "list_projects": {
                try {
                    const projects = db.listProjects();
                    return { content: [{ type: "text", text: JSON.stringify(projects, null, 2) }] };
                } catch (error) {
                    console.error("Error listing projects:", error);
                    throw new McpError(ErrorCode.InternalError, `Failed to list projects: ${error}`);
                }
            }
            case "create_project": {
                const nameArg = args.name as string;
                if (!nameArg) throw new McpError(ErrorCode.InvalidParams, "Name is required");
                const project = db.createProject(nameArg);
                return { content: [{ type: "text", text: JSON.stringify(project, null, 2) }] };
            }
            case "delete_project": {
                const idArg = args.id as string;
                if (!idArg) throw new McpError(ErrorCode.InvalidParams, "ID is required");
                db.deleteProject(idArg);
                return { content: [{ type: "text", text: "Project deleted" }] };
            }
            case "delete_stream": {
                const idArg = args.id as string;
                if (!idArg) throw new McpError(ErrorCode.InvalidParams, "ID is required");
                db.deleteStream(idArg);
                return { content: [{ type: "text", text: "Stream deleted" }] };
            }
            case "query_logs": {
                const streamId = args.streamId as string;
                if (!streamId) throw new McpError(ErrorCode.InvalidParams, "Stream ID is required");
                const query = args.query as string | undefined;
                const limit = (args.limit as number) || 10;
                const mode = (args.mode as string) || "recent";

                let logs;
                if (mode === "search" && query) {
                    logs = await db.searchLogs(streamId, query, limit);
                } else {
                    logs = db.getRecentLogs(streamId, limit);
                }
                return { content: [{ type: "text", text: JSON.stringify(logs, null, 2) }] };
            }
            default:
                throw new McpError(ErrorCode.MethodNotFound, "Unknown tool");
        }
    });

    return server;
}


export async function startMcpServerStdio(db: DbService) {
    const server = createServer(db);
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

const transports = new Map<string, DenoSseTransport>();

export async function startMcpServerHttp(db: DbService) {
    const server = createServer(db);

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
    const mcpUrl = `${baseUrl}/mcp`;

    console.log(colors.bold.green(`✔ Loggerhead MCP Server running on ${baseUrl}`));

    console.log(colors.bold.blue("\n🔌Connect your AI Client:"));

    console.log(colors.bold("\n  Claude Desktop"));
    console.log(colors.dim("  ~/Library/Application Support/Claude/claude_desktop_config.json"));
    console.log(colors.cyan(`  "loggerhead": { "command": "loggerhead", "args": ["stdio"] }`));

    console.log(colors.bold("\n  Claude Code"));
    console.log(colors.cyan(`  claude mcp add --transport http loggerhead ${mcpUrl}`));

    console.log(colors.bold("\n  Cursor"));
    console.log(colors.dim("  Settings > Features > MCP > Add new server"));
    console.log(colors.cyan(`  Type: SSE  |  URL: ${mcpUrl}`));

    console.log(colors.bold("\n  VS Code"));
    console.log(colors.dim("  Command Palette > MCP: Add Server"));
    console.log(colors.cyan(`  ${JSON.stringify({ name: "loggerhead", type: "http", url: mcpUrl })}`));

    console.log(colors.bold("\n  Windsurf"));
    console.log(colors.dim("  ~/.codeium/windsurf/mcp_config.json"));
    console.log(colors.cyan(`  "loggerhead": { "serverUrl": "${mcpUrl}" }`));

    console.log("\n");

    const httpServer = Deno.serve({
        port,
        onListen: () => { } // Silence default listening log
    }, async (req) => {
        // CORS & Private Network Access (PNA) Handling
        const origin = req.headers.get("Origin") || "*";
        const corsHeaders = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Private-Network": "true",
            "Vary": "Origin",
        };

        if (req.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        const url = new URL(req.url);


        if (url.pathname === "/mcp") {
            const sessionId = crypto.randomUUID();
            let transport: DenoSseTransport;

            const body = new ReadableStream({
                start(controller) {
                    transport = new DenoSseTransport(sessionId, controller);
                    transports.set(sessionId, transport);

                    // Send endpoint event immediately
                    const endpointEvent = `event: endpoint\ndata: /messages?sessionId=${sessionId}\n\n`;
                    controller.enqueue(new TextEncoder().encode(endpointEvent));

                    // Connect server to transport
                    server.connect(transport);
                },
                cancel() {
                    const t = transports.get(sessionId);
                    t?.close();
                    transports.delete(sessionId);
                },
            });

            return new Response(body, {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "Access-Control-Allow-Origin": "*",
                },
            });
        }

        if (url.pathname === "/messages") {
            const sessionId = url.searchParams.get("sessionId");
            if (!sessionId || !transports.has(sessionId)) {
                return new Response("Session not found", { status: 404, headers: corsHeaders });
            }

            const transport = transports.get(sessionId);
            try {
                const message = await req.json();
                transport?.handlePostMessage(message);
                return new Response("Accepted", {
                    status: 202,
                    headers: corsHeaders
                });
            } catch (e) {
                console.error(e);
                return new Response("Error", { status: 500, headers: corsHeaders });
            }
        }

        if (url.pathname === "/api/ingest") {
            return await handleIngest(req, db, corsHeaders);
        }

        if (url.pathname === "/api/projects" && (req.method === "POST" || req.method === "GET")) {
            const projects = await db.listProjects();
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
                const streams = await db.listStreams(projectId);
                return new Response(JSON.stringify(streams), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
        }

        if (url.pathname === "/api/streams/create" && req.method === "POST") {
            const body = await req.json();
            const stream = await db.createStream(body.projectId, body.type, body.name, {});
            return new Response(JSON.stringify(stream), { headers: { "Content-Type": "application/json", ...corsHeaders } });
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

        const body = await req.json();
        const { streamId, logs } = body;

        if (!streamId || !logs) {
            return new Response("Missing streamId or logs", { status: 400, headers: corsHeaders });
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
