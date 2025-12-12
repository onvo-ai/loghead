import express from "express";
import cors from "cors";
import { DbService } from "../services/db";
import { AuthService } from "../services/auth";
import chalk from "chalk";

const auth = new AuthService();

export async function startApiServer(db: DbService) {
    const app = express();
    const port = process.env.PORT || 4567;

    app.use(cors());
    app.use(express.json());

    await auth.initialize();

    console.log(chalk.bold.green(`\n💻 API server running on:`));
    console.log(chalk.green(`http://localhost:${port}`));

    // Helper to parse OTLP attributes
    const parseOtlpAttributes = (attributes: any[]) => {
        if (!Array.isArray(attributes)) return {};
        const result: Record<string, any> = {};
        for (const attr of attributes) {
            if (attr.key && attr.value) {
                // Extract value based on type (stringValue, intValue, boolValue, etc.)
                const val = attr.value;
                if (val.stringValue !== undefined) result[attr.key] = val.stringValue;
                else if (val.intValue !== undefined) result[attr.key] = parseInt(val.intValue);
                else if (val.doubleValue !== undefined) result[attr.key] = val.doubleValue;
                else if (val.boolValue !== undefined) result[attr.key] = val.boolValue;
                else if (val.arrayValue !== undefined) result[attr.key] = val.arrayValue; // Simplified
                else if (val.kvlistValue !== undefined) result[attr.key] = val.kvlistValue; // Simplified
                else result[attr.key] = val;
            }
        }
        return result;
    };

    // OTLP Logs Ingestion Endpoint
    app.post("/v1/logs", async (req, res) => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return res.status(401).json({ code: 16, message: "Unauthenticated" });
            }
            const token = authHeader.split(" ")[1];
            const payload = await auth.verifyToken(token);
            if (!payload || !payload.streamId) {
                return res.status(401).json({ code: 16, message: "Invalid token" });
            }

            const streamId = payload.streamId;
            const { resourceLogs } = req.body;

            if (!resourceLogs || !Array.isArray(resourceLogs)) {
                return res.status(400).json({ code: 3, message: "Invalid payload" });
            }

            let count = 0;

            for (const resourceLog of resourceLogs) {
                const resourceAttrs = parseOtlpAttributes(resourceLog.resource?.attributes);

                if (resourceLog.scopeLogs) {
                    for (const scopeLog of resourceLog.scopeLogs) {
                        const scopeName = scopeLog.scope?.name;

                        if (scopeLog.logRecords) {
                            for (const log of scopeLog.logRecords) {
                                let content = "";
                                if (log.body?.stringValue) content = log.body.stringValue;
                                else if (log.body?.kvlistValue) content = JSON.stringify(log.body.kvlistValue);
                                else if (typeof log.body === 'string') content = log.body; // Fallback

                                const logAttrs = parseOtlpAttributes(log.attributes);

                                // Merge attributes: Resource > Scope (if any) > Log
                                const metadata = {
                                    ...resourceAttrs,
                                    ...logAttrs,
                                    severity: log.severityText || log.severityNumber,
                                    scope: scopeName,
                                    timestamp: log.timeUnixNano
                                };

                                if (content) {
                                    await db.addLog(streamId, content, metadata);
                                    count++;
                                }
                            }
                        }
                    }
                }
            }

            res.json({ partialSuccess: {}, logsIngested: count });
        } catch (e) {
            console.error("OTLP Ingest error:", e);
            res.status(500).json({ code: 13, message: String(e) });
        }
    });

    app.post("/api/ingest", async (req, res) => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return res.status(401).send("Unauthorized: Missing token");
            }
            const token = authHeader.split(" ")[1];
            const payload = await auth.verifyToken(token);
            if (!payload || !payload.streamId) {
                return res.status(401).send("Unauthorized: Invalid token");
            }

            const { streamId, logs } = req.body;

            if (streamId !== payload.streamId) {
                return res.status(403).send("Forbidden: Token does not match streamId");
            }

            if (!logs) {
                return res.status(400).send("Missing logs");
            }

            const logEntries = Array.isArray(logs) ? logs : [logs];

            for (const log of logEntries) {
                let content = "";
                let metadata = {};

                if (typeof log === "string") {
                    content = log;
                } else if (typeof log === "object") {
                    content = log.content || JSON.stringify(log);
                    metadata = log.metadata || {};
                }

                if (content) {
                    await db.addLog(streamId, content, metadata);
                }
            }

            res.json({ success: true, count: logEntries.length });
        } catch (e) {
            console.error("Ingest error:", e);
            res.status(500).json({ error: String(e) });
        }
    });

    app.get("/api/projects", (req, res) => {
        const projects = db.listProjects();
        res.json(projects);
    });

    app.post("/api/projects", (req, res) => {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: "Name required" });
        const project = db.createProject(name);
        res.json(project);
    });

    app.delete("/api/projects/:id", (req, res) => {
        const { id } = req.params;
        db.deleteProject(id);
        res.json({ success: true });
    });

    app.get("/api/streams", (req, res) => {
        const projectId = req.query.projectId as string;
        if (projectId) {
            const streams = db.listStreams(projectId);
            res.json(streams);
        } else {
            res.status(400).send("Missing projectId");
        }
    });

    app.delete("/api/streams/:id", (req, res) => {
        const { id } = req.params;
        db.deleteStream(id);
        res.json({ success: true });
    });

    app.get("/api/streams/:id/token", async (req, res) => {
        const { id } = req.params;
        try {
            const token = await auth.createStreamToken(id);
            res.json({ token });
        } catch (e) {
            res.status(500).json({ error: String(e) });
        }
    });

    app.post("/api/streams", (req, res) => {
        // Deprecated or just listing? The previous code had this returning listStreams for POST?
        // I'll remove it or keep it if CLI uses it?
        // CLI uses db directly.
        // MCP uses GET /api/streams
        // I'll replace this with the actual CREATE logic to be RESTful, or keep /create
        const projectId = req.body.projectId;
        if (projectId) {
            const streams = db.listStreams(projectId);
            res.json(streams);
        } else {
            res.status(400).send("Missing projectId");
        }
    });

    app.post("/api/streams/create", async (req, res) => {
        const body = req.body;
        const stream = await db.createStream(body.projectId, body.type, body.name, body.config || {});
        res.json(stream);
    });

    app.get("/api/logs", async (req, res) => {
        const streamId = req.query.streamId as string;
        if (!streamId) {
            return res.status(400).send("Missing streamId");
        }

        let page = parseInt((req.query.page as string) || "1");
        if (page < 1) page = 1;

        let pageSize = parseInt((req.query.pageSize as string) || "100");
        let limit = req.query.limit ? parseInt(req.query.limit as string) : pageSize;

        // Enforce max limit
        if (limit > 1000) limit = 1000;

        const offset = (page - 1) * limit;

        const query = req.query.q as string;

        let logs;
        if (query) {
            logs = await db.searchLogs(streamId, query, limit);
        } else {
            logs = db.getRecentLogs(streamId, limit, offset);
        }
        res.json(logs);
    });

    app.listen(port, () => {
        // listening
    });
}
