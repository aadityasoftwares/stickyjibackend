import { R2_CONFIG } from "../../../config/cloudflareR2.config.js";

/**
 * Builds or normalizes a public media URL using the configured public domain (e.g. https://media.stickyji.com).
 * - Appends storageKey to the public base URL
 * - Upgrades/normalizes legacy URLs (e.g. aadityasoftwares.fun) to the new domain
 */
export function buildMediaUrl(storageKey?: string | null, existingUrl?: string | null): string | null {
    const baseUrl = (process.env.CLOUDFLARE_R2_PUBLIC_URL?.trim() || R2_CONFIG.PUBLIC_URL || "https://media.stickyji.com").replace(/\/$/, "");

    if (storageKey && typeof storageKey === "string" && storageKey.trim().length > 0) {
        const cleanKey = storageKey.trim().replace(/^\/+/, "");
        return `${baseUrl}/${cleanKey}`;
    }

    if (existingUrl && typeof existingUrl === "string" && existingUrl.trim().length > 0) {
        const trimmed = existingUrl.trim();
        if (trimmed.includes("aadityasoftwares.fun")) {
            return trimmed.replace(/^https?:\/\/aadityasoftwares\.fun/, baseUrl);
        }
        return trimmed;
    }

    return null;
}

