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

test("1. Registration automatically provisions workspace, folder, columns, default 'My First Note', and preferences", async () => {
    const authService = new AuthService();
    const result = await authService.register({
        email: "firstnote@test.com",
        password: "Password123!",
        firstName: "First",
        lastName: "NoteUser",
    });

    const userId = result.data.user.id;
    assert.ok(userId, "User ID must be returned");

    // 1. Verify Personal Workspace exists
    const workspace = await WorkspaceModel.findOne({
        ownerId: new Types.ObjectId(userId),
        isPersonal: true,
    });
    assert.ok(workspace, "Personal workspace must be provisioned");
    assert.equal(workspace.name, USER_WORKSPACE_CONSTANTS.WORKSPACE.NAME);

    // 2. Verify Default Workspace Folder exists
    const folder = await WorkspaceFolderModel.findOne({
        workspaceId: workspace._id,
        isDefault: true,
    });
    assert.ok(folder, "Default folder must be provisioned");
    assert.equal(folder.name, USER_WORKSPACE_CONSTANTS.DEFAULT_FOLDER.NAME);

    // 3. Verify Default Columns exist (TODO, COMPLETED)
    const columns = await StickyNoteColumnModel.find({
        workspaceId: workspace._id,
        workspaceFolderId: folder._id,
    });
    assert.equal(columns.length, 2, "There must be 2 default columns (TODO and COMPLETED)");

    const todoColumn = columns.find((c) => c.type === StickyNoteColumnType.TODO);
    assert.ok(todoColumn, "Default TODO column must exist");

    // 4. Verify Default 'My First Note' exists
    const note = await StickyNoteModel.findOne({
        workspaceId: workspace._id,
        workspaceFolderId: folder._id,
        title: USER_WORKSPACE_CONSTANTS.DEFAULT_NOTE.TITLE,
    });
    assert.ok(note, "Default 'My First Note' must be seeded in database");
    assert.equal(note.columnId.toString(), todoColumn._id.toString(), "Note must be in TODO column");
    assert.equal(note.content, USER_WORKSPACE_CONSTANTS.DEFAULT_NOTE.CONTENT);
    assert.equal(note.color, StickyNoteColor.YELLOW);
    assert.equal(note.status, StickyNoteStatus.ACTIVE);
    assert.equal(note.position, 0);
    assert.equal(note.stickyNoteNumber, 1, "First note in workspace must have stickyNoteNumber = 1");
    assert.ok(note.rank, "Note must have a valid rank");
    assert.equal(note.createdBy.toString(), userId);

    // 5. Verify User Preferences for selected workspace & folder are initialized
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

    const myNotesWsPref = await UserPreferenceModel.findOne({
        userId: userObjectId,
        key: "mynotesselectedworkspace",
    });
    assert.ok(myNotesWsPref, "myNotesSelectedWorkspace preference must exist");
    assert.equal(myNotesWsPref.value, workspace._id.toString());

    const myNotesFolderPref = await UserPreferenceModel.findOne({
        userId: userObjectId,
        key: "mynotesselectedfolder",
    });
    assert.ok(myNotesFolderPref, "myNotesSelectedFolder preference must exist");
    assert.equal(myNotesFolderPref.value, folder._id.toString());

    const favWsPref = await UserPreferenceModel.findOne({
        userId: userObjectId,
        key: "favouriteselectedworkspace",
    });
    assert.ok(favWsPref, "favouriteSelectedWorkspace preference must exist");
    assert.equal(favWsPref.value, workspace._id.toString());
});

test("2. Default provisioning is idempotent and does not create duplicates on second run", async () => {
    const user = await UserModel.findOne({ email: "firstnote@test.com" });
    assert.ok(user);

    const provisioningService = new UserWorkspaceProvisioningService();
    await provisioningService.provisionUserDefaults(user);

    const workspaceCount = await WorkspaceModel.countDocuments({
        ownerId: user._id,
        isPersonal: true,
    });
    assert.equal(workspaceCount, 1, "Only 1 personal workspace should exist");

    const noteCount = await StickyNoteModel.countDocuments({
        createdBy: user._id,
        title: USER_WORKSPACE_CONSTANTS.DEFAULT_NOTE.TITLE,
    });
    assert.equal(noteCount, 1, "Only 1 default note should exist");
});
