import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import mongoose, { Types } from "mongoose";
import express from "express";
import cookieParser from "cookie-parser";

process.env.JWT_ACCESS_SECRET = "test-jwt-access-secret-stickyji-32chars";
process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret-stickyji-32chars";
process.env.FRONTEND_URL = "http://localhost:3000";

const { UserModel } = await import("../src/modules/user/models/user.model.ts");
const { WorkspaceModel } = await import("../src/modules/workspace/models/workspace.model.ts");
const { WorkspaceFolderModel } = await import("../src/modules/workspaceFolders/models/workspaceFolder.model.ts");
const { StickyNoteColumnModel } = await import("../src/modules/stickynotescolumns/models/stickyNoteColumn.model.ts");
const { StickyNoteModel } = await import("../src/modules/stickynotes/models/stickynote.model.ts");
const { UserPreferenceModel } = await import("../src/modules/userpreference/models/userPreference.model.ts");
const { AuthService } = await import("../src/modules/auth/services/auth.service.ts");
const { JwtUtil } = await import("../src/modules/auth/utils/jwt.util.ts");
const { SessionModel } = await import("../src/modules/auth/models/session.model.ts");
const { SessionStatus } = await import("../src/modules/auth/constants/session.constants.js");
const { CryptoUtil } = await import("../src/modules/auth/utils/crypto.util.ts");
const { default: appRoutes } = await import("../src/routes/app.routes.ts");
const { errorMiddleware } = await import("../src/middlewares/error/error.middleware.ts");

let mongodProcess, testDirectory, server, baseUrl;

async function createAuthHeaders(userId) {
    const sessionId = new Types.ObjectId().toString();
    const refreshToken = JwtUtil.generateRefreshToken(userId.toString(), sessionId, 1);
    const refreshTokenHash = CryptoUtil.hashToken(refreshToken);

    await SessionModel.create({
        _id: new Types.ObjectId(sessionId),
        userId: new Types.ObjectId(userId),
        refreshTokenHash,
        refreshTokenVersion: 1,
        status: SessionStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        lastUsedAt: new Date(),
    });

    const accessToken = JwtUtil.generateAccessToken(userId.toString(), sessionId);
    return {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
    };
}

before(async () => {
    testDirectory = await mkdtemp(join(tmpdir(), "stickyji-onboarding-test-"));
    const socket = createServer().listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));

    mongodProcess = spawn(
        globalThis.process.env.MONGOD_BINARY ?? "mongod",
        [
            "--dbpath",
            testDirectory,
            "--port",
            String(port),
            "--bind_ip",
            "127.0.0.1",
            "--logpath",
            join(testDirectory, "mongo.log"),
        ],
        { windowsHide: true, stdio: "ignore" },
    );

    let startupError;
    mongodProcess.on("error", (error) => {
        startupError = error;
    });

    let connected = false;
    for (let i = 0; i < 40; i++) {
        if (startupError) throw startupError;
        try {
            await mongoose.connect(`mongodb://127.0.0.1:${port}/stickyji_onboarding_test?directConnection=true`, {
                serverSelectionTimeoutMS: 2000,
            });
            connected = true;
            break;
        } catch {
            await delay(200);
        }
    }
    if (!connected) throw new Error("Could not connect to test mongod instance");

    // Initialize full database defaults via DatabaseInitializer
    const { DatabaseInitializer } = await import("../src/database/initialization/database-initializer.ts");
    const initializer = new DatabaseInitializer();
    await initializer.initialize();

    // Start Express test server
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api/v1", appRoutes);
    app.use(errorMiddleware);

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
});

after(async () => {
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongodProcess) {
        mongodProcess.kill();
        await delay(500);
    }
    if (testDirectory) {
        await rm(testDirectory, { recursive: true, force: true }).catch(() => {});
    }
});

