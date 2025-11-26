import { db } from "../db/client";
import { OllamaService } from "./ollama";
import { AuthService } from "./auth";
import { Project, Stream, Log, SearchResult } from "../types";
import { randomUUID } from "crypto";

const ollama = new OllamaService();
const auth = new AuthService();

// Helper to cast DB results to avoid no-explicit-any
// deno-lint-ignore no-explicit-any
type DbAny = any;

export class DbService {
    createProject(name: string): Project {
        const id = randomUUID();
        (db.prepare("INSERT INTO projects (id, name) VALUES (?, ?)") as unknown as DbAny).run(id, name);
        return this.getProject(id);
    }

    getProject(id: string): Project {
        return (db.prepare("SELECT * FROM projects WHERE id = ?") as unknown as DbAny).get(id);
    }

    deleteProject(id: string): boolean {
        (db.prepare("DELETE FROM projects WHERE id = ?") as unknown as DbAny).run(id);
        return true;
    }

    listProjects(): Project[] {
        try {
            const projects = (db.prepare("SELECT * FROM projects ORDER BY created_at DESC") as unknown as DbAny).all();
            return projects.map((p: Project) => {
                const streams = (db.prepare("SELECT * FROM data_streams WHERE project_id = ?") as unknown as DbAny).all(p.id);
                return { ...p, streams };
            });
        } catch (e) {
            console.error("Error in listProjects:", e);
            throw e;
        }
    }

    async createStream(projectId: string, type: string, name: string, config: Record<string, unknown> = {}): Promise<Stream & { token: string }> {
        const id = randomUUID();
        (db.prepare("INSERT INTO data_streams (id, project_id, type, name, config) VALUES (?, ?, ?, ?, ?)") as unknown as DbAny).run(
            id, projectId, type, name, JSON.stringify(config)
        );

        const token = await auth.createStreamToken(id);
        const stream = this.getStream(id);

        return { ...stream, token };
    }

    getStream(id: string): Stream {
        const stream = (db.prepare("SELECT * FROM data_streams WHERE id = ?") as unknown as DbAny).get(id);
        if (stream && typeof stream.config === "string") {
            try { stream.config = JSON.parse(stream.config); } catch { /* ignore */ }
        }
        return stream;
    }

    deleteStream(id: string): boolean {
        (db.prepare("DELETE FROM data_streams WHERE id = ?") as unknown as DbAny).run(id);
        return true;
    }

    listStreams(projectId: string): Stream[] {
        const streams = (db.prepare("SELECT * FROM data_streams WHERE project_id = ? ORDER BY created_at DESC") as unknown as DbAny).all(projectId);
        return streams.map((s: Stream) => {
            if (typeof s.config === "string") try { s.config = JSON.parse(s.config); } catch { /* ignore */ }
            return s;
        });
    }

    async addLog(streamId: string, content: string, metadata: Record<string, unknown> = {}): Promise<{ id: string }> {
        // Generate embedding
        let embedding: number[] | null = null;
        try {
            embedding = await ollama.generateEmbedding(content);
        } catch (_e) {
            // console.warn("Embedding failed", _e);
        }

        const id = randomUUID();
        const metadataStr = JSON.stringify(metadata);

        // Manual Transaction
        const insertTx = db.transaction(() => {
            // 1. Insert into logs
            const info = (db.prepare("INSERT INTO logs (id, stream_id, content, metadata) VALUES (?, ?, ?, ?)") as unknown as DbAny).run(
                id, streamId, content, metadataStr
            );

            // 2. Get rowid directly
            const rowid = info.lastInsertRowid;

            // 3. Insert into vec_logs if embedding exists
            if (embedding && embedding.length > 0) {
                if (embedding.length !== 1024) {
                    console.warn(`[Warning] Embedding dimension mismatch. Expected 1024, got ${embedding.length}. Skipping vector index.`);
                    return;
                }
                const vectorJson = JSON.stringify(embedding);
                // Explicitly cast rowid to BigInt to ensure better-sqlite3 binds it as an INTEGER
                (db.prepare("INSERT INTO vec_logs(rowid, embedding) VALUES (?, ?)") as unknown as DbAny).run(BigInt(rowid), vectorJson);
            }
        });

        try {
            insertTx();
        } catch (e) {
            throw e;
        }

        return { id };
    }

    async searchLogs(streamId: string, query: string, limit = 10): Promise<SearchResult[]> {
        const embedding = await ollama.generateEmbedding(query);
        if (!embedding) return [];

        const vectorJson = JSON.stringify(embedding);

        // KNN Search
        const rows = (db.prepare(`
      SELECT l.content, l.timestamp, l.metadata, v.distance
      FROM vec_logs v
      JOIN logs l ON l.rowid = v.rowid
      WHERE v.embedding MATCH ? AND k = ? AND l.stream_id = ?
      ORDER BY v.distance
    `) as unknown as DbAny).all(vectorJson, limit, streamId);

        return rows.map((row: { content: string; timestamp: string; metadata: string; distance: number }) => {
            let meta: Record<string, unknown> | undefined;
            try { meta = JSON.parse(row.metadata); } catch { /* ignore */ }
            return {
                content: row.content,
                timestamp: row.timestamp,
                similarity: 1 - row.distance, // Rough approx
                metadata: (meta && Object.keys(meta).length > 0) ? meta : undefined
            };
        });
    }

    getRecentLogs(streamId: string, limit = 50, offset = 0): Log[] {
        const rows = (db.prepare(`
      SELECT content, timestamp, metadata FROM logs
      WHERE stream_id = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `) as unknown as DbAny).all(streamId, limit, offset);

        return rows.map((row: Log) => {
            let meta = row.metadata;
            if (typeof meta === "string") {
                try { meta = JSON.parse(meta); } catch { /* ignore */ }
            }
            return {
                id: row.id, // Ensure id is included if needed, or update Log type
                stream_id: streamId,
                content: row.content,
                timestamp: row.timestamp,
                metadata: (typeof meta === "object" && meta && Object.keys(meta).length > 0) ? meta : {}
            } as Log;
        });
    }

    close() {
        db.close();
    }
}

