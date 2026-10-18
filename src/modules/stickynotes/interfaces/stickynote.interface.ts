import type { Document, Types } from "mongoose";
import type { StickyNoteColumnType } from "../../stickynotescolumns/constants/stickyNoteColumn.enums.js";
import type {
  StickyNoteBackgroundPattern,
  StickyNoteColor,
  StickyNoteDatePreset,
  StickyNoteDateState,
  StickyNotePriority,
  StickyNoteOverdueSort,
  StickyNoteShape,
  StickyNoteStatus,
  StickyNoteVariant,
} from "../constants/stickyNote.enums.js";

export type StickyNoteSortField =
  | "createdAt"
  | "updatedAt"
  | "position"
  | "rank"
  | "title"
  | "noteDate"
  | "stickyNoteNumber";

export type StickyNoteStoredShape =
  StickyNoteShape | "NOTE" | "ROUNDED" | "SOFT" | "CUT" | "TICKET" | "FOLDED";

export interface IStickyNote {
  workspaceId: Types.ObjectId;
  workspaceFolderId?: Types.ObjectId | null;
  columnId: Types.ObjectId;
  stickyNoteNumber: number;
  title: string;
  content: string;
  color: StickyNoteColor;
  priority: StickyNotePriority;
  shape: StickyNoteStoredShape;
  variant: StickyNoteVariant;
  backgroundPattern: StickyNoteBackgroundPattern;
  position: number;
  rank: string;
  status: StickyNoteStatus;
  noteDate?: string | null;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  archivedAt?: Date | null;
  archivedBy?: Types.ObjectId | null;
  deletedAt?: Date | null;
  deletedBy?: Types.ObjectId | null;
  purgeAfter?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IStickyNoteRecord extends IStickyNote {
  _id: Types.ObjectId;
  noteKey?: string;
}

export interface IStickyNoteDocument extends IStickyNote, Document {
  _id: Types.ObjectId;
  noteKey: string | undefined;
}

export interface IStickyNoteCreate {
  workspaceId: Types.ObjectId | string;
  workspaceFolderId: Types.ObjectId | string;
  columnId: Types.ObjectId | string;
  title?: string;
  content: string;
  color?: StickyNoteColor;
  priority?: StickyNotePriority;
  shape?: StickyNoteShape;
  variant?: StickyNoteVariant;
  backgroundPattern?: StickyNoteBackgroundPattern;
  position?: number;
  rank?: string;
  noteDate?: string | null;
  assigneeIds?: string[];
}

export interface IStickyNoteUpdate {
  workspaceId?: Types.ObjectId | string;
  workspaceFolderId?: Types.ObjectId | string;
  columnId?: Types.ObjectId | string;
  title?: string;
  content?: string;
  color?: StickyNoteColor;
  priority?: StickyNotePriority;
  shape?: StickyNoteShape;
  variant?: StickyNoteVariant;
  backgroundPattern?: StickyNoteBackgroundPattern;
  position?: number;
  rank?: string;
  noteDate?: string | null;
  assigneeIds?: string[];
}

export interface IStickyNoteReorder {
  columnId?: string | null;
  beforeId?: string | null;
  afterId?: string | null;
}

export interface IStickyNoteFilter {
  workspaceId?: Types.ObjectId | string;
  workspaceFolderId?: Types.ObjectId | string | null;
  columnId?: Types.ObjectId | string;
  search?: string;
  stickyNoteNumber?: number;
  color?: StickyNoteColor;
  priority?: StickyNotePriority;
  shape?: StickyNoteShape;
  variant?: StickyNoteVariant;
  status?: StickyNoteStatus;
  createdBy?: Types.ObjectId | string;
  noteDate?: string;
  datePreset?: StickyNoteDatePreset;
  page?: number;
  limit?: number;
  sortBy?: StickyNoteSortField;
  sortOrder?: "asc" | "desc";
}

export interface IStickyNoteRepositoryFilter extends Omit<
  IStickyNoteFilter,
  "datePreset"
> {
  noteDateFrom?: string;
  noteDateTo?: string;
  noteDateState?: StickyNoteDateState;
}

export interface IStickyNotePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface IStickyNoteAssigneeNormalized {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface IStickyNoteChecklistSummary {
  total: number;
  completed: number;
}

export interface IStickyNoteChecklistItemResponse {
  id: string;
  _id?: string;
  checklistId: string;
  title: string;
  position: number;
  isCompleted: boolean;
  status: string;
}

export interface IStickyNoteChecklistResponse {
  id: string;
  _id?: string;
  stickyNoteId: string;
  title: string;
  position: number;
  status: string;
  items: IStickyNoteChecklistItemResponse[];
}

export interface IStickyNoteListItemResponse {
  id: string;
  noteKey: string;
  workspaceId: string;
  workspaceFolderId: string | null;
  folderName: string | null;
  columnId: string;
  title: string;
  content: string;
  noteDate: string | null;
  color: StickyNoteColor;
  shape: StickyNoteStoredShape;
  variant: StickyNoteVariant;
  backgroundPattern: StickyNoteBackgroundPattern;
  position: number;
  rank: string;
  isFavorite: boolean;
  favoriteId: string | null;
  creatorEmail: string | null;
  assignees: IStickyNoteAssigneeNormalized[];
  checklistSummary: IStickyNoteChecklistSummary;
  checklists: IStickyNoteChecklistResponse[];
  updatedAt: Date | string;
}

export interface IStickyNoteDetailResponse {
  id: string;
  noteKey: string;
  workspaceId: string;
  workspaceFolderId: string | null;
  folderName: string | null;
  columnId: string;
  title: string;
  content: string;
  noteDate: string | null;
  color: StickyNoteColor;
  shape: StickyNoteStoredShape;
  variant: StickyNoteVariant;
  backgroundPattern: StickyNoteBackgroundPattern;
  position: number;
  rank: string;
  isFavorite: boolean;
  favoriteId: string | null;
  assignees: IStickyNoteAssigneeNormalized[];
  checklistSummary: IStickyNoteChecklistSummary;
  checklists: IStickyNoteChecklistResponse[];
  reminders: unknown[];
  attachments: unknown[];
  links: unknown[];
  updatedAt: Date | string;
}

export type IStickyNoteResponse = IStickyNoteDetailResponse;

export interface IStickyNotePaginatedResult {
  data: IStickyNoteListItemResponse[];
  pagination: IStickyNotePagination;
}

export interface IStickyNotePurgeResult {
  stickyNoteId: string;
  deletedChecklistItems: number;
  deletedChecklists: number;
  deletedStickyNotes: number;
}

export interface IStickyNoteOverdueFilter {
  workspaceId?: string;
  workspaceFolderId?: string;
  page?: number;
  limit?: number;
  sort?: StickyNoteOverdueSort;
}

export interface IStickyNoteOverdueRecord extends Pick<
  IStickyNoteRecord,
  | "_id"
  | "workspaceId"
  | "workspaceFolderId"
  | "columnId"
  | "stickyNoteNumber"
  | "title"
  | "content"
  | "priority"
  | "color"
  | "createdAt"
  | "updatedAt"
> {
  noteDate: string;
  column: { _id: Types.ObjectId; name: string; type: StickyNoteColumnType };
}

export interface IStickyNoteOverdueListItem {
  id: string;
  noteKey: string;
  workspaceId: string;
  workspaceFolderId: string | null;
  title: string;
  content: string;
  noteDate: string;
  daysOverdue: number;
  column: { id: string; name: string; type: StickyNoteColumnType };
  priority: StickyNotePriority;
  color: StickyNoteColor;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IStickyNoteOverdueColumnCount {
  columnId: string;
  name: string;
  type: StickyNoteColumnType;
  count: number;
}

export interface IBringStickyNotesToTodayResult {
  today: string;
  requested: number;
  updated: number;
  skipped: number;
  skippedNotes: Array<{ id: string; reason: "NOT_OVERDUE_OR_UNAVAILABLE" }>;
}
