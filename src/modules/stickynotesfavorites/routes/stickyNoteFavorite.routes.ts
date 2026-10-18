import { Router } from "express";

import { StickyNoteFavoriteController } from "../controllers/stickyNoteFavorite.controller.js";

import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";

import { validateContentType } from "../../../utils/validations/validateContentType.js";

import { createStickyNoteFavoriteValidation } from "../validations/createStickyNoteFavorite.validation.js";

import { getStickyNoteFavoriteValidation } from "../validations/getStickyNoteFavorite.validation.js";

import { getStickyNoteFavoritesValidation } from "../validations/getStickyNoteFavorites.validation.js";

import { updateStickyNoteFavoriteStatusValidation } from "../validations/updateStickyNoteFavoriteStatus.validation.js";

const stickyNoteFavoriteRoutes = Router();

const stickyNoteFavoriteController = new StickyNoteFavoriteController();

stickyNoteFavoriteRoutes.use(authMiddleware);

stickyNoteFavoriteRoutes.post(
    "/create",
    validateContentType("application/json"),
    createStickyNoteFavoriteValidation,
    stickyNoteFavoriteController.createStickyNoteFavorite,
);

stickyNoteFavoriteRoutes.get(
    "/get/:id",
    getStickyNoteFavoriteValidation,
    stickyNoteFavoriteController.getStickyNoteFavoriteById,
);

stickyNoteFavoriteRoutes.get("/check/:stickyNoteId", stickyNoteFavoriteController.checkStickyNoteFavorite);

stickyNoteFavoriteRoutes.get(
    "/getall",
    getStickyNoteFavoritesValidation,
    stickyNoteFavoriteController.getStickyNoteFavorites,
);

stickyNoteFavoriteRoutes.post(
    "/getall",
    validateContentType("application/json"),
    getStickyNoteFavoritesValidation,
    stickyNoteFavoriteController.getStickyNoteFavorites,
);

stickyNoteFavoriteRoutes.put(
    "/status/:id",
    validateContentType("application/json"),
    updateStickyNoteFavoriteStatusValidation,
    stickyNoteFavoriteController.updateStickyNoteFavoriteStatus,
);

stickyNoteFavoriteRoutes.delete(
    "/delete/:id",
    getStickyNoteFavoriteValidation,
    stickyNoteFavoriteController.deleteStickyNoteFavorite,
);

stickyNoteFavoriteRoutes.put(
    "/restore/:id",
    getStickyNoteFavoriteValidation,
    stickyNoteFavoriteController.restoreStickyNoteFavorite,
);

export default stickyNoteFavoriteRoutes;
