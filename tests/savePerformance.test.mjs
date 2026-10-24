import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { test } from "node:test";
import express from "express";
import {
    savePerformanceMiddleware,
    savePerformanceModule,
    monitorSaveCommands,
    measureSaveStage,
    measureSaveSync,
} from "../src/utils/savePerformance.util.ts";

test("timing isolates concurrent requests, counts failures and excludes sensitive data", async () => {
    const keys = ["SAVE_PERFORMANCE_ENABLED", "SAVE_PERFORMANCE_SAMPLE_RATE", "SAVE_PERFORMANCE_SLOW_MS"];
    const previous = keys.map((key) => process.env[key]);
    const records = [];
    const originalInfo = console.info;
    keys.forEach((key, index) => {
        process.env[key] = ["true", "1", "0"][index];
    });
    console.info = (tag, value) => {
        if (tag === "[SavePerformance]") records.push(JSON.parse(value));
    };
    const client = new EventEmitter();
    monitorSaveCommands(client);
    monitorSaveCommands(client);
    assert.equal(client.listenerCount("commandStarted"), 1);
    let commandId = 0;
    const app = express();
    app.use(savePerformanceMiddleware, savePerformanceModule("test"), express.json());
    app.post("/save/:id", async (req, res) => {
        measureSaveSync("validation", () => assert.ok(req.body.secret));
        await measureSaveStage("business", async () => {
            const requestId = ++commandId;
            client.emit("commandStarted", { requestId, command: { secret: req.body.secret } });
            await new Promise((resolve) => setTimeout(resolve, 10));
            client.emit(req.params.id === "failed" ? "commandFailed" : "commandSucceeded", {
                requestId,
                duration: 5,
                commandName: "update",
                reply: { secret: req.body.secret },
            });
        });
        res.json({ saved: true });
    });
    const server = app.listen(0, "127.0.0.1");
    try {
        await once(server, "listening");
        const url = `http://127.0.0.1:${server.address().port}`;
        const request = async (id) => {
            const response = await fetch(`${url}/save/${id}?token=secret-query`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ secret: "private-body" }),
            });
            assert.deepEqual(await response.json(), { saved: true });
        };
        await Promise.all([request("private-id"), request("failed")]);
        assert.equal(records.length, 2);
        for (const record of records) {
            assert.equal(record.route, "/save/:id");
            assert.equal(record.module, "test");
            assert.equal(record.commands, 1);
            assert.equal(record.databaseMs, 5);
            assert.ok(record.stages.validation >= 0);
            assert.ok(record.stages.business >= 0);
            assert.ok(record.stages.response >= 0);
        }
        assert.doesNotMatch(JSON.stringify(records), /private-id|private-body|secret-query/);
        process.env.SAVE_PERFORMANCE_ENABLED = "false";
        await request("disabled");
        assert.equal(records.length, 2);
    } finally {
        console.info = originalInfo;
        keys.forEach((key, index) => {
            if (previous[index] === undefined) delete process.env[key];
            else process.env[key] = previous[index];
        });
        await new Promise((resolve) => server.close(resolve));
    }
});
