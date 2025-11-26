import { create, verify } from "djwt";
import { db } from "../db/client.ts";

// Helper type for DB access
// deno-lint-ignore no-explicit-any
type DbAny = any;

export class AuthService {
    private secretKey: CryptoKey | null = null;

    async initialize() {
        if (this.secretKey) return;

        // Try to load secret from DB
        const row = (db.prepare("SELECT value FROM system_config WHERE key = 'jwt_secret'") as unknown as DbAny).get();

        let rawSecret = row?.value;

        if (!rawSecret) {
            // Generate new secret
            const key = await crypto.subtle.generateKey(
                { name: "HMAC", hash: "SHA-512" },
                true,
                ["sign", "verify"],
            );
            const exported = await crypto.subtle.exportKey("jwk", key);
            rawSecret = JSON.stringify(exported);

            (db.prepare("INSERT INTO system_config (key, value) VALUES ('jwt_secret', ?)") as unknown as DbAny).run(rawSecret);
        }

        const jwk = JSON.parse(rawSecret);
        this.secretKey = await crypto.subtle.importKey(
            "jwk",
            jwk,
            { name: "HMAC", hash: "SHA-512" },
            true,
            ["sign", "verify"]
        );
    }

    async createStreamToken(streamId: string): Promise<string> {
        await this.initialize();
        if (!this.secretKey) throw new Error("Auth not initialized");

        const jwt = await create({ alg: "HS512", type: "JWT" }, {
            sub: streamId,
            iss: "loghead",
            // No expiration for stream tokens for now, or make it very long lived
            // exp: getNumericDate(60 * 60 * 24 * 365), // 1 year
        }, this.secretKey);

        return jwt;
    }

    async verifyToken(token: string): Promise<{ streamId: string } | null> {
        await this.initialize();
        if (!this.secretKey) throw new Error("Auth not initialized");

        try {
            const payload = await verify(token, this.secretKey);
            if (payload.iss !== "loghead" || !payload.sub) return null;
            return { streamId: payload.sub };
        } catch (e) {
            console.error("Token verification failed:", e);
            return null;
        }
    }
}
