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
import jwt from "jsonwebtoken";

process.env.JWT_ACCESS_SECRET = "auth-logout-test-access-secret-32chars!";
process.env.JWT_REFRESH_SECRET = "auth-logout-test-refresh-secret-32chars!";

const { SessionModel } = await import("../src/modules/auth/models/session.model.ts");
const { UserModel } = await import("../src/modules/user/models/user.model.ts");
const { SessionStatus } = await import("../src/modules/auth/constants/session.constants.js");
const { JwtUtil } = await import("../src/modules/auth/utils/jwt.util.ts");
const { CryptoUtil } = await import("../src/modules/auth/utils/crypto.util.ts");
const { AUTH_COOKIE_CONSTANTS } = await import("../src/modules/auth/constants/authCookie.constants.js");
const { default: authRoutes } = await import("../src/modules/auth/routes/auth.routes.ts");
const { default: userRoutes } = await import("../src/modules/user/routes/user.routes.ts");
const { errorMiddleware } = await import("../src/middlewares/error/error.middleware.ts");

let mongoProcess, mongoDirectory, server, baseUrl;
let testUser;

async function createTestSession(userId, customVersion = 1) {
    const sessionId = new Types.ObjectId().toString();
    const refreshToken = JwtUtil.generateRefreshToken(userId.toString(), sessionId, customVersion);
    const refreshTokenHash = CryptoUtil.hashToken(refreshToken);

    await SessionModel.create({
        _id: new Types.ObjectId(sessionId),
        userId: new Types.ObjectId(userId),
        refreshTokenHash,
        refreshTokenVersion: customVersion,
        status: SessionStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        lastUsedAt: new Date(),
    });

    const accessToken = JwtUtil.generateAccessToken(userId.toString(), sessionId);

    return {
        sessionId,
        accessToken,
        refreshToken,
    };
}

before(async () => {
    const socket = createServer().listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));

    mongoDirectory = await mkdtemp(join(tmpdir(), "auth-logout-test-"));
    mongoProcess = spawn(
        process.env.MONGOD_BINARY ?? "mongod",
        [
            "--dbpath",
            mongoDirectory,
            "--port",
            String(port),
            "--bind_ip",
            "127.0.0.1",
            "--logpath",
            join(mongoDirectory, "mongo.log"),
        ],
        { windowsHide: true, stdio: "ignore" },
    );

    let startupError;
    mongoProcess.on("error", (err) => {
        startupError = err;
    });

    for (let attempt = 0; ; attempt++) {
        if (startupError) throw startupError;
        try {
            await mongoose.connect(`mongodb://127.0.0.1:${port}/authLogoutTest?directConnection=true`, {
                serverSelectionTimeoutMS: 500,
                autoIndex: false,
            });
            break;
        } catch (err) {
            if (attempt >= 40) throw err;
            await delay(250);
        }
    }

    testUser = await UserModel.create({
        email: "logout-test@example.com",
        globalRoleId: new Types.ObjectId(),
        authProvider: "LOCAL",
        status: "ACTIVE",
    });

    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use("/auth", authRoutes);
    app.use("/user", userRoutes);
    app.use(errorMiddleware);

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState) await mongoose.disconnect();
    if (mongoProcess) {
        mongoProcess.kill();
        await delay(250);
    }
    if (mongoDirectory) await rm(mongoDirectory, { recursive: true, force: true }).catch(() => undefined);
});

test("1. POST /auth/logout with active access token revokes session and clears cookie", async () => {
    const { sessionId, accessToken } = await createTestSession(testUser._id);

    const res = await fetch(`${baseUrl}/auth/logout`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.message, "Logout successful.");

    const sessionInDb = await SessionModel.findById(sessionId);
    assert.equal(sessionInDb.status, SessionStatus.REVOKED);

    const setCookie = res.headers.get("set-cookie");
    assert.ok(setCookie, "Expected set-cookie header on logout");
    assert.ok(setCookie.includes("msn_refresh="), "Expected msn_refresh cookie to be cleared");
});

