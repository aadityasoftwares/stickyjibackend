import { Types, type AnyBulkWriteOperation, type ClientSession } from "mongoose";
import type { IStickyNoteColumn } from "../interfaces/stickyNoteColumn.interface.js";
import type { StickyNoteColumnType } from "../constants/stickyNoteColumn.enums.js";
import { StickyNoteColumnModel } from "../models/stickyNoteColumn.model.js";
import { RankUtil } from "../../../utils/rank.util.js";

export const COLUMN_SELECT =
    "_id workspaceId workspaceFolderId name type color position rank isSystem createdBy updatedBy createdAt updatedAt";

export class StickyNoteColumnRepository {
    async create(data: Partial<IStickyNoteColumn>) {
        return StickyNoteColumnModel.create(data);
    }

    async createMany(data: Partial<IStickyNoteColumn>[]) {
        return StickyNoteColumnModel.insertMany(data, { ordered: true });
    }

    async findById(id: string) {
        return StickyNoteColumnModel.findById(new Types.ObjectId(id)).select(COLUMN_SELECT).lean();
    }

    async findAllByWorkspaceFolder(workspaceId: string, workspaceFolderId: string, session?: ClientSession) {
        const query = StickyNoteColumnModel.find({
            workspaceId: new Types.ObjectId(workspaceId),
            workspaceFolderId: new Types.ObjectId(workspaceFolderId),
        })
            .select(COLUMN_SELECT)
            .sort({ rank: 1, position: 1, _id: 1 })
            .lean();

        if (session) query.session(session);
        return query.exec();
    }

    async countByWorkspaceFolder(workspaceId: string, workspaceFolderId: string): Promise<number> {
        return StickyNoteColumnModel.countDocuments({
            workspaceId: new Types.ObjectId(workspaceId),
            workspaceFolderId: new Types.ObjectId(workspaceFolderId),
        });
    }

    async existsById(id: string): Promise<boolean> {
        return !!(await StickyNoteColumnModel.exists({ _id: new Types.ObjectId(id) }));
    }

    async findSystemByType(workspaceId: string, workspaceFolderId: string, type: StickyNoteColumnType) {
        return StickyNoteColumnModel.findOne({
            workspaceId: new Types.ObjectId(workspaceId),
            workspaceFolderId: new Types.ObjectId(workspaceFolderId),
            type,
        })
            .select("_id")
            .lean();
    }

    async getHighestPosition(workspaceId: string, workspaceFolderId: string): Promise<number> {
        const column = await StickyNoteColumnModel.findOne({
            workspaceId: new Types.ObjectId(workspaceId),
            workspaceFolderId: new Types.ObjectId(workspaceFolderId),
        })
            .sort({ position: -1 })
            .select("position")
            .lean();

        return column?.position ?? -1;
    }

    async getHighestRank(workspaceId: string, workspaceFolderId: string): Promise<string | null> {
        const column = await StickyNoteColumnModel.findOne({
            workspaceId: new Types.ObjectId(workspaceId),
            workspaceFolderId: new Types.ObjectId(workspaceFolderId),
        })
            .sort({ rank: -1, position: -1 })
            .select("rank")
            .lean();

        return column?.rank ?? null;
    }

    async getNextRank(workspaceId: string, workspaceFolderId: string): Promise<string> {
        const highestRank = await this.getHighestRank(workspaceId, workspaceFolderId);
        if (!highestRank) return RankUtil.generateInitialRank();
        return RankUtil.generateRankAfter(highestRank) ?? RankUtil.generateInitialRank();
    }

    async updateById(id: string, data: Partial<IStickyNoteColumn>) {
        return StickyNoteColumnModel.findByIdAndUpdate(
            new Types.ObjectId(id),
            { $set: data },
            { new: true, runValidators: true },
        )
            .select(COLUMN_SELECT)
            .lean();
    }

    async deleteById(id: string, session?: ClientSession) {
        const query = StickyNoteColumnModel.findByIdAndDelete(new Types.ObjectId(id));
        if (session) query.session(session);
        return query.exec();
    }

    async hardDeleteById(id: string, session?: ClientSession) {
        return this.deleteById(id, session);
    }

    async reorder(
        workspaceId: string,
        workspaceFolderId: string,
        orderedIds: string[],
        updatedBy: Types.ObjectId,
    ) {
        const ranks = RankUtil.generateNSequentialRanks(orderedIds.length);
        const bulkOperations: AnyBulkWriteOperation<IStickyNoteColumn>[] = orderedIds.map((id, index) => ({
            updateOne: {
                filter: {
                    _id: new Types.ObjectId(id),
                    workspaceId: new Types.ObjectId(workspaceId),
                    workspaceFolderId: new Types.ObjectId(workspaceFolderId),
                },
                update: { $set: { position: index, rank: ranks[index], updatedBy } },
            },
        }));

        await StickyNoteColumnModel.bulkWrite(bulkOperations);
        return this.findAllByWorkspaceFolder(workspaceId, workspaceFolderId);
    }

    async normalizeRanks(workspaceId: string, workspaceFolderId: string): Promise<void> {
        const columns = await StickyNoteColumnModel.find({
            workspaceId: new Types.ObjectId(workspaceId),
            workspaceFolderId: new Types.ObjectId(workspaceFolderId),
        })
            .select("_id rank position createdAt")
            .sort({ rank: 1, position: 1, createdAt: 1, _id: 1 })
            .lean();

        if (columns.length === 0) return;

        const newRanks = RankUtil.generateNSequentialRanks(columns.length);
        const bulkOps = columns.map((col, index) => ({
            updateOne: {
                filter: { _id: col._id },
                update: { $set: { rank: newRanks[index] } },
            },
        }));

        await StickyNoteColumnModel.bulkWrite(bulkOps);
    }
}
