import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import type { RequestHandler } from "express";
import type { mongo } from "mongoose";

interface SaveTiming {
    module?: string;
    stages: Record<string, number>;
    databaseMs: number;
    commands: number;
    slowestCommandMs: number;
    slowestCommand?: string;
    closed: boolean;
}

const timings = new AsyncLocalStorage<SaveTiming>();
const monitoredClients = new WeakSet<mongo.MongoClient>();
export const savePerformanceEnabled = () => process.env.SAVE_PERFORMANCE_ENABLED === "true";

/** Supply only a server-defined mount path, never a request value. */
export function savePerformanceModule(module: string): RequestHandler {
    return (_req, _res, next) => {
        const state = timings.getStore();
        if (state) state.module = module;
        next();
    };
}

function addStage(state: SaveTiming, stage: string, start: number) {
    state.stages[stage] = (state.stages[stage] ?? 0) + performance.now() - start;
}

export function measureSaveSync<T>(stage: string, operation: () => T): T {
    const state = timings.getStore();
    if (!state) return operation();
    const start = performance.now();
    try {
        return operation();
    } finally {
        addStage(state, stage, start);
    }
}

export async function measureSaveStage<T>(stage: string, operation: () => Promise<T>): Promise<T> {
    const state = timings.getStore();
    if (!state) return operation();
    const start = performance.now();
    try {
        return await operation();
    } finally {
        addStage(state, stage, start);
    }
}

/** Only sampled request commands are retained; query bodies and results are never inspected. */
export function monitorSaveCommands(client: mongo.MongoClient): void {
    if (monitoredClients.has(client)) return;
    monitoredClients.add(client);
    const pending = new Map<number, SaveTiming>();
    client.on("commandStarted", (event) => {
        const state = timings.getStore();
        if (state && !state.closed) pending.set(event.requestId, state);
    });
    const complete = (event: mongo.CommandSucceededEvent | mongo.CommandFailedEvent) => {
        const state = pending.get(event.requestId);
        pending.delete(event.requestId);
        if (!state || state.closed) return;
        state.commands++;
        state.databaseMs += event.duration;
        if (event.duration > state.slowestCommandMs) {
            state.slowestCommandMs = event.duration;
            state.slowestCommand = event.commandName;
        }
    };
    client.on("commandSucceeded", complete);
    client.on("commandFailed", complete);
}

/** Disabled by default. One bounded, value-free record per sampled slow request. */
export const savePerformanceMiddleware: RequestHandler = (req, res, next) => {
    if (!savePerformanceEnabled() || !["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
        return next();
    }
    const configuredRate = Number(process.env.SAVE_PERFORMANCE_SAMPLE_RATE ?? 0.01);
    const rate = Number.isFinite(configuredRate) ? Math.max(0, Math.min(1, configuredRate)) : 0.01;
    if (Math.random() >= rate) return next();
    const start = performance.now();
    const state: SaveTiming = {
        stages: {},
        databaseMs: 0,
        commands: 0,
        slowestCommandMs: 0,
        closed: false,
    };
    const json = res.json;
    res.json = function (body) {
        const responseStart = performance.now();
        try {
            return json.call(this, body);
        } finally {
            addStage(state, "response", responseStart);
        }
    };
    const finish = () => {
        if (state.closed) return;
        state.closed = true;
        const totalMs = performance.now() - start;
        const configuredThreshold = Number(process.env.SAVE_PERFORMANCE_SLOW_MS ?? 250);
        const threshold = Number.isFinite(configuredThreshold) ? Math.max(0, configuredThreshold) : 250;
        if (totalMs < threshold) return;
        const round = (value: number) => Math.round(value * 100) / 100;
        console.info(
            "[SavePerformance]",
            JSON.stringify({
                method: req.method,
                module: state.module,
                // Route templates only: never URLs, IDs, query strings, headers or bodies.
                route: typeof req.route?.path === "string" ? req.route.path : "unmatched",
                status: res.statusCode,
                totalMs: round(totalMs),
                databaseMs: round(state.databaseMs),
                commands: state.commands,
                slowestCommand: state.slowestCommand,
                slowestCommandMs: round(state.slowestCommandMs),
                stages: Object.fromEntries(
                    Object.entries(state.stages).map(([key, value]) => [key, round(value)]),
                ),
            }),
        );
    };
    res.once("finish", finish);
    res.once("close", finish);
    timings.run(state, next);
};
