import type { Request, Response, NextFunction } from "express";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";
import { StickyNoteAttachmentService } from "../services/stickyNoteAttachment.service.js";

export class StickyNoteAttachmentController {
    private readonly service = new StickyNoteAttachmentService();
    private params(req: Request) {
        return [
            RequestUtil.getParam(req.params.noteId),
            RequestUtil.getParam(req.params.attachmentId),
            RequestUtil.getUserId(req),
        ] as const;
    }
    requestUpload = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const [noteId, , userId] = this.params(req);
            res.status(201).json(
                ResponseUtil.created(
                    "Attachment upload requested",
                    await this.service.requestUpload(noteId, userId, req.body),
                ),
            );
        } catch (error) {
            next(error);
        }
    };
    complete = async (req: Request, res: Response, next: NextFunction) => {
        try {
            res.json(
                ResponseUtil.success(
                    "Attachment uploaded successfully",
                    await this.service.complete(...this.params(req)),
                ),
            );
        } catch (error) {
            next(error);
        }
    };
    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const [noteId, , userId] = this.params(req);
            const result = await this.service.list(noteId, userId, req.query);
            res.json(
                ResponseUtil.paginated(
                    "Attachments fetched",
                    result.data,
                    result.page,
                    result.limit,
                    result.total,
                ),
            );
        } catch (error) {
            next(error);
        }
    };
    download = async (req: Request, res: Response, next: NextFunction) => {
        try {
            res.json(
                ResponseUtil.success(
                    "Download URL created",
                    await this.service.download(...this.params(req)),
                ),
            );
        } catch (error) {
            next(error);
        }
    };
    delete = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.service.delete(...this.params(req));
            res.json(ResponseUtil.success("Attachment deleted"));
        } catch (error) {
            next(error);
        }
    };
}
