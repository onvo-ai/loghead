import { assertEquals, assertExists } from "@std/assert";
import { migrate } from "../db/migrate.ts";

// Set up environment to use in-memory DB before importing client
Deno.env.set("LOGGERHEAD_DB_PATH", ":memory:");

// Dynamic import to ensure env var is set before module loads
// We trigger the side-effect of client.ts (creating DB connection)
await import("../db/client.ts");
const { DbService } = await import("../services/db.ts");

Deno.test("DbService - Project Management", async (t) => {
    // @ts-ignore: Dynamic import returns any
    const service = new DbService();

    // Initialize DB schema
    migrate(false);

    await t.step("createProject creates a project", () => {
        const project = service.createProject("Test Project");
        assertExists(project.id);
        assertEquals(project.name, "Test Project");
    });

    await t.step("listProjects returns projects", () => {
        const projects = service.listProjects();
        assertExists(projects.find(p => p.name === "Test Project"));
    });

    await t.step("deleteProject deletes a project", () => {
        const projects = service.listProjects();
        const project = projects.find(p => p.name === "Test Project");
        if (project) {
            service.deleteProject(project.id);

            const remaining = service.listProjects();
            assertEquals(remaining.find(p => p.name === "Test Project"), undefined);
        }
    });
});

Deno.test("DbService - Stream Management", async (t) => {
    // @ts-ignore: Dynamic import returns any
    const service = new DbService();

    // Create a fresh project for this test suite
    const project = service.createProject("Stream Project");

    await t.step("createStream creates a stream", () => {
        const stream = service.createStream(project.id, "terminal", "My Stream", { foo: "bar" });
        assertExists(stream.id);
        assertEquals(stream.name, "My Stream");
        assertEquals(stream.type, "terminal");
        // @ts-ignore: Property access
        assertEquals(stream.config, { foo: "bar" });
    });

    await t.step("listStreams returns streams", () => {
        const streams = service.listStreams(project.id);
        assertEquals(streams.length, 1);
        assertEquals(streams[0].name, "My Stream");
    });
});
