import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import cors from "cors";
import { createCorsOptions, getAllowedOrigins } from "../src/config/cors.config.ts";
import { createR2CorsRule, mergeR2CorsRules } from "../src/config/r2Cors.config.ts";

test("development origins include localhost alongside configured frontend origins", () => {
    assert.deepEqual(
        getAllowedOrigins({
            NODE_ENV: "development",
            CLIENT_URL: "https://app.example.com/",
            CORS_ALLOWED_ORIGINS: " http://localhost:5173,https://app.example.com ",
        }),
        [
            "https://app.example.com",
            "http://localhost:5173",
            "http://localhost:4200",
            "http://127.0.0.1:4200",
        ],
    );
    assert.deepEqual(getAllowedOrigins({ NODE_ENV: "production", CLIENT_URL: "https://app.example.com" }), [
        "https://app.example.com",
    ]);
    assert.deepEqual(getAllowedOrigins({ NODE_ENV: "production" }), []);
    for (const origin of [
        "*",
        "null",
        "https://*.example.com",
        "https://example.com/path",
        "https://user:password@example.com",
    ]) {
        assert.throws(() => getAllowedOrigins({ CLIENT_URL: origin }));
    }
});

test("API preflight permits local development and configured production origins only", async (t) => {
    const app = express();
    app.use(cors(createCorsOptions({ NODE_ENV: "development", CLIENT_URL: "https://app.example.com" })));
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const url = `http://127.0.0.1:${server.address().port}/upload`;
    for (const origin of [
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "https://app.example.com",
        "https://untrusted.example",
        "http://localhost:4200.evil.example",
    ]) {
        const response = await fetch(url, {
            method: "OPTIONS",
            headers: {
                Origin: origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type,authorization",
            },
        });
        const allowed = [
            "http://localhost:4200",
            "http://127.0.0.1:4200",
            "https://app.example.com",
        ].includes(origin);
        assert.equal(response.headers.get("access-control-allow-origin"), allowed ? origin : null);
        if (allowed) {
            assert.equal(response.status, 204);
            assert.equal(response.headers.get("access-control-allow-credentials"), "true");
            assert.match(response.headers.get("access-control-allow-headers"), /Authorization/);
        }
    }
});

test("R2 policy allows signed conditional uploads and preserves unrelated bucket rules", () => {
    const rule = createR2CorsRule({ NODE_ENV: "development" });
    assert.ok(rule.AllowedOrigins.includes("http://localhost:4200"));
    assert.ok(rule.AllowedMethods.includes("PUT"));
    assert.ok(rule.AllowedHeaders.includes("Content-Type"));
    assert.ok(rule.AllowedHeaders.includes("If-None-Match"));
    const existing = {
        ID: "production",
        AllowedOrigins: ["https://app.example.com"],
        AllowedMethods: ["GET"],
    };
    const merged = mergeR2CorsRules([existing], rule);
    assert.deepEqual(merged, [rule, existing]);
    assert.deepEqual(mergeR2CorsRules(merged, rule), merged);
    assert.throws(() => createR2CorsRule({ NODE_ENV: "production" }));
});
