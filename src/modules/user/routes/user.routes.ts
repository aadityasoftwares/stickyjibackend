import { Router } from "express";
import { UserController } from "../controllers/user.controller.js";
import { createUserValidation } from "../validations/createUser.validation.js";
import { getUserValidation } from "../validations/getUser.validation.js";
import { updateUserValidation } from "../validations/updateUser.validation.js";
import { updateUserStatusValidation } from "../validations/updateUserStatus.validation.js";
import { deleteUserValidation } from "../validations/deleteUser.validation.js";
import { restoreUserValidation } from "../validations/restoreUser.validation.js";
import { requireBodyFields } from "../../../utils/validations/validateBody.validation.js";
import { requireRouteParam } from "../../../utils/validations/validateParam.validation.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";

const userRoutes = Router();
const userController = new UserController();

userRoutes.post(
    "/create",
    validateContentType("application/json"),
    requireBodyFields("email", "globalRoleId", "authProvider"),
    createUserValidation,
    userController.createUser
);

userRoutes.get(
    "/getall",
    userController.getUsers
);

userRoutes.get(
    "/get/:id",
    requireRouteParam("id"),
    getUserValidation,
    userController.getUserById
);

userRoutes.get(
    "/get/email/:email",
    requireRouteParam("email"),
    getUserValidation,
    userController.getUserByEmail
);

userRoutes.put(
    "/update/:id",
    validateContentType("application/json"),
    requireRouteParam("id"),
    updateUserValidation,
    userController.updateUser
);

userRoutes.patch(
    "/status/:id",
    validateContentType("application/json"),
    requireRouteParam("id"),
    requireBodyFields("status"),
    updateUserStatusValidation,
    userController.updateUserStatus
);

userRoutes.delete(
    "/delete/:id",
    requireRouteParam("id"),
    deleteUserValidation,
    userController.deleteUser
);

userRoutes.patch(
    "/restore/:id",
    validateContentType("application/json"),
    requireRouteParam("id"),
    restoreUserValidation,
    userController.restoreUser
);

export default userRoutes;