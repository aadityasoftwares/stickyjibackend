import { Router } from "express";

import {
    StickyNoteLabelController,
} from "../controllers/stickyNoteLabel.controller.js";

import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";

import {
    validateContentType,
} from "../../../utils/validations/validateContentType.js";

import {
    createStickyNoteLabelValidation,
} from "../validations/createStickyNoteLabel.validation.js";

import {
    getStickyNoteLabelValidation,
} from "../validations/getStickyNoteLabel.validation.js";

import {
    updateStickyNoteLabelValidation,
} from "../validations/updateStickyNoteLabel.validation.js";

const stickyNoteLabelRoutes = Router();
const stickyNoteLabelController = new StickyNoteLabelController();

stickyNoteLabelRoutes.post(
    "/create",
    authMiddleware,
    validateContentType("application/json"),
    createStickyNoteLabelValidation,
    stickyNoteLabelController.createStickyNoteLabel,
);

stickyNoteLabelRoutes.get(
    "/get/:id",
    authMiddleware,
    getStickyNoteLabelValidation,
    stickyNoteLabelController.getStickyNoteLabelById,
);

stickyNoteLabelRoutes.get(
    "/getall",
    authMiddleware,
    stickyNoteLabelController.getStickyNoteLabels,
);

stickyNoteLabelRoutes.put(
    "/update/:id",
    authMiddleware,
    validateContentType("application/json"),
    updateStickyNoteLabelValidation,
    stickyNoteLabelController.updateStickyNoteLabel,
);

stickyNoteLabelRoutes.put(
    "/status/:id",
    authMiddleware,
    validateContentType("application/json"),
    getStickyNoteLabelValidation,
    stickyNoteLabelController.updateStickyNoteLabelStatus,
);

stickyNoteLabelRoutes.delete(
    "/delete/:id",
    authMiddleware,
    getStickyNoteLabelValidation,
    stickyNoteLabelController.deleteStickyNoteLabel,
);

stickyNoteLabelRoutes.put(
    "/restore/:id",
    authMiddleware,
    getStickyNoteLabelValidation,
    stickyNoteLabelController.restoreStickyNoteLabel,
);

export default stickyNoteLabelRoutes;