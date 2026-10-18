import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";
import { invitationTokenSchema } from "./workspaceMemberInvitation.schema.js";
export const validateWorkspaceMemberInvitationTokenValidation = validateUsingZOD(invitationTokenSchema);
export const acceptWorkspaceMemberInvitationValidation = validateUsingZOD(invitationTokenSchema);
