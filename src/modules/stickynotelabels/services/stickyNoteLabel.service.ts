import { subscriptionEntitlementService } from "../../subscriptionentitlement/services/subscriptionentitlement.service.js";
import { FeatureCode } from "../../feature/constants/feature.enums.js";
import { workspaceAvailabilityService } from "../../workspace/services/workspaceAvailability.service.js";
import { Types } from "mongoose";

import type {
    IStickyNoteLabel,
    IStickyNoteLabelCreate,
    IStickyNoteLabelFilter,
    IStickyNoteLabelUpdate,
} from "../interfaces/stickyNoteLabel.interface.js";

import { StickyNoteLabelStatus } from "../constants/stickyNoteLabel.enums.js";

import { StickyNoteLabelMessages } from "../constants/stickyNoteLabel.messages.js";

import { StickyNoteLabelRepository } from "../repositories/stickyNoteLabel.repository.js";

import { StickyNoteLabelValidation } from "../validations/stickyNoteLabel.validation.js";

import { AuditLogAction } from "../../auditlog/constants/auditLog.enums.js";

import { AuditLogService } from "../../auditlog/services/auditLog.service.js";

import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";

import { AppModule } from "../../../utils/enums/appModule.enums.js";

import { AppError } from "../../../utils/errors/app.error.js";

export class StickyNoteLabelService {
    private stickyNoteLabelRepository: StickyNoteLabelRepository;
    private auditLogService: AuditLogService;

    constructor() {
        this.stickyNoteLabelRepository = new StickyNoteLabelRepository();

        this.auditLogService = new AuditLogService();
    }

    async createStickyNoteLabel(data: IStickyNoteLabelCreate, createdBy: string, context?: IAuditLogContext) {
        const normalizedName = StickyNoteLabelValidation.normalizeName(data.name);

        const normalizedSlug = StickyNoteLabelValidation.normalizeSlug(data.slug || normalizedName);

        const workspaceId = typeof data.workspaceId === "string" ? data.workspaceId : data.workspaceId;

        await workspaceAvailabilityService.assertAvailable(workspaceId);
        await subscriptionEntitlementService.assertWorkspaceFeature(String(workspaceId), FeatureCode.NOTES);
        const exists = await this.stickyNoteLabelRepository.existsBySlug(workspaceId, normalizedSlug);

        if (exists) {
            throw new AppError(StickyNoteLabelMessages.SLUG_ALREADY_EXISTS, 409);
        }

        const labelData: Partial<IStickyNoteLabel> = {
            ...data,

            workspaceId: new Types.ObjectId(workspaceId),

            name: normalizedName,

            slug: normalizedSlug,

            status: StickyNoteLabelStatus.ACTIVE,

            createdBy: new Types.ObjectId(createdBy),

            updatedBy: new Types.ObjectId(createdBy),
        };

        const label = await this.stickyNoteLabelRepository.create(labelData);

        await this.auditLogService.logCreate(
            context ?? {},
            {
                module: AppModule.STICKY_NOTE_LABEL,
                resourceId: label._id.toString(),
                resourceName: label.name,
            },
            `Sticky note label "${label.name}" was created successfully.`,
        );

        return label;
    }

    async getStickyNoteLabelById(id: string) {
        const label = await this.stickyNoteLabelRepository.findById(id);

        if (!label) {
            throw new AppError(StickyNoteLabelMessages.NOT_FOUND, 404);
        }
        await workspaceAvailabilityService.assertAvailable(label.workspaceId);

        return label;
    }

    async getStickyNoteLabels(filters: IStickyNoteLabelFilter = {}) {
        if (filters.workspaceId) await workspaceAvailabilityService.assertAvailable(filters.workspaceId);
        return this.stickyNoteLabelRepository.findAll(filters);
    }

    async updateStickyNoteLabel(
        id: string,
        data: IStickyNoteLabelUpdate,
        updatedBy: string,
        context?: IAuditLogContext,
    ) {
        const existing = await this.stickyNoteLabelRepository.findById(id);

        if (!existing) {
            throw new AppError(StickyNoteLabelMessages.NOT_FOUND, 404);
        }
        await workspaceAvailabilityService.assertAvailable(existing.workspaceId);
        await subscriptionEntitlementService.assertWorkspaceFeature(
            String(existing.workspaceId),
            FeatureCode.NOTES,
        );

        const updateData: IStickyNoteLabelUpdate = {
            ...data,
        };

        const changes: Array<{
            field: string;
            oldValue?: unknown;
            newValue?: unknown;
        }> = [];

        if (data.name !== undefined) {
            const normalizedName = StickyNoteLabelValidation.normalizeName(data.name);

            if (existing.name !== normalizedName) {
                changes.push({
                    field: "name",
                    oldValue: existing.name,
                    newValue: normalizedName,
                });
            }

            updateData.name = normalizedName;
        }

        if (data.slug !== undefined || data.name !== undefined) {
            const normalizedSlug = StickyNoteLabelValidation.normalizeSlug(
                data.slug || data.name || existing.name,
            );

            const exists = await this.stickyNoteLabelRepository.existsBySlug(
                existing.workspaceId,
                normalizedSlug,
                id,
            );

            if (exists) {
                throw new AppError(StickyNoteLabelMessages.SLUG_ALREADY_EXISTS, 409);
            }

            if (existing.slug !== normalizedSlug) {
                changes.push({
                    field: "slug",
                    oldValue: existing.slug,
                    newValue: normalizedSlug,
                });
            }

            updateData.slug = normalizedSlug;
        }

        if (data.color !== undefined && existing.color !== data.color) {
            changes.push({
                field: "color",
                oldValue: existing.color,
                newValue: data.color,
            });
        }

        if (data.position !== undefined && existing.position !== data.position) {
            changes.push({
                field: "position",
                oldValue: existing.position,
                newValue: data.position,
            });
        }

        const label = await this.stickyNoteLabelRepository.updateById(id, {
            ...updateData,
            updatedBy: updatedBy as any,
        });

        if (!label) {
            throw new AppError(StickyNoteLabelMessages.NOT_FOUND, 404);
        }

        if (changes.length > 0) {
            await this.auditLogService.logUpdate(
                context ?? {},
                {
                    module: AppModule.STICKY_NOTE_LABEL,
                    resourceId: label._id.toString(),
                    resourceName: label.name,
                },
                `Sticky note label "${label.name}" was updated successfully.`,
                changes,
            );
        }

        return label;
    }

    async updateStickyNoteLabelStatus(
        id: string,
        status: StickyNoteLabelStatus,
        updatedBy: string,
        context?: IAuditLogContext,
    ) {
        const existing = await this.stickyNoteLabelRepository.findByIdIncludingDeleted(id);

        if (!existing) {
            throw new AppError(StickyNoteLabelMessages.NOT_FOUND, 404);
        }
        await workspaceAvailabilityService.assertAvailable(existing.workspaceId);
        if (status === StickyNoteLabelStatus.ACTIVE)
            await subscriptionEntitlementService.assertWorkspaceFeature(
                String(existing.workspaceId),
                FeatureCode.NOTES,
            );

        if (existing.status === StickyNoteLabelStatus.DELETED) {
            throw new AppError(StickyNoteLabelMessages.ALREADY_DELETED, 400);
        }

        if (existing.status === status) {
            if (status === StickyNoteLabelStatus.ACTIVE) {
                throw new AppError(StickyNoteLabelMessages.ALREADY_ACTIVE, 400);
            }

            if (status === StickyNoteLabelStatus.ARCHIVED) {
                throw new AppError(StickyNoteLabelMessages.ALREADY_ARCHIVED, 400);
            }
        }

        const oldStatus = existing.status;

        const label = await this.stickyNoteLabelRepository.updateStatus(
            id,
            status,
            new Types.ObjectId(updatedBy),
        );

        if (!label) {
            throw new AppError(StickyNoteLabelMessages.NOT_FOUND, 404);
        }

        await this.auditLogService.log({
            ...context,
            action: AuditLogAction.STATUS_CHANGE,
            module: AppModule.STICKY_NOTE_LABEL,
            resourceId: label._id.toString(),
            resourceName: label.name,
            description: `Sticky note label "${label.name}" status was changed from "${oldStatus}" to "${status}".`,
            changes: [
                {
                    field: "status",
                    oldValue: oldStatus,
                    newValue: status,
                },
            ],
        });

        return label;
    }

    async deleteStickyNoteLabel(id: string, updatedBy: string, context?: IAuditLogContext) {
        const existing = await this.stickyNoteLabelRepository.findById(id);

        if (!existing) {
            throw new AppError(StickyNoteLabelMessages.NOT_FOUND, 404);
        }
        await workspaceAvailabilityService.assertAvailable(existing.workspaceId);

        const label = await this.stickyNoteLabelRepository.softDelete(id, new Types.ObjectId(updatedBy));

        if (!label) {
            throw new AppError(StickyNoteLabelMessages.NOT_FOUND, 404);
        }

        await this.auditLogService.log({
            ...context,
            action: AuditLogAction.DELETE,
            module: AppModule.STICKY_NOTE_LABEL,
            resourceId: label._id.toString(),
            resourceName: label.name,
            description: `Sticky note label "${label.name}" was deleted successfully.`,
        });

        return label;
    }

    async restoreStickyNoteLabel(id: string, updatedBy: string, context?: IAuditLogContext) {
        const existing = await this.stickyNoteLabelRepository.findByIdIncludingDeleted(id);

        if (!existing) {
            throw new AppError(StickyNoteLabelMessages.NOT_FOUND, 404);
        }
        await workspaceAvailabilityService.assertAvailable(existing.workspaceId);
        await subscriptionEntitlementService.assertWorkspaceFeature(
            String(existing.workspaceId),
            FeatureCode.NOTES,
        );

        if (existing.status !== StickyNoteLabelStatus.DELETED) {
            throw new AppError(StickyNoteLabelMessages.CANNOT_RESTORE_ACTIVE, 400);
        }

        const label = await this.stickyNoteLabelRepository.restore(id, new Types.ObjectId(updatedBy));

        if (!label) {
            throw new AppError(StickyNoteLabelMessages.NOT_FOUND, 404);
        }

        await this.auditLogService.log({
            ...context,
            action: AuditLogAction.RESTORE,
            module: AppModule.STICKY_NOTE_LABEL,
            resourceId: label._id.toString(),
            resourceName: label.name,
            description: `Sticky note label "${label.name}" was restored successfully.`,
        });

        return label;
    }
}
