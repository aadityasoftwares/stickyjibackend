import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { PermissionAction, PermissionModule } from "../constants/permission.enums.js";
import { permissionAuthorizationService } from "../services/permissionAuthorization.service.js";
import { StickyNoteModel } from "../../stickynotes/models/stickyNote.model.js";
import { WorkspaceMemberRepository } from "../../workspaceMember/repositories/workspaceMember.repository.js";
import { AppError } from "../../../utils/errors/app.error.js";
import { StickyNoteMessages } from "../../stickynotes/constants/stickyNote.messages.js";
import { WorkspaceMemberMessages } from "../../workspaceMember/constants/workspaceMember.messages.js";
import { WorkspaceFolderRepository } from "../../workspaceFolders/repositories/workspaceFolder.repository.js";
import { WorkspaceFolderMessages } from "../../workspaceFolders/constants/workspaceFolder.messages.js";
import { WorkspaceMemberInvitationRepository } from "../../workspaceInvitations/repositories/workspaceMemberInvitation.repository.js";
import { WorkspaceMemberInvitationMessages } from "../../workspaceInvitations/constants/workspaceMemberInvitation.messages.js";

import { RoleModel } from "../../roles/models/role.model.js";
import { RoleMessages } from "../../roles/constants/role.messages.js";
import { StickyNoteColumnModel } from "../../stickynotescolumns/models/stickyNoteColumn.model.js";
import { StickyNoteColumnMessages } from "../../stickynotescolumns/constants/stickyNoteColumn.messages.js";

export interface IRequirePermissionOptions {
    module: PermissionModule | string;
    action: PermissionAction | PermissionAction[];
    resource?: "note" | "member" | "workspace" | "folder" | "invitation" | "role" | "column";
    getWorkspaceId?: (req: Request) => string | undefined | Promise<string | undefined>;
    allowTrashedWorkspace?: boolean;
    allowInactiveWorkspace?: boolean;
    scope?: "global";
}

declare global {
    namespace Express {
        interface Locals {
            workspaceAuth?: import("../services/permissionAuthorization.service.js").IWorkspaceAuthorizationContext;
            globalAuth?: import("../services/permissionAuthorization.service.js").IGlobalAuthorizationContext;
            stickyNote?: unknown;
            targetMember?: unknown;
            targetRole?: unknown;
            targetInvitation?: Awaited<ReturnType<WorkspaceMemberInvitationRepository["findByIdForMutation"]>>;
            invitationResponse?: Awaited<ReturnType<WorkspaceMemberInvitationRepository["findById"]>>;
            targetColumn?: unknown;
        }
    }
}

