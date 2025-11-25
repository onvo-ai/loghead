import { parseArgs } from "@std/cli/parse-args";
import { DbService } from "./services/db.ts";
import { TextLineStream } from "@std/streams";
import { startMcpServerHttp, startMcpServerStdio } from "./mcp/server.ts";
import { migrate } from "./db/migrate.ts";
import { ensureInfrastructure } from "./utils/startup.ts";
import { Log } from "./types.ts";

const db = new DbService();

async function main() {
    const args = parseArgs(Deno.args, {
        string: ["project", "name", "stream", "container", "type"],
        boolean: ["help"],
        alias: { h: "help" },
    });

    const command = args._[0];

    if (args.help || !command) {
        console.log(`
Loggerhead CLI

Usage:
  loggerhead init              # Initialize/Migrate database
  loggerhead start             # Start MCP Server (HTTP)
  loggerhead stdio             # Start MCP Server (Stdio)
  loggerhead projects list
  loggerhead projects add <name>
  loggerhead streams list --project <id>
  loggerhead streams add <docker|browser|terminal> --project <id> --name <name> [--container <container_id>]
  
  # Utility commands to run data ingestion
  loggerhead ingest --stream <id>
  loggerhead attach --stream <id> [--container <container_id>]
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
                await startMcpServerHttp(db);
                break;
            }
            case "stdio": {
                // No logs to stdout in stdio mode
                await startMcpServerStdio(db);
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

                    const s = db.createStream(projectId, type, name, config);
                    console.log(`Stream created: ${s.id}`);
                } else {
                    console.error("Unknown streams command. Use 'list' or 'add'.");
                }
                break;
            }
            // Keep legacy/utility commands for actual operation
            case "ingest": {
                const streamId = args.stream;
                if (!streamId) throw new Error("Missing arg: --stream");

                console.error("Reading from stdin... (Ctrl+D to stop)");
                const reader = Deno.stdin.readable
                    .pipeThrough(new TextDecoderStream())
                    .pipeThrough(new TextLineStream());

                for await (const line of reader) {
                    if (typeof line === 'string' && !line.trim()) continue;
                    const content = String(line);
                    console.log(content);
                    await db.addLog(streamId, content);
                }
                break;
            }
            case "docker":
            case "attach": {
                const streamId = args.stream;
                const container = args.container;

                if (!container && streamId) {
                    // Check if we can find container in config?
                    // Need a getStream method or listStreams and find.
                    // Skipping for simplicity, assume user passes it or we implement getStream later.
                }

                if (!streamId || !container) throw new Error("Missing args: --stream, --container");

                console.error(`Attaching to docker container ${container}...`);

                const cmd = new Deno.Command("docker", {
                    args: ["logs", "-f", container],
                    stdout: "piped",
                    stderr: "piped"
                });

                const child = cmd.spawn();

                const stdoutReader = child.stdout
                    .pipeThrough(new TextDecoderStream())
                    .pipeThrough(new TextLineStream());

                const stderrReader = child.stderr
                    .pipeThrough(new TextDecoderStream())
                    .pipeThrough(new TextLineStream());

                const processStream = async (reader: ReadableStream<string>, prefix: string) => {
                    for await (const line of reader) {
                        if (!line.trim()) continue;
                        console.log(`${prefix}: ${line}`);
                        await db.addLog(streamId, line, { source: prefix });
                    }
                };

                await Promise.all([
                    processStream(stdoutReader as unknown as ReadableStream<string>, "STDOUT"),
                    processStream(stderrReader as unknown as ReadableStream<string>, "STDERR"),
                    child.status
                ]);
                break;
            }
            case "log": {
                const subcmd = args._[1];
                if (subcmd === "list") {
                    const streamId = args.stream;
                    if (!streamId) throw new Error("Missing arg: --stream");
                    const logs = db.getRecentLogs(streamId);
                    console.table(logs.map((l: Log) => ({
                        content: l.content.substring(0, 50),
                        timestamp: l.timestamp
                    })));
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
        if (command !== "start" && command !== "stdio") {
            db.close();
        }
    }
}


if (import.meta.main) {
    await main();
}
