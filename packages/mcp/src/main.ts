#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const API_URL = process.env.LOGHEAD_API_URL || "http://localhost:4567/api";

async function fetchApi(path: string, options: RequestInit = {}) {
    const url = `${API_URL}${path}`;
    const res = await fetch(url, options);
    if (!res.ok) {
        throw new Error(`API Error ${res.status}: ${res.statusText}`);
    }
    return await res.json();
}

// Define types locally
interface Project { id: string; name: string; }
interface Stream { id: string; name: string; type: string; }

async function main() {
    const server = new McpServer({
        name: "loghead-mcp",
        version: "0.1.0"
    });

    // Resources
    server.resource(
        "project",
        "loghead://project/{id}",
        async (uri) => {
            const id = uri.href.split("/").pop() as string;
            try {
                const streams: Stream[] = await fetchApi(`/streams?projectId=${id}`);
                return {
                    contents: [{
                        uri: uri.href,
                        mimeType: "application/json",
                        text: JSON.stringify(streams, null, 2),
                    }]
                };
            } catch (error) {
                throw new Error(`Failed to fetch project streams: ${error}`);
            }
        }
    );

    // Tools
    server.tool(
        "list_projects",
        "Lists all the projects and their streams",
        {}, // No args
        async () => {
            try {
                const projects = await fetchApi("/projects");
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
                return { content: [{ type: "text", text: `Error: ${error}` }], isError: true };
            }
        }
    );

    server.tool(
        "query_logs",
        "Search or retrieve logs from a specific stream",
        {
            streamId: z.string().describe("The Stream ID"),
            query: z.string().optional().describe("Search query"),
            limit: z.number().optional().describe("Max logs to return (deprecated, use pageSize)"),
            page: z.number().optional().default(1).describe("Page number"),
            pageSize: z.number().optional().default(100).describe("Logs per page")
        },
        async ({ streamId, query, limit, page, pageSize }) => {
            try {
                let url = `/logs?streamId=${streamId}&page=${page}&pageSize=${pageSize}`;
                if (limit) url += `&limit=${limit}`;
                if (query) url += `&q=${encodeURIComponent(query)}`;

                const logs = await fetchApi(url);
                return { content: [{ type: "text", text: JSON.stringify(logs, null, 2) }] };
            } catch (error) {
                return { content: [{ type: "text", text: `Error: ${error}` }], isError: true };
            }
        }
    );

    server.tool(
        "create_project",
        "Create a new project",
        { name: z.string() },
        async ({ name }) => {
            try {
                const project = await fetchApi("/projects", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name })
                });
                return { content: [{ type: "text", text: `Project created: ${project.id}` }] };
            } catch (e) {
                return { content: [{ type: "text", text: `Error: ${e}` }], isError: true };
            }
        }
    );

    server.tool(
        "delete_project",
        "Delete a project",
        { id: z.string() },
        async ({ id }) => {
            try {
                await fetchApi(`/projects/${id}`, { method: "DELETE" });
                return { content: [{ type: "text", text: `Project deleted` }] };
            } catch (e) {
                return { content: [{ type: "text", text: `Error: ${e}` }], isError: true };
            }
        }
    );

    server.tool(
        "create_stream",
        "Create a new stream",
        {
            projectId: z.string(),
            type: z.string(),
            name: z.string(),
            config: z.any().optional()
        },
        async ({ projectId, type, name, config }) => {
            try {
                const stream = await fetchApi("/streams/create", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ projectId, type, name, config })
                });
                return { content: [{ type: "text", text: `Stream created: ${stream.id}\nToken: ${stream.token}` }] };
            } catch (e) {
                return { content: [{ type: "text", text: `Error: ${e}` }], isError: true };
            }
        }
    );

    server.tool(
        "delete_stream",
        "Delete a stream",
        { id: z.string() },
        async ({ id }) => {
            try {
                await fetchApi(`/streams/${id}`, { method: "DELETE" });
                return { content: [{ type: "text", text: `Stream deleted` }] };
            } catch (e) {
                return { content: [{ type: "text", text: `Error: ${e}` }], isError: true };
            }
        }
    );

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Loghead MCP Server running on stdio");
}

main().catch(console.error);
