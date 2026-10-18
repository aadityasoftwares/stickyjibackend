import type { Request } from "express";

export class RequestUtil {
    static getParam(value: string | string[] | undefined): string {
        if (Array.isArray(value)) {
            return value[0]?.trim() ?? "";
        }
        return value?.trim() ?? "";
    }

    static getUserId(req: Request): string {
        return (req.user?.id as string) || "";
    }
}
