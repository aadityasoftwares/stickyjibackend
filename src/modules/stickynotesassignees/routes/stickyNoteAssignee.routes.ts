import { Router } from "express";

import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";
import { StickyNoteAssigneeController } from "../controllers/stickyNoteAssignee.controller.js";
import { createStickyNoteAssigneeValidation } from "../validations/createStickyNoteAssignee.validation.js";
import { getStickyNoteAssigneeValidation } from "../validations/getStickyNoteAssignee.validation.js";
import { getStickyNoteAssigneesValidation } from "../validations/getStickyNoteAssignees.validation.js";
import { syncStickyNoteAssigneesValidation } from "../validations/syncStickyNoteAssignees.validation.js";

const stickyNoteAssigneeRoutes = Router();
const stickyNoteAssigneeController = new StickyNoteAssigneeController();

stickyNoteAssigneeRoutes.use(authMiddleware);

stickyNoteAssigneeRoutes.post(
    "/create",
    validateContentType("application/json"),
    createStickyNoteAssigneeValidation,
    stickyNoteAssigneeController.createStickyNoteAssignee,
);

stickyNoteAssigneeRoutes.get(
    "/sticky-note/:stickyNoteId",
    stickyNoteAssigneeController.getAssigneesByStickyNoteId,
);

stickyNoteAssigneeRoutes.get(
    "/note/:stickyNoteId",
    stickyNoteAssigneeController.getAssigneesByStickyNoteId,
);

stickyNoteAssigneeRoutes.get(
    "/getall",
    getStickyNoteAssigneesValidation,
    stickyNoteAssigneeController.getStickyNoteAssignees,
);

stickyNoteAssigneeRoutes.post(
    "/getall",
    validateContentType("application/json"),
    getStickyNoteAssigneesValidation,
    stickyNoteAssigneeController.getStickyNoteAssignees,
);

stickyNoteAssigneeRoutes.get(
    "/get/:id",
    getStickyNoteAssigneeValidation,
    stickyNoteAssigneeController.getStickyNoteAssigneeById,
);

stickyNoteAssigneeRoutes.put(
    "/sync/:id",
    validateContentType("application/json"),
    syncStickyNoteAssigneesValidation,
    stickyNoteAssigneeController.syncStickyNoteAssignees,
);

stickyNoteAssigneeRoutes.delete(
    "/delete/:id",
    getStickyNoteAssigneeValidation,
    stickyNoteAssigneeController.removeStickyNoteAssignee,
);

stickyNoteAssigneeRoutes.put(
    "/restore/:id",
    getStickyNoteAssigneeValidation,
    stickyNoteAssigneeController.restoreStickyNoteAssignee,
);

export default stickyNoteAssigneeRoutes;
