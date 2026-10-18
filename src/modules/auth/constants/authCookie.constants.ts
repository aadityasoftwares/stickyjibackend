import type { CookieOptions } from "express";
import dotenv from "dotenv";
dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

export const AUTH_COOKIE_CONSTANTS = {
    REFRESH_TOKEN_NAME: isProduction ? "__Host-msn_refresh" : "msn_refresh",

    REFRESH_TOKEN_OPTIONS: {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
    } satisfies CookieOptions,
} as const;
