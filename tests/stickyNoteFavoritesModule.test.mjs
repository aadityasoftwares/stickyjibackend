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

process.env.JWT_ACCESS_SECRET = "fav-module-test-access-secret";
process.env.JWT_REFRESH_SECRET = "fav-module-test-refresh-secret";
for (const key of ["ACCOUNT_ID", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "BUCKET_NAME"]) {
    process.env[`CLOUDFLARE_R2_${key}`] = "fav-module-test";
}
process.env.CLOUDFLARE_R2_PUBLIC_URL = "https://cdn.example.test";

const { UserModel } = await import("../src/modules/user/models/user.model.ts");
const { UserProfileModel } = await import("../src/modules/userprofile/models/userProfile.model.ts");
const { WorkspaceModel } = await import("../src/modules/workspace/models/workspace.model.ts");
const { WorkspaceFolderModel } = await import("../src/modules/workspaceFolders/models/workspaceFolder.model.ts");
const { StickyNoteColumnModel } = await import("../src/modules/stickynotescolumns/models/stickyNoteColumn.model.ts");
const { StickyNoteModel } = await import("../src/modules/stickynotes/models/stickynote.model.ts");
const { StickyNoteFavoriteModel } = await import("../src/modules/stickynotesfavorites/models/stickyNoteFavorite.model.ts");
const { StickyNoteAssigneeModel } = await import("../src/modules/stickynotesassignees/models/stickyNoteAssignee.model.ts");
const { MediaModel } = await import("../src/modules/media/models/media.model.ts");
const { CloudflareR2Service } = await import("../src/modules/media/storage/cloudflareR2.service.ts");
const {
    MediaStatus,
    MediaType,
    MediaPurpose,
    MediaVisibility,
    MediaResourceType,
} = await import("../src/modules/media/constants/media.enums.js");
const { JwtUtil } = await import("../src/modules/auth/utils/jwt.util.ts");
const { default: stickyNoteFavoriteRoutes } = await import("../src/modules/stickynotesfavorites/routes/stickyNoteFavorite.routes.ts");
const { errorMiddleware } = await import("../src/middlewares/error/error.middleware.ts");
const { seedProductSubscriptionFixtures } = await import("./helpers/subscriptionFixtures.mjs");

let mongoProcess, mongoDirectory, server, baseUrl;
let userA, userB;
let userAToken, userBToken;
let userAProfile, userBProfile;
let userAMedia;
let workspaceA, folderA, columnA, noteA, noteB;

CloudflareR2Service.prototype.createDownloadUrl = async function (storageKey, expiresIn = 900) {
    return `https://mock-r2.test/download/${storageKey}?expires=${expiresIn}`;
};

