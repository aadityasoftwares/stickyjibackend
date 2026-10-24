import type { ConnectOptions } from "mongoose";

/** Shared by the API and maintenance scripts, including standalone deployments. */
export function mongoConnectionOptions(options: ConnectOptions = {}): ConnectOptions {
    // Explicit options override URI parameters, including retryWrites=true.
    // Transaction capability is checked separately before business operations run.
    return { ...options, retryWrites: false };
}
