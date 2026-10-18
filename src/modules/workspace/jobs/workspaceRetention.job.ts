import { WorkspaceService } from "../services/workspace.service.js";
const workspaceService = new WorkspaceService();
export const runWorkspaceRetentionCleanup = () => workspaceService.purgeExpiredWorkspaces();
