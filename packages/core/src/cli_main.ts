#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DbService } from "./services/db";
import { startApiServer } from "./api/server";
import { migrate } from "./db/migrate";
// import { ensureInfrastructure } from "./utils/startup"; // Might need adjustment
import { startTui } from "./ui/main";
import { AuthService } from "./services/auth";
import chalk from "chalk";

const db = new DbService();
const auth = new AuthService();

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .command("init", "Initialize/Migrate database", {}, async () => {
            console.log("Initializing database...");
            await migrate();
        })
        .command(["start", "$0"], "Start API Server", {}, async () => {
            console.log("Ensuring database is initialized...");
            await migrate(false); // Run migrations silently

            const token = await auth.getOrCreateMcpToken();

            // Start API Server (this sets up express listen)
            await startApiServer(db);

            // Start TUI (this will clear screen and take over)
            await startTui(db, token);
            process.exit(0);
        })
        .command("ui", "Start Terminal UI", {}, async () => {
            const token = await auth.getOrCreateMcpToken();
            await startTui(db, token);
            process.exit(0);
        })
        .command("projects <cmd> [name]", "Manage projects", (yargs) => {
            yargs
                .command("list", "List projects", {}, () => {
                    const projects = db.listProjects();
                    console.table(projects);
                })
                .command("add <name>", "Add project", {}, (argv) => {
                    const p = db.createProject(argv.name as string);
                    console.log(`Project created: ${p.id}`);
                })
                .command("delete <id>", "Delete project", {}, (argv) => {
                    db.deleteProject(argv.id as string);
                    console.log(`Project deleted: ${argv.id}`);
                });
        })
        .command("streams <cmd> [type] [name]", "Manage streams", (yargs) => {
            yargs
                .command("list", "List streams", {
                    project: { type: "string", demandOption: true }
                }, (argv) => {
                    const streams = db.listStreams(argv.project);
                    console.table(streams);
                })
                .command("add <type> <name>", "Add stream", {
                    project: { type: "string", demandOption: true },
                    container: { type: "string" }
                }, async (argv) => {
                    const config: Record<string, unknown> = {};
                    if (argv.type === "docker" && argv.container) {
                        config.container = argv.container;
                    }
                    const s = await db.createStream(argv.project, argv.type as string, argv.name as string, config);
                    console.log(`Stream created: ${s.id}`);
                    console.log(`Token: ${s.token}`);
                })
                .command("token", "Get token for stream", {
                    stream: { type: "string", demandOption: true }
                }, async (argv) => {
                    const token = await auth.createStreamToken(argv.stream as string);
                    console.log(`Token: ${token}`);
                })
                .command("delete <id>", "Delete stream", {}, (argv) => {
                    db.deleteStream(argv.id as string);
                    console.log(`Stream deleted: ${argv.id}`);
                });
        })
        .demandCommand(1)
        .strict()
        .help()
        .parse();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
