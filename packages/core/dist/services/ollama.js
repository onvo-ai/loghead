"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaService = void 0;
const ollama_1 = require("ollama");
class OllamaService {
    client;
    model;
    constructor(host = "http://localhost:11434", model = "qwen3-embedding:0.6b") {
        this.client = new ollama_1.Ollama({ host });
        this.model = model;
    }
    async generateEmbedding(prompt) {
        try {
            const response = await this.client.embeddings({
                model: this.model,
                prompt: prompt,
            });
            return response.embedding;
        }
        catch (error) {
            console.error("Failed to generate embedding:", error);
            throw error;
        }
    }
    async ensureModel() {
        try {
            const list = await this.client.list();
            const exists = list.models.some((m) => m.name.includes(this.model));
            if (!exists) {
                console.log(`Model ${this.model} not found. Pulling...`);
                await this.client.pull({ model: this.model });
                console.log("Model pulled.");
            }
        }
        catch (e) {
            console.warn("Could not check/pull ollama model:", e);
        }
    }
}
exports.OllamaService = OllamaService;
