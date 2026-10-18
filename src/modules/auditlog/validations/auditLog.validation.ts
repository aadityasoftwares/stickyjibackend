import { AppModule } from "../../../utils/enums/appModule.enums.js";
import {
    AuditLogAction,
    AuditLogActorType,
    AuditLogSeverity,
    AuditLogStatus,
} from "../constants/auditLog.enums.js";

export const AuditLogValidation = {
    actions: Object.values(AuditLogAction),
    modules: Object.values(AppModule),
    actorTypes: Object.values(AuditLogActorType),
    statuses: Object.values(AuditLogStatus),
    severities: Object.values(AuditLogSeverity),
};
