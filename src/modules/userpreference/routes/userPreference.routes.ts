import { Router } from "express";
import { createUserPreferenceValidation } from "../validations/createUserPreference.validation.js";
import { getUserPreferencesValidation } from "../validations/getUserPreference.validation.js";
import { deleteUserPreferenceValidation } from "../validations/deleteUserPreference.validation.js";
import { resetUserPreferenceValidation } from "../validations/resetUserPreference.validation.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";
import { UserPreferenceController } from "../controller/userPreference.controller.js";
import { updateUserPreferenceValidation } from "../validations/updateUserPreference.validation.js";
import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";
import { resetAllUserPreferencesValidation } from "../validations/resetAllUserPreferences.validation.js";

const userPreferenceRoutes = Router();
const userPreferenceController = new UserPreferenceController();

userPreferenceRoutes.use(authMiddleware);

userPreferenceRoutes.post(
    "/create",
    validateContentType("application/json"),
    createUserPreferenceValidation,
    userPreferenceController.createUserPreference,
);

userPreferenceRoutes.get(
    "/my",
    getUserPreferencesValidation,
    userPreferenceController.getUserPreferences,
);

userPreferenceRoutes.get(
    "/my/:key",
    getUserPreferencesValidation,
    userPreferenceController.getUserPreference,
);

userPreferenceRoutes.put(
    "/update",
    validateContentType("application/json"),
    updateUserPreferenceValidation,
    userPreferenceController.updateUserPreference,
);

userPreferenceRoutes.delete(
    "/my/:key",
    deleteUserPreferenceValidation,
    userPreferenceController.deleteUserPreference,
);

userPreferenceRoutes.post(
    "/reset",
    validateContentType("application/json"),
    resetUserPreferenceValidation,
    userPreferenceController.resetUserPreference,
);

userPreferenceRoutes.post(
    "/resetall",
    resetAllUserPreferencesValidation,
    userPreferenceController.resetAllUserPreferences,
);

export default userPreferenceRoutes;