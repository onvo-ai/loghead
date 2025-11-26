#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const API_URL = process.env.LOGHEAD_API_URL || "http://localhost:4567/api";
async function fetchApi(path, options = {}) {
    const url = `${API_URL}${path}`;
    const res = await fetch(url, options);
    if (!res.ok) {
        throw new Error(`API Error ${res.status}: ${res.statusText}`);
    }
    return await res.json();
}
async function main() {
    const server = new mcp_js_1.McpServer({
        name: "loghead-mcp",
        version: "0.1.0"
    });
    // Resources
    server.resource("project", "loghead://project/{id}", async (uri) => {
        const id = uri.href.split("/").pop();
        try {
            const streams = await fetchApi(`/streams?projectId=${id}`);
            return {
                contents: [{
                        uri: uri.href,
                        mimeType: "application/json",
                        text: JSON.stringify(streams, null, 2),
                    }]
            };
        }
        catch (error) {
            throw new Error(`Failed to fetch project streams: ${error}`);
        }
    });
    // Tools
    server.tool("list_projects", "Lists all the projects and their streams", {}, // No args
    async () => {
        try {
            const projects = await fetchApi("/projects");
            const fullData = await Promise.all(projects.map(async (p) => {
                try {
                    const streams = await fetchApi(`/streams?projectId=${p.id}`);
                    return { ...p, streams };
                }
                catch {
                    return p;
                }
            }));
            return { content: [{ type: "text", text: JSON.stringify(fullData, null, 2) }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `Error: ${error}` }], isError: true };
        }
    });
    server.tool("query_logs", "Search or retrieve logs from a specific stream", {
        streamId: zod_1.z.string().describe("The Stream ID"),
        query: zod_1.z.string().optional().describe("Search query"),
        limit: zod_1.z.number().optional().default(20).describe("Max logs to return")
    }, async ({ streamId, query, limit }) => {
        try {
            let url = `/logs?streamId=${streamId}&limit=${limit}`;
            if (query)
                url += `&q=${encodeURIComponent(query)}`;
            const logs = await fetchApi(url);
            return { content: [{ type: "text", text: JSON.stringify(logs, null, 2) }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `Error: ${error}` }], isError: true };
        }
    });
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("Loghead MCP Server running on stdio");
}
main().catch(console.error);
