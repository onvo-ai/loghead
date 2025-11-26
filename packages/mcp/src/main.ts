import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
    ErrorCode,
    McpError,
} from "@modelcontextprotocol/sdk/types.js";

const API_URL = Deno.env.get("LOGHEAD_API_URL") || "http://localhost:4567/api";

async function fetchApi(path: string, options: RequestInit = {}) {
    const url = `${API_URL}${path}`;
    const res = await fetch(url, options);
    if (!res.ok) {
        throw new Error(`API Error ${res.status}: ${res.statusText}`);
    }
    return await res.json();
}

// Define types locally since we don't import from Core
interface Project { id: string; name: string; }
interface Stream { id: string; name: string; type: string; }
interface Log { content: string; timestamp: string; metadata: Record<string, unknown>; }

async function main() {
    const server = new Server(
        { name: "loghead-mcp", version: "0.1.0" },
        { capabilities: { resources: {}, tools: {} } }
    );

    // List Resources (Projects and Streams)
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
        try {
            const projects: Project[] = await fetchApi("/projects");
            return {
                resources: projects.map((p) => ({
                    uri: `loghead://project/${p.id}`,
                    name: p.name,
                    mimeType: "application/json",
                    description: `Project: ${p.name}`,
                })),
            };
        } catch (error) {
            console.error("Error listing resources:", error);
            return { resources: [] };
        }
    });

    // Read Resource (Get Project details or Stream details)
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const uri = request.params.uri;

        if (uri.startsWith("loghead://project/")) {
            const id = uri.split("/").pop();
            try {
                const streams: Stream[] = await fetchApi(`/streams?projectId=${id}`);
                return {
                    contents: [
                        {
                            uri: uri,
                            mimeType: "application/json",
                            text: JSON.stringify(streams, null, 2),
                        },
                    ],
                };
            } catch (error) {
                throw new McpError(ErrorCode.InternalError, `Failed to fetch project streams: ${error}`);
            }
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
                    description: "Search or retrieve logs from a specific stream",
                    inputSchema: {
                        type: "object",
                        properties: {
                            streamId: { type: "string" },
                            query: { type: "string" },
                            limit: { type: "number" },
                        },
                        required: ["streamId"],
                    },
                }
            ],
        });
    });

    // Call Tool
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const name = request.params.name;
        const args = request.params.arguments || {};

        switch (name) {
            case "list_projects": {
                try {
                    const projects = await fetchApi("/projects");
                    // Fetch streams for each project to be helpful
                    const fullData = await Promise.all(projects.map(async (p: Project) => {
                        try {
                            const streams = await fetchApi(`/streams?projectId=${p.id}`);
                            return { ...p, streams };
                        } catch {
                            return p;
                        }
                    }));

                    return { content: [{ type: "text", text: JSON.stringify(fullData, null, 2) }] };
                } catch (error) {
                    throw new McpError(ErrorCode.InternalError, `Failed to list projects: ${error}`);
                }
            }
            case "query_logs": {
                const streamId = args.streamId as string;
                if (!streamId) throw new McpError(ErrorCode.InvalidParams, "Stream ID is required");
                const query = args.query as string | undefined;
                const limit = (args.limit as number) || 20;

                try {
                    let url = `/logs?streamId=${streamId}&limit=${limit}`;
                    if (query) url += `&q=${encodeURIComponent(query)}`;

                    const logs = await fetchApi(url);
                    return { content: [{ type: "text", text: JSON.stringify(logs, null, 2) }] };
                } catch (error) {
                    throw new McpError(ErrorCode.InternalError, `Failed to query logs: ${error}`);
                }
            }
            default:
                throw new McpError(ErrorCode.MethodNotFound, "Unknown tool");
        }
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
}

if (import.meta.main) {
    await main();
}
