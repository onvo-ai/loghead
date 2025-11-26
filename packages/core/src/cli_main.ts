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
        .command("start", "Start API Server", {}, async () => {
            console.log("Ensuring database is initialized...");
            await migrate(false); // Run migrations silently

            const token = await auth.getOrCreateMcpToken();
            console.log(chalk.bold.yellow(`\n🔑 MCP Server Token: ${token}`));
            console.log(chalk.dim("Use this token for the MCP Server or other admin integrations.\n"));

            await startApiServer(db);
        })
        .command("ui", "Start Terminal UI", {}, async () => {
            await startTui(db);
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
