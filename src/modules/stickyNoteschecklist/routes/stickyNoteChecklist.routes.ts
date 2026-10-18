import { Router } from "express";

import { StickyNoteChecklistController } from "../controllers/stickyNoteChecklist.controller.js";

import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";

import { validateContentType } from "../../../utils/validations/validateContentType.js";

import { createStickyNoteChecklistValidation } from "../validations/createStickyNoteChecklist.validation.js";

import { getStickyNoteChecklistValidation } from "../validations/getStickyNoteChecklist.validation.js";

import { updateStickyNoteChecklistValidation } from "../validations/updateStickyNoteChecklist.validation.js";

import { updateStickyNoteChecklistStatusValidation } from "../validations/updateStickyNoteChecklistStatus.validation.js";
import { getStickyNoteChecklistsValidation } from "../validations/getStickyNoteChecklists.validation.js";

const stickyNoteChecklistRoutes = Router();

const stickyNoteChecklistController = new StickyNoteChecklistController();

stickyNoteChecklistRoutes.use(authMiddleware);

stickyNoteChecklistRoutes.post(
    "/create",
    validateContentType("application/json"),
    createStickyNoteChecklistValidation,
    stickyNoteChecklistController.createStickyNoteChecklist,
);

stickyNoteChecklistRoutes.get(
    "/get",
    getStickyNoteChecklistValidation,
    stickyNoteChecklistController.getStickyNoteChecklistById,
);

stickyNoteChecklistRoutes.get(
    "/get/:id",
    getStickyNoteChecklistValidation,
    stickyNoteChecklistController.getStickyNoteChecklistById,
);

stickyNoteChecklistRoutes.post(
    ["/", "/getall"],
    validateContentType("application/json"),
    getStickyNoteChecklistsValidation,
    stickyNoteChecklistController.getStickyNoteChecklists,
);

stickyNoteChecklistRoutes.get(
    ["/", "/getall"],
    getStickyNoteChecklistsValidation,
    stickyNoteChecklistController.getStickyNoteChecklists,
);

stickyNoteChecklistRoutes.put(
    "/update/:id",
    validateContentType("application/json"),
    updateStickyNoteChecklistValidation,
    stickyNoteChecklistController.updateStickyNoteChecklist,
);

stickyNoteChecklistRoutes.put(
    "/status/:id",
    validateContentType("application/json"),
    updateStickyNoteChecklistStatusValidation,
    stickyNoteChecklistController.updateStickyNoteChecklistStatus,
);

stickyNoteChecklistRoutes.put(
    "/trash/:id",
    getStickyNoteChecklistValidation,
    stickyNoteChecklistController.deleteStickyNoteChecklist,
);

stickyNoteChecklistRoutes.delete(
    "/delete/:id",
    getStickyNoteChecklistValidation,
    stickyNoteChecklistController.deleteStickyNoteChecklist,
);

stickyNoteChecklistRoutes.put(
    "/restore/:id",
    getStickyNoteChecklistValidation,
    stickyNoteChecklistController.restoreStickyNoteChecklist,
);

export default stickyNoteChecklistRoutes;
