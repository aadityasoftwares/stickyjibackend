import { AppError } from "../../../utils/errors/app.error.js";
import { STICKY_NOTE_CONSTANTS } from "../constants/stickyNote.constants.js";
import { StickyNoteMessages } from "../constants/stickyNote.messages.js";
import { StickyNoteValidation as V } from "./stickyNote.validation.js";
import { StickyNoteAssigneeMessages } from "../../stickynotesassignees/constants/stickyNoteAssignee.messages.js";
import { STICKY_NOTE_ASSIGNEE_CONSTANTS } from "../../stickynotesassignees/constants/stickyNoteAssignee.constants.js";
const allowedFields = new Set([
  "workspaceId",
  "workspaceFolderId",
  "columnId",
  "title",
  "content",
  "color",
  "priority",
  "shape",
  "variant",
  "backgroundPattern",
  "position",
  "noteDate",
  "assigneeIds",
]);
// Shared create/update rules; request validation stays in middleware.
export function validateStickyNoteFields(
  body: unknown,
  mode: "create" | "update",
): void {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError(
      mode === "create"
        ? "Request body is required."
        : StickyNoteMessages.UPDATE_REQUIRED,
      400,
    );
  }
  const values = body as Record<string, unknown>;
  const keys = Object.keys(values);
  if (mode === "update" && keys.length === 0)
    throw new AppError(StickyNoteMessages.UPDATE_REQUIRED, 400);
  const unknownField = keys.find((field) => !allowedFields.has(field));
  if (unknownField)
    throw new AppError(
      mode === "create"
        ? `Field "${unknownField}" is not allowed when creating a sticky note.`
        : `Field "${unknownField}" cannot be updated.`,
      400,
    );
  const {
    workspaceId,
    workspaceFolderId,
    columnId,
    title,
    content,
    color,
    priority,
    shape,
    variant,
    backgroundPattern,
    position,
    noteDate,
    assigneeIds,
  } = values;
  if (mode === "create" && !workspaceId)
    throw new AppError(StickyNoteMessages.WORKSPACE_ID_REQUIRED, 400);
  if (workspaceId !== undefined && !V.isValidObjectId(workspaceId))
    throw new AppError(StickyNoteMessages.INVALID_WORKSPACE_ID, 400);
  if (mode === "create" && !workspaceFolderId)
    throw new AppError(StickyNoteMessages.WORKSPACE_FOLDER_ID_REQUIRED, 400);
  if (
    workspaceFolderId !== undefined &&
    workspaceFolderId !== null &&
    workspaceFolderId !== "" &&
    !V.isValidObjectId(workspaceFolderId)
  )
    throw new AppError(StickyNoteMessages.INVALID_WORKSPACE_FOLDER_ID, 400);
  if (mode === "create" && !columnId)
    throw new AppError(StickyNoteMessages.COLUMN_ID_REQUIRED, 400);
  if (columnId !== undefined && !V.isValidObjectId(columnId))
    throw new AppError(StickyNoteMessages.INVALID_COLUMN_ID, 400);
  if (
    title !== undefined &&
    (typeof title !== "string" ||
      V.normalizeTitle(title).length > STICKY_NOTE_CONSTANTS.TITLE.MAX_LENGTH)
  )
    throw new AppError(StickyNoteMessages.INVALID_TITLE, 400);
  if (mode === "create" && (content === undefined || content === null))
    throw new AppError(StickyNoteMessages.CONTENT_REQUIRED, 400);
  if (content !== undefined) {
    if (typeof content !== "string")
      throw new AppError(StickyNoteMessages.INVALID_CONTENT, 400);
    const normalized = V.normalizeContent(content);
    if (
      normalized.length < STICKY_NOTE_CONSTANTS.CONTENT.MIN_LENGTH ||
      normalized.length > STICKY_NOTE_CONSTANTS.CONTENT.MAX_LENGTH
    )
      throw new AppError(StickyNoteMessages.INVALID_CONTENT, 400);
  }
  if (color !== undefined && !V.isValidColor(color))
    throw new AppError(StickyNoteMessages.INVALID_COLOR, 400);
  if (priority !== undefined && !V.isValidPriority(priority))
    throw new AppError(StickyNoteMessages.INVALID_PRIORITY, 400);
  if (shape !== undefined && !V.isValidShape(shape))
    throw new AppError(StickyNoteMessages.INVALID_SHAPE, 400);
  if (variant !== undefined && !V.isValidVariant(variant))
    throw new AppError(StickyNoteMessages.INVALID_VARIANT, 400);
  if (
    backgroundPattern !== undefined &&
    !V.isValidBackgroundPattern(backgroundPattern)
  )
    throw new AppError(StickyNoteMessages.INVALID_BACKGROUND_PATTERN, 400);
  if (
    noteDate !== undefined &&
    noteDate !== null &&
    noteDate !== "" &&
    !V.isValidDateKey(noteDate)
  )
    throw new AppError(StickyNoteMessages.INVALID_NOTE_DATE, 400);
  if (
    position !== undefined &&
    (!V.isValidPosition(position) ||
      position < STICKY_NOTE_CONSTANTS.POSITION.MIN)
  )
    throw new AppError(StickyNoteMessages.INVALID_POSITION, 400);
  if (assigneeIds !== undefined) {
    if (!Array.isArray(assigneeIds))
      throw new AppError(StickyNoteAssigneeMessages.INVALID_ASSIGNEE_IDS, 400);
    if (assigneeIds.length > STICKY_NOTE_ASSIGNEE_CONSTANTS.MAX_PER_NOTE)
      throw new AppError(StickyNoteAssigneeMessages.TOO_MANY_ASSIGNEES, 400);
    if (assigneeIds.some((id) => !V.isValidObjectId(id)))
      throw new AppError(StickyNoteAssigneeMessages.INVALID_ASSIGNEE_IDS, 400);
  }
}