test("1. Newly registered user starts with zero workspaces and zero folders", async () => {
    const authService = new AuthService();
    const regResult = await authService.register({
        email: "onboard_user1@test.com",
        password: "Password123!",
        firstName: "Onboard",
        lastName: "One",
    });

    const userId = regResult.data.user.id;
    assert.ok(userId);

    const wsCount = await WorkspaceModel.countDocuments({ ownerId: new Types.ObjectId(userId) });
    assert.equal(wsCount, 0, "Workspaces must be 0 upon registration");

    const folderCount = await WorkspaceFolderModel.countDocuments({ createdBy: new Types.ObjectId(userId) });
    assert.equal(folderCount, 0, "Folders must be 0 upon registration");

    // Status check via GET /api/v1/workspaces/status
    const headers = await createAuthHeaders(userId);
    const res = await fetch(`${baseUrl}/workspaces/status`, { headers });
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.success, true);
    assert.equal(body.data.hasWorkspaces, false);
    assert.equal(body.data.hasFolders, false);
    assert.equal(body.data.requiresOnboarding, true);
});

test("2. Status check via alias GET /api/v1/onboarding/check", async () => {
    const user = await UserModel.findOne({ email: "onboard_user1@test.com" });
    assert.ok(user);
    const headers = await createAuthHeaders(user._id);

    const res = await fetch(`${baseUrl}/onboarding/check`, { headers });
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.data.hasWorkspaces, false);
    assert.equal(body.data.hasFolders, false);
    assert.equal(body.data.requiresOnboarding, true);
});

test("3. POST initial-setup rejects invalid input", async () => {
    const user = await UserModel.findOne({ email: "onboard_user1@test.com" });
    assert.ok(user);
    const headers = await createAuthHeaders(user._id);

    // Missing folderTitle
    const res1 = await fetch(`${baseUrl}/onboarding/initial-setup`, {
        method: "POST",
        headers,
        body: JSON.stringify({ workspaceTitle: "My Space" }),
    });
    assert.equal(res1.status, 400);

    // Empty workspaceTitle
    const res2 = await fetch(`${baseUrl}/onboarding/initial-setup`, {
        method: "POST",
        headers,
        body: JSON.stringify({ workspaceTitle: "   ", folderTitle: "Notes" }),
    });
    assert.equal(res2.status, 400);

    // Over 255 chars
    const res3 = await fetch(`${baseUrl}/onboarding/initial-setup`, {
        method: "POST",
        headers,
        body: JSON.stringify({ workspaceTitle: "a".repeat(256), folderTitle: "Notes" }),
    });
    assert.equal(res3.status, 400);
});

test("4. POST initial-setup creates workspace, folder, columns, default note, and initializes preferences", async () => {
    const user = await UserModel.findOne({ email: "onboard_user1@test.com" });
    assert.ok(user);
    const headers = await createAuthHeaders(user._id);

    const res = await fetch(`${baseUrl}/onboarding/initial-setup`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            workspaceTitle: "Engineering Workspace",
            folderTitle: "Sprint Planning",
        }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();

    assert.equal(body.success, true);
    assert.ok(body.data.workspace);
    assert.equal(body.data.workspace.name, "Engineering Workspace");
    assert.ok(body.data.folder);
    assert.equal(body.data.folder.name, "Sprint Planning");

    // Verify workspace in DB
    const ws = await WorkspaceModel.findById(body.data.workspace.id);
    assert.ok(ws);
    assert.equal(ws.name, "Engineering Workspace");
    assert.equal(ws.isPersonal, true);

    // Verify folder in DB
    const folder = await WorkspaceFolderModel.findById(body.data.folder.id);
    assert.ok(folder);
    assert.equal(folder.name, "Sprint Planning");
    assert.equal(folder.isDefault, true);

    // Verify columns
    const columns = await StickyNoteColumnModel.find({
        workspaceId: ws._id,
        workspaceFolderId: folder._id,
    });
    assert.equal(columns.length, 2);

    // Verify note
    const note = await StickyNoteModel.findOne({
        workspaceId: ws._id,
        workspaceFolderId: folder._id,
    });
    assert.ok(note);

    // Verify preferences updated
    const pref = await UserPreferenceModel.findOne({
        userId: user._id,
        key: "selectedworkspaceid",
    });
    assert.ok(pref);
    assert.equal(pref.value, ws._id.toString());
});

