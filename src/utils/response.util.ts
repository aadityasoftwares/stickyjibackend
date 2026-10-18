export interface ApiResponse<T = unknown> {
    success: boolean;
    message: string;
    data?: T;
    error?: unknown;
    meta?: PaginationMeta;
}

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export class ResponseUtil {
    static success<T>(message: string, data?: T): ApiResponse<T> {
        const response: ApiResponse<T> = {
            success: true,
            message,
        };

        if (data !== undefined) response.data = data;

        return response;
    }

    static created<T>(message: string, data?: T): ApiResponse<T> {
        const response: ApiResponse<T> = {
            success: true,
            message,
        };

        if (data !== undefined) response.data = data;

        return response;
    }

    static badRequest(message = "Bad request", error?: unknown): ApiResponse {
        const response: ApiResponse = {
            success: false,
            message,
        };

        if (error !== undefined) response.error = error;

        return response;
    }

    static unauthorized(message = "Unauthorized"): ApiResponse {
        return {
            success: false,
            message,
        };
    }

    static forbidden(message = "Forbidden"): ApiResponse {
        return {
            success: false,
            message,
        };
    }

    static notFound(message = "Resource not found"): ApiResponse {
        return {
            success: false,
            message,
        };
    }

    static serverError(message = "Internal server error", error?: unknown): ApiResponse {
        const response: ApiResponse = {
            success: false,
            message,
        };

        if (error !== undefined) response.error = error;

        return response;
    }

    static validationError(message = "Validation error", error?: unknown): ApiResponse {
        const response: ApiResponse = {
            success: false,
            message,
        };

        if (error !== undefined) response.error = error;

        return response;
    }

    static error(message: string, code?: string): ApiResponse {
        return {
            success: false,
            message,
            ...(code ? { error: { code } } : {}),
        };
    }

    static paginated<T>(
        message: string,
        data: T[],
        page: number,
        limit: number,
        total: number,
    ): ApiResponse<T[]> {
        return {
            success: true,
            message,
            data,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}
