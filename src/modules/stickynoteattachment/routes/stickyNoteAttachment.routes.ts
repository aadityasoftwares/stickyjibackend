import { Router } from "express";
import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";
import { StickyNoteAttachmentController } from "../controllers/stickyNoteAttachment.controller.js";

const routes = Router({ mergeParams: true });
const controller = new StickyNoteAttachmentController();
routes.use(authMiddleware);
// Resource permissions are enforced in the service, including calls via generic Media APIs.
routes.post("/request-upload", validateContentType("application/json"), controller.requestUpload);
routes.post("/:attachmentId/complete", controller.complete);
routes.get("/", controller.list);
routes.get("/:attachmentId/download", controller.download);
routes.delete("/:attachmentId", controller.delete);
export default routes;
