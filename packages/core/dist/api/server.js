"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startApiServer = startApiServer;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = require("../services/auth");
const chalk_1 = __importDefault(require("chalk"));
const auth = new auth_1.AuthService();
async function startApiServer(db) {
    const app = (0, express_1.default)();
    const port = process.env.PORT || 4567;
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    await auth.initialize();
    console.log(chalk_1.default.bold.green(`💻 Server running on:\n`));
    console.log(chalk_1.default.green(`http://localhost:${port}`));
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
                }
                else if (typeof log === "object") {
                    content = log.content || JSON.stringify(log);
                    metadata = log.metadata || {};
                }
                if (content) {
                    await db.addLog(streamId, content, metadata);
                }
            }
            res.json({ success: true, count: logEntries.length });
        }
        catch (e) {
            console.error("Ingest error:", e);
            res.status(500).json({ error: String(e) });
        }
    });
    app.get("/api/projects", (req, res) => {
        const projects = db.listProjects();
        res.json(projects);
    });
    app.post("/api/projects", (req, res) => {
        const projects = db.listProjects();
        res.json(projects);
    });
    app.get("/api/streams", (req, res) => {
        const projectId = req.query.projectId;
        if (projectId) {
            const streams = db.listStreams(projectId);
            res.json(streams);
        }
        else {
            res.status(400).send("Missing projectId");
        }
    });
    app.post("/api/streams", (req, res) => {
        const projectId = req.body.projectId;
        if (projectId) {
            const streams = db.listStreams(projectId);
            res.json(streams);
        }
        else {
            res.status(400).send("Missing projectId");
        }
    });
    app.post("/api/streams/create", async (req, res) => {
        const body = req.body;
        const stream = await db.createStream(body.projectId, body.type, body.name, {});
        res.json(stream);
    });
    app.get("/api/logs", async (req, res) => {
        const streamId = req.query.streamId;
        if (!streamId) {
            return res.status(400).send("Missing streamId");
        }
        const limit = parseInt(req.query.limit || "50");
        const query = req.query.q;
        let logs;
        if (query) {
            logs = await db.searchLogs(streamId, query, limit);
        }
        else {
            logs = db.getRecentLogs(streamId, limit);
        }
        res.json(logs);
    });
    app.listen(port, () => {
        // listening
    });
}
