import { build, emptyDir } from "dnt";

await emptyDir("./npm");

await build({
    entryPoints: [{
        kind: "bin",
        name: "loghead",
        path: "./packages/core/src/cli_main.ts",
    }],
    outDir: "./npm",
    shims: {
        // see JS docs for overview and more options
        deno: true,
    },
    package: {
        // package.json properties
        name: "@loghead/core",
        version: "0.1.0",
        description: "Smart log aggregation tool and MCP server",
        license: "MIT",
        repository: {
            type: "git",
            url: "git+https://github.com/onvo-ai/loghead.git",
        },
        bugs: {
            url: "https://github.com/onvo-ai/loghead/issues",
        },
    },
    postBuild() {
        // steps to run after building and before running the tests
        // @ts-ignore
        Deno.copyFileSync("README.md", "npm/README.md");
    },
});
