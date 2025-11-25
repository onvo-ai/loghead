import { ensureDir } from "jsr:@std/fs";

async function build() {
    console.log("Building NPM package (Binary Distribution)...");

    const npmDir = "./cli/build/npm";
    const binDir = `${npmDir}/bin`;

    // 1. Clean & Create Dirs
    try {
        await Deno.remove(npmDir, { recursive: true });
    } catch { /* ignore */ }

    await ensureDir(binDir);

    // 2. Copy Binary
    // Ensure the binary exists
    const binarySource = "./cli/build/loggerhead";
    try {
        await Deno.stat(binarySource);
    } catch {
        console.error("Binary not found at ./cli/build/loggerhead. Please run 'deno task build' in cli/ first.");
        Deno.exit(1);
    }

    const binaryDest = `${binDir}/loggerhead`;
    await Deno.copyFile(binarySource, binaryDest);
    // Ensure executable
    await Deno.chmod(binaryDest, 0o755);

    // 3. Create package.json
    const packageJson = {
        name: "@onvo-ai/loggerhead",
        version: "0.1.0",
        description: "Smart log aggregation tool and MCP server",
        bin: {
            "loggerhead": "./bin/loggerhead"
        },
        files: [
            "bin"
        ],
        os: ["darwin"],
        cpu: ["arm64"],
        scripts: {
            "postinstall": "echo 'Note: This package contains a prebuilt binary for macOS ARM64.'"
        },
        author: "Onvo AI",
        license: "MIT",
        repository: {
            type: "git",
            url: "git+https://github.com/onvo-ai/loggerhead.git"
        },
        bugs: {
            url: "https://github.com/onvo-ai/loggerhead/issues"
        }
    };

    await Deno.writeTextFile(`${npmDir}/package.json`, JSON.stringify(packageJson, null, 2));

    // 4. Copy README
    await Deno.copyFile("README.md", `${npmDir}/README.md`);

    console.log(`Package prepared in ${npmDir}/`);
    console.log("Run 'cd npm && npm publish --access public' to publish.");
}

build();