before(async () => {
    const socket = createServer().listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));

    mongoDirectory = await mkdtemp(join(tmpdir(), "fav-mod-test-"));
    mongoProcess = spawn(
        process.env.MONGOD_BINARY ?? "mongod",
        [
            "--dbpath",
            mongoDirectory,
            "--port",
            String(port),
            "--bind_ip",
            "127.0.0.1",
            "--replSet",
            "favModSet",
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
            await mongoose.connect(`mongodb://127.0.0.1:${port}/fav_mod_test?directConnection=true`, {
                serverSelectionTimeoutMS: 500,
                autoIndex: false,
            });
            break;
        } catch (err) {
            if (attempt >= 40) throw err;
            await delay(250);
        }
    }

    await mongoose.connection.db.admin().command({
        replSetInitiate: { _id: "favModSet", members: [{ _id: 0, host: `127.0.0.1:${port}` }] },
    });

    for (let attempt = 0; ; attempt++) {
        if ((await mongoose.connection.db.admin().command({ hello: 1 })).isWritablePrimary) break;
        if (attempt >= 80) throw new Error("Replica set did not elect a primary");
        await delay(250);
    }

    await seedProductSubscriptionFixtures();

    const app = express();
    app.use(express.json());
    app.use("/api/v1/stickynotefavorites", stickyNoteFavoriteRoutes);
    app.use(errorMiddleware);

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/stickynotefavorites`;

    userA = await UserModel.create({
        email: `usera-${Date.now()}@test.com`,
        displayName: "User A",
        globalRoleId: new Types.ObjectId(),
        status: "ACTIVE",
        isDeleted: false,
    });

    userB = await UserModel.create({
        email: `userb-${Date.now()}@test.com`,
        displayName: "User B",
        globalRoleId: new Types.ObjectId(),
        status: "ACTIVE",
        isDeleted: false,
    });

    userAToken = JwtUtil.generateAccessToken(userA._id.toString(), new Types.ObjectId().toString());
    userBToken = JwtUtil.generateAccessToken(userB._id.toString(), new Types.ObjectId().toString());

    userAMedia = await MediaModel.create({
        uploadedBy: userA._id,
        mediaType: MediaType.IMAGE,
        originalFileName: "usera.png",
        bucket: "fav-module-test",
        mimeType: "image/png",
        size: 1024,
        purpose: MediaPurpose.PROFILE_IMAGE,
        visibility: MediaVisibility.PRIVATE,
        status: MediaStatus.READY,
        storageKey: `user/avatars/${userA._id}/2026/usera.png`,
        resourceType: MediaResourceType.USER,
        resourceId: userA._id,
        isConfirmed: true,
    });

    userAProfile = await UserProfileModel.create({
        userId: userA._id,
        displayName: "User A Special",
        firstName: "User",
        lastName: "A",
        profileImage: userAMedia._id,
        profileType: "PERSONAL",
        status: "ACTIVE",
        isDeleted: false,
    });

    userBProfile = await UserProfileModel.create({
        userId: userB._id,
        displayName: "User B Regular",
        firstName: "User",
        lastName: "B",
        profileImage: null,
        profileType: "PERSONAL",
        status: "ACTIVE",
        isDeleted: false,
    });

    workspaceA = await WorkspaceModel.create({
        name: "Workspace Alpha",
        slug: `ws-alpha-${Date.now()}`,
        ownerId: userA._id,
        status: "ACTIVE",
        visibility: "PRIVATE",
        isPersonal: false,
        createdBy: userA._id,
        updatedBy: userA._id,
    });

    folderA = await WorkspaceFolderModel.create({
        workspaceId: workspaceA._id,
        name: "Ideas Folder",
        slug: "ideas-folder",
        position: 0,
        isDefault: true,
        status: "ACTIVE",
    });

    columnA = await StickyNoteColumnModel.create({
        workspaceId: workspaceA._id,
        workspaceFolderId: folderA._id,
        name: "To Do",
        color: "YELLOW",
        position: 0,
        status: "ACTIVE",
        createdBy: userA._id,
        updatedBy: userA._id,
    });

    noteA = await StickyNoteModel.create({
        workspaceId: workspaceA._id,
        workspaceFolderId: folderA._id,
        columnId: columnA._id,
        stickyNoteNumber: 1,
        title: "Important Milestone Note",
        content: "Detailed plans for product launch.",
        color: "YELLOW",
        priority: "HIGH",
        shape: "SQUARE",
        variant: "PLAIN",
        backgroundPattern: "NONE",
        position: 0,
        rank: "0|hzzzzz:",
        status: "ACTIVE",
        createdBy: userA._id,
        updatedBy: userA._id,
    });

    noteB = await StickyNoteModel.create({
        workspaceId: workspaceA._id,
        workspaceFolderId: folderA._id,
        columnId: columnA._id,
        stickyNoteNumber: 2,
        title: "Secondary Task Note",
        content: "Minor improvements.",
        color: "BLUE",
        priority: "LOW",
        shape: "SQUARE",
        variant: "PLAIN",
        backgroundPattern: "NONE",
        position: 1,
        rank: "0|hzzzzz:1",
        status: "ACTIVE",
        createdBy: userA._id,
        updatedBy: userA._id,
    });

    await StickyNoteAssigneeModel.create({
        stickyNoteId: noteA._id,
        userId: userA._id,
        workspaceId: workspaceA._id,
        assignedBy: userA._id,
        status: "ACTIVE",
        createdBy: userA._id,
    });
});

after(async () => {
    if (server) await new Promise((res) => server.close(res));
    await mongoose.disconnect();
    if (mongoProcess?.pid && mongoProcess.exitCode === null) {
        const stopped = once(mongoProcess, "exit");
        mongoProcess.kill();
        await stopped;
    }
    if (mongoDirectory) {
        await rm(mongoDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
});

test("1. POST /create adds a favorite and returns enriched response with profile image", async () => {
    const res = await fetch(`${baseUrl}/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
            stickyNoteId: noteA._id.toString(),
        }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data);
    assert.equal(body.data.isFavorite, true);
    assert.ok(body.data.favoriteId);
    assert.equal(body.data.stickyNoteId, noteA._id.toString());
    assert.equal(body.data.title, "Important Milestone Note");
    assert.equal(body.data.folderName, "Ideas Folder");

    // Profile image & creator check
    assert.ok(body.data.creator);
    assert.equal(body.data.creator.id, userA._id.toString());
    assert.ok(body.data.creator.profileImage?.url.includes("mock-r2.test/download"));
    assert.ok(body.data.creatorProfileImage?.url.includes("mock-r2.test/download"));

    // Assignee check
    assert.ok(Array.isArray(body.data.assignees));
    assert.equal(body.data.assignees.length, 1);
    assert.equal(body.data.assignees[0].id, userA._id.toString());
    assert.ok(body.data.assignees[0].profileImage?.url.includes("mock-r2.test/download"));

    // Nested stickyNote object
    assert.ok(body.data.stickyNote);
    assert.equal(body.data.stickyNote.title, "Important Milestone Note");
    assert.equal(body.data.stickyNote.isFavorite, true);
});

