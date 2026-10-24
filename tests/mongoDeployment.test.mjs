import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import mongoose, { Types } from "mongoose";
import { runMongoTransaction } from "../src/utils/mongoTransaction.util.ts";
import { connectDatabase } from "../src/config/database.ts";
import { mongoConnectionOptions } from "../src/config/mongoConnectionOptions.ts";
import { WorkspaceMemberInvitationRepository } from "../src/modules/workspaceInvitations/repositories/workspaceMemberInvitation.repository.ts";
import { WorkspaceMemberInvitationModel as Invitation } from "../src/modules/workspaceInvitations/models/workspaceMemberInvitation.model.ts";
import { WorkspaceRepository } from "../src/modules/workspace/repositories/workspace.repository.ts";
import { WorkspaceFolderRepository } from "../src/modules/workspaceFolders/repositories/workspaceFolder.repository.ts";
import { StickyNoteRepository } from "../src/modules/stickynotes/repositories/stickynote.repository.ts";
import { StickyNoteColumnRepository } from "../src/modules/stickynotescolumns/repositories/stickyNoteColumn.repository.ts";
import { SubscriptionSeedRepository } from "../src/seeders/subscription/repositories/subscription-seed.repository.ts";

test("connection options preserve maintenance settings and override retryable writes", () => {
    const settings = {
        autoIndex: false,
        autoCreate: false,
        serverSelectionTimeoutMS: 10000,
        retryWrites: true,
    };
    const options = mongoConnectionOptions(settings);
    assert.deepEqual(options, { ...settings, retryWrites: false });
    assert.equal(settings.retryWrites, true);
    const client = new mongoose.mongo.MongoClient(
        "mongodb://127.0.0.1/test?retryWrites=true",
        mongoConnectionOptions(),
    );
    assert.equal(client.options.retryWrites, false);
});

for (const replicaSet of [false, true]) {
    test(`MongoDB ${replicaSet ? "replica set" : "standalone"}: bulk writes, lifecycle wrappers and failure safety`, async (t) => {
        const socket = createServer().listen(0, "127.0.0.1");
        await once(socket, "listening");
        const port = socket.address().port;
        await new Promise((resolve) => socket.close(resolve));
        const directory = await mkdtemp(join(tmpdir(), "sticky-deployment-test-"));
        const mongo = spawn(
            process.env.MONGOD_BINARY ?? "mongod",
            [
                "--dbpath",
                directory,
                "--port",
                String(port),
                "--bind_ip",
                "127.0.0.1",
                "--logpath",
                join(directory, "mongo.log"),
                ...(replicaSet ? ["--replSet", "deploymentTest"] : []),
            ],
            { windowsHide: true, stdio: "ignore" },
        );
        let startupError;
        mongo.on("error", (error) => {
            startupError = error;
        });
        t.after(async () => {
            mock.restoreAll();
            await mongoose.disconnect();
            if (mongo.exitCode === null && !startupError) {
                const exited = once(mongo, "exit");
                mongo.kill();
                await exited;
            }
            await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
        });
        const uri = `mongodb://127.0.0.1:${port}/deployment_test?directConnection=true&serverSelectionTimeoutMS=500`;
        const probe = new mongoose.mongo.MongoClient(uri);
        try {
            for (let attempt = 0; ; attempt++) {
                if (startupError) throw startupError;
                try {
                    await probe.connect();
                    break;
                } catch (error) {
                    if (attempt >= 40) throw error;
                    await delay(250);
                }
            }
            if (replicaSet) {
                await probe.db("admin").command({
                    replSetInitiate: {
                        _id: "deploymentTest",
                        members: [{ _id: 0, host: `127.0.0.1:${port}` }],
                    },
                });
                for (let attempt = 0; ; attempt++) {
                    if ((await probe.db("admin").command({ hello: 1 })).isWritablePrimary) break;
                    assert.ok(attempt < 80);
                    await delay(250);
                }
            }
        } finally {
            await probe.close();
        }
        await connectDatabase(uri);
        assert.equal(mongoose.connection.getClient().options.retryWrites, false);
        await Invitation.createCollection();
        await Invitation.createIndexes();
        const collection = mongoose.connection.db.collection("transaction_probe");
        await collection.insertOne({ _id: "setup" });
        const repositories = [
            new WorkspaceRepository(),
            new WorkspaceFolderRepository(),
            new StickyNoteRepository(),
            new StickyNoteColumnRepository(),
            new WorkspaceMemberInvitationRepository(),
        ];
        const runners = repositories.map((repository) => repository.runInTransaction.bind(repository));
        runners.push(new SubscriptionSeedRepository().transaction.bind(new SubscriptionSeedRepository()));
        for (const [index, run] of runners.entries()) {
            await run(async (session) => {
                assert.equal(Boolean(session), replicaSet);
                const options = session ? { session } : {};
                await collection.bulkWrite(
                    [{ insertOne: { document: { _id: `row-${index}`, value: 1 } } }],
                    options,
                );
                await collection.updateOne({ _id: `row-${index}` }, { $inc: { value: 1 } }, options);
                return true;
            });
            assert.equal((await collection.findOne({ _id: `row-${index}` })).value, 2);
            await run((session) => collection.deleteOne({ _id: `row-${index}` }, session ? { session } : {}));
        }
        const invitations = new WorkspaceMemberInvitationRepository();
        const workspaceId = new Types.ObjectId();
        const record = {
            _id: new Types.ObjectId(),
            workspaceId,
            email: "standalone@example.test",
            roleId: new Types.ObjectId(),
            invitedBy: new Types.ObjectId(),
            tokenHash: "a".repeat(64),
            status: "PENDING",
            expiresAt: new Date(Date.now() + 60000),
        };
        const created = await invitations.runInTransaction((session) =>
            invitations.createPendingBatchIfMissing([record], session),
        );
        assert.equal(created.length, 1);
        const duplicate = await invitations.runInTransaction((session) =>
            invitations.createPendingBatchIfMissing(
                [{ ...record, _id: new Types.ObjectId(), tokenHash: "b".repeat(64) }],
                session,
            ),
        );
        assert.equal(duplicate.length, 0);
        assert.equal(await Invitation.countDocuments({ workspaceId }), 1);

        // A business/driver failure must never cause the callback to be replayed outside its transaction.
        let invocations = 0;
        const failure = Object.assign(new Error("Illegal operation in business logic"), {
            code: 20,
            codeName: "IllegalOperation",
        });
        await assert.rejects(
            () =>
                invitations.runInTransaction(async (session) => {
                    invocations++;
                    await collection.insertOne({ _id: "failure" }, session ? { session } : {});
                    throw failure;
                }),
            (error) => error === failure,
        );
        assert.equal(invocations, 1);
        assert.equal(Boolean(await collection.findOne({ _id: "failure" })), !replicaSet);

        let ran = false;
        const discoveryFailure = Object.assign(new Error("Topology lookup failed"), { code: 20 });
        const admin = mock.method(mongoose.connection.db, "admin", () => ({
            command: async () => {
                throw discoveryFailure;
            },
        }));
        await assert.rejects(
            () =>
                runMongoTransaction(async () => {
                    ran = true;
                }),
            (error) => error === discoveryFailure,
        );
        assert.equal(ran, false);
        admin.mock.restore();
    });
}
