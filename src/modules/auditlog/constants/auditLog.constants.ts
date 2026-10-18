import { AuditLogActorType, AuditLogSeverity, } from "./auditLog.enums.js";

export const DEFAULT_AUDIT_LOG_ACTOR_TYPE = AuditLogActorType.USER;
export const DEFAULT_AUDIT_LOG_SEVERITY = AuditLogSeverity.INFO;
export const DEFAULT_AUDIT_LOG_METADATA = {};