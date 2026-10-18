import assert from "node:assert/strict";
import { after, before, test, mock } from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import mongoose, { Types } from "mongoose";
import express from "express";
import { StickyNoteModel } from "../src/modules/stickynotes/models/stickyNote.model.ts";
import { StickyNoteService } from "../src/modules/stickynotes/services/stickyNote.service.ts";
import { StickyNoteDateService } from "../src/modules/stickynotes/services/stickyNoteDate.service.ts";
import { WorkspaceModel } from "../src/modules/workspace/models/workspace.model.ts";
import { WorkspaceMemberModel } from "../src/modules/workspaceMember/models/workspaceMember.model.ts";
import { StickyNoteColumnModel } from "../src/modules/stickynotescolumns/models/stickyNoteColumn.model.ts";
import { UserPreferenceModel } from "../src/modules/userpreference/models/userPreference.model.ts";
import { AuditLogModel } from "../src/modules/auditlog/models/auditLog.model.ts";
import { AuditLogService } from "../src/modules/auditlog/services/auditLog.service.ts";
process.env.JWT_ACCESS_SECRET = "overdue-integration-test-access-secret";
process.env.JWT_REFRESH_SECRET = "overdue-integration-test-refresh-secret";
const { JwtUtil } = await import("../src/modules/auth/utils/jwt.util.ts");
const { default: routes } = await import("../src/modules/stickynotes/routes/stickyNote.routes.ts");

// Isolated, disposable replica set; never connects to the application's configured database.
let mongoProcess, mongoDirectory, httpServer, baseUrl;
const owner = new Types.ObjectId();
const stranger = new Types.ObjectId();
const member = new Types.ObjectId();
const creator = new Types.ObjectId();
const removed = new Types.ObjectId();
const workspace = new Types.ObjectId();
const otherWorkspace = new Types.ObjectId();
const deletedWorkspace = new Types.ObjectId();
const folder = new Types.ObjectId();
const otherFolder = new Types.ObjectId();
const columns = {};
const service = new StickyNoteService();
const realGetToday = StickyNoteDateService.prototype.getTodayDateKey;
const now = new Date("2026-10-04T20:00:00Z"); // Oct 5 in Kolkata, Oct 4 in UTC.
const today = "2026-10-05";
let sequence = 0;

async function makeNote(overrides = {}) {
    return StickyNoteModel.create({
        workspaceId: workspace, workspaceFolderId: folder, columnId: columns.TODO,
        stickyNoteNumber: ++sequence, title: "Overdue note", content: "Sidebar content",
        noteDate: "2026-10-02", createdBy: owner, updatedBy: owner, ...overrides,
    });
}

async function request(path, options = {}, user = owner) {
    const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: { Authorization: `Bearer ${user}`, "Content-Type": "application/json", ...options.headers },
    });
    return { status: response.status, body: await response.json() };
}

