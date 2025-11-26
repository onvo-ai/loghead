import { DbService } from "../services/db.ts";
import { Select } from "@cliffy/prompt";
import { colors } from "@cliffy/ansi/colors";

export async function startTui(db: DbService) {
    console.clear();
    console.log(colors.bold.blue("Loghead Dashboard\n"));

    while (true) {
        const projects = db.listProjects();

        if (projects.length === 0) {
            console.log("No projects found. Use 'npx loghead projects add <name>' to create one.");
            break;
        }

        const projectOptions = projects.map(p => ({ name: p.name, value: p.id }));
        projectOptions.push({ name: colors.red("Exit"), value: "exit" });

        const projectId = await Select.prompt({
            message: "Select a Project",
            options: projectOptions
        });

        if (projectId === "exit") break;

        // List streams for project
        while (true) {
            console.clear();
            const project = projects.find(p => p.id === projectId);
            console.log(colors.bold.blue(`Project: ${project?.name}\n`));

            const streams = db.listStreams(projectId);

            if (streams.length === 0) {
                console.log("No streams found.");
            }

            const streamOptions = streams.map(s => ({
                name: `${s.name} (${s.type})`,
                value: s.id
            }));
            streamOptions.push({ name: colors.yellow("Back"), value: "back" });

            const streamId = await Select.prompt({
                message: "Select a Stream to view logs",
                options: streamOptions
            });

            if (streamId === "back") break;

            // Show logs (simple tail)
            console.clear();
            const stream = streams.find(s => s.id === streamId);
            console.log(colors.bold.green(`Logs for ${stream?.name}:\n`));

            const logs = db.getRecentLogs(streamId, 20);
            if (logs.length === 0) {
                console.log("No logs recorded yet.");
            } else {
                // Reverse to show oldest to newest like a log file
                [...logs].reverse().forEach(log => {
                    console.log(`${colors.dim(log.timestamp)}  ${log.content}`);
                });
            }

            console.log("\nPress Enter to return...");
            await Deno.stdin.read(new Uint8Array(1));
        }
        console.clear();
    }
}