export const requirePermission = (options: IRequirePermissionOptions) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId || !Types.ObjectId.isValid(userId)) {
                throw new AppError("Unauthorized: Invalid authenticated user", 401);
            }

            console.log("RequirePermission middleware invoked with options:", options, "for userId:", userId);

            if (options.scope === "global") {
                const auth = await permissionAuthorizationService.resolveGlobalAuthorization(userId);
                permissionAuthorizationService.assertPermission(auth, options.module, options.action);
                res.locals.globalAuth = auth;
                next();
                return;
            }

            let workspaceId: string | undefined;

            if (options.resource === "invitation") {
                const id = req.params.id;
                if (typeof id !== "string" || !Types.ObjectId.isValid(id)) throw new AppError(WorkspaceMemberInvitationMessages.NOT_FOUND, 404);
                const repository = new WorkspaceMemberInvitationRepository();
                const invitation = options.action === PermissionAction.READ
                    ? await repository.findById(id) : await repository.findByIdForMutation(id);
                if (!invitation) throw new AppError(WorkspaceMemberInvitationMessages.NOT_FOUND, 404);
                const workspace = invitation.workspaceId;
                workspaceId = String(workspace && typeof workspace === "object" && "_id" in workspace ? workspace._id : workspace);
                for (const supplied of [req.query.workspaceId, req.body?.workspaceId]) {
                    if (supplied !== undefined && supplied !== workspaceId) throw new AppError(WorkspaceMemberInvitationMessages.ACCESS_DENIED, 403);
                }
                if (options.action === PermissionAction.READ) res.locals.invitationResponse = invitation;
                else res.locals.targetInvitation = invitation;
            }

            if (options.getWorkspaceId) {
                workspaceId = await options.getWorkspaceId(req);
            }

            if (options.resource === "folder") {
                const id = req.params.id;
                if (typeof id !== "string" || !Types.ObjectId.isValid(id)) throw new AppError(WorkspaceFolderMessages.NOT_FOUND, 400);
                const folder = await new WorkspaceFolderRepository().findByIdIncludingDeleted(id);
                if (!folder) throw new AppError(WorkspaceFolderMessages.NOT_FOUND, 404);
                workspaceId = folder.workspaceId.toString();
                for (const supplied of [req.query.workspaceId, req.body?.workspaceId]) {
                    if (supplied !== undefined && supplied !== workspaceId) throw new AppError(WorkspaceFolderMessages.WORKSPACE_MISMATCH, 400);
                }
            }

            if (options.resource === "column") {
                const id = req.params.id;
                if (typeof id !== "string" || !Types.ObjectId.isValid(id)) throw new AppError(StickyNoteColumnMessages.INVALID_ID, 400);
                const column = await StickyNoteColumnModel.findById(id).select("_id workspaceId workspaceFolderId isSystem").lean().exec();
                if (!column) throw new AppError(StickyNoteColumnMessages.NOT_FOUND, 404);
                res.locals.targetColumn = column;
                workspaceId = column.workspaceId.toString();
                for (const supplied of [req.query?.workspaceId, (req.body as Record<string, unknown> | undefined)?.workspaceId]) {
                    if (supplied !== undefined && supplied !== workspaceId) throw new AppError(StickyNoteColumnMessages.COLUMN_WORKSPACE_MISMATCH, 400);
                }
            }

            if (options.resource === "workspace") {
                const id = req.params.id;
                if (typeof id !== "string" || !Types.ObjectId.isValid(id)) throw new AppError("Invalid workspace ID.", 400);
                workspaceId = id;
            }

            if (!workspaceId) {
                const paramWs = req.params?.workspaceId;
                const queryWs = req.query?.workspaceId;
                const bodyWs = (req.body as Record<string, unknown> | undefined)?.workspaceId;
                const localsWs = res.locals?.stickyNoteFilters?.workspaceId;

                if (typeof paramWs === "string" && Types.ObjectId.isValid(paramWs)) {
                    workspaceId = paramWs.trim();
                } else if (typeof queryWs === "string" && Types.ObjectId.isValid(queryWs)) {
                    workspaceId = queryWs.trim();
                } else if (typeof bodyWs === "string" && Types.ObjectId.isValid(bodyWs)) {
                    workspaceId = bodyWs.trim();
                } else if (typeof localsWs === "string" && Types.ObjectId.isValid(localsWs)) {
                    workspaceId = localsWs.trim();
                }
            }

            // If not found yet and resource is a note, resolve from note id in params
            if (!workspaceId && options.resource === "note") {
                const rawNoteId = req.params?.id ?? req.params?.stickyNoteId;
                const noteId = typeof rawNoteId === "string" ? rawNoteId.trim() : undefined;
                if (noteId && Types.ObjectId.isValid(noteId)) {
                    const note = await StickyNoteModel.findById(noteId)
                        .select("_id workspaceId createdBy status")
                        .lean()
                        .exec();

                    if (!note) {
                        throw new AppError(StickyNoteMessages.NOT_FOUND, 404, "STICKY_NOTE_NOT_FOUND");
                    }

                    res.locals.stickyNote = note;
                    workspaceId = note.workspaceId.toString();
                }
            }

            // The stored member determines the workspace even when a request supplies a workspace hint.
            if (options.resource === "member") {
                const rawMemberId = req.params?.id;
                const memberId = typeof rawMemberId === "string" ? rawMemberId.trim() : undefined;
                if (!memberId || !Types.ObjectId.isValid(memberId)) {
                    throw new AppError(WorkspaceMemberMessages.NOT_FOUND, 400);
                }
                const member = await new WorkspaceMemberRepository().findAuthorizationTarget(memberId);
                if (!member) throw new AppError(WorkspaceMemberMessages.NOT_FOUND, 404);
                const memberWorkspaceId = member.workspaceId.toString();
                for (const supplied of [req.query.workspaceId, req.body?.workspaceId]) {
                    if (supplied !== undefined && supplied !== memberWorkspaceId) {
                        throw new AppError(WorkspaceMemberMessages.ACCESS_DENIED, 403);
                    }
                }
                res.locals.targetMember = member;
                workspaceId = memberWorkspaceId;
            }

            if (options.resource === "role") {
                const rawRoleId = req.params?.id ?? (req.body as Record<string, unknown> | undefined)?.id ?? req.query?.id;
                const roleId = typeof rawRoleId === "string" ? rawRoleId.trim() : undefined;
                if (!roleId || !Types.ObjectId.isValid(roleId)) {
                    throw new AppError(RoleMessages.NOT_FOUND, 404);
                }
                const role = await RoleModel.findById(roleId)
                    .select("_id name displayName code type scope workspaceId isSystem isDefault priority isActive permissions")
                    .lean()
                    .exec();
                if (!role) {
                    throw new AppError(RoleMessages.NOT_FOUND, 404);
                }
                res.locals.targetRole = role;
                if (role.workspaceId) {
                    const roleWorkspaceId = role.workspaceId.toString();
                    for (const supplied of [req.query.workspaceId, (req.body as Record<string, unknown> | undefined)?.workspaceId]) {
                        if (supplied !== undefined && supplied !== roleWorkspaceId) {
                            throw new AppError(RoleMessages.WORKSPACE_MISMATCH, 403);
                        }
                    }
                    workspaceId = roleWorkspaceId;
                } else if (role.isSystem) {
                    const actionList = Array.isArray(options.action) ? options.action : [options.action];
                    const isMutation = actionList.some(a => [PermissionAction.UPDATE, PermissionAction.DELETE].includes(a));
                    if (isMutation) {
                        throw new AppError(actionList.includes(PermissionAction.DELETE) ? RoleMessages.SYSTEM_ROLE_DELETE : RoleMessages.SYSTEM_ROLE_UPDATE, 403);
                    }
                }
            }

            // If a workspaceId could be determined, resolve and enforce permissions
            if (workspaceId) {
                const auth = await permissionAuthorizationService.resolveWorkspaceAuthorization(
                    userId,
                    workspaceId,
                    options.allowTrashedWorkspace ?? false,
                    options.allowInactiveWorkspace ?? false,
                );
                res.locals.workspaceAuth = auth;

                if (options.module === PermissionModule.WORKSPACE) {
                    permissionAuthorizationService.assertWorkspaceAccess(auth, options.action);
                } else if (options.module === PermissionModule.FOLDERS) {
                    permissionAuthorizationService.assertFolderAccess(auth, options.action);
                } else if (options.module === PermissionModule.MEMBERS) {
                    permissionAuthorizationService.assertMemberAccess(auth, options.action);
                } else {
                    permissionAuthorizationService.assertPermission(auth, options.module, options.action);
                }

                if (options.resource === "note" && res.locals.stickyNote) {
                    permissionAuthorizationService.assertNoteAccess(
                        auth,
                        res.locals.stickyNote as { createdBy?: unknown; workspaceId?: unknown },
                        options.action,
                    );
                }

                if (options.resource === "role" && res.locals.targetRole) {
                    const actionList = Array.isArray(options.action) ? options.action : [options.action];
                    const isMutation = actionList.some(a => [PermissionAction.UPDATE, PermissionAction.DELETE].includes(a));
                    if (isMutation) {
                        permissionAuthorizationService.assertCanManageRole(
                            auth,
                            res.locals.targetRole as { priority?: number; code?: string; isSystem?: boolean; workspaceId?: unknown },
                        );
                    }
                }
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};
