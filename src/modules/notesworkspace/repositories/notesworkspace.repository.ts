import type { INotesWorkspaceDocument } from "../interfaces/notesworkspace.interface.js";
import { NotesWorkspaceModel } from "../models/notesworkspace.model.js";

interface IFilterNotesWorkspaceRepositoryPayload {
    filter: Record<string, any>;
    page: number;
    limit: number;
    sort: Record<string, 1 | -1>;
}

export class NotesWorkspaceRepository {
    private readonly populateOptions = [
        {
            path: "owner",
            select: "firstName lastName email",
        },
        {
            path: "members",
            select: "firstName lastName email",
        },
        // {
        //     path: "backgroundImage",
        // },
    ];

    async create(data: Partial<INotesWorkspaceDocument>) {
        const workspace = await NotesWorkspaceModel.create(data);

        return workspace.populate(this.populateOptions);
    }

    async findById(id: string, owner: string) {
        return await NotesWorkspaceModel.findOne({
            _id: id,
            owner,
        }).populate(this.populateOptions);
    }

    async findMyWorkspaces(owner: string) {
        return await NotesWorkspaceModel.find({
            owner,
            isActive: true,
        })
            .populate(this.populateOptions)
            .sort({
                updatedAt: -1,
                createdAt: -1,
            });
    }

    async update(id: string, owner: string, data: Record<string, any>) {
        return await NotesWorkspaceModel.findOneAndUpdate(
            {
                _id: id,
                owner,
            },
            {
                $set: data,
            },
            {
                new: true,
                runValidators: true,
            },
        ).populate(this.populateOptions);
    }

    async delete(id: string, owner: string) {
        return await NotesWorkspaceModel.findOneAndDelete({
            _id: id,
            owner,
        });
    }

    async deactivate(id: string, owner: string) {
        return await NotesWorkspaceModel.findOneAndUpdate(
            {
                _id: id,
                owner,
            },
            {
                $set: {
                    isActive: false,
                },
            },
            {
                new: true,
                runValidators: true,
            },
        ).populate(this.populateOptions);
    }

    async activate(id: string, owner: string) {
        return await NotesWorkspaceModel.findOneAndUpdate(
            {
                _id: id,
                owner,
            },
            {
                $set: {
                    isActive: true,
                },
            },
            {
                new: true,
                runValidators: true,
            },
        ).populate(this.populateOptions);
    }

    async archive(id: string, owner: string) {
        return await NotesWorkspaceModel.findOneAndUpdate(
            {
                _id: id,
                owner,
            },
            {
                $set: {
                    isArchived: true,
                },
            },
            {
                new: true,
                runValidators: true,
            },
        ).populate(this.populateOptions);
    }

    async unarchive(id: string, owner: string) {
        return await NotesWorkspaceModel.findOneAndUpdate(
            {
                _id: id,
                owner,
            },
            {
                $set: {
                    isArchived: false,
                },
            },
            {
                new: true,
                runValidators: true,
            },
        ).populate(this.populateOptions);
    }

    async filterMyWorkspaces({ filter, page, limit, sort }: IFilterNotesWorkspaceRepositoryPayload) {
        const skip = (page - 1) * limit;

        const [workspaces, totalRecords] = await Promise.all([
            NotesWorkspaceModel.find(filter)
                .populate(this.populateOptions)
                .sort(sort)
                .skip(skip)
                .limit(limit),

            NotesWorkspaceModel.countDocuments(filter),
        ]);

        const totalPages = totalRecords === 0 ? 0 : Math.ceil(totalRecords / limit);

        return {
            workspaces,
            pagination: {
                currentPage: page,
                limit,
                totalRecords,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            },
        };
    }
}
