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

    console.log(chalk.bold.green(`\n💻 MCP server running on:`));
    console.log(chalk.green(`http://localhost:${port}`));

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
        const limit = parseInt((req.query.limit as string) || "50");
        const query = req.query.q as string;

        let logs;
        if (query) {
            logs = await db.searchLogs(streamId, query, limit);
        } else {
            logs = db.getRecentLogs(streamId, limit);
        }
        res.json(logs);
    });

    app.listen(port, () => {
        // listening
    });
}
