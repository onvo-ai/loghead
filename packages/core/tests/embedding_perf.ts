import { OllamaService } from "../src/services/ollama";
import { performance } from "perf_hooks";

async function runTest() {
    console.log("Starting Embedding Performance Test...");

    const service = new OllamaService();

    // Ensure model exists first so pull time doesn't affect metrics
    console.log("Checking model availability...");
    await service.ensureModel();

    const testString = "This is a test log message that simulates a typical log entry in a production system. It contains some details about an error or an event that occurred.";
    const iterations = 10;
    const latencies: number[] = [];

    console.log(`Running ${iterations} iterations...`);

    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        try {
            await service.generateEmbedding(testString);
            const end = performance.now();
            const duration = end - start;
            latencies.push(duration);
            console.log(`Iteration ${i + 1}: ${duration.toFixed(2)}ms`);
        } catch (e) {
            console.error(`Iteration ${i + 1} failed:`, e);
        }
    }

    if (latencies.length > 0) {
        const warmUp = latencies[0];
        const results = latencies.slice(1); // Remove warm-up

        console.log("\n--- Results ---");
        console.log(`Total Iterations: ${latencies.length}`);
        console.log(`Warm-up Time: ${warmUp.toFixed(2)}ms`);

        if (results.length > 0) {
            const min = Math.min(...results);
            const max = Math.max(...results);

            // Calculate Median
            results.sort((a, b) => a - b);
            const mid = Math.floor(results.length / 2);
            const median = results.length % 2 !== 0
                ? results[mid]
                : (results[mid - 1] + results[mid]) / 2;

            console.log(`Min Latency (excl. warmup): ${min.toFixed(2)}ms`);
            console.log(`Avg Latency (excl. warmup): ${median.toFixed(2)}ms`);
            console.log(`Max Latency (excl. warmup): ${max.toFixed(2)}ms`);
        } else {
            console.log("Not enough iterations to calculate stats (need > 1).");
        }
    } else {
        console.log("\nNo successful iterations.");
    }
}

runTest().catch(console.error);
