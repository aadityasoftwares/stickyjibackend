import { Router } from "express";
import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";
import { createStickyNoteValidation } from "../validations/createStickyNote.validation.js";
import { getStickyNoteValidation } from "../validations/getStickyNote.validation.js";
import { updateStickyNoteValidation } from "../validations/updateStickyNote.validation.js";
import { getStickyNotesValidation } from "../validations/getStickyNotes.validation.js";
import { updateStickyNoteStatusValidation } from "../validations/updateStickyNoteStatus.validation.js";
import { reorderStickyNoteValidation } from "../validations/reorderStickyNote.validation.js";
import { StickyNoteAssigneeController } from "../../stickynotesassignees/controllers/stickyNoteAssignee.controller.js";
import { syncStickyNoteAssigneesValidation } from "../../stickynotesassignees/validations/syncStickyNoteAssignees.validation.js";
import { StickyNoteController } from "../controllers/stickynote.controller.js";
import {
  getOverdueStickyNotesValidation,
  bringOverdueStickyNotesToTodayValidation,
} from "../validations/overdueStickyNotes.validation.js";
import { requirePermission } from "../../permissions/middlewares/permission.middleware.js";
import {
  PermissionAction,
  PermissionModule,
} from "../../permissions/constants/permission.enums.js";

const stickyNoteRoutes = Router();
const stickyNoteController = new StickyNoteController();
const stickyNoteAssigneeController = new StickyNoteAssigneeController();

stickyNoteRoutes.use(authMiddleware);

stickyNoteRoutes.post(
  "/overdue",
  validateContentType("application/json"),
  getOverdueStickyNotesValidation,
  stickyNoteController.getOverdueStickyNotes,
);
stickyNoteRoutes.get(
  "/overdue",
  getOverdueStickyNotesValidation,
  stickyNoteController.getOverdueStickyNotes,
);
stickyNoteRoutes.put(
  "/overdue/bringtoday",
  validateContentType("application/json"),
  bringOverdueStickyNotesToTodayValidation,
  stickyNoteController.bringOverdueStickyNotesToToday,
);
stickyNoteRoutes.put(
  "/overdue/bring-today",
  validateContentType("application/json"),
  bringOverdueStickyNotesToTodayValidation,
  stickyNoteController.bringOverdueStickyNotesToToday,
);
stickyNoteRoutes.post(
  "/create",
  validateContentType("application/json"),
  createStickyNoteValidation,
  requirePermission({
    module: PermissionModule.NOTES,
    action: PermissionAction.CREATE,
  }),
  stickyNoteController.createStickyNote,
);
stickyNoteRoutes.get(
  "/get/:id",
  getStickyNoteValidation,
  requirePermission({
    module: PermissionModule.NOTES,
    action: PermissionAction.READ,
    resource: "note",
  }),
  stickyNoteController.getStickyNoteById,
);
stickyNoteRoutes.post(
  "/getall",
  validateContentType("application/json"),
  getStickyNotesValidation,
  requirePermission({
    module: PermissionModule.NOTES,
    action: PermissionAction.READ,
  }),
  stickyNoteController.getStickyNotes,
);
stickyNoteRoutes.get(
  "/getall",
  getStickyNotesValidation,
  requirePermission({
    module: PermissionModule.NOTES,
    action: PermissionAction.READ,
  }),
  stickyNoteController.getStickyNotes,
);
stickyNoteRoutes.put(
  "/update/:id",
  validateContentType("application/json"),
  updateStickyNoteValidation,
  requirePermission({
    module: PermissionModule.NOTES,
    action: PermissionAction.UPDATE,
    resource: "note",
  }),
  stickyNoteController.updateStickyNote,
);
stickyNoteRoutes.put(
  "/status/:id",
  validateContentType("application/json"),
  updateStickyNoteStatusValidation,
  requirePermission({
    module: PermissionModule.NOTES,
    action: PermissionAction.UPDATE,
    resource: "note",
  }),
  stickyNoteController.updateStickyNoteStatus,
);
stickyNoteRoutes.put(
  "/reorder/:id",
  validateContentType("application/json"),
  reorderStickyNoteValidation,
  requirePermission({
    module: PermissionModule.NOTES,
    action: [PermissionAction.UPDATE, PermissionAction.MOVE],
    resource: "note",
  }),
  stickyNoteController.reorderStickyNote,
);
stickyNoteRoutes.put(
  "/trash/:id",
  getStickyNoteValidation,
  requirePermission({
    module: PermissionModule.NOTES,
    action: [PermissionAction.DELETE, PermissionAction.ARCHIVE],
    resource: "note",
  }),
  stickyNoteController.deleteStickyNote,
);
stickyNoteRoutes.delete(
  "/delete/:id",
  getStickyNoteValidation,
  requirePermission({
    module: PermissionModule.NOTES,
    action: PermissionAction.DELETE,
    resource: "note",
  }),
  stickyNoteController.deleteStickyNote,
);
stickyNoteRoutes.put(
  "/restore/:id",
  getStickyNoteValidation,
  requirePermission({
    module: PermissionModule.NOTES,
    action: PermissionAction.UPDATE,
    resource: "note",
  }),
  stickyNoteController.restoreStickyNote,
);
stickyNoteRoutes.delete(
  "/permanent/:id",
  getStickyNoteValidation,
  requirePermission({
    module: PermissionModule.NOTES,
    action: PermissionAction.DELETE,
    resource: "note",
  }),
  stickyNoteController.permanentlyDeleteStickyNote,
);
stickyNoteRoutes.get(
  "/:stickyNoteId/assignees",
  requirePermission({
    module: PermissionModule.NOTES,
    action: PermissionAction.READ,
    resource: "note",
  }),
  stickyNoteAssigneeController.getAssigneesByStickyNoteId,
);
stickyNoteRoutes.put(
  "/:stickyNoteId/assignees",
  validateContentType("application/json"),
  syncStickyNoteAssigneesValidation,
  requirePermission({
    module: PermissionModule.NOTES,
    action: PermissionAction.UPDATE,
    resource: "note",
  }),
  stickyNoteAssigneeController.syncStickyNoteAssignees,
);

export default stickyNoteRoutes;
