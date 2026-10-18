import { Router } from "express";

import { UserProfileController } from "../controllers/userProfile.controller.js";
import { createUserProfileValidation } from "../validations/createUserProfile.validation.js";
import { updateUserProfileValidation } from "../validations/updateUserProfile.validation.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";
import { getUserProfileValidation } from "../validations/getUserProfile.validation.js";
import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";

const userProfileRoutes = Router();
const userProfileController = new UserProfileController();

userProfileRoutes.post(
    "/create",
    authMiddleware,
    validateContentType("application/json"),
    createUserProfileValidation,
    userProfileController.createProfile
);

userProfileRoutes.get(
    "/me",
    authMiddleware,
    getUserProfileValidation,
    userProfileController.getMyProfile
);

userProfileRoutes.put(
    "/update",
    authMiddleware,
    validateContentType("application/json"),
    updateUserProfileValidation,
    userProfileController.updateMyProfile
);

userProfileRoutes.get(
    "/get/:id",
    authMiddleware,
    getUserProfileValidation,
    userProfileController.getProfileById
);

userProfileRoutes.put(
    "/update/:id",
    authMiddleware,
    validateContentType("application/json"),
    updateUserProfileValidation,
    userProfileController.updateProfile
);

userProfileRoutes.get(
    "/getall",
    authMiddleware,
    userProfileController.getProfiles
);

export default userProfileRoutes;