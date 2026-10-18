import { Router } from "express";
import { MediaController } from "../controllers/media.controller.js";
import { requestUploadValidation } from "../validations/requestUpload.validation.js";
import { completeUploadValidation } from "../validations/completeUpload.validation.js";
import { getMediaValidation } from "../validations/getMedia.validation.js";
import { updateMediaValidation } from "../validations/updateMedia.validation.js";
import { deleteMediaValidation } from "../validations/deleteMedia.validation.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";
import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";

const mediaRoutes = Router();
const mediaController = new MediaController();

mediaRoutes.post(
    "/requestupload",
    authMiddleware,
    validateContentType("application/json"),
    requestUploadValidation,
    mediaController.requestUpload,
);

mediaRoutes.get(
    "/getall",
    authMiddleware,
    mediaController.getAll,
);

mediaRoutes.post(
    "/:id/complete",
    authMiddleware,
    completeUploadValidation,
    mediaController.completeUpload,
);

mediaRoutes.get(
    "/get/:id",
    authMiddleware,
    getMediaValidation,
    mediaController.get,
);

mediaRoutes.put(
    "/update/:id",
    authMiddleware,
    validateContentType("application/json"),
    updateMediaValidation,
    mediaController.update,
);

mediaRoutes.delete(
    "/delete/:id",
    authMiddleware,
    deleteMediaValidation,
    mediaController.delete,
);

export default mediaRoutes;