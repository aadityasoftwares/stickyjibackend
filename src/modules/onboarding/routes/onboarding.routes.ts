import { Router } from "express";
import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";
import { OnboardingController } from "../controllers/onboarding.controller.js";
import { initialSetupValidation } from "../validations/initialSetup.schema.js";

const onboardingRoutes = Router();
const onboardingController = new OnboardingController();

onboardingRoutes.use(authMiddleware);

onboardingRoutes.get(["/status", "/check"], onboardingController.getOnboardingStatus);

onboardingRoutes.post(
    ["/initial-setup", "/initialize"],
    validateContentType("application/json"),
    initialSetupValidation,
    onboardingController.initialSetup,
);

export default onboardingRoutes;

