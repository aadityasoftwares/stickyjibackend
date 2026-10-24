import { Router } from "express";
import { savePerformanceModule } from "../utils/savePerformance.util.js";
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

router.use("/billing", savePerformanceModule("billing"), billingRoutes);
router.use(
    "/subscriptionentitlement",
    savePerformanceModule("subscriptionentitlement"),
    subscriptionEntitlementRoutes,
);
router.use("/subscriptionusage", savePerformanceModule("subscriptionusage"), subscriptionUsageRoutes);
router.use("/usersubscription", savePerformanceModule("usersubscription"), userSubscriptionRoutes);

//MANAGE PERMISSIONS
router.use("/permissions", savePerformanceModule("permissions"), permissionRoutes);

//MANAGE ROLES
router.use("/roles", savePerformanceModule("roles"), roleRoutes);

//MANAGE LANGUAGES
router.use("/languages", savePerformanceModule("languages"), languageRoutes);

//MANAGE COUNTRIES
router.use("/countries", savePerformanceModule("countries"), countryRoutes);

//MANAGE TIMEZONES
router.use("/timezones", savePerformanceModule("timezones"), timezoneRoutes);

//MANAGE CURRENCIES
router.use("/currencies", savePerformanceModule("currencies"), currencyRoutes);

//MANAGE FEATURES
router.use("/features", savePerformanceModule("features"), featureRoutes);

//MANAGE PLANS
router.use("/plans", savePerformanceModule("plans"), planRoutes);

//MANAGE PLANS PRICES
router.use("/plans/prices", savePerformanceModule("planprices"), planPriceRoutes);

//MANAGE PLAN FEATURES
router.use("/planfeatures", savePerformanceModule("planfeatures"), planFeatureRoutes);

//MANAGE SYSTEM SETTINGS
router.use("/systemsettings", savePerformanceModule("systemsettings"), systemSettingRoutes);

//MANAGE USER
router.use("/user", savePerformanceModule("user"), userAuthRoutes);

//MANAGE USER AUTHENTICATION ROUTES
router.use("/auth", savePerformanceModule("auth"), authRoutes);

//MANAGE USER PROFILE ROUTES
router.use("/userprofile", savePerformanceModule("userprofile"), userProfileRoutes);

//MANAGE USER PROFILE ROUTES
router.use("/media", savePerformanceModule("media"), mediaRoutes);

//MANAGE USER PREFERENCE ROUTES
router.use("/userpreference", savePerformanceModule("userpreference"), userPreferenceRoutes);

//MANAGE USER WORKSPACES ROUTES
router.use("/workspaces", savePerformanceModule("workspaces"), workspaceRoutes);

//MANAGE WORKSPACES MEMBER INVITATIONS ROUTES
router.use(
    "/workspacememberinvitations",
    savePerformanceModule("workspacememberinvitations"),
    workspaceMemberInvitationRoutes,
);

//MANAGE WORKSPACES FOLDERS ROUTES
router.use("/workspacefolders", savePerformanceModule("workspacefolders"), workspaceFolderRoutes);

//MANAGE WORKSPACES MEMBERS ROUTES
router.use("/workspacemembers", savePerformanceModule("workspacemembers"), workspaceMemberRoutes);

//MANAGE STICKY NOTES ROUTES
router.use("/stickynotescolumns", savePerformanceModule("stickynotescolumns"), stickyNoteColumnRoutes);

//MANAGE STICKY NOTES ROUTES
router.use("/stickynotes", savePerformanceModule("stickynotes"), stickyNoteRoutes);

//MANAGE STICKY NOTE LABELS ROUTES
router.use("/stickynoteslabels", savePerformanceModule("stickynoteslabels"), stickyNoteLabelRoutes);

//MANAGE STICKY NOTE CHECKLIST ROUTES
router.use("/stickynoteschecklist", savePerformanceModule("stickynoteschecklist"), stickyNoteChecklistRoutes);

//MANAGE STICKY NOTE CHECKLIST ITEMS ROUTES
router.use(
    "/stickynoteschecklistitems",
    savePerformanceModule("stickynoteschecklistitems"),
    stickyNoteChecklistItemRoutes,
);

//MANAGE STICKY NOTE FAVORITES ROUTES
router.use("/stickynotefavorites", savePerformanceModule("stickynotefavorites"), stickyNoteFavoriteRoutes);

//MANAGE STICKY NOTE ASSIGNEES ROUTES
router.use("/stickynotesassignees", savePerformanceModule("stickynotesassignees"), stickyNoteAssigneeRoutes);
router.use("/stickynoteassignees", savePerformanceModule("stickynotesassignees"), stickyNoteAssigneeRoutes);

//MANAGE AUDIT LOGS
router.use("/auditlogs", savePerformanceModule("auditlogs"), auditLogRoutes);

export default router;
