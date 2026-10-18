import type { INotesWorkspaceDocument, INotesWorkspaceFilterPayload, } from "../interfaces/notesworkspace.interface.js";
import { NotesWorkspaceRepository } from "../repositories/notesworkspace.repository.js";
import { NotesWorkspaceUtil } from "../utils/notesworkspace.util.js";

export class NotesWorkspaceService {
    private repository: NotesWorkspaceRepository;

    constructor() {
        this.repository = new NotesWorkspaceRepository();
    }

    private getReferenceId(reference: any): string {
        if (!reference) {
            return "";
        }

        if (reference._id) {
            return reference._id.toString();
        }

        return reference.toString();
    }

    private async getAuthorizedWorkspace(id: string, owner: string) {
        if (!NotesWorkspaceUtil.isValidObjectId(id)) {
            throw new Error("Invalid workspace ID");
        }

        const workspace = await this.repository.findById(id, owner);

        if (!workspace) {
            throw new Error("Workspace not found or access denied");
        }

        return workspace;
    }

    async createWorkspace(data: Partial<INotesWorkspaceDocument>) {
        const title = typeof data.title === "string" ? data.title.trim() : "";

        if (!title) {
            throw new Error("Workspace title is required");
        }

        if (!data.owner) {
            throw new Error("Owner is required");
        }

        if (data.visibility && !NotesWorkspaceUtil.isValidVisibility(data.visibility)
        ) {
            throw new Error("Invalid workspace visibility");
        }

        const payload: Partial<INotesWorkspaceDocument> = {
            ...data,
            title,
            owner: data.owner,
            description:
                data.description?.trim() || "",
            visibility:
                data.visibility || "private",
            backgroundColor:
                data.backgroundColor || "#F8F9FA",
            backgroundImage:
                data.backgroundImage || undefined,
            backgroundImageUrl:
                data.backgroundImageUrl || "",
            members: NotesWorkspaceUtil.normalizeMembers(data.members),
            isArchived: false,
            isActive: true,
        };

        return await this.repository.create(payload);
    }

    async getWorkspaceById(id: string, owner: string) {
        return await this.getAuthorizedWorkspace(id, owner);
    }

    async getMyWorkspaces(owner: string) {
        if (!NotesWorkspaceUtil.isValidObjectId(owner)) {
            throw new Error("Invalid owner ID");
        }

        return await this.repository.findMyWorkspaces(owner);
    }

    async updateWorkspace(id: string, owner: string, data: Partial<INotesWorkspaceDocument>) {
        await this.getAuthorizedWorkspace(id, owner);

        const payload: Record<string, any> = { ...data, };

        delete payload._id;
        delete payload.owner;
        delete payload.createdAt;
        delete payload.updatedAt;

        if (data.title !== undefined) {
            const title = typeof data.title === "string" ? data.title.trim() : "";

            if (!title) {
                throw new Error("Workspace title cannot be empty");
            }

            payload.title = title;
        }

        if (data.description !== undefined) {
            payload.description = data.description.trim();
        }

        if (data.visibility !== undefined) {
            if (!NotesWorkspaceUtil.isValidVisibility(data.visibility)) {
                throw new Error("Invalid workspace visibility");
            }

            payload.visibility = data.visibility;
        }

        if (data.members !== undefined) {
            payload.members = NotesWorkspaceUtil.normalizeMembers(data.members);
        }

        if (data.backgroundColor !== undefined) {
            payload.backgroundColor = data.backgroundColor;
        }

        if (data.backgroundImage !== undefined) {
            payload.backgroundImage = data.backgroundImage;
        }

        if (data.backgroundImageUrl !== undefined) {
            payload.backgroundImageUrl = data.backgroundImageUrl;
        }

        const workspace = await this.repository.update(id, owner, payload);

        if (!workspace) {
            throw new Error("Workspace update failed");
        }

        return workspace;
    }

    async deleteWorkspace(id: string, owner: string) {
        await this.getAuthorizedWorkspace(id, owner);

        const workspace = await this.repository.delete(id, owner);

        if (!workspace) {
            throw new Error("Workspace deletion failed");
        }

        return workspace;
    }

    async deactivateWorkspace(id: string, owner: string) {
        await this.getAuthorizedWorkspace(id, owner);

        const workspace = await this.repository.deactivate(id, owner);

        if (!workspace) {
            throw new Error("Workspace deactivation failed");
        }

        return workspace;
    }

    async activateWorkspace(id: string, owner: string) {
        await this.getAuthorizedWorkspace(id, owner);

        const workspace = await this.repository.activate(id, owner);

        if (!workspace) {
            throw new Error("Workspace activation failed");
        }

        return workspace;
    }

    async archiveWorkspace(id: string, owner: string) {
        await this.getAuthorizedWorkspace(id, owner);

        const workspace = await this.repository.archive(id, owner);

        if (!workspace) {
            throw new Error("Workspace archive failed");
        }

        return workspace;
    }

    async unarchiveWorkspace(id: string, owner: string) {
        await this.getAuthorizedWorkspace(id, owner);

        const workspace = await this.repository.unarchive(id, owner);

        if (!workspace) {
            throw new Error("Workspace unarchive failed");
        }

        return workspace;
    }

    async filterMyWorkspaces(owner: string, payload: INotesWorkspaceFilterPayload) {
        const page = Number(payload.page) > 0 ? Number(payload.page) : 1;

        const limit = Number(payload.limit) > 0 && Number(payload.limit) <= 100 ? Number(payload.limit) : 10;

        const filter: Record<string, any> = { owner, };

        if (typeof payload.isActive === "boolean") {
            filter.isActive = payload.isActive;
        }

        if (typeof payload.isArchived === "boolean") {
            filter.isArchived = payload.isArchived;
        }

        if (payload.visibility) {
            const visibilities = Array.isArray(payload.visibility) ? payload.visibility : [payload.visibility];

            const invalidVisibility = visibilities.find((visibility) => !NotesWorkspaceUtil.isValidVisibility(visibility));

            if (invalidVisibility) {
                throw new Error(`Invalid workspace visibility: ${invalidVisibility}`);
            }

            filter.visibility = {
                $in: visibilities,
            };
        }

        if (payload.search?.trim()) {
            const escapedSearch = payload.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

            const searchRegex = new RegExp(escapedSearch, "i");

            filter.$or = [
                {
                    title: searchRegex,
                },
                {
                    description: searchRegex,
                },
            ];
        }

        const allowedSortFields = [
            "title",
            "visibility",
            "createdAt",
            "updatedAt",
        ];

        const sortBy = payload.sortBy && allowedSortFields.includes(payload.sortBy) ? payload.sortBy : "updatedAt";

        const sortOrder: 1 | -1 = payload.sortOrder === "asc" ? 1 : -1;

        const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder, createdAt: -1, };

        return await this.repository.filterMyWorkspaces(
            {
                filter,
                page,
                limit,
                sort,
            }
        );
    }
}