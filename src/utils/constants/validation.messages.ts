export const ValidationMessages = {
    // ==========================================
    // Common / Required Fields
    // ==========================================
    REQUIRED_FIELD: (field: string) => `${field} is required.`,
    FIELD_REQUIRED: (field: string) => `${field} is required.`, // Referenced in middleware
    REQUIRED_ROUTE_PARAM: (field: string) => `Route parameter '${field}' is required.`,
    REQUIRED_QUERY_PARAM: (field: string) => `Query parameter '${field}' is required.`,
    REQUIRED_HEADER: (field: string) => `Header '${field}' is required.`,
    EMPTY_REQUEST_BODY: "Request body cannot be empty.",
    PAYLOAD_TOO_LARGE: (maxSize: string) => `Request body exceeds the maximum allowed size of ${maxSize}.`,
    INVALID_JSON: "Invalid JSON payload.",

    // ==========================================
    // Headers & Content-Type Validation
    // ==========================================
    CONTENT_TYPE_REQUIRED: "Content-Type header is required.",
    INVALID_CONTENT_TYPE: (expected: string) => `Content-Type must be '${expected}'.`,

    // ==========================================
    // Field Specific: IDs, Numbers, Booleans
    // ==========================================
    INVALID_ID: (field: string = "id") => `Invalid '${field}'. Must be a valid 24-character hex ID.`,
    INVALID_BOOLEAN: (field: string) => `'${field}' must be a boolean.`,
    INVALID_NUMBER: (field: string) => `'${field}' must be a valid number.`,
    MIN_VALUE: (field: string, min: number) => `'${field}' must be at least ${min}.`,
    MAX_VALUE: (field: string, max: number) => `'${field}' must not exceed ${max}.`,

    // ==========================================
    // User Input: Email, Phone, Password, Date, URL
    // ==========================================
    INVALID_EMAIL: "Invalid email address.",
    INVALID_PHONE: "Invalid phone number format.",
    INVALID_PASSWORD: "Invalid password.",
    PASSWORD_TOO_SHORT: (minLength: number) => `Password must be at least ${minLength} characters long.`,
    INVALID_DATE: (field: string = "date") => `'${field}' must be a valid date format.`,
    INVALID_URL: (field: string = "URL") => `'${field}' must be a valid URL.`,

    // ==========================================
    // Enums & Codes
    // ==========================================
    INVALID_ENUM: (field: string, allowedValues?: string) =>
        allowedValues
            ? `Invalid value for '${field}'. Allowed values: ${allowedValues}.`
            : `Invalid value provided for '${field}'.`,
    INVALID_CODE: (field: string) =>
        `'${field}' must contain only uppercase letters, numbers, and underscores.`,
    INVALID_CODE_LENGTH: (field: string, min: number, max: number) =>
        `'${field}' must be between ${min} and ${max} characters long.`,

    // ==========================================
    // Pagination, Sort & Search Validations
    // ==========================================
    INVALID_PAGE: "Page must be greater than zero.",
    INVALID_LIMIT: "Limit must be greater than zero.",
    INVALID_PAGINATION_PAGE: "Invalid page parameter. Must be a positive integer.",
    INVALID_PAGINATION_LIMIT: (maxLimit: number) => `Limit must be a positive integer and not exceed ${maxLimit}.`,
    INVALID_SORT_FIELD: (allowedFields: string) => `Invalid sort field. Allowed fields: ${allowedFields}.`,
    INVALID_SORT_ORDER: "Invalid sort order. Use 'asc', 'desc', '1', or '-1'.",
    INVALID_SEARCH: "Invalid search value.",
    INVALID_SEARCH_QUERY: "Search term must be a valid string.",
    SEARCH_LENGTH_INVALID: (min: number, max: number) =>
        `Search term length must be between ${min} and ${max} characters.`,

    // ==========================================
    // Params & Route Validation
    // ==========================================
    PARAM_REQUIRED: (paramName: string) => `Route parameter '${paramName}' is required.`,
    INVALID_PARAM: (paramName: string) => `Invalid route parameter '${paramName}'.`,

    // ==========================================
    // File Upload Messages
    // ==========================================
    FILE_REQUIRED: "File is required.",
    INVALID_FILE: "Invalid file.",
    FILE_TOO_LARGE: "Uploaded file exceeds the maximum allowed size.",
    INVALID_FILE_TYPE: "Unsupported file type.",
};