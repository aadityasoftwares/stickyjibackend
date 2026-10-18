import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";
import { invitationCreateSchema } from "./workspaceMemberInvitation.schema.js";
export const createWorkspaceMemberInvitationValidation = validateUsingZOD(invitationCreateSchema);
