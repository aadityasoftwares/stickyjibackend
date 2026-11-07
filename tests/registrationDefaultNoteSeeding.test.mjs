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

process.env.JWT_ACCESS_SECRET = "test-jwt-access-secret-stickyji";
process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret-stickyji";
process.env.FRONTEND_URL = "http://localhost:3000";

import { UserModel } from "../src/modules/user/models/user.model.ts";
import { WorkspaceModel } from "../src/modules/workspace/models/workspace.model.ts";
import { WorkspaceFolderModel } from "../src/modules/workspaceFolders/models/workspaceFolder.model.ts";
import { StickyNoteColumnModel } from "../src/modules/stickynotescolumns/models/stickyNoteColumn.model.ts";
import { StickyNoteModel } from "../src/modules/stickynotes/models/stickynote.model.ts";
import { UserPreferenceModel } from "../src/modules/userpreference/models/userPreference.model.ts";
import { AuthService } from "../src/modules/auth/services/auth.service.ts";
import { UserWorkspaceProvisioningService } from "../src/modules/workspace/services/userWorkspaceProvisioning.service.ts";
import { USER_WORKSPACE_CONSTANTS } from "../src/modules/user/constants/userWorkspace.constants.ts";
import { StickyNoteColumnType } from "../src/modules/stickynotescolumns/constants/stickyNoteColumn.enums.ts";
import { StickyNoteColor, StickyNoteStatus } from "../src/modules/stickynotes/constants/stickyNote.enums.ts";

let mongodProcess, testDirectory;

before(async () => {
    testDirectory = await mkdtemp(join(tmpdir(), "stickyji-seed-note-test-"));
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
            await mongoose.connect(`mongodb://127.0.0.1:${port}/stickyji_seed_note_test?directConnection=true`, {
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
});

after(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongodProcess) {
        mongodProcess.kill();
        await delay(500);
    }
    if (testDirectory) {
        await rm(testDirectory, { recursive: true, force: true }).catch(() => {});
    }
});

test("1. Registration creates user with zero workspaces and zero folders (auto-seeding decommissioned)", async () => {
    const authService = new AuthService();
    const result = await authService.register({
        email: "firstnote@test.com",
        password: "Password123!",
        firstName: "First",
        lastName: "NoteUser",
    });

    const userId = result.data.user.id;
    assert.ok(userId, "User ID must be returned");

    // 1. Verify ZERO workspaces exist upon registration
    const workspaceCount = await WorkspaceModel.countDocuments({
        ownerId: new Types.ObjectId(userId),
    });
    assert.equal(workspaceCount, 0, "Newly registered user must begin with 0 workspaces");

    // 2. Verify ZERO folders exist upon registration
    const folderCount = await WorkspaceFolderModel.countDocuments({
        createdBy: new Types.ObjectId(userId),
    });
    assert.equal(folderCount, 0, "Newly registered user must begin with 0 folders");

    // 3. Verify onboarding status requires initial setup
    const provisioningService = new UserWorkspaceProvisioningService();
    const status = await provisioningService.getOnboardingStatus(userId);
    assert.deepEqual(status, {
        hasWorkspaces: false,
        hasFolders: false,
        requiresOnboarding: true,
    });
});

test("2. Dynamic initial setup creates workspace, folder, columns, default note, and initializes preferences", async () => {
    const user = await UserModel.findOne({ email: "firstnote@test.com" });
    assert.ok(user);
    const userId = user._id.toString();

    const provisioningService = new UserWorkspaceProvisioningService();
    const setupResult = await provisioningService.initialSetup(userId, {
        workspaceTitle: "Acme Workspace",
        folderTitle: "Main Notes",
    });

    assert.ok(setupResult.workspace, "Workspace must be returned");
    assert.equal(setupResult.workspace.name, "Acme Workspace");
    assert.ok(setupResult.folder, "Folder must be returned");
    assert.equal(setupResult.folder.name, "Main Notes");

    // Verify workspace in DB
    const workspace = await WorkspaceModel.findById(setupResult.workspace.id);
    assert.ok(workspace, "Workspace must exist in database");
    assert.equal(workspace.name, "Acme Workspace");
    assert.equal(workspace.isPersonal, true);

    // Verify folder in DB
    const folder = await WorkspaceFolderModel.findById(setupResult.folder.id);
    assert.ok(folder, "Folder must exist in database");
    assert.equal(folder.name, "Main Notes");
    assert.equal(folder.isDefault, true);

    // Verify columns exist
    const columns = await StickyNoteColumnModel.find({
        workspaceId: workspace._id,
        workspaceFolderId: folder._id,
    });
    assert.equal(columns.length, 2, "There must be 2 default columns (TODO and COMPLETED)");

    const todoColumn = columns.find((c) => c.type === StickyNoteColumnType.TODO);
    assert.ok(todoColumn, "Default TODO column must exist");

    // Verify default note exists in TODO column
    const note = await StickyNoteModel.findOne({
        workspaceId: workspace._id,
        workspaceFolderId: folder._id,
    });
    assert.ok(note, "Default note must be created");
    assert.equal(note.columnId.toString(), todoColumn._id.toString());

    // Verify User Preferences for selected workspace & folder are updated
    const userObjectId = new Types.ObjectId(userId);
    const selectedWsPref = await UserPreferenceModel.findOne({
        userId: userObjectId,
        key: "selectedworkspaceid",
    });
    assert.ok(selectedWsPref, "selectedWorkspaceId preference must exist");
    assert.equal(selectedWsPref.value, workspace._id.toString());

    const selectedFolderPref = await UserPreferenceModel.findOne({
        userId: userObjectId,
        key: "selectedfolderid",
    });
    assert.ok(selectedFolderPref, "selectedFolderId preference must exist");
    assert.equal(selectedFolderPref.value, folder._id.toString());

    // Verify onboarding status now reflects completion
    const status = await provisioningService.getOnboardingStatus(userId);
    assert.deepEqual(status, {
        hasWorkspaces: true,
        hasFolders: true,
        requiresOnboarding: false,
    });
});

test("3. Second initial setup attempt is rejected (conflict)", async () => {
    const user = await UserModel.findOne({ email: "firstnote@test.com" });
    assert.ok(user);
    const userId = user._id.toString();

    const provisioningService = new UserWorkspaceProvisioningService();
    await assert.rejects(
        () =>
            provisioningService.initialSetup(userId, {
                workspaceTitle: "Duplicate Workspace",
                folderTitle: "Duplicate Folder",
            }),
        (err) => {
            assert.equal(err.statusCode, 409);
            return true;
        },
    );
});
