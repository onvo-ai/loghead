"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTui = startTui;
const auth_1 = require("../services/auth");
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
let title = `
 █████                         █████                             █████
▒▒███                         ▒▒███                             ▒▒███ 
 ▒███         ██████   ███████ ▒███████    ██████   ██████    ███████ 
 ▒███        ███▒▒███ ███▒▒███ ▒███▒▒███  ███▒▒███ ▒▒▒▒▒███  ███▒▒███ 
 ▒███       ▒███ ▒███▒███ ▒███ ▒███ ▒███ ▒███████   ███████ ▒███ ▒███ 
 ▒███      █▒███ ▒███▒███ ▒███ ▒███ ▒███ ▒███▒▒▒   ███▒▒███ ▒███ ▒███ 
 ███████████▒▒██████ ▒▒███████ ████ █████▒▒██████ ▒▒████████▒▒████████
▒▒▒▒▒▒▒▒▒▒▒  ▒▒▒▒▒▒   ▒▒▒▒▒███▒▒▒▒ ▒▒▒▒▒  ▒▒▒▒▒▒   ▒▒▒▒▒▒▒▒  ▒▒▒▒▒▒▒▒ 
                      ███ ▒███                                        
                     ▒▒██████                                         
                      ▒▒▒▒▒▒                                          `;
async function startTui(db, token) {
    const port = process.env.PORT || 4567;
    const showHeader = () => {
        console.clear();
        console.log(chalk_1.default.bold(title));
        console.log(chalk_1.default.bold(`\nServer URL :`) + " " + chalk_1.default.dim(`http://localhost:${port}`));
        console.log(chalk_1.default.bold(`MCP Token  :`) + " " + chalk_1.default.dim(token) + "\n");
    };
    while (true) {
        showHeader();
        const projects = db.listProjects();
        const projectChoices = projects.map(p => ({ name: p.name, value: p.id }));
        projectChoices.push(new inquirer_1.default.Separator());
        projectChoices.push({ name: chalk_1.default.green("+ Create Project"), value: "create_project" });
        projectChoices.push({ name: chalk_1.default.red("Exit"), value: "exit" });
        const { projectId } = await inquirer_1.default.prompt([{
                type: "list",
                name: "projectId",
                message: "Select a project",
                choices: projectChoices,
                pageSize: 10,
                prefix: "💡"
            }]);
        if (projectId === "exit")
            break;
        if (projectId === "create_project") {
            const { name } = await inquirer_1.default.prompt([{
                    type: "input",
                    name: "name",
                    message: "Project Name:",
                    prefix: "💡"
                }]);
            if (name) {
                db.createProject(name);
            }
            continue;
        }
        // List streams for project
        while (true) {
            showHeader();
            const project = projects.find(p => p.id === projectId);
            console.log(chalk_1.default.bold.blue(`Project: ${project?.name}\n`));
            const streams = db.listStreams(projectId);
            const streamChoices = streams.map(s => ({
                name: `${s.name} (${s.type})`,
                value: s.id
            }));
            streamChoices.push(new inquirer_1.default.Separator());
            streamChoices.push({ name: chalk_1.default.green("+ Create Stream"), value: "create_stream" });
            streamChoices.push({ name: chalk_1.default.yellow("Back"), value: "back" });
            const { streamId } = await inquirer_1.default.prompt([{
                    type: "list",
                    name: "streamId",
                    message: "Select a stream",
                    choices: streamChoices,
                    pageSize: 10,
                    prefix: "💡"
                }]);
            if (streamId === "back")
                break;
            if (streamId === "create_stream") {
                showHeader();
                console.log(chalk_1.default.bold.blue(`Project: ${project?.name}`));
                console.log(chalk_1.default.bold.blue(`  └─ Create Stream\n`));
                const { name, type } = await inquirer_1.default.prompt([
                    {
                        type: "input",
                        name: "name",
                        message: "Stream name:",
                        prefix: "💡"
                    },
                    {
                        type: "list",
                        name: "type",
                        message: "Stream type:",
                        choices: ["browser", "terminal", "docker"],
                        prefix: "💡"
                    }
                ]);
                if (name && type) {
                    // For now, empty config
                    const s = await db.createStream(projectId, type, name, {});
                    console.log(chalk_1.default.green(`\nStream created!`));
                    console.log(chalk_1.default.bold.yellow(`Token: ${s.token}\n`));
                    await inquirer_1.default.prompt([{
                            type: "input",
                            name: "continue",
                            message: "Press enter to continue...",
                            prefix: "💡"
                        }]);
                }
                continue;
            }
            // Stream Actions
            while (true) {
                showHeader();
                const stream = streams.find(s => s.id === streamId);
                console.log(chalk_1.default.bold.blue(`Project: ${project?.name}`));
                console.log(chalk_1.default.bold.blue(`  └─ Stream: ${stream?.name} (${stream?.type})\n`));
                const { action } = await inquirer_1.default.prompt([{
                        type: "list",
                        name: "action",
                        message: "Action",
                        choices: [
                            { name: "View logs", value: "view_logs" },
                            { name: "Get token", value: "get_token" },
                            { name: "Delete stream", value: "delete_stream" },
                            { name: chalk_1.default.yellow("Back"), value: "back" }
                        ],
                        prefix: "💡"
                    }]);
                if (action === "back")
                    break;
                if (action === "get_token") {
                    const auth = new auth_1.AuthService();
                    const token = await auth.createStreamToken(streamId);
                    console.log(chalk_1.default.green(`\nToken for ${stream?.name}:`));
                    console.log(chalk_1.default.bold.yellow(`${token}\n`));
                    await inquirer_1.default.prompt([{
                            type: "input",
                            name: "continue",
                            message: "Press enter to continue...",
                            prefix: "💡"
                        }]);
                }
                if (action === "delete_stream") {
                    const { confirm } = await inquirer_1.default.prompt([{
                            type: "confirm",
                            name: "confirm",
                            message: `Are you sure you want to delete stream ${stream?.name}?`
                        }]);
                    if (confirm) {
                        db.deleteStream(streamId);
                        break; // Go back to stream list
                    }
                }
                if (action === "view_logs") {
                    console.clear();
                    console.log(chalk_1.default.bold.green(`Logs for ${stream?.name}:\n`));
                    const logs = db.getRecentLogs(streamId, 20);
                    if (logs.length === 0) {
                        console.log("No logs recorded yet.");
                    }
                    else {
                        [...logs].reverse().forEach(log => {
                            console.log(`${chalk_1.default.dim(log.timestamp)}  ${log.content}`);
                        });
                    }
                    console.log("\n");
                    await inquirer_1.default.prompt([{
                            type: "input",
                            name: "return",
                            message: "Press enter to return...",
                            prefix: "💡"
                        }]);
                }
            }
        }
    }
}