test("2. GET / and GET /getall return paginated list of enriched favorites", async () => {
    // Also favorite noteB
    await fetch(`${baseUrl}/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
            stickyNoteId: noteB._id.toString(),
        }),
    });

    for (const path of ["", "/getall"]) {
        const res = await fetch(`${baseUrl}${path}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${userAToken}`,
            },
        });

        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.success, true);
        assert.equal(body.meta.total, 2);
        assert.equal(body.data.length, 2);

        const favA = body.data.find((f) => f.stickyNoteId === noteA._id.toString());
        assert.ok(favA);
        assert.equal(favA.title, "Important Milestone Note");
        assert.equal(favA.folderName, "Ideas Folder");
        assert.equal(favA.isFavorite, true);
        assert.ok(favA.creator.profileImage?.url.includes("mock-r2.test/download"));
    }
});

test("3. POST /getall supports filtering by search and workspaceId", async () => {
    const res = await fetch(`${baseUrl}/getall`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
            workspaceId: workspaceA._id.toString(),
            search: "Milestone",
            page: 1,
            limit: 10,
        }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].stickyNoteId, noteA._id.toString());
    assert.equal(body.data[0].title, "Important Milestone Note");
});

test("4. GET /check/:stickyNoteId returns favorite status and enriched details", async () => {
    const res = await fetch(`${baseUrl}/check/${noteA._id}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${userAToken}`,
        },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.isFavorite, true);
    assert.ok(body.data.favorite);
    assert.equal(body.data.favorite.title, "Important Milestone Note");
});

test("5. PUT /trash/:id and PUT /restore/:id manage favorite lifecycle", async () => {
    // Delete favorite for noteB using PUT /trash/:id
    const trashRes = await fetch(`${baseUrl}/trash/${noteB._id}`, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${userAToken}`,
        },
    });

    assert.equal(trashRes.status, 200);

    // Verify it is no longer in active getall
    const getRes = await fetch(`${baseUrl}/getall`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${userAToken}`,
        },
    });
    const getBody = await getRes.json();
    assert.equal(getBody.data.length, 1);
    assert.equal(getBody.data[0].stickyNoteId, noteA._id.toString());

    // Restore it
    const restoreRes = await fetch(`${baseUrl}/restore/${noteB._id}`, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${userAToken}`,
        },
    });
    assert.equal(restoreRes.status, 200);
    const restoreBody = await restoreRes.json();
    assert.equal(restoreBody.success, true);
    assert.equal(restoreBody.data.isFavorite, true);
    assert.equal(restoreBody.data.title, "Secondary Task Note");
});
