import { Types } from "mongoose";
import { WorkspaceRepository } from "../repositories/workspace.repository.js";
import { WorkspaceMessages } from "../constants/workspace.messages.js";
import { AppError } from "../../../utils/errors/app.error.js";

// Child services use the parent's state; trashing a workspace never changes its children.
export class WorkspaceAvailabilityService {
    private readonly repository = new WorkspaceRepository();

    async assertAvailable(value: unknown): Promise<void> {
        const id =
            typeof value === "object" && value !== null && "_id" in value
                ? String(value._id)
                : String(value ?? "");
        if (!Types.ObjectId.isValid(id) || !(await this.repository.findById(id))) {
            throw new AppError(WorkspaceMessages.NOT_FOUND, 404);
        }
    }

    async assertNoteWorkspaceAvailable(value: unknown): Promise<void> {
        const id =
            typeof value === "object" && value !== null && "_id" in value
                ? String(value._id)
                : String(value ?? "");
        if (!Types.ObjectId.isValid(id)) throw new AppError(WorkspaceMessages.NOT_FOUND, 404);
        const note = await this.repository.findNoteWorkspace(id);
        await this.assertAvailable(note?.workspaceId);
    }
}

export const workspaceAvailabilityService = new WorkspaceAvailabilityService();
