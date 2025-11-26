"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrate = migrate;
const client_1 = require("./client");
function migrate(verbose = true) {
    if (verbose)
        console.log("Running migrations...");
    // Enable foreign keys
    client_1.db.exec("PRAGMA foreign_keys = ON;");
    // System Config table (for secrets, etc.)
    client_1.db.exec(`
    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
    // Projects table
    client_1.db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
    // Data Streams table
    client_1.db.exec(`
    CREATE TABLE IF NOT EXISTS data_streams (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      config TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
    // Logs table
    client_1.db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      stream_id TEXT,
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT DEFAULT '{}',
      FOREIGN KEY(stream_id) REFERENCES data_streams(id) ON DELETE CASCADE
    );
  `);
    // Vector table (using sqlite-vec)
    // Assuming 1024 dimensions for qwen3-embedding:0.6b (check actual dim)
    // qwen2.5-0.5b is 1536?
    // qwen-embedding-0.6b might be 384 or 1024?
    // Let's assume 1024 as per previous code.
    try {
        client_1.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_logs USING vec0(
        embedding float[1024]
      );
    `);
    }
    catch (e) {
        console.warn("Failed to create virtual vector table. Is sqlite-vec loaded?", e);
    }
    if (verbose)
        console.log("Migrations complete.");
}