test("2. GET /auth/logout works identically to POST /auth/logout", async () => {
    const { sessionId, accessToken } = await createTestSession(testUser._id);

    const res = await fetch(`${baseUrl}/auth/logout`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.message, "Logout successful.");

    const sessionInDb = await SessionModel.findById(sessionId);
    assert.equal(sessionInDb.status, SessionStatus.REVOKED);
});

test("3. POST /auth/logout with expired access token successfully logs out and revokes session", async () => {
    const { sessionId } = await createTestSession(testUser._id);

    const expiredAccessToken = jwt.sign(
        {
            sub: testUser._id.toString(),
            sessionId,
            tokenType: "ACCESS",
        },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: "-10s" },
    );

    const res = await fetch(`${baseUrl}/auth/logout`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${expiredAccessToken}`,
        },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.message, "Logout successful.");

    const sessionInDb = await SessionModel.findById(sessionId);
    assert.equal(sessionInDb.status, SessionStatus.REVOKED);
});

test("4. POST /auth/logout with cookie-based refresh token logs out session", async () => {
    const { sessionId, refreshToken } = await createTestSession(testUser._id);

    const res = await fetch(`${baseUrl}/auth/logout`, {
        method: "POST",
        headers: {
            Cookie: `${AUTH_COOKIE_CONSTANTS.REFRESH_TOKEN_NAME}=${refreshToken}`,
        },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    const sessionInDb = await SessionModel.findById(sessionId);
    assert.equal(sessionInDb.status, SessionStatus.REVOKED);
});

test("5. POST and GET /user/logout work through the user module routes", async () => {
    const sessionPost = await createTestSession(testUser._id);

    const resPost = await fetch(`${baseUrl}/user/logout`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${sessionPost.accessToken}`,
        },
    });

    assert.equal(resPost.status, 200);
    const bodyPost = await resPost.json();
    assert.equal(bodyPost.success, true);
    assert.equal(bodyPost.message, "Logout successful.");

    const dbSessionPost = await SessionModel.findById(sessionPost.sessionId);
    assert.equal(dbSessionPost.status, SessionStatus.REVOKED);

    const sessionGet = await createTestSession(testUser._id);

    const resGet = await fetch(`${baseUrl}/user/logout`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${sessionGet.accessToken}`,
        },
    });

    assert.equal(resGet.status, 200);
    const bodyGet = await resGet.json();
    assert.equal(bodyGet.success, true);

    const dbSessionGet = await SessionModel.findById(sessionGet.sessionId);
    assert.equal(dbSessionGet.status, SessionStatus.REVOKED);
});

test("6. POST /auth/logoutall and POST /user/logoutall revoke all active user sessions", async () => {
    const session1 = await createTestSession(testUser._id);
    const session2 = await createTestSession(testUser._id);
    const session3 = await createTestSession(testUser._id);

    assert.equal((await SessionModel.findById(session1.sessionId)).status, SessionStatus.ACTIVE);
    assert.equal((await SessionModel.findById(session2.sessionId)).status, SessionStatus.ACTIVE);
    assert.equal((await SessionModel.findById(session3.sessionId)).status, SessionStatus.ACTIVE);

    const res = await fetch(`${baseUrl}/auth/logoutall`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${session1.accessToken}`,
        },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.message, "All sessions have been logged out successfully.");

    assert.equal((await SessionModel.findById(session1.sessionId)).status, SessionStatus.REVOKED);
    assert.equal((await SessionModel.findById(session2.sessionId)).status, SessionStatus.REVOKED);
    assert.equal((await SessionModel.findById(session3.sessionId)).status, SessionStatus.REVOKED);

    const session4 = await createTestSession(testUser._id);
    const session5 = await createTestSession(testUser._id);

    const resUserLogoutAll = await fetch(`${baseUrl}/user/logoutall`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${session4.accessToken}`,
        },
    });

    assert.equal(resUserLogoutAll.status, 200);
    assert.equal((await SessionModel.findById(session4.sessionId)).status, SessionStatus.REVOKED);
    assert.equal((await SessionModel.findById(session5.sessionId)).status, SessionStatus.REVOKED);
});
