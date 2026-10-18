import type {
    Request,
    Response,
    NextFunction,
} from "express";

import {
    ResponseUtil,
} from "../../../utils/response.util.js";

import {
    RequestUtil,
} from "../../../utils/request.util.js";

import {
    StickyNoteChecklistItemService,
} from "../services/stickyNoteChecklistItem.service.js";

import {
    StickyNoteChecklistItemMessages,
} from "../constants/stickyNoteChecklistItem.messages.js";

import type {
    StickyNoteChecklistItemStatus,
} from "../constants/stickyNoteChecklistItem.enums.js";

import type {
    StickyNoteChecklistItemSortField,
} from "../interfaces/stickyNoteChecklistItem.interface.js";

export class StickyNoteChecklistItemController {
    private readonly stickyNoteChecklistItemService:
        StickyNoteChecklistItemService;

    constructor() {
        this.stickyNoteChecklistItemService =
            new StickyNoteChecklistItemService();
    }

    createStickyNoteChecklistItem =
        async (
            req: Request,
            res: Response,
            next: NextFunction,
        ) => {
            try {
                const item =
                    await this
                        .stickyNoteChecklistItemService
                        .createStickyNoteChecklistItem(
                            req.body,
                            req.user?.id as string,
                        );

                return res
                    .status(
                        201,
                    )
                    .json(
                        ResponseUtil.created(
                            StickyNoteChecklistItemMessages.CREATED,
                            item,
                        ),
                    );
            } catch (error) {
                next(
                    error,
                );
            }
        };

    getStickyNoteChecklistItemById =
        async (
            req: Request,
            res: Response,
            next: NextFunction,
        ) => {
            try {
                const item =
                    await this
                        .stickyNoteChecklistItemService
                        .getStickyNoteChecklistItemById(
                            RequestUtil.getParam(
                                req.params.id ?? req.query.id,
                            ),
                        );

                return res
                    .status(
                        200,
                    )
                    .json(
                        ResponseUtil.success(
                            StickyNoteChecklistItemMessages.FETCHED,
                            item,
                        ),
                    );
            } catch (error) {
                next(
                    error,
                );
            }
        };

    getStickyNoteChecklistItems =
        async (
            req: Request,
            res: Response,
            next: NextFunction,
        ) => {
            try {
                const source = (req.method === "POST" ? req.body : req.query) ?? {};
                const parseBoolean = (val: unknown): boolean | undefined => {
                    if (val === true || val === "true") return true;
                    if (val === false || val === "false") return false;
                    return undefined;
                };

                const items =
                    await this
                        .stickyNoteChecklistItemService
                        .getStickyNoteChecklistItems({
                            checklistId:
                                typeof source.checklistId === "string"
                                    ? source.checklistId.trim()
                                    : (source.checklistId as string),
                            search:
                                typeof source.search === "string"
                                    ? source.search
                                    : undefined,
                            status:
                                source.status as StickyNoteChecklistItemStatus |
                                undefined,
                            isCompleted:
                                parseBoolean(source.isCompleted),
                            createdBy:
                                typeof source.createdBy === "string"
                                    ? source.createdBy.trim()
                                    : undefined,
                            completedBy:
                                typeof source.completedBy === "string"
                                    ? source.completedBy.trim()
                                    : undefined,
                            page:
                                source.page !==
                                    undefined
                                    ? Number(
                                        source.page,
                                    )
                                    : undefined,
                            limit:
                                source.limit !==
                                    undefined
                                    ? Number(
                                        source.limit,
                                    )
                                    : undefined,
                            sortBy:
                                source.sortBy as StickyNoteChecklistItemSortField |
                                undefined,
                            sortOrder:
                                source.sortOrder as "asc" |
                                "desc" |
                                undefined,
                        });

                return res
                    .status(
                        200,
                    )
                    .json(
                        ResponseUtil.paginated(
                            StickyNoteChecklistItemMessages.FETCHED_ALL,
                            items.data,
                            items.pagination.page,
                            items.pagination.limit,
                            items.pagination.total,
                        ),
                    );
            } catch (error) {
                next(
                    error,
                );
            }
        };

    updateStickyNoteChecklistItem =
        async (
            req: Request,
            res: Response,
            next: NextFunction,
        ) => {
            try {
                const item =
                    await this
                        .stickyNoteChecklistItemService
                        .updateStickyNoteChecklistItem(
                            RequestUtil.getParam(
                                req.params.id,
                            ),
                            req.body,
                            req.user?.id as string,
                        );

                return res
                    .status(
                        200,
                    )
                    .json(
                        ResponseUtil.success(
                            StickyNoteChecklistItemMessages.UPDATED,
                            item,
                        ),
                    );
            } catch (error) {
                next(
                    error,
                );
            }
        };

    updateStickyNoteChecklistItemStatus =
        async (
            req: Request,
            res: Response,
            next: NextFunction,
        ) => {
            try {
                const item =
                    await this
                        .stickyNoteChecklistItemService
                        .updateStickyNoteChecklistItemStatus(
                            RequestUtil.getParam(
                                req.params.id,
                            ),
                            req.body.status,
                            req.user?.id as string,
                        );

                return res
                    .status(
                        200,
                    )
                    .json(
                        ResponseUtil.success(
                            StickyNoteChecklistItemMessages.STATUS_UPDATED,
                            item,
                        ),
                    );
            } catch (error) {
                next(
                    error,
                );
            }
        };

    updateStickyNoteChecklistItemCompletion =
        async (
            req: Request,
            res: Response,
            next: NextFunction,
        ) => {
            try {
                const item =
                    await this
                        .stickyNoteChecklistItemService
                        .updateStickyNoteChecklistItemCompletion(
                            RequestUtil.getParam(
                                req.params.id,
                            ),
                            req.body.isCompleted,
                            req.user?.id as string,
                        );

                return res
                    .status(
                        200,
                    )
                    .json(
                        ResponseUtil.success(
                            req.body.isCompleted
                                ? StickyNoteChecklistItemMessages.COMPLETED
                                : StickyNoteChecklistItemMessages.UNCOMPLETED,
                            item,
                        ),
                    );
            } catch (error) {
                next(
                    error,
                );
            }
        };

    deleteStickyNoteChecklistItem =
        async (
            req: Request,
            res: Response,
            next: NextFunction,
        ) => {
            try {
                await this
                    .stickyNoteChecklistItemService
                    .deleteStickyNoteChecklistItem(
                        RequestUtil.getParam(
                            req.params.id,
                        ),
                        req.user?.id as string,
                    );

                return res
                    .status(
                        200,
                    )
                    .json(
                        ResponseUtil.success(
                            StickyNoteChecklistItemMessages.DELETED,
                        ),
                    );
            } catch (error) {
                next(
                    error,
                );
            }
        };

    restoreStickyNoteChecklistItem =
        async (
            req: Request,
            res: Response,
            next: NextFunction,
        ) => {
            try {
                const item =
                    await this
                        .stickyNoteChecklistItemService
                        .restoreStickyNoteChecklistItem(
                            RequestUtil.getParam(
                                req.params.id,
                            ),
                            req.user?.id as string,
                        );

                return res
                    .status(
                        200,
                    )
                    .json(
                        ResponseUtil.success(
                            StickyNoteChecklistItemMessages.RESTORED,
                            item,
                        ),
                    );
            } catch (error) {
                next(
                    error,
                );
            }
        };
}
