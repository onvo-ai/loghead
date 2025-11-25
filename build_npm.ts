import { build, emptyDir } from "dnt";

await emptyDir("./npm");

await build({
    entryPoints: [{
        kind: "bin",
        name: "loggerhead",
        path: "./cli/src/main.ts",
    }],
    outDir: "./npm",
    shims: {
        // see JS docs for overview and more options
        deno: true,
    },
    package: {
        // package.json properties
        name: "@onvo-ai/loggerhead",
        version: "0.1.0",
        description: "Smart log aggregation tool and MCP server",
        license: "MIT",
        repository: {
            type: "git",
            url: "git+https://github.com/onvo-ai/loggerhead.git",
        },
        bugs: {
            url: "https://github.com/onvo-ai/loggerhead/issues",
        },
    },
    postBuild() {
        // steps to run after building and before running the tests
        // @ts-ignore
        Deno.copyFileSync("README.md", "npm/README.md");
    },
});
