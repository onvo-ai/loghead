"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureInfrastructure = ensureInfrastructure;
const chalk_1 = __importDefault(require("chalk"));
const ollama_1 = require("../services/ollama");
const migrate_1 = require("../db/migrate");
async function ensureInfrastructure() {
    console.log(chalk_1.default.bold.blue("\n🚀Performing system preflight checks..."));
    // 1. Check Local Ollama
    await checkStep("Checking local Ollama...", async () => {
        try {
            // Node.js fetch needs global fetch or polyfill in Node 18+. 
            // Assuming Node 18+ which has fetch.
            const response = await fetch("http://localhost:11434/api/tags");
            if (!response.ok)
                throw new Error("Ollama is not running");
        }
        catch {
            throw new Error("Ollama is not accessible at http://localhost:11434. Please install and run Ollama.");
        }
    });
    // 2. Check Database & Migrations (SQLite)
    await checkStep("Initializing database...", async () => {
        try {
            (0, migrate_1.migrate)(false);
        }
        catch (e) {
            console.log(chalk_1.default.yellow("\n   ➤ Migration failed..."));
            throw e;
        }
    });
    // 3. Check Ollama Model
    await checkStep("Checking embedding model (qwen3-embedding)...", async () => {
        const ollama = new ollama_1.OllamaService();
        await ollama.ensureModel();
    });
    console.log(`${chalk_1.default.green("✔")} System preflight checks complete`);
}
async function checkStep(name, action) {
    // Print pending state
    process.stdout.write(`${chalk_1.default.cyan("○")} ${name}`);
    try {
        await action();
        // Clear line and print success
        process.stdout.write(`\r${chalk_1.default.green("✔")} ${name}      \n`);
    }
    catch (e) {
        process.stdout.write(`\r${chalk_1.default.red("✖")} ${name}\n`);
        console.error(chalk_1.default.red(`   Error: ${e instanceof Error ? e.message : e}`));
        process.exit(1);
    }
}
