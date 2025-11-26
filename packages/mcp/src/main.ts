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
            limit: z.number().optional().default(20).describe("Max logs to return")
        },
        async ({ streamId, query, limit }) => {
            try {
                let url = `/logs?streamId=${streamId}&limit=${limit}`;
                if (query) url += `&q=${encodeURIComponent(query)}`;

                const logs = await fetchApi(url);
                return { content: [{ type: "text", text: JSON.stringify(logs, null, 2) }] };
            } catch (error) {
                return { content: [{ type: "text", text: `Error: ${error}` }], isError: true };
            }
        }
    );

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Loghead MCP Server running on stdio");
}

main().catch(console.error);
