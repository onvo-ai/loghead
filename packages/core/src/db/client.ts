import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const dbPath = process.env.LOGHEAD_DB_PATH || "loghead.db";
console.log(`[DB] Using database at: ${path.resolve(dbPath)}`);

const db = new Database(dbPath);

// Load sqlite-vec extension
try {
    sqliteVec.load(db);
} catch (e) {
    console.error("Failed to load sqlite-vec extension:", e);
}

export { db };
