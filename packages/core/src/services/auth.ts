import jwt from "jsonwebtoken";
import { db } from "../db/client";
import { randomBytes } from "crypto";

// Helper type for DB access
// deno-lint-ignore no-explicit-any
type DbAny = any;

export class AuthService {
    private secretKey: string | null = null;

    async initialize() {
        if (this.secretKey) return;

        // Try to load secret from DB
        const row = (db.prepare("SELECT value FROM system_config WHERE key = 'jwt_secret'") as unknown as DbAny).get();

        let rawSecret = row?.value;

        if (!rawSecret) {
            // Generate new secret
            rawSecret = randomBytes(64).toString('hex');
            (db.prepare("INSERT INTO system_config (key, value) VALUES ('jwt_secret', ?)") as unknown as DbAny).run(rawSecret);
        }

        this.secretKey = rawSecret;
    }

    async getOrCreateMcpToken(): Promise<string> {
        await this.initialize();
        if (!this.secretKey) throw new Error("Auth not initialized");

        // Check if token exists in DB
        const row = (db.prepare("SELECT value FROM system_config WHERE key = 'mcp_token'") as unknown as DbAny).get();
        if (row?.value) {
            return row.value;
        }

        // Create new token
        // A system token that has access to everything (conceptually)
        const token = jwt.sign({ sub: "system:mcp", iss: "loghead", role: "admin" }, this.secretKey, { algorithm: "HS512" });

        (db.prepare("INSERT INTO system_config (key, value) VALUES ('mcp_token', ?)") as unknown as DbAny).run(token);

        return token;
    }

    async createStreamToken(streamId: string): Promise<string> {
        await this.initialize();
        if (!this.secretKey) throw new Error("Auth not initialized");

        const token = jwt.sign({ sub: streamId, iss: "loghead" }, this.secretKey, { algorithm: "HS512" });
        return token;
    }

    async verifyToken(token: string): Promise<{ streamId: string } | null> {
        await this.initialize();
        if (!this.secretKey) throw new Error("Auth not initialized");

        try {
            const payload = jwt.verify(token, this.secretKey, { issuer: "loghead", algorithms: ["HS512"] }) as jwt.JwtPayload;
            if (!payload.sub) return null;
            return { streamId: payload.sub };
        } catch (e) {
            console.error("Token verification failed:", e);
            return null;
        }
    }
}
