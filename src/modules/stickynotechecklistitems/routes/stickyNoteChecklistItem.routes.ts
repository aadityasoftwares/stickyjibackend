import { Router } from "express";

import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";

import { validateContentType } from "../../../utils/validations/validateContentType.js";

import { StickyNoteChecklistItemController } from "../controllers/stickyNoteChecklistItem.controller.js";

import { createStickyNoteChecklistItemValidation } from "../validations/createStickyNoteChecklistItem.validation.js";

import { getStickyNoteChecklistItemValidation } from "../validations/getStickyNoteChecklistItem.validation.js";

import { updateStickyNoteChecklistItemValidation } from "../validations/updateStickyNoteChecklistItem.validation.js";

import { updateStickyNoteChecklistItemStatusValidation } from "../validations/updateStickyNoteChecklistItemStatus.validation.js";
import { getStickyNoteChecklistItemsValidation } from "../validations/getStickyNoteChecklistItems.validation.js";
import { updateStickyNoteChecklistItemCompletionValidation } from "../validations/updateStickyNoteChecklistItemCompletion.validation.js";

const stickyNoteChecklistItemRoutes = Router();

const stickyNoteChecklistItemController = new StickyNoteChecklistItemController();

stickyNoteChecklistItemRoutes.use(authMiddleware);

stickyNoteChecklistItemRoutes.post(
    "/create",
    validateContentType("application/json"),
    createStickyNoteChecklistItemValidation,
    stickyNoteChecklistItemController.createStickyNoteChecklistItem,
);

stickyNoteChecklistItemRoutes.get(
    "/get",
    getStickyNoteChecklistItemValidation,
    stickyNoteChecklistItemController.getStickyNoteChecklistItemById,
);

stickyNoteChecklistItemRoutes.get(
    "/get/:id",
    getStickyNoteChecklistItemValidation,
    stickyNoteChecklistItemController.getStickyNoteChecklistItemById,
);

stickyNoteChecklistItemRoutes.post(
    ["/", "/getall"],
    validateContentType("application/json"),
    getStickyNoteChecklistItemsValidation,
    stickyNoteChecklistItemController.getStickyNoteChecklistItems,
);

stickyNoteChecklistItemRoutes.get(
    ["/", "/getall"],
    getStickyNoteChecklistItemsValidation,
    stickyNoteChecklistItemController.getStickyNoteChecklistItems,
);

stickyNoteChecklistItemRoutes.put(
    "/update/:id",
    validateContentType("application/json"),
    updateStickyNoteChecklistItemValidation,
    stickyNoteChecklistItemController.updateStickyNoteChecklistItem,
);

stickyNoteChecklistItemRoutes.put(
    "/status/:id",
    validateContentType("application/json"),
    updateStickyNoteChecklistItemStatusValidation,
    stickyNoteChecklistItemController.updateStickyNoteChecklistItemStatus,
);

stickyNoteChecklistItemRoutes.put(
    "/completion/:id",
    validateContentType("application/json"),
    updateStickyNoteChecklistItemCompletionValidation,
    stickyNoteChecklistItemController.updateStickyNoteChecklistItemCompletion,
);

stickyNoteChecklistItemRoutes.put(
    "/trash/:id",
    getStickyNoteChecklistItemValidation,
    stickyNoteChecklistItemController.deleteStickyNoteChecklistItem,
);

stickyNoteChecklistItemRoutes.delete(
    "/delete/:id",
    getStickyNoteChecklistItemValidation,
    stickyNoteChecklistItemController.deleteStickyNoteChecklistItem,
);

stickyNoteChecklistItemRoutes.put(
    "/restore/:id",
    getStickyNoteChecklistItemValidation,
    stickyNoteChecklistItemController.restoreStickyNoteChecklistItem,
);

export default stickyNoteChecklistItemRoutes;
