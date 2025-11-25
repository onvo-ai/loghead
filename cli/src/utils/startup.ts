import { colors } from "@cliffy/ansi/colors";
import { OllamaService } from "../services/ollama.ts";
import { migrate } from "../db/migrate.ts";

export async function ensureInfrastructure() {
    console.log(colors.bold.blue("\n🚀Performing system preflight checks..."));

    // 1. Check Local Ollama
    await checkStep("Checking local Ollama...", async () => {
        try {
            const response = await fetch("http://localhost:11434/api/tags");
            if (!response.ok) throw new Error("Ollama is not running");
        } catch {
            throw new Error("Ollama is not accessible at http://localhost:11434. Please install and run Ollama.");
        }
    });

    // 2. Check Database & Migrations (SQLite)
    await checkStep("Initializing database...", async () => {
        try {
            await migrate(false);
        } catch (e) {
            console.log(colors.yellow("\n   ➤ Migration failed..."));
            throw e;
        }
    });

    // 3. Check Ollama Model
    await checkStep("Checking embedding model (qwen3-embedding)...", async () => {
        const ollama = new OllamaService();
        await ollama.ensureModel();
    });

    console.log(`${colors.green("✔")} System preflight checks complete`);
}

async function checkStep(name: string, action: () => Promise<void>) {
    const encoder = new TextEncoder();

    // Print pending state
    await Deno.stdout.write(encoder.encode(`${colors.cyan("○")} ${name}`));

    try {
        await action();
        // Clear line and print success
        await Deno.stdout.write(encoder.encode(`\r${colors.green("✔")} ${name}      \n`));
    } catch (e) {
        await Deno.stdout.write(encoder.encode(`\r${colors.red("✖")} ${name}\n`));
        console.error(colors.red(`   Error: ${e instanceof Error ? e.message : e}`));
        Deno.exit(1);
    }
}
