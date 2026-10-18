import { Router } from "express";
import { AuditLogController } from "../controllers/auditLog.controller.js";
import { getAuditLogValidation } from "../validations/getAuditLog.validation.js";
import { getAuditLogsValidation } from "../validations/getAuditLogs.validation.js";
import { requireRouteParam } from "../../../utils/validations/validateParam.validation.js";

const auditLogRoutes = Router();
const auditLogController = new AuditLogController();

auditLogRoutes.get(
    "/getall",
    getAuditLogsValidation,
    auditLogController.getAll
);

auditLogRoutes.get(
    "/get/:id",
    requireRouteParam("id"),
    getAuditLogValidation,
    auditLogController.getById
);

export default auditLogRoutes;