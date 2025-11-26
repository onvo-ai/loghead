"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbService = void 0;
const client_1 = require("../db/client");
const ollama_1 = require("./ollama");
const auth_1 = require("./auth");
const crypto_1 = require("crypto");
const ollama = new ollama_1.OllamaService();
const auth = new auth_1.AuthService();
class DbService {
    createProject(name) {
        const id = (0, crypto_1.randomUUID)();
        client_1.db.prepare("INSERT INTO projects (id, name) VALUES (?, ?)").run(id, name);
        return this.getProject(id);
    }
    getProject(id) {
        return client_1.db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
    }
    deleteProject(id) {
        client_1.db.prepare("DELETE FROM projects WHERE id = ?").run(id);
        return true;
    }
    listProjects() {
        console.error("Listing projects...");
        try {
            const projects = client_1.db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
            console.error(`Found ${projects.length} projects.`);
            return projects.map((p) => {
                const streams = client_1.db.prepare("SELECT * FROM data_streams WHERE project_id = ?").all(p.id);
                return { ...p, streams };
            });
        }
        catch (e) {
            console.error("Error in listProjects:", e);
            throw e;
        }
    }
    async createStream(projectId, type, name, config = {}) {
        const id = (0, crypto_1.randomUUID)();
        client_1.db.prepare("INSERT INTO data_streams (id, project_id, type, name, config) VALUES (?, ?, ?, ?, ?)").run(id, projectId, type, name, JSON.stringify(config));
        const token = await auth.createStreamToken(id);
        const stream = this.getStream(id);
        return { ...stream, token };
    }
    getStream(id) {
        const stream = client_1.db.prepare("SELECT * FROM data_streams WHERE id = ?").get(id);
        if (stream && typeof stream.config === "string") {
            try {
                stream.config = JSON.parse(stream.config);
            }
            catch { /* ignore */ }
        }
        return stream;
    }
    deleteStream(id) {
        client_1.db.prepare("DELETE FROM data_streams WHERE id = ?").run(id);
        return true;
    }
    listStreams(projectId) {
        const streams = client_1.db.prepare("SELECT * FROM data_streams WHERE project_id = ? ORDER BY created_at DESC").all(projectId);
        return streams.map((s) => {
            if (typeof s.config === "string")
                try {
                    s.config = JSON.parse(s.config);
                }
                catch { /* ignore */ }
            return s;
        });
    }
    async addLog(streamId, content, metadata = {}) {
        // Generate embedding
        let embedding = null;
        try {
            embedding = await ollama.generateEmbedding(content);
        }
        catch (_e) {
            // console.warn("Embedding failed", _e);
        }
        const id = (0, crypto_1.randomUUID)();
        const metadataStr = JSON.stringify(metadata);
        // Manual Transaction
        const insertTx = client_1.db.transaction(() => {
            // 1. Insert into logs
            client_1.db.prepare("INSERT INTO logs (id, stream_id, content, metadata) VALUES (?, ?, ?, ?)").run(id, streamId, content, metadataStr);
            // 2. Get rowid
            const rowInfo = client_1.db.prepare("SELECT last_insert_rowid() as rowid").get();
            const rowid = rowInfo.rowid;
            // 3. Insert into vec_logs if embedding exists
            if (embedding && embedding.length > 0) {
                const vectorJson = JSON.stringify(embedding);
                client_1.db.prepare("INSERT INTO vec_logs(rowid, embedding) VALUES (?, ?)").run(rowid, vectorJson);
            }
        });
        try {
            insertTx();
        }
        catch (e) {
            throw e;
        }
        return { id };
    }
    async searchLogs(streamId, query, limit = 10) {
        const embedding = await ollama.generateEmbedding(query);
        if (!embedding)
            return [];
        const vectorJson = JSON.stringify(embedding);
        // KNN Search
        const rows = client_1.db.prepare(`
      SELECT l.content, l.timestamp, l.metadata, v.distance
      FROM vec_logs v
      JOIN logs l ON l.rowid = v.rowid
      WHERE v.embedding MATCH ? AND k = ? AND l.stream_id = ?
      ORDER BY v.distance
    `).all(vectorJson, limit, streamId);
        return rows.map((row) => {
            let meta;
            try {
                meta = JSON.parse(row.metadata);
            }
            catch { /* ignore */ }
            return {
                content: row.content,
                timestamp: row.timestamp,
                similarity: 1 - row.distance, // Rough approx
                metadata: (meta && Object.keys(meta).length > 0) ? meta : undefined
            };
        });
    }
    getRecentLogs(streamId, limit = 50) {
        const rows = client_1.db.prepare(`
      SELECT content, timestamp, metadata FROM logs
      WHERE stream_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(streamId, limit);
        return rows.map((row) => {
            let meta = row.metadata;
            if (typeof meta === "string") {
                try {
                    meta = JSON.parse(meta);
                }
                catch { /* ignore */ }
            }
            return {
                id: row.id, // Ensure id is included if needed, or update Log type
                stream_id: streamId,
                content: row.content,
                timestamp: row.timestamp,
                metadata: (typeof meta === "object" && meta && Object.keys(meta).length > 0) ? meta : {}
            };
        });
    }
    close() {
        client_1.db.close();
    }
}
exports.DbService = DbService;
