import { ensureDir } from "jsr:@std/fs";

async function build() {
    console.log("Building MCP Server (Binary)...");

    // 1. Compile to Binary
    const cmd = new Deno.Command("deno", {
        args: [
            "compile",
            "--allow-net",
            "--allow-env",
            "--allow-read",
            "--output", "packages/mcp/build/loghead-mcp",
            "packages/mcp/src/main.ts"
        ]
    });

    const { code, stdout, stderr } = await cmd.output();
    if (code !== 0) {
        console.error("Compilation failed:");
        console.error(new TextDecoder().decode(stderr));
        Deno.exit(1);
    }

    // 2. Prepare NPM Package
    const npmDir = "./packages/mcp/build/npm";
    const binDir = `${npmDir}/bin`;

    try { await Deno.remove(npmDir, { recursive: true }); } catch { /* ignore */ }
    await ensureDir(binDir);

    // Copy Binary
    await Deno.copyFile("./packages/mcp/build/loghead-mcp", `${binDir}/loghead-mcp`);
    await Deno.chmod(`${binDir}/loghead-mcp`, 0o755);

    // Create package.json
    const packageJson = {
        name: "@loghead/mcp",
        version: "0.1.0",
        description: "Standalone MCP Server for Loghead",
        bin: {
            "loghead-mcp": "./bin/loghead-mcp"
        },
        files: ["bin"],
        os: ["darwin"],
        cpu: ["arm64"],
        scripts: {
            "postinstall": "echo 'Note: This package contains a prebuilt binary for macOS ARM64.'"
        },
        author: "Onvo AI",
        license: "MIT",
        publishConfig: { "access": "public" }
    };

    await Deno.writeTextFile(`${npmDir}/package.json`, JSON.stringify(packageJson, null, 2));

    console.log(`@loghead/mcp prepared in ${npmDir}`);
    console.log("Run 'cd packages/mcp/build/npm && npm publish --access public' to publish.");
}

if (import.meta.main) {
    await build();
}
