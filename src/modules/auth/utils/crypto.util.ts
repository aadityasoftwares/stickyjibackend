import crypto from "node:crypto";

export class CryptoUtil {
    static hashToken(token: string): string {
        return crypto.createHash("sha256").update(token).digest("hex");
    }

    static generateToken(length = 32): string {
        return crypto.randomBytes(length).toString("hex");
    }
}
