"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTui = startTui;
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
async function startTui(db) {
    console.clear();
    console.log(chalk_1.default.bold.blue("Loghead Dashboard\n"));
    while (true) {
        const projects = db.listProjects();
        if (projects.length === 0) {
            console.log("No projects found. Use 'npx loghead projects add <name>' to create one.");
            break;
        }
        const projectChoices = projects.map(p => ({ name: p.name, value: p.id }));
        projectChoices.push({ name: chalk_1.default.red("Exit"), value: "exit" });
        const { projectId } = await inquirer_1.default.prompt([{
                type: "list",
                name: "projectId",
                message: "Select a Project",
                choices: projectChoices
            }]);
        if (projectId === "exit")
            break;
        // List streams for project
        while (true) {
            console.clear();
            const project = projects.find(p => p.id === projectId);
            console.log(chalk_1.default.bold.blue(`Project: ${project?.name}\n`));
            const streams = db.listStreams(projectId);
            if (streams.length === 0) {
                console.log("No streams found.");
            }
            const streamChoices = streams.map(s => ({
                name: `${s.name} (${s.type})`,
                value: s.id
            }));
            streamChoices.push({ name: chalk_1.default.yellow("Back"), value: "back" });
            const { streamId } = await inquirer_1.default.prompt([{
                    type: "list",
                    name: "streamId",
                    message: "Select a Stream to view logs",
                    choices: streamChoices
                }]);
            if (streamId === "back")
                break;
            // Show logs (simple tail)
            console.clear();
            const stream = streams.find(s => s.id === streamId);
            console.log(chalk_1.default.bold.green(`Logs for ${stream?.name}:\n`));
            const logs = db.getRecentLogs(streamId, 20);
            if (logs.length === 0) {
                console.log("No logs recorded yet.");
            }
            else {
                // Reverse to show oldest to newest like a log file
                [...logs].reverse().forEach(log => {
                    console.log(`${chalk_1.default.dim(log.timestamp)}  ${log.content}`);
                });
            }
            console.log("\nPress Enter to return...");
            await new Promise(resolve => {
                process.stdin.once('data', () => resolve());
            });
        }
        console.clear();
    }
}