before(async () => {
    const socket = createServer();
    socket.listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    mongoDirectory = await mkdtemp(join(tmpdir(), "sticky-overdue-test-"));
    mongoProcess = spawn(process.env.MONGOD_BINARY ?? "mongod", [
        "--dbpath", mongoDirectory, "--port", String(port), "--bind_ip", "127.0.0.1",
        "--replSet", "overdueTest", "--logpath", join(mongoDirectory, "mongo.log"),
    ], { windowsHide: true, stdio: "ignore" });
    let startupError;
    mongoProcess.on("error", error => { startupError = error; });
    const uri = `mongodb://127.0.0.1:${port}/sticky_overdue_test`;
    const client = new mongoose.mongo.MongoClient(uri, { directConnection: true, serverSelectionTimeoutMS: 500 });
    for (let attempt = 0; ; attempt++) {
        if (startupError) throw startupError;
        try { await client.connect(); break; }
        catch (error) { if (attempt >= 40) throw error; await delay(250); }
    }
    try {
        await client.db("admin").command({ replSetInitiate: { _id: "overdueTest", members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
        for (let attempt = 0; ; attempt++) {
            if ((await client.db("admin").command({ hello: 1 })).isWritablePrimary) break;
            assert.ok(attempt < 80, "Temporary replica set must elect a primary");
            await delay(250);
        }
    } finally { await client.close(); }
    await mongoose.connect(`${uri}?replicaSet=overdueTest`, { autoIndex: false });
    await WorkspaceModel.collection.insertMany([
        { _id: workspace, ownerId: owner, createdBy: creator, status: "ACTIVE" },
        { _id: otherWorkspace, ownerId: stranger, createdBy: stranger, status: "ACTIVE" },
        { _id: deletedWorkspace, ownerId: owner, createdBy: owner, status: "DELETED" },
    ]);
    await WorkspaceMemberModel.collection.insertMany([
        { workspaceId: workspace, userId: member, status: "ACTIVE" },
        { workspaceId: workspace, userId: removed, status: "REMOVED" },
    ]);
    for (const type of ["TODO", "IN_PROGRESS", "CUSTOM", "COMPLETED"]) {
        const column = await StickyNoteColumnModel.create({
            workspaceId: workspace, workspaceFolderId: folder,
            name: type === "COMPLETED" ? "Shipped (renamed)" : type === "CUSTOM" ? "Review" : type,
            type, createdBy: owner,
        });
        columns[type] = column._id;
    }
    for (const [key, workspaceId] of [["OTHER", otherWorkspace], ["DELETED", deletedWorkspace]]) {
        const column = await StickyNoteColumnModel.create({ workspaceId, workspaceFolderId: otherFolder, name: "To do", type: "TODO", createdBy: stranger });
        columns[key] = column._id;
    }
    await UserPreferenceModel.collection.insertMany([owner, member, creator, stranger, removed].map(userId => ({ userId, key: "timezone", value: "Asia/Kolkata" })));
    await AuditLogModel.createCollection();
    mock.method(StickyNoteDateService.prototype, "getTodayDateKey", function (userId) {
        return realGetToday.call(this, userId, now);
    });
    // Keep the real auth middleware and routes; token cryptography is outside this feature's scope.
    mock.method(JwtUtil, "verifyAccessToken", token => ({ sub: token, sessionId: "test-session" }));
    const app = express();
    app.use(express.json());
    app.use("/api/v1/stickynotes", routes);
    app.use((error, _req, res, _next) => res.status(error.statusCode ?? 500).json({ success: false, message: error.message }));
    httpServer = app.listen(0, "127.0.0.1");
    await once(httpServer, "listening");
    baseUrl = `http://127.0.0.1:${httpServer.address().port}/api/v1/stickynotes`;
});

after(async () => {
    mock.restoreAll();
    if (httpServer) await new Promise(resolve => httpServer.close(resolve));
    await mongoose.disconnect();
    if (mongoProcess?.pid && mongoProcess.exitCode === null) {
        const exited = once(mongoProcess, "exit");
        mongoProcess.kill();
        await exited;
    }
    if (mongoDirectory) {
        const target = resolve(mongoDirectory);
        assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes("sticky-overdue-test-"));
        await rm(target, { recursive: true, force: true });
    }
});

test("local date and calendar days handle midnight, DST, leap days; TODAY stays exact", async () => {
    const dates = new StickyNoteDateService();
    assert.equal(await realGetToday.call(dates, owner.toString(), now), today);
    await UserPreferenceModel.collection.updateOne({ userId: owner }, { $set: { value: "America/Los_Angeles" } });
    assert.equal(await realGetToday.call(dates, owner.toString(), new Date("2026-10-05T02:00:00Z")), "2026-10-04");
    await UserPreferenceModel.collection.updateOne({ userId: owner }, { $set: { value: "Asia/Kolkata" } });
    assert.equal(StickyNoteDateService.getCalendarDaysBetween("2026-03-07", "2026-03-09"), 2);
    assert.equal(StickyNoteDateService.getCalendarDaysBetween("2024-02-28", "2024-03-01"), 2);
    assert.deepEqual(await dates.resolveFilter({ datePreset: "TODAY" }, owner.toString(), now), { noteDate: today });
    assert.equal(dates.normalizeNullableDateKey(null), null);
    assert.equal(dates.normalizeNullableDateKey("2026-10-02"), "2026-10-02");
});

test("Mongo filters lifecycle, dates and semantic completed column before paging and summary", async () => {
    await StickyNoteModel.deleteMany({});
    const todo = await makeNote();
    const progress = await makeNote({ columnId: columns.IN_PROGRESS, noteDate: "2026-10-04" });
    const review = await makeNote({ columnId: columns.CUSTOM, noteDate: "2026-10-03" });
    for (const overrides of [
        { columnId: columns.COMPLETED }, { noteDate: null }, { noteDate: today },
        { noteDate: "2026-10-06" }, { status: "TRASHED" }, { status: "ARCHIVED" },
        { workspaceId: otherWorkspace, workspaceFolderId: otherFolder, columnId: columns.OTHER },
        { workspaceId: deletedWorkspace, workspaceFolderId: otherFolder, columnId: columns.DELETED },
        { columnId: new Types.ObjectId() },
    ]) await makeNote(overrides);
    const missingDate = await makeNote();
    await StickyNoteModel.collection.updateOne({ _id: missingDate._id }, { $unset: { noteDate: "" } });
    const result = await request(`/overdue?workspaceId=${workspace}&workspaceFolderId=${folder}&page=1&limit=2`);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.meta, { page: 1, limit: 2, total: 3, totalPages: 2 });
    assert.equal(result.body.data.today, today);
    assert.equal(result.body.data.total, 3);
    assert.equal(result.body.data.byColumn.reduce((sum, item) => sum + item.count, 0), 3);
    assert.deepEqual(result.body.data.notes.map(note => note.id), [todo.id, review.id]);
    assert.deepEqual(result.body.data.notes.map(note => note.daysOverdue), [3, 2]);
    assert.equal(result.body.data.notes[0].noteKey, `ST-${String(todo.stickyNoteNumber).padStart(6, "0")}`);
    assert.equal("_id" in result.body.data.notes[0], false);
    assert.equal("checklists" in result.body.data.notes[0], false);
    const newest = await request("/overdue?sort=NEWEST_FIRST&limit=1");
    assert.equal(newest.body.data.notes[0].id, progress.id);
    const page2 = await request("/overdue?page=2&limit=2");
    assert.deepEqual(page2.body.data.notes.map(note => note.id), [progress.id]);
    assert.equal((await request("/overdue?page=99")).body.data.total, 3);
    assert.equal((await request(`/overdue?workspaceFolderId=${otherFolder}`)).body.data.total, 0);
    const postResult = await request("/overdue", {
        method: "POST",
        body: JSON.stringify({ workspaceId: workspace.toString(), workspaceFolderId: folder.toString(), page: 1, limit: 2 }),
    });
    assert.equal(postResult.status, 200);
    assert.deepEqual(postResult.body.meta, result.body.meta);
    assert.deepEqual(postResult.body.data.notes.map(note => note.id), result.body.data.notes.map(note => note.id));
    assert.equal(postResult.body.message, "Overdue sticky notes retrieved successfully.");

    const tied = await makeNote({ noteDate: "2026-10-04" });
    const stable = await request("/overdue?sort=NEWEST_FIRST&limit=2");
    assert.deepEqual(stable.body.data.notes.map(note => note.id), [progress.id, tied.id].sort().reverse());
});

test("owner, creator and active member have access; stranger and removed member cannot read or update", async () => {
    for (const user of [owner, creator, member]) {
        assert.ok((await request("/overdue", {}, user)).body.data.total > 0);
    }
    const target = await makeNote();
    for (const user of [stranger, removed]) {
        assert.equal((await request(`/overdue?workspaceId=${workspace}`, {}, user)).body.data.total, 0);
        const result = await request("/overdue/bring-today", { method: "PUT", body: JSON.stringify({ stickyNoteIds: [target.id] }) }, user);
        assert.equal(result.body.data.updated, 0);
        assert.equal(result.body.data.skipped, 1);
        assert.equal((await StickyNoteModel.findById(target._id)).noteDate, "2026-10-02");
    }
    const memberNote = await makeNote();
    assert.equal((await service.bringOverdueStickyNotesToToday([memberNote.id], member.toString())).updated, 1);
    const foreignNote = await makeNote({ workspaceId: otherWorkspace, workspaceFolderId: otherFolder, columnId: columns.OTHER });
    const mixed = await service.bringOverdueStickyNotesToToday([target.id, foreignNote.id], owner.toString());
    assert.equal(mixed.updated, 1);
    assert.equal(mixed.skipped, 1);
    assert.equal((await StickyNoteModel.findById(foreignNote._id)).noteDate, "2026-10-02");
});

test("single and bulk bring-today update only date/editor/timestamp and preserve exact audit history", async () => {
    const a = await makeNote({ title: "Keep title", rank: "00300000", position: 12 });
    const b = await makeNote({ columnId: columns.IN_PROGRESS, noteDate: "2026-10-04" });
    const completed = await makeNote({ columnId: columns.COMPLETED });
    const unknown = new Types.ObjectId().toString();
    const before = await StickyNoteModel.findById(a._id).lean();
    const result = await request("/overdue/bring-today", { method: "PUT", body: JSON.stringify({ stickyNoteIds: [a.id, b.id, completed.id, unknown] }) });
    assert.equal(result.status, 200);
    assert.deepEqual({ ...result.body.data, skippedNotes: [] }, { today, requested: 4, updated: 2, skipped: 2, skippedNotes: [] });
    assert.deepEqual(result.body.data.skippedNotes.map(item => item.id), [completed.id, unknown]);
    const after = await StickyNoteModel.findById(a._id).lean();
    assert.equal(after.noteDate, today);
    assert.equal(after.updatedBy.toString(), owner.toString());
    assert.ok(after.updatedAt >= before.updatedAt);
    for (const key of Object.keys(before).filter(key => !["noteDate", "updatedBy", "updatedAt"].includes(key))) {
        assert.deepEqual(after[key], before[key], `${key} must be preserved`);
    }
    const audit = await AuditLogModel.findOne({ resourceId: a._id }).lean();
    assert.deepEqual(audit.changes, [{ field: "noteDate", oldValue: "2026-10-02", newValue: today }]);
    assert.equal(audit.actorId.toString(), owner.toString());
    assert.equal(await AuditLogModel.countDocuments({ resourceId: { $in: [a._id, b._id] } }), 2);
    const overdue = await service.getOverdueStickyNotes({}, owner.toString());
    assert.equal(overdue.data.notes.some(note => note.id === a.id || note.id === b.id), false);
    const repeated = await service.bringOverdueStickyNotesToToday([a.id], owner.toString());
    assert.equal(repeated.updated, 0);
    assert.equal(await AuditLogModel.countDocuments({ resourceId: a._id }), 1);
});

test("audit insert failure rolls back all note updates and audit inserts", async () => {
    const a = await makeNote();
    const b = await makeNote();
    const realLogMany = AuditLogService.prototype.logMany;
    const failing = mock.method(AuditLogService.prototype, "logMany", async function (logs, session) {
        await realLogMany.call(this, logs, session);
        throw new Error("injected audit failure");
    });
    try {
        await assert.rejects(service.bringOverdueStickyNotesToToday([a.id, b.id], owner.toString()), /injected audit failure/);
    } finally { failing.mock.restore(); }
    assert.equal(await StickyNoteModel.countDocuments({ _id: { $in: [a._id, b._id] }, noteDate: "2026-10-02" }), 2);
    assert.equal(await AuditLogModel.countDocuments({ resourceId: { $in: [a._id, b._id] } }), 0);
});

test("concurrent reschedules update and audit a note exactly once", async () => {
    const note = await makeNote();
    const results = await Promise.all([
        service.bringOverdueStickyNotesToToday([note.id], owner.toString()),
        service.bringOverdueStickyNotesToToday([note.id], owner.toString()),
    ]);
    assert.equal(results.reduce((sum, result) => sum + result.updated, 0), 1);
    assert.equal(await AuditLogModel.countDocuments({ resourceId: note._id }), 1);
});

test("HTTP validation rejects invalid IDs, duplicates, oversized batches, unsafe sorting and paging", async () => {
    for (const query of ["sort=title", "sort[$gt]=x", "sortBy=noteDate", "page=0", "limit=-1", "page=1.5", "page=9007199254740991&limit=100", "workspaceId=bad", "workspaceFolderId=bad", "limit=1&limit=2"]) {
        assert.equal((await request(`/overdue?${query}`)).status, 400, query);
    }
    const id = new Types.ObjectId().toString();
    for (const body of [{}, { stickyNoteIds: [] }, { stickyNoteIds: "bad" }, { stickyNoteIds: ["bad"] },
        { stickyNoteIds: [id, id.toUpperCase()] }, { stickyNoteIds: Array(101).fill(id) }, { stickyNoteIds: [id], noteDate: today }]) {
        assert.equal((await request("/overdue/bring-today", { method: "PUT", body: JSON.stringify(body) })).status, 400);
    }
    for (const body of [{ sort: "title" }, { page: 0 }, { limit: -1 }, { workspaceId: "bad" }, { unknownField: 123 }]) {
        assert.equal((await request("/overdue", { method: "POST", body: JSON.stringify(body) })).status, 400);
    }
    const invalidContentType = await request("/overdue", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({}),
    });
    assert.equal(invalidContentType.status, 415);
    assert.equal((await request("/overdue?limit=1000")).body.meta.limit, 100);
    assert.equal((await request("/overdue", { headers: { Authorization: "" } })).status, 401);
});

test("sidebar query count stays constant as the page size increases", async () => {
    const queries = [];
    mongoose.set("debug", (collection, method) => { queries.push(`${collection}.${method}`); });
    try {
        await request("/overdue?limit=1");
        const smallPage = [...queries];
        queries.length = 0;
        await request("/overdue?limit=100");
        assert.deepEqual(queries.sort(), smallPage.sort());
        assert.equal(queries.length, 4); // timezone preference, memberships, workspaces, note aggregation
    } finally { mongoose.set("debug", false); }
});
