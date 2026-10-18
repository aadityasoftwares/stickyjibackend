export const AppMessages = {
    SERVER_RUNNING: (port: number | string) => `Server is running successfully on port ${port}.`,
    SERVER_ERROR: "An unexpected server error occurred. Please try again later.",
    APP_INITIALIZED: "Application initialized successfully.",
    SHUTDOWN_INITIATED: "Graceful shutdown initiated...",
    SHUTDOWN_COMPLETE: "Server stopped successfully.",

    INTERNAL_SERVER_ERROR: "Internal Server Error.",
    SERVICE_UNAVAILABLE: "Service is temporarily unavailable. Please try again later.",
    ROUTE_NOT_FOUND: (path: string) => `The requested endpoint '${path}' was not found on this server.`,
    UNHANDLED_REJECTION: "Unhandled Promise Rejection detected.",
    UNCAUGHT_EXCEPTION: "Uncaught Exception thrown.",

    TOO_MANY_REQUESTS: "Too many requests from this IP. Please try again later.",
    REQUEST_TIMEOUT: "Request timeout. The server took too long to respond.",
    NETWORK_ERROR: "Network error occurred. Please check your connection.",

    HEALTH_CHECK_SUCCESS: "Server health check passed.",
    MAINTENANCE_MODE: "The system is currently undergoing scheduled maintenance.",
    API_WELCOME: "Welcome to the API service.",
};
