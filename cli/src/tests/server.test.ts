import { assertEquals, assertExists } from "@std/assert";
import { createServer } from "./server.ts";
import { migrate } from "../db/migrate.ts";

// Set up environment to use in-memory DB
Deno.env.set("LOGGERHEAD_DB_PATH", ":memory:");

// Import services after setting env var
await import("../db/client.ts");
const { DbService } = await import("../services/db.ts");

Deno.test("MCP Server", async (t) => {
    // @ts-ignore: Dynamic import
    const db = new DbService();
    migrate(false);
    const server = createServer(db);

    // Mock Transport
    // deno-lint-ignore no-explicit-any
    const clientMessages: any[] = [];
    const mockTransport = {
        start: () => Promise.resolve(),
        close: () => Promise.resolve(),
        // deno-lint-ignore no-explicit-any
        send: (msg: any) => {
            clientMessages.push(msg);
            return Promise.resolve();
        },
        // deno-lint-ignore no-explicit-any
        onmessage: undefined as ((msg: any) => void) | undefined,
        onclose: undefined,
        onerror: undefined
    };

    await server.connect(mockTransport);

    await t.step("list_tools returns available tools", async () => {
        // Simulate client sending request
        if (mockTransport.onmessage) {
            mockTransport.onmessage({
                jsonrpc: "2.0",
                id: 1,
                method: "tools/list",
                params: {}
            });
        }

        // Wait for response (simple tick wait)
        await new Promise(r => setTimeout(r, 10));

        const response = clientMessages.find(m => m.id === 1);
        assertExists(response);
        assertExists(response.result);
        assertExists(response.result.tools);
        const tools = response.result.tools;
        // deno-lint-ignore no-explicit-any
        assertExists(tools.find((t: any) => t.name === "list_projects"));
        // deno-lint-ignore no-explicit-any
        assertExists(tools.find((t: any) => t.name === "create_project"));
    });

    await t.step("create_project tool works", async () => {
        const reqId = 2;
        if (mockTransport.onmessage) {
            mockTransport.onmessage({
                jsonrpc: "2.0",
                id: reqId,
                method: "tools/call",
                params: {
                    name: "create_project",
                    arguments: { name: "MCP Test Project" }
                }
            });
        }

        await new Promise(r => setTimeout(r, 10));

        const response = clientMessages.find(m => m.id === reqId);
        assertExists(response);
        if (response.error) {
            console.error("Tool error:", response.error);
            throw new Error(response.error.message);
        }
        assertExists(response.result);
        const content = JSON.parse(response.result.content[0].text);
        assertEquals(content.name, "MCP Test Project");
    });

    await t.step("list_projects tool works", async () => {
        const reqId = 3;
        if (mockTransport.onmessage) {
            mockTransport.onmessage({
                jsonrpc: "2.0",
                id: reqId,
                method: "tools/call",
                params: {
                    name: "list_projects",
                    arguments: {}
                }
            });
        }

        await new Promise(r => setTimeout(r, 10));

        const response = clientMessages.find(m => m.id === reqId);
        assertExists(response);
        if (response.error) {
            console.error("Tool error:", response.error);
            throw new Error(response.error.message);
        }
        assertExists(response.result);
        const projects = JSON.parse(response.result.content[0].text);
        // deno-lint-ignore no-explicit-any
        assertExists(projects.find((p: any) => p.name === "MCP Test Project"));
    });
});
