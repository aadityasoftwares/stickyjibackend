import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";
import { createFolderSchema } from "./workspaceFolder.schema.js";
export const createWorkspaceFolderValidation = validateUsingZOD(createFolderSchema);
