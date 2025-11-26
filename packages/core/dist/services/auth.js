"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("../db/client");
const crypto_1 = require("crypto");
class AuthService {
    secretKey = null;
    async initialize() {
        if (this.secretKey)
            return;
        // Try to load secret from DB
        const row = client_1.db.prepare("SELECT value FROM system_config WHERE key = 'jwt_secret'").get();
        let rawSecret = row?.value;
        if (!rawSecret) {
            // Generate new secret
            rawSecret = (0, crypto_1.randomBytes)(64).toString('hex');
            client_1.db.prepare("INSERT INTO system_config (key, value) VALUES ('jwt_secret', ?)").run(rawSecret);
        }
        this.secretKey = rawSecret;
    }
    async getOrCreateMcpToken() {
        await this.initialize();
        if (!this.secretKey)
            throw new Error("Auth not initialized");
        // Check if token exists in DB
        const row = client_1.db.prepare("SELECT value FROM system_config WHERE key = 'mcp_token'").get();
        if (row?.value) {
            return row.value;
        }
        // Create new token
        // A system token that has access to everything (conceptually)
        const token = jsonwebtoken_1.default.sign({ sub: "system:mcp", iss: "loghead", role: "admin" }, this.secretKey, { algorithm: "HS512" });
        client_1.db.prepare("INSERT INTO system_config (key, value) VALUES ('mcp_token', ?)").run(token);
        return token;
    }
    async createStreamToken(streamId) {
        await this.initialize();
        if (!this.secretKey)
            throw new Error("Auth not initialized");
        const token = jsonwebtoken_1.default.sign({ sub: streamId, iss: "loghead" }, this.secretKey, { algorithm: "HS512" });
        return token;
    }
    async verifyToken(token) {
        await this.initialize();
        if (!this.secretKey)
            throw new Error("Auth not initialized");
        try {
            const payload = jsonwebtoken_1.default.verify(token, this.secretKey, { issuer: "loghead", algorithms: ["HS512"] });
            if (!payload.sub)
                return null;
            return { streamId: payload.sub };
        }
        catch (e) {
            console.error("Token verification failed:", e);
            return null;
        }
    }
}
exports.AuthService = AuthService;
