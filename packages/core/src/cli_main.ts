import { parseArgs } from "@std/cli/parse-args";
import { DbService } from "./services/db.ts";
import { startApiServer } from "./api/server.ts"; // Renamed from mcp/server.ts
import { migrate } from "./db/migrate.ts";
import { ensureInfrastructure } from "./utils/startup.ts";
import { Log } from "./types.ts";
import { startTui } from "./ui/main.ts";

const db = new DbService();

async function main() {
    const args = parseArgs(Deno.args, {
        string: ["project", "name", "stream", "container", "type"],
        boolean: ["help"],
        alias: { h: "help" },
    });

    const command = args._[0];

    if (args.help) {
        console.log(`
Loghead Core CLI (package: @loghead/core)

Usage:
  npx loghead ui               # Start Terminal UI (Dashboard)
  npx loghead init             # Initialize/Migrate database
  npx loghead start            # Start API Server
  npx loghead projects list
  npx loghead projects add <name>
  npx loghead streams list --project <id>
  npx loghead streams add <docker|browser|terminal> --project <id> --name <name>
    `);
        Deno.exit(0);
    }

    try {
        switch (command) {
            case "init": {
                console.log("Initializing database...");
                await migrate();
                break;
            }
            case "start": {
                await ensureInfrastructure();
                await startApiServer(db);
                break;
            }
            case "ui":
            case undefined: {
                await startTui(db);
                break;
            }
            case "projects": {
                const subcmd = args._[1];
                if (subcmd === "list") {
                    const projects = db.listProjects();
                    console.table(projects);
                } else if (subcmd === "add" || subcmd === "create") {
                    const name = args._[2]?.toString() || args.name;
                    if (!name) throw new Error("Project name required");
                    const p = db.createProject(name);
                    console.log(`Project created: ${p.id}`);
                } else {
                    console.error("Unknown projects command. Use 'list' or 'add'.");
                }
                break;
            }
            case "streams": {
                const subcmd = args._[1];
                if (subcmd === "list") {
                    const projectId = args.project;
                    if (!projectId) throw new Error("Missing arg: --project");
                    const streams = db.listStreams(projectId);
                    console.table(streams);
                } else if (subcmd === "add") {
                    const type = args._[2]?.toString();
                    const projectId = args.project;
                    const name = args.name;

                    if (!type || !["docker", "browser", "terminal"].includes(type)) {
                        throw new Error("Invalid or missing type. Use: docker, browser, terminal");
                    }
                    if (!projectId || !name) throw new Error("Missing args: --project, --name");

                    const config: Record<string, unknown> = {};
                    if (type === "docker" && args.container) {
                        config.container = args.container;
                    }

                    const s = await db.createStream(projectId, type, name, config);
                    console.log(`Stream created: ${s.id}`);
                    console.log(`Token: ${s.token}`);
                    console.log(`(Keep this token safe, it allows writing logs to this stream)`);
                } else {
                    console.error("Unknown streams command. Use 'list' or 'add'.");
                }
                break;
            }
            default:
                console.error("Unknown command");
                Deno.exit(1);
        }
    } catch (err) {
        console.error("Error:", err);
        Deno.exit(1);
    } finally {
        if (command !== "start" && command !== "ui" && command !== undefined) {
            db.close();
        }
    }
}


if (import.meta.main) {
    await main();
}
