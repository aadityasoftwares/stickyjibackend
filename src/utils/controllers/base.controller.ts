import type { Request } from "express";

export abstract class BaseController {
    protected getParam(value: string | string[] | undefined): string {
        if (Array.isArray(value)) {
            return value[0]?.trim() ?? "";
        }

        return value?.trim() ?? "";
    }
}