test("5. Status check now returns requiresOnboarding = false", async () => {
    const user = await UserModel.findOne({ email: "onboard_user1@test.com" });
    assert.ok(user);
    const headers = await createAuthHeaders(user._id);

    const res = await fetch(`${baseUrl}/workspaces/status`, { headers });
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.data.hasWorkspaces, true);
    assert.equal(body.data.hasFolders, true);
    assert.equal(body.data.requiresOnboarding, false);
});

test("6. Second initial setup attempt is rejected with 409 Conflict", async () => {
    const user = await UserModel.findOne({ email: "onboard_user1@test.com" });
    assert.ok(user);
    const headers = await createAuthHeaders(user._id);

    const res = await fetch(`${baseUrl}/onboarding/initial-setup`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            workspaceTitle: "Another Space",
            folderTitle: "Another Folder",
        }),
    });
    assert.equal(res.status, 409);
});

test("7. Route alias POST /api/v1/workspaces/initialize also works identically", async () => {
    const authService = new AuthService();
    const regResult = await authService.register({
        email: "onboard_user2@test.com",
        password: "Password123!",
        firstName: "Onboard",
        lastName: "Two",
    });
    const userId = regResult.data.user.id;
    const headers = await createAuthHeaders(userId);

    // Check status
    const statusRes = await fetch(`${baseUrl}/workspaces/status`, { headers });
    const statusBody = await statusRes.json();
    assert.equal(statusBody.data.requiresOnboarding, true);

    // Initialize via POST /api/v1/workspaces/initialize
    const initRes = await fetch(`${baseUrl}/workspaces/initialize`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            workspaceTitle: "Design Studio",
            folderTitle: "Moodboards",
        }),
    });
    assert.equal(initRes.status, 201);
    const initBody = await initRes.json();
    assert.equal(initBody.data.workspace.name, "Design Studio");
    assert.equal(initBody.data.folder.name, "Moodboards");

    // Re-check status
    const statusRes2 = await fetch(`${baseUrl}/workspaces/status`, { headers });
    const statusBody2 = await statusRes2.json();
    assert.equal(statusBody2.data.requiresOnboarding, false);
});

test("8. PUT /stickynotes/update/:id accepts full payload including status (ARCHIVED)", async () => {
    const user = await UserModel.findOne({ email: "onboard_user1@test.com" });
    assert.ok(user);
    const headers = await createAuthHeaders(user._id);

    const note = await StickyNoteModel.findOne({ createdBy: user._id });
    assert.ok(note);

    const updateRes = await fetch(`${baseUrl}/stickynotes/update/${note._id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
            workspaceId: note.workspaceId.toString(),
            workspaceFolderId: note.workspaceFolderId.toString(),
            columnId: note.columnId.toString(),
            title: "Updated Note Title",
            content: "Updated note content text.",
            color: "YELLOW",
            priority: "NONE",
            status: "ARCHIVED",
            shape: "SQUARE",
            variant: "PLAIN",
            backgroundPattern: "NONE",
            noteDate: "2026-11-07",
        }),
    });

    assert.equal(updateRes.status, 200);
    const updateBody = await updateRes.json();
    assert.equal(updateBody.success, true);
    assert.equal(updateBody.data.title, "Updated Note Title");
    assert.equal(updateBody.data.status, "ARCHIVED");

    // Verify in DB
    const updatedNoteInDb = await StickyNoteModel.findById(note._id);
    assert.equal(updatedNoteInDb.status, "ARCHIVED");
    assert.equal(updatedNoteInDb.title, "Updated Note Title");
});

