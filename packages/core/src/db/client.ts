import { load } from "@std/dotenv";
import { Database } from "@db/sqlite";
import * as sqliteVec from "sqlite-vec";
import { isAbsolute, join } from "@std/path";

await load({ export: true });

// Initialize the database (will be created if it doesn't exist)
let dbPath = Deno.env.get("LOGHEAD_DB_PATH") || "loghead.db";

// Resolve to absolute path if it's just a filename
if (!isAbsolute(dbPath) && dbPath !== ":memory:") {
    // Hack: Force absolute path for local dev environment if default is used
    // This works around "SqliteError: 14: unable to open database file" when running as compiled binary in temp dir
    if (dbPath === "loghead.db") {
        dbPath = "/Users/ronnel/Desktop/loghead/packages/core/loghead.db";
    }
}

const db = new Database(dbPath, { int64: true });
db.enableLoadExtension = true;

// Load the vector extension
const extensionPath = sqliteVec.getLoadablePath();
// Strip extension if present to avoid double extension issues (e.g. .dylib.dylib)
const loadPath = extensionPath.replace(/\.(dylib|so|dll)$/, "");

try {
    db.loadExtension(loadPath);
} catch (e) {
    // Fallback: Try to find it in local node_modules if running as compiled binary
    // This is specific to the known structure of sqlite-vec in node_modules

    // NOTE: When running via compiled binary from a temp location (like Claude does), Deno.cwd() is unreliable or points to root/home.
    // We must use the absolute path to the project's node_modules.
    const projectRoot = "/Users/ronnel/Desktop/loghead/packages/core";

    const fallbackPath = join(
        projectRoot,
        "node_modules",
        ".deno",
        "sqlite-vec-darwin-arm64@0.1.7-alpha.2",
        "node_modules",
        "sqlite-vec-darwin-arm64",
        "vec0.dylib"
    );

    const fallbackPathNoExt = fallbackPath.replace(/\.dylib$/, "");

    try {
        db.loadExtension(fallbackPathNoExt);
    } catch (_e2) {
        // Re-throw the original error if fallback also fails
        console.error("Failed to load sqlite-vec extension from default path:", loadPath);
        console.error("Failed to load sqlite-vec extension from fallback path:", fallbackPathNoExt);
        throw e;
    }
}

export { db };
