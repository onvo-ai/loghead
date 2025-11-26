#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_1 = require("@modelcontextprotocol/sdk/types");
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
    const server = new index_js_1.Server({ name: "loghead-mcp", version: "0.1.0" }, { capabilities: { resources: {}, tools: {} } });
    // List Resources (Projects and Streams)
    server.setRequestHandler(types_1.ListResourcesRequestSchema, async () => {
        try {
            const projects = await fetchApi("/projects");
            return {
                resources: projects.map((p) => ({
                    uri: `loghead://project/${p.id}`,
                    name: p.name,
                    mimeType: "application/json",
                    description: `Project: ${p.name}`,
                })),
            };
        }
        catch (error) {
            console.error("Error listing resources:", error);
            return { resources: [] };
        }
    });
    // Read Resource (Get Project details or Stream details)
    server.setRequestHandler(types_1.ReadResourceRequestSchema, async (request) => {
        const uri = request.params.uri;
        if (uri.startsWith("loghead://project/")) {
            const id = uri.split("/").pop();
            try {
                const streams = await fetchApi(`/streams?projectId=${id}`);
                return {
                    contents: [
                        {
                            uri: uri,
                            mimeType: "application/json",
                            text: JSON.stringify(streams, null, 2),
                        },
                    ],
                };
            }
            catch (error) {
                throw new types_1.McpError(types_1.ErrorCode.InternalError, `Failed to fetch project streams: ${error}`);
            }
        }
        throw new types_1.McpError(types_1.ErrorCode.InvalidRequest, "Unknown resource");
    });
    // List Tools
    server.setRequestHandler(types_1.ListToolsRequestSchema, () => {
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
    server.setRequestHandler(types_1.CallToolRequestSchema, async (request) => {
        const name = request.params.name;
        const args = request.params.arguments || {};
        switch (name) {
            case "list_projects": {
                try {
                    const projects = await fetchApi("/projects");
                    // Fetch streams for each project to be helpful
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
                    throw new types_1.McpError(types_1.ErrorCode.InternalError, `Failed to list projects: ${error}`);
                }
            }
            case "query_logs": {
                const streamId = args.streamId;
                if (!streamId)
                    throw new types_1.McpError(types_1.ErrorCode.InvalidParams, "Stream ID is required");
                const query = args.query;
                const limit = args.limit || 20;
                try {
                    let url = `/logs?streamId=${streamId}&limit=${limit}`;
                    if (query)
                        url += `&q=${encodeURIComponent(query)}`;
                    const logs = await fetchApi(url);
                    return { content: [{ type: "text", text: JSON.stringify(logs, null, 2) }] };
                }
                catch (error) {
                    throw new types_1.McpError(types_1.ErrorCode.InternalError, `Failed to query logs: ${error}`);
                }
            }
            default:
                throw new types_1.McpError(types_1.ErrorCode.MethodNotFound, "Unknown tool");
        }
    });
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
}
main().catch(console.error);
