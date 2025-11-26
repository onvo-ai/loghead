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
    const binarySource = "./packages/core/build/loghead";
    try {
        await Deno.stat(binarySource);
    } catch {
        console.error("Binary not found at ./packages/core/build/loghead. Please run 'deno task build' in packages/core/ first.");
        Deno.exit(1);
    }

    const binaryDest = `${binDir}/loghead`;
    await Deno.copyFile(binarySource, binaryDest);
    // Ensure executable
    await Deno.chmod(binaryDest, 0o755);

    // 3. Create package.json
    const packageJson = {
        name: "@loghead/core",
        version: "0.1.0",
        description: "Smart log aggregation tool and MCP server",
        bin: {
            "loghead": "./bin/loghead"
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
        publishConfig: { "access": "public" },
        repository: {
            type: "git",
            url: "git+https://github.com/onvo-ai/loghead.git"
        },
        bugs: {
            url: "https://github.com/onvo-ai/loghead/issues"
        }
    };

    await Deno.writeTextFile(`${npmDir}/package.json`, JSON.stringify(packageJson, null, 2));

    // 4. Copy README
    await Deno.copyFile("README.md", `${npmDir}/README.md`);

    console.log(`Package prepared in ${npmDir}/`);
    console.log("Run 'cd npm && npm publish --access public' to publish.");
}

build();
