import { Router } from "express";
import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";
import { NotesWorkspaceController } from "../controllers/notesworkspace.controller.js";

const notesWorkspaceRoutes = Router();
const controller = new NotesWorkspaceController();

notesWorkspaceRoutes.post(
    "/create",
    authMiddleware,
    controller.createWorkspace
);

notesWorkspaceRoutes.post(
    "/filter",
    authMiddleware,
    controller.filterMyWorkspaces
);

notesWorkspaceRoutes.get(
    "/my",
    authMiddleware,
    controller.getMyWorkspaces
);

notesWorkspaceRoutes.get(
    "/get/:id",
    authMiddleware,
    controller.getWorkspaceById
);

notesWorkspaceRoutes.put(
    "/update/:id",
    authMiddleware,
    controller.updateWorkspace
);

notesWorkspaceRoutes.put(
    "/archive/:id",
    authMiddleware,
    controller.archiveWorkspace
);

notesWorkspaceRoutes.put(
    "/unarchive/:id",
    authMiddleware,
    controller.unarchiveWorkspace
);

notesWorkspaceRoutes.put(
    "/deactivate/:id",
    authMiddleware,
    controller.deactivateWorkspace
);

notesWorkspaceRoutes.put(
    "/activate/:id",
    authMiddleware,
    controller.activateWorkspace
);

notesWorkspaceRoutes.delete(
    "/delete/:id",
    authMiddleware,
    controller.deleteWorkspace
);

export default notesWorkspaceRoutes;