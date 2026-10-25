import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { registerValidation } from "../validations/register.validation.js";
import { loginValidation } from "../validations/login.validation.js";
import { refreshTokenValidation } from "../validations/refreshToken.validation.js";
import { verifyEmailValidation } from "../validations/verifyEmail.validation.js";
import { resendVerificationValidation } from "../validations/resendVerification.validation.js";
import { forgotPasswordValidation } from "../validations/forgotPassword.validation.js";
import { resetPasswordValidation } from "../validations/resetPassword.validation.js";
import { changePasswordValidation } from "../validations/changePassword.validation.js";
import { requireBodyFields } from "../../../utils/validations/validateBody.validation.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";
import { authMiddleware, logoutAuthMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";

const authRoutes = Router();
const authController = new AuthController();

authRoutes.post(
    "/register",
    validateContentType("application/json"),
    requireBodyFields("email", "password"),
    registerValidation,
    authController.register,
);

authRoutes.post(
    "/login",
    validateContentType("application/json"),
    requireBodyFields("email", "password"),
    loginValidation,
    authController.login,
);

authRoutes.post("/refreshtoken", authController.refreshToken);

authRoutes.post(
    "/verifyemail",
    validateContentType("application/json"),
    requireBodyFields("token"),
    verifyEmailValidation,
    authController.verifyEmail,
);

authRoutes.post(
    "/resendverification",
    validateContentType("application/json"),
    requireBodyFields("email"),
    resendVerificationValidation,
    authController.resendVerificationEmail,
);

authRoutes.post(
    "/forgotpassword",
    validateContentType("application/json"),
    requireBodyFields("email"),
    forgotPasswordValidation,
    authController.forgotPassword,
);

authRoutes.post(
    "/resetpassword",
    validateContentType("application/json"),
    requireBodyFields("token", "password"),
    resetPasswordValidation,
    authController.resetPassword,
);

authRoutes.post(
    "/changepassword",
    authMiddleware,
    validateContentType("application/json"),
    requireBodyFields("currentPassword", "newPassword"),
    changePasswordValidation,
    authController.changePassword,
);

authRoutes.post("/logout", logoutAuthMiddleware, authController.logout);
authRoutes.get("/logout", logoutAuthMiddleware, authController.logout);

authRoutes.post("/logoutall", authMiddleware, authController.logoutAll);

authRoutes.get("/sessions", authMiddleware, authController.getSessions);

export default authRoutes;
