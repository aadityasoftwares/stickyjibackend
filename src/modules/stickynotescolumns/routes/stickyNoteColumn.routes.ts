import { Router } from "express";
import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";
import { requirePermission } from "../../permissions/middlewares/permission.middleware.js";
import { PermissionAction, PermissionModule } from "../../permissions/constants/permission.enums.js";
import { StickyNoteColumnController } from "../controllers/stickyNoteColumn.controller.js";
import { createStickyNoteColumnValidation } from "../validations/createStickyNoteColumn.validation.js";
import { getStickyNoteColumnValidation } from "../validations/getStickyNoteColumn.validation.js";
import { getStickyNoteColumnsValidation } from "../validations/getStickyNoteColumns.validation.js";
import { updateStickyNoteColumnValidation } from "../validations/updateStickyNoteColumn.validation.js";
import { reorderStickyNoteColumnsValidation } from "../validations/reorderStickyNoteColumns.validation.js";
import { reorderStickyNoteColumnValidation } from "../validations/reorderStickyNoteColumn.validation.js";

const stickyNoteColumnRoutes = Router();
const stickyNoteColumnController = new StickyNoteColumnController();

const stickyNoteColumnPermission = (
    action: PermissionAction | PermissionAction[],
    resource?: "column",
    allowTrashedWorkspace = false,
    allowInactiveWorkspace = false,
) =>
    requirePermission({
        module: PermissionModule.NOTES,
        action,
        resource,
        allowTrashedWorkspace,
        allowInactiveWorkspace,
    });

stickyNoteColumnRoutes.use(authMiddleware);

stickyNoteColumnRoutes.post(
    "/create",
    validateContentType("application/json"),
    createStickyNoteColumnValidation,
    stickyNoteColumnPermission(PermissionAction.CREATE),
    stickyNoteColumnController.createStickyNoteColumn,
);

stickyNoteColumnRoutes.get(
    "/get/:id",
    getStickyNoteColumnValidation,
    stickyNoteColumnPermission(PermissionAction.READ, "column"),
    stickyNoteColumnController.getStickyNoteColumnById,
);

stickyNoteColumnRoutes.post(
    "/getall",
    validateContentType("application/json"),
    getStickyNoteColumnsValidation,
    stickyNoteColumnPermission(PermissionAction.READ),
    stickyNoteColumnController.getStickyNoteColumns,
);

stickyNoteColumnRoutes.get(
    ["/", "/getall"],
    getStickyNoteColumnsValidation,
    stickyNoteColumnPermission(PermissionAction.READ),
    stickyNoteColumnController.getStickyNoteColumns,
);

stickyNoteColumnRoutes.put(
    "/update/:id",
    validateContentType("application/json"),
    updateStickyNoteColumnValidation,
    stickyNoteColumnPermission(PermissionAction.UPDATE, "column"),
    stickyNoteColumnController.updateStickyNoteColumn,
);

stickyNoteColumnRoutes.put(
    "/reorder",
    validateContentType("application/json"),
    reorderStickyNoteColumnsValidation,
    stickyNoteColumnPermission(PermissionAction.UPDATE),
    stickyNoteColumnController.reorderStickyNoteColumns,
);

stickyNoteColumnRoutes.put(
    "/reorder/:id",
    validateContentType("application/json"),
    reorderStickyNoteColumnValidation,
    stickyNoteColumnPermission(PermissionAction.UPDATE, "column"),
    stickyNoteColumnController.reorderStickyNoteColumn,
);

stickyNoteColumnRoutes.delete(
    "/delete/:id",
    getStickyNoteColumnValidation,
    stickyNoteColumnPermission(PermissionAction.DELETE, "column"),
    stickyNoteColumnController.deleteStickyNoteColumn,
);

export default stickyNoteColumnRoutes;
