import { Router } from "express";
import userAuthRoutes from "../modules/user/routes/user.routes.js";
import userProfileRoutes from "../modules/userprofile/routes/userProfile.routes.js";
import permissionRoutes from "../modules/permissions/routes/permission.routes.js";
import roleRoutes from "../modules/roles/routes/role.routes.js";
import languageRoutes from "../modules/languages/routes/language.routes.js";
import countryRoutes from "../modules/countries/routes/country.routes.js";
import timezoneRoutes from "../modules/timezones/routes/timezone.routes.js";
import currencyRoutes from "../modules/currency/routes/currency.routes.js";
import featureRoutes from "../modules/feature/routes/feature.routes.js";
import planRoutes from "../modules/plan/routes/plan.routes.js";
import planFeatureRoutes from "../modules/planfeature/routes/planfeature.routes.js";
import systemSettingRoutes from "../modules/systemsettings/routes/systemSetting.routes.js";
import auditLogRoutes from "../modules/auditlog/routes/auditLog.routes.js";
import authRoutes from "../modules/auth/routes/auth.routes.js";
import mediaRoutes from "../modules/media/routes/media.routes.js";
import userPreferenceRoutes from "../modules/userpreference/routes/userPreference.routes.js";
import workspaceRoutes from "../modules/workspace/routes/workspace.routes.js";
import workspaceMemberRoutes from "../modules/workspaceMember/routes/workspaceMember.routes.js";
import workspaceMemberInvitationRoutes from "../modules/workspaceInvitations/routes/workspaceMemberInvitation.routes.js";
import workspaceFolderRoutes from "../modules/workspaceFolders/routes/workspaceFolder.routes.js";
import stickyNoteLabelRoutes from "../modules/stickynotelabels/routes/stickyNoteLabel.routes.js";
import stickyNoteChecklistRoutes from "../modules/stickyNoteschecklist/routes/stickyNoteChecklist.routes.js";
import stickyNoteChecklistItemRoutes from "../modules/stickynotechecklistitems/routes/stickyNoteChecklistItem.routes.js";

import stickyNoteFavoriteRoutes from "../modules/stickynotesfavorites/routes/stickyNoteFavorite.routes.js";
import stickyNoteAssigneeRoutes from "../modules/stickynotesassignees/routes/stickyNoteAssignee.routes.js";
import stickyNoteColumnRoutes from "../modules/stickynotescolumns/routes/stickyNoteColumn.routes.js";
import planPriceRoutes from "../modules/planprice/routes/planPrice.routes.js";
import userSubscriptionRoutes from "../modules/usersubscription/routes/usersubscription.routes.js";
import subscriptionUsageRoutes from "../modules/subscriptionusage/routes/subscriptionusage.routes.js";
import subscriptionEntitlementRoutes from "../modules/subscriptionentitlement/routes/subscriptionentitlement.routes.js";
import billingRoutes from "../modules/billing/routes/billing.routes.js";
import stickyNoteRoutes from "../modules/stickynotes/routes/stickynote.routes.js";

const router = Router();

router.use("/billing", billingRoutes);
router.use("/subscriptionentitlement", subscriptionEntitlementRoutes);
router.use("/subscriptionusage", subscriptionUsageRoutes);
router.use("/usersubscription", userSubscriptionRoutes);

//MANAGE PERMISSIONS
router.use("/permissions", permissionRoutes);

//MANAGE ROLES
router.use("/roles", roleRoutes);

//MANAGE LANGUAGES
router.use("/languages", languageRoutes);

//MANAGE COUNTRIES
router.use("/countries", countryRoutes);

//MANAGE TIMEZONES
router.use("/timezones", timezoneRoutes);

//MANAGE CURRENCIES
router.use("/currencies", currencyRoutes);

//MANAGE FEATURES
router.use("/features", featureRoutes);

//MANAGE PLANS
router.use("/plans", planRoutes);

//MANAGE PLANS PRICES
router.use("/plans/prices", planPriceRoutes);

//MANAGE PLAN FEATURES
router.use("/planfeatures", planFeatureRoutes);

//MANAGE SYSTEM SETTINGS
router.use("/systemsettings", systemSettingRoutes);

//MANAGE USER
router.use("/user", userAuthRoutes);

//MANAGE USER AUTHENTICATION ROUTES
router.use("/auth", authRoutes);

//MANAGE USER PROFILE ROUTES
router.use("/userprofile", userProfileRoutes);

//MANAGE USER PROFILE ROUTES
router.use("/media", mediaRoutes);

//MANAGE USER PREFERENCE ROUTES
router.use("/userpreference", userPreferenceRoutes);

//MANAGE USER WORKSPACES ROUTES
router.use("/workspaces", workspaceRoutes);

//MANAGE WORKSPACES MEMBER INVITATIONS ROUTES
router.use("/workspacememberinvitations", workspaceMemberInvitationRoutes);

//MANAGE WORKSPACES FOLDERS ROUTES
router.use("/workspacefolders", workspaceFolderRoutes);

//MANAGE WORKSPACES MEMBERS ROUTES
router.use("/workspacemembers", workspaceMemberRoutes);

//MANAGE STICKY NOTES ROUTES
router.use("/stickynotescolumns", stickyNoteColumnRoutes);

//MANAGE STICKY NOTES ROUTES
router.use("/stickynotes", stickyNoteRoutes);

//MANAGE STICKY NOTE LABELS ROUTES
router.use("/stickynoteslabels", stickyNoteLabelRoutes);

//MANAGE STICKY NOTE CHECKLIST ROUTES
router.use("/stickynoteschecklist", stickyNoteChecklistRoutes);

//MANAGE STICKY NOTE CHECKLIST ITEMS ROUTES
router.use("/stickynoteschecklistitems", stickyNoteChecklistItemRoutes);

//MANAGE STICKY NOTE FAVORITES ROUTES
router.use("/stickynotefavorites", stickyNoteFavoriteRoutes);

//MANAGE STICKY NOTE ASSIGNEES ROUTES
router.use("/stickynotesassignees", stickyNoteAssigneeRoutes);
router.use("/stickynoteassignees", stickyNoteAssigneeRoutes);

//MANAGE AUDIT LOGS
router.use("/auditlogs", auditLogRoutes);

export default router;
