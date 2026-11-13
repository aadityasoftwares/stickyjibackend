import type { CorsOptions } from "cors";

export function getAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
    const origins = [env.CLIENT_URL, env.CORS_ALLOWED_ORIGINS]
        .flatMap((value) => value?.split(",") ?? [])
        .map((value) => value.trim())
        .filter(Boolean);

    if (!env.NODE_ENV || env.NODE_ENV === "development" || env.NODE_ENV === "test") {
        origins.push("http://localhost:4200", "http://127.0.0.1:4200");
    }

    return [
        ...new Set(
            origins.map((origin) => {
                const url = new URL(origin);
                if (
                    !["http:", "https:"].includes(url.protocol) ||
                    url.username ||
                    url.password ||
                    url.pathname !== "/" ||
                    url.search ||
                    url.hash ||
                    url.hostname.includes("*")
                ) {
                    throw new Error("CORS origins must be exact HTTP(S) origins without paths or wildcards.");
                }
                return url.origin;
            }),
        ),
    ];
}

export function createCorsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
    return {
        origin: getAllowedOrigins(env),
        methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    };
}
