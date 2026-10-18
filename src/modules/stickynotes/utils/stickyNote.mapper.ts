import type {
    IStickyNoteAssigneeNormalized,
    IStickyNoteChecklistResponse,
    IStickyNoteChecklistSummary,
    IStickyNoteDetailResponse,
    IStickyNoteListItemResponse,
    IStickyNoteRecord,
    IStickyNoteOverdueRecord,
    IStickyNoteOverdueListItem,
} from "../interfaces/stickyNote.interface.js";
import {
    StickyNoteBackgroundPattern,
    StickyNoteColor,
    StickyNoteShape,
    StickyNoteVariant,
} from "../constants/stickyNote.enums.js";

/**
 * Normalizes raw user / assignee object to standard structure:
 * { id, name, email, avatarUrl }
 */
export function normalizeAssignee(raw: any): IStickyNoteAssigneeNormalized {
    if (!raw) {
        return { id: "", name: "", email: "", avatarUrl: null };
    }

    const user = raw.userId && typeof raw.userId === "object" ? raw.userId : raw;
    const id = user._id
        ? user._id.toString()
        : user.id
          ? user.id.toString()
          : raw.userId
            ? raw.userId.toString()
            : raw.id
              ? raw.id.toString()
              : "";

    const firstName = user.firstName ?? "";
    const lastName = user.lastName ?? "";
    const fullName = `${firstName} ${lastName}`.trim();

    const name = user.displayName || user.name || (fullName.length > 0 ? fullName : user.email || "");

    const email = user.email || "";
    const avatarUrl = user.avatarUrl || user.avatar || user.profile?.avatarUrl || null;

    return {
        id,
        name,
        email,
        avatarUrl,
    };
}

export interface IMapStickyNoteOptions {
    folderName?: string | null;
    isFavorite?: boolean;
    favoriteId?: string | null;
    creatorEmail?: string | null;
    assignees?: IStickyNoteAssigneeNormalized[];
    checklists?: IStickyNoteChecklistResponse[];
    checklistSummary?: IStickyNoteChecklistSummary;
}

function getNoteKey(note: { noteKey?: string; stickyNoteNumber: number }): string {
    const number = typeof note.stickyNoteNumber === "number" ? note.stickyNoteNumber : undefined;
    return note.noteKey ?? (number ? `ST-${String(number).padStart(6, "0")}` : "");
}

export function mapStickyNoteOverdueListItem(
    note: IStickyNoteOverdueRecord,
    daysOverdue: number,
): IStickyNoteOverdueListItem {
    return {
        id: note._id.toString(),
        noteKey: getNoteKey(note),
        workspaceId: note.workspaceId.toString(),
        workspaceFolderId: note.workspaceFolderId?.toString() ?? null,
        title: note.title,
        content: note.content,
        noteDate: note.noteDate,
        daysOverdue,
        column: {
            id: note.column._id.toString(),
            name: note.column.name,
            type: note.column.type,
        },
        priority: note.priority,
        color: note.color,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
    };
}

/**
 * Maps a Sticky Note database record to lightweight frontend-friendly list/card DTO.
 */
export function mapStickyNoteListItem(
    note: IStickyNoteRecord,
    options: IMapStickyNoteOptions = {},
): IStickyNoteListItemResponse {
    const noteKey = getNoteKey(note);

    const checklists = options.checklists ?? [];
    const checklistSummary = options.checklistSummary ?? deriveChecklistSummary(checklists);

    return {
        id: note._id.toString(),
        noteKey: noteKey ?? "",
        workspaceId: note.workspaceId ? note.workspaceId.toString() : "",
        workspaceFolderId: note.workspaceFolderId ? note.workspaceFolderId.toString() : null,
        folderName: options.folderName ?? null,
        columnId: note.columnId ? note.columnId.toString() : "",
        title: note.title ?? "",
        content: note.content ?? "",
        noteDate: note.noteDate ?? null,
        color: note.color ?? StickyNoteColor.YELLOW,
        shape: note.shape ?? StickyNoteShape.SQUARE,
        variant: note.variant ?? StickyNoteVariant.PLAIN,
        backgroundPattern: note.backgroundPattern ?? StickyNoteBackgroundPattern.NONE,
        position: note.position ?? 0,
        rank: note.rank ?? "",
        isFavorite: Boolean(options.isFavorite),
        favoriteId: options.favoriteId ?? null,
        creatorEmail: options.creatorEmail ?? null,
        assignees: options.assignees ?? [],
        checklistSummary,
        checklists,
        updatedAt: note.updatedAt ?? note.createdAt ?? new Date(),
    };
}

/**
 * Maps a Sticky Note database record to rich detail/editor DTO.
 */
export function mapStickyNoteDetail(
    note: IStickyNoteRecord,
    options: IMapStickyNoteOptions = {},
): IStickyNoteDetailResponse {
    const noteKey = getNoteKey(note);

    const checklists = options.checklists ?? [];
    const checklistSummary = options.checklistSummary ?? deriveChecklistSummary(checklists);

    return {
        id: note._id.toString(),
        noteKey: noteKey ?? "",
        workspaceId: note.workspaceId ? note.workspaceId.toString() : "",
        workspaceFolderId: note.workspaceFolderId ? note.workspaceFolderId.toString() : null,
        folderName: options.folderName ?? null,
        columnId: note.columnId ? note.columnId.toString() : "",
        title: note.title ?? "",
        content: note.content ?? "",
        noteDate: note.noteDate ?? null,
        color: note.color ?? StickyNoteColor.YELLOW,
        shape: note.shape ?? StickyNoteShape.SQUARE,
        variant: note.variant ?? StickyNoteVariant.PLAIN,
        backgroundPattern: note.backgroundPattern ?? StickyNoteBackgroundPattern.NONE,
        position: note.position ?? 0,
        rank: note.rank ?? "",
        isFavorite: Boolean(options.isFavorite),
        favoriteId: options.favoriteId ?? null,
        assignees: options.assignees ?? [],
        checklistSummary,
        checklists,
        reminders: [],
        attachments: [],
        links: [],
        updatedAt: note.updatedAt ?? note.createdAt ?? new Date(),
    };
}

function deriveChecklistSummary(checklists: IStickyNoteChecklistResponse[]): IStickyNoteChecklistSummary {
    let total = 0;
    let completed = 0;

    for (const cl of checklists) {
        if (Array.isArray(cl.items)) {
            total += cl.items.length;
            for (const item of cl.items) {
                if (item.isCompleted) completed += 1;
            }
        }
    }

    return { total, completed };
}
