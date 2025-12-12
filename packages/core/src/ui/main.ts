import { DbService } from "../services/db";
import { AuthService } from "../services/auth";
import inquirer from "inquirer";
import chalk from "chalk";

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

export async function startTui(db: DbService, token: string) {
    const port = process.env.PORT || 4567;
    const showHeader = () => {
        console.clear();
        console.log(chalk.bold(title));
        console.log(chalk.bold(`\nServer URL :`) + " " + chalk.dim(`http://localhost:${port}`));
        console.log(chalk.bold(`MCP Token  :`) + " " + chalk.dim(token) + "\n");
    };

    while (true) {
        showHeader();
        const projects = db.listProjects();

        const projectChoices: (inquirer.Separator | { name: string; value: string })[] = projects.map(p => ({ name: p.name, value: p.id }));
        projectChoices.push(new inquirer.Separator());
        projectChoices.push({ name: chalk.green("+ Create Project"), value: "create_project" });
        projectChoices.push({ name: chalk.red("Exit"), value: "exit" });

        const { projectId } = await inquirer.prompt([{
            type: "list",
            name: "projectId",
            message: "Select a project",
            choices: projectChoices,
            pageSize: 10,
            prefix: "💡"
        }]);

        if (projectId === "exit") break;

        if (projectId === "create_project") {
            const { name } = await inquirer.prompt([{
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
            console.log(chalk.bold.blue(`Project: ${project?.name}\n`));

            const streams = db.listStreams(projectId);

            const streamChoices: (inquirer.Separator | { name: string; value: string })[] = streams.map(s => ({
                name: `${s.name} (${s.type})`,
                value: s.id
            }));
            streamChoices.push(new inquirer.Separator());
            streamChoices.push({ name: chalk.green("+ Create Stream"), value: "create_stream" });
            streamChoices.push({ name: chalk.yellow("Back"), value: "back" });

            const { streamId } = await inquirer.prompt([{
                type: "list",
                name: "streamId",
                message: "Select a stream",
                choices: streamChoices,
                pageSize: 10,
                prefix: "💡"
            }]);

            if (streamId === "back") break;

            if (streamId === "create_stream") {
                showHeader();
                console.log(chalk.bold.blue(`Project: ${project?.name}`));
                console.log(chalk.bold.blue(`  └─ Create Stream\n`));

                const { name, type } = await inquirer.prompt([
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
                        choices: ["browser", "terminal", "docker", "opentelemetry"],
                        prefix: "💡"
                    }
                ]);

                if (name && type) {
                    // For now, empty config
                    const s = await db.createStream(projectId, type, name, {});
                    console.log(chalk.green(`\nStream created!`));
                    console.log(chalk.bold.yellow(`Token: ${s.token}\n`));

                    await inquirer.prompt([{
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
                console.log(chalk.bold.blue(`Project: ${project?.name}`));
                console.log(chalk.bold.blue(`  └─ Stream: ${stream?.name} (${stream?.type})\n`));

                const { action } = await inquirer.prompt([{
                    type: "list",
                    name: "action",
                    message: "Action",
                    choices: [
                        { name: "View logs", value: "view_logs" },
                        { name: "Get token", value: "get_token" },
                        { name: "Delete stream", value: "delete_stream" },
                        { name: chalk.yellow("Back"), value: "back" }
                    ],
                    prefix: "💡"
                }]);

                if (action === "back") break;

                if (action === "get_token") {
                    const auth = new AuthService();
                    const token = await auth.createStreamToken(streamId);
                    console.log(chalk.green(`\nToken for ${stream?.name}:`));
                    console.log(chalk.bold.yellow(`${token}\n`));

                    await inquirer.prompt([{
                        type: "input",
                        name: "continue",
                        message: "Press enter to continue...",
                        prefix: "💡"
                    }]);
                }

                if (action === "delete_stream") {
                    const { confirm } = await inquirer.prompt([{
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
                    console.log(chalk.bold.green(`Logs for ${stream?.name}:\n`));

                    const logs = db.getRecentLogs(streamId, 20);
                    if (logs.length === 0) {
                        console.log("No logs recorded yet.");
                    } else {
                        [...logs].reverse().forEach(log => {
                            console.log(`${chalk.dim(log.timestamp)}  ${log.content}`);
                        });
                    }

                    console.log("\n");
                    await inquirer.prompt([{
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
