import assert from "node:assert/strict";
import { afterEach, test, mock } from "node:test";
import { Types } from "mongoose";
import {
    USER_PREFERENCE_ALLOWED_VALUES,
    USER_PREFERENCE_KEYS,
} from "../src/modules/userpreference/constants/userPreference.constants.ts";
import { UserPreferenceRepository } from "../src/modules/userpreference/repositories/userPreference.repository.ts";
import { UserPreferenceService } from "../src/modules/userpreference/services/userPreference.service.ts";

const userId = new Types.ObjectId().toString();
const statusKey = USER_PREFERENCE_KEYS.WORKSPACE_STATUS_FILTER.toLowerCase();
const accessKey = USER_PREFERENCE_KEYS.WORKSPACE_ACCESS_FILTER.toLowerCase();

function preference(key, value) {
    return { _id: new Types.ObjectId(), key, value };
}

afterEach(() => mock.restoreAll());

test("workspace status and access values are separated", () => {
    assert.deepEqual(USER_PREFERENCE_ALLOWED_VALUES[USER_PREFERENCE_KEYS.WORKSPACE_STATUS_FILTER], [
        "ALL",
        "ACTIVE",
        "ARCHIVED",
        "TRASHED",
    ]);
    assert.deepEqual(USER_PREFERENCE_ALLOWED_VALUES[USER_PREFERENCE_KEYS.WORKSPACE_ACCESS_FILTER], [
        "ALL",
        "OWNED",
        "SHARED",
    ]);
});

test("legacy ownership status migrates to the default access preference", async () => {
    const before = [preference(statusKey, "SHARED"), preference(accessKey, "ALL")];
    const after = [preference(statusKey, "ALL"), preference(accessKey, "SHARED")];
    let reads = 0;
    let updates;

    mock.method(UserPreferenceRepository.prototype, "findAllByUserId", async () =>
        reads++ === 0 ? before : after,
    );
    mock.method(UserPreferenceRepository.prototype, "updatePreferenceValues", async (_userId, values) => {
        updates = values;
    });

    const result = await new UserPreferenceService().getUserPreferences(userId);

    assert.deepEqual(updates, [
        { key: statusKey, value: "ALL" },
        { key: accessKey, value: "SHARED" },
    ]);
    assert.deepEqual(
        result.map(({ key, value }) => ({ key, value })),
        [
            { key: USER_PREFERENCE_KEYS.WORKSPACE_STATUS_FILTER, value: "ALL" },
            { key: USER_PREFERENCE_KEYS.WORKSPACE_ACCESS_FILTER, value: "SHARED" },
        ],
    );
});

test("legacy migration preserves a newer explicit access preference", async () => {
    const before = [preference(statusKey, "SHARED"), preference(accessKey, "OWNED")];
    const after = [preference(statusKey, "ALL"), preference(accessKey, "OWNED")];
    let reads = 0;
    let updates;

    mock.method(UserPreferenceRepository.prototype, "findAllByUserId", async () =>
        reads++ === 0 ? before : after,
    );
    mock.method(UserPreferenceRepository.prototype, "updatePreferenceValues", async (_userId, values) => {
        updates = values;
    });

    await new UserPreferenceService().getUserPreferences(userId);

    assert.deepEqual(updates, [{ key: statusKey, value: "ALL" }]);
});

test("workspace folder preference keys, defaults, aliases and allowed values are configured", async () => {
    const { USER_PREFERENCE_DEFINITIONS } =
        await import("../src/modules/userpreference/constants/userPreference.constants.ts");
    const { UserPreferenceValidation } =
        await import("../src/modules/userpreference/validations/userPreference.validation.ts");

    assert.deepEqual(USER_PREFERENCE_ALLOWED_VALUES[USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_STATUS_FILTER], [
        "ALL",
        "ACTIVE",
        "INACTIVE",
        "ARCHIVED",
        "TRASHED",
        "DELETED",
    ]);
    assert.deepEqual(USER_PREFERENCE_ALLOWED_VALUES[USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_SORT_ORDER], [
        "FOLDER_ORDER",
        "POSITION",
        "RECENTLY_UPDATED",
        "RECENTLY_CREATED",
        "NAME_ASC",
        "NAME_DESC",
        "OLDEST_FIRST",
    ]);
    assert.deepEqual(USER_PREFERENCE_ALLOWED_VALUES[USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_VIEW], [
        "GRID",
        "LIST",
    ]);

    assert.equal(
        USER_PREFERENCE_DEFINITIONS[USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_STATUS_FILTER].defaultValue,
        "ALL",
    );
    assert.equal(
        USER_PREFERENCE_DEFINITIONS[USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_SORT_ORDER].defaultValue,
        "FOLDER_ORDER",
    );
    assert.equal(
        USER_PREFERENCE_DEFINITIONS[USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_VIEW].defaultValue,
        "GRID",
    );

    // Canonical key lookup with case insensitivity and aliases
    assert.equal(
        UserPreferenceValidation.getCanonicalKey("workspaceFolderStatusFilter"),
        USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_STATUS_FILTER,
    );
    assert.equal(
        UserPreferenceValidation.getCanonicalKey("folderStatusFilter"),
        USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_STATUS_FILTER,
    );
    assert.equal(
        UserPreferenceValidation.getCanonicalKey("workspaceFolderSortOrder"),
        USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_SORT_ORDER,
    );
    assert.equal(
        UserPreferenceValidation.getCanonicalKey("folderSortOrder"),
        USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_SORT_ORDER,
    );
    assert.equal(
        UserPreferenceValidation.getCanonicalKey("workspaceFolderView"),
        USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_VIEW,
    );
    assert.equal(
        UserPreferenceValidation.getCanonicalKey("folderView"),
        USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_VIEW,
    );

    // Value normalization to uppercase
    assert.equal(
        UserPreferenceValidation.normalizeValue(
            USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_STATUS_FILTER,
            "active",
        ),
        "ACTIVE",
    );
    assert.equal(
        UserPreferenceValidation.normalizeValue(
            USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_SORT_ORDER,
            "folder_order",
        ),
        "FOLDER_ORDER",
    );
    assert.equal(
        UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_VIEW, "list"),
        "LIST",
    );
});

test("workspace member preference keys, defaults, aliases and allowed values are configured", async () => {
    const { USER_PREFERENCE_DEFINITIONS } =
        await import("../src/modules/userpreference/constants/userPreference.constants.ts");
    const { UserPreferenceValidation } =
        await import("../src/modules/userpreference/validations/userPreference.validation.ts");

    assert.deepEqual(USER_PREFERENCE_ALLOWED_VALUES[USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_STATUS_FILTER], [
        "ALL",
        "ACTIVE",
        "INVITED",
        "INVITATIONS",
        "REMOVED",
    ]);
    assert.deepEqual(USER_PREFERENCE_ALLOWED_VALUES[USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_SORT_ORDER], [
        "RECENTLY_UPDATED",
        "RECENTLY_CREATED",
        "NAME_ASC",
        "NAME_DESC",
        "OLDEST_FIRST",
        "ROLE",
        "ROLE_ASC",
    ]);
    assert.deepEqual(USER_PREFERENCE_ALLOWED_VALUES[USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_VIEW], [
        "GRID",
        "LIST",
    ]);

    assert.equal(
        USER_PREFERENCE_DEFINITIONS[USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_STATUS_FILTER].defaultValue,
        "ALL",
    );
    assert.equal(
        USER_PREFERENCE_DEFINITIONS[USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_SORT_ORDER].defaultValue,
        "RECENTLY_UPDATED",
    );
    assert.equal(
        USER_PREFERENCE_DEFINITIONS[USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_VIEW].defaultValue,
        "LIST",
    );

    // Canonical key lookup with case insensitivity and aliases
    assert.equal(
        UserPreferenceValidation.getCanonicalKey("workspaceMemberStatusFilter"),
        USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_STATUS_FILTER,
    );
    assert.equal(
        UserPreferenceValidation.getCanonicalKey("memberStatusFilter"),
        USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_STATUS_FILTER,
    );
    assert.equal(
        UserPreferenceValidation.getCanonicalKey("workspaceMemberSortOrder"),
        USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_SORT_ORDER,
    );
    assert.equal(
        UserPreferenceValidation.getCanonicalKey("memberSortOrder"),
        USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_SORT_ORDER,
    );
    assert.equal(
        UserPreferenceValidation.getCanonicalKey("workspaceMemberView"),
        USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_VIEW,
    );
    assert.equal(
        UserPreferenceValidation.getCanonicalKey("memberView"),
        USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_VIEW,
    );

    // Value normalization to uppercase
    assert.equal(
        UserPreferenceValidation.normalizeValue(
            USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_STATUS_FILTER,
            "active",
        ),
        "ACTIVE",
    );
    assert.equal(
        UserPreferenceValidation.normalizeValue(
            USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_STATUS_FILTER,
            "invitations",
        ),
        "INVITATIONS",
    );
    assert.equal(
        UserPreferenceValidation.normalizeValue(
            USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_SORT_ORDER,
            "recently_updated",
        ),
        "RECENTLY_UPDATED",
    );
    assert.equal(
        UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_VIEW, "grid"),
        "GRID",
    );
    assert.equal(
        UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_VIEW, "list"),
        "LIST",
    );
});

test("workspace role preference keys, defaults, aliases and allowed values are configured", async () => {
    const { USER_PREFERENCE_DEFINITIONS } =
        await import("../src/modules/userpreference/constants/userPreference.constants.ts");
    const { UserPreferenceValidation } =
        await import("../src/modules/userpreference/validations/userPreference.validation.ts");

    assert.deepEqual(USER_PREFERENCE_ALLOWED_VALUES[USER_PREFERENCE_KEYS.WORKSPACE_ROLE_STATUS_FILTER], [
        "ALL",
        "SYSTEM",
        "CUSTOM",
        "INACTIVE",
    ]);
    assert.deepEqual(USER_PREFERENCE_ALLOWED_VALUES[USER_PREFERENCE_KEYS.WORKSPACE_ROLE_SORT_ORDER], [
        "PRIORITY",
        "ROLE_LEVEL",
        "RECENTLY_UPDATED",
        "UPDATED_AT",
        "NAME_ASC",
        "NAME",
        "RECENTLY_CREATED",
        "CREATED_AT",
        "NAME_DESC",
        "OLDEST_FIRST",
    ]);
    assert.deepEqual(USER_PREFERENCE_ALLOWED_VALUES[USER_PREFERENCE_KEYS.WORKSPACE_ROLE_VIEW], [
        "GRID",
        "LIST",
    ]);

    assert.equal(
        USER_PREFERENCE_DEFINITIONS[USER_PREFERENCE_KEYS.WORKSPACE_ROLE_STATUS_FILTER].defaultValue,
        "ALL",
    );
    assert.equal(
        USER_PREFERENCE_DEFINITIONS[USER_PREFERENCE_KEYS.WORKSPACE_ROLE_SORT_ORDER].defaultValue,
        "PRIORITY",
    );
    assert.equal(USER_PREFERENCE_DEFINITIONS[USER_PREFERENCE_KEYS.WORKSPACE_ROLE_VIEW].defaultValue, "GRID");

    // Canonical key lookup with case insensitivity and aliases
    assert.equal(
        UserPreferenceValidation.getCanonicalKey("workspaceRoleStatusFilter"),
        USER_PREFERENCE_KEYS.WORKSPACE_ROLE_STATUS_FILTER,
    );
    assert.equal(
        UserPreferenceValidation.getCanonicalKey("roleStatusFilter"),
        USER_PREFERENCE_KEYS.WORKSPACE_ROLE_STATUS_FILTER,
    );
    assert.equal(
        UserPreferenceValidation.getCanonicalKey("workspaceRoleSortOrder"),
        USER_PREFERENCE_KEYS.WORKSPACE_ROLE_SORT_ORDER,
    );
    assert.equal(
        UserPreferenceValidation.getCanonicalKey("roleSortOrder"),
        USER_PREFERENCE_KEYS.WORKSPACE_ROLE_SORT_ORDER,
    );
    assert.equal(
        UserPreferenceValidation.getCanonicalKey("workspaceRoleView"),
        USER_PREFERENCE_KEYS.WORKSPACE_ROLE_VIEW,
    );
    assert.equal(
        UserPreferenceValidation.getCanonicalKey("roleView"),
        USER_PREFERENCE_KEYS.WORKSPACE_ROLE_VIEW,
    );

    // Value normalization to uppercase
    assert.equal(
        UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.WORKSPACE_ROLE_STATUS_FILTER, "system"),
        "SYSTEM",
    );
    assert.equal(
        UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.WORKSPACE_ROLE_STATUS_FILTER, "custom"),
        "CUSTOM",
    );
    assert.equal(
        UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.WORKSPACE_ROLE_SORT_ORDER, "priority"),
        "PRIORITY",
    );
    assert.equal(
        UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.WORKSPACE_ROLE_VIEW, "list"),
        "LIST",
    );
});

test("today view and sticky note view preference keys, defaults, aliases, allowed values, and normalization are configured", async () => {
    const { USER_PREFERENCE_DEFINITIONS } =
        await import("../src/modules/userpreference/constants/userPreference.constants.ts");
    const { UserPreferenceValidation } =
        await import("../src/modules/userpreference/validations/userPreference.validation.ts");

    // Allowed values
    const expectedViews = ["NOTES", "KANBAN", "TABLE", "GRID"];
    assert.deepEqual(USER_PREFERENCE_ALLOWED_VALUES[USER_PREFERENCE_KEYS.TODAY_VIEW], expectedViews);
    assert.deepEqual(USER_PREFERENCE_ALLOWED_VALUES[USER_PREFERENCE_KEYS.STICKY_NOTE_VIEW], expectedViews);

    // Default values
    assert.equal(USER_PREFERENCE_DEFINITIONS[USER_PREFERENCE_KEYS.TODAY_VIEW].defaultValue, "KANBAN");
    assert.equal(USER_PREFERENCE_DEFINITIONS[USER_PREFERENCE_KEYS.STICKY_NOTE_VIEW].defaultValue, "KANBAN");

    // Key validation
    assert.equal(UserPreferenceValidation.isValidKey("todayView"), true);
    assert.equal(UserPreferenceValidation.isValidKey("todayview"), true);
    assert.equal(UserPreferenceValidation.isValidKey("today_view"), true);
    assert.equal(UserPreferenceValidation.isValidKey("todaystickynoteview"), true);
    assert.equal(UserPreferenceValidation.isValidKey("todaynoteview"), true);
    assert.equal(UserPreferenceValidation.isValidKey("stickyNoteView"), true);
    assert.equal(UserPreferenceValidation.isValidKey("stickynoteview"), true);
    assert.equal(UserPreferenceValidation.isValidKey("sticky_note_view"), true);

    // Canonical keys
    assert.equal(UserPreferenceValidation.getCanonicalKey("todayView"), USER_PREFERENCE_KEYS.TODAY_VIEW);
    assert.equal(UserPreferenceValidation.getCanonicalKey("todayview"), USER_PREFERENCE_KEYS.TODAY_VIEW);
    assert.equal(UserPreferenceValidation.getCanonicalKey("today_view"), USER_PREFERENCE_KEYS.TODAY_VIEW);
    assert.equal(
        UserPreferenceValidation.getCanonicalKey("todaystickynoteview"),
        USER_PREFERENCE_KEYS.TODAY_VIEW,
    );
    assert.equal(UserPreferenceValidation.getCanonicalKey("todaynoteview"), USER_PREFERENCE_KEYS.TODAY_VIEW);
    assert.equal(
        UserPreferenceValidation.getCanonicalKey("stickynoteview"),
        USER_PREFERENCE_KEYS.STICKY_NOTE_VIEW,
    );
    assert.equal(
        UserPreferenceValidation.getCanonicalKey("sticky_note_view"),
        USER_PREFERENCE_KEYS.STICKY_NOTE_VIEW,
    );

    // Value normalization to uppercase
    assert.equal(UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.TODAY_VIEW, "notes"), "NOTES");
    assert.equal(
        UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.TODAY_VIEW, "kanban"),
        "KANBAN",
    );
    assert.equal(UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.TODAY_VIEW, "table"), "TABLE");
    assert.equal(UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.TODAY_VIEW, "grid"), "GRID");
    assert.equal(
        UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.STICKY_NOTE_VIEW, "notes"),
        "NOTES",
    );
    assert.equal(
        UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.STICKY_NOTE_VIEW, "kanban"),
        "KANBAN",
    );
    assert.equal(
        UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.STICKY_NOTE_VIEW, "table"),
        "TABLE",
    );
    assert.equal(
        UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.STICKY_NOTE_VIEW, "grid"),
        "GRID",
    );

    // Domain validation
    assert.equal(
        UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.TODAY_VIEW, "NOTES"),
        null,
    );
    assert.equal(
        UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.TODAY_VIEW, "KANBAN"),
        null,
    );
    assert.equal(
        UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.TODAY_VIEW, "TABLE"),
        null,
    );
    assert.equal(UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.TODAY_VIEW, "GRID"), null);
    assert.notEqual(
        UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.TODAY_VIEW, "INVALID_VIEW"),
        null,
    );
});

test("overdue view preference keys, defaults, aliases, allowed values, and normalization are configured", async () => {
    const { USER_PREFERENCE_DEFINITIONS } =
        await import("../src/modules/userpreference/constants/userPreference.constants.ts");
    const { UserPreferenceValidation } =
        await import("../src/modules/userpreference/validations/userPreference.validation.ts");

    // Allowed values
    assert.deepEqual(USER_PREFERENCE_ALLOWED_VALUES[USER_PREFERENCE_KEYS.OVERDUE_VIEW], ["BAR", "BUTTON"]);

    // Default value
    assert.equal(USER_PREFERENCE_DEFINITIONS[USER_PREFERENCE_KEYS.OVERDUE_VIEW].defaultValue, "BAR");

    // Key validation
    assert.equal(UserPreferenceValidation.isValidKey("overdueView"), true);
    assert.equal(UserPreferenceValidation.isValidKey("overdueview"), true);
    assert.equal(UserPreferenceValidation.isValidKey("overdue_view"), true);
    assert.equal(UserPreferenceValidation.isValidKey("todayoverdueview"), true);

    // Canonical keys
    assert.equal(UserPreferenceValidation.getCanonicalKey("overdueView"), USER_PREFERENCE_KEYS.OVERDUE_VIEW);
    assert.equal(UserPreferenceValidation.getCanonicalKey("overdueview"), USER_PREFERENCE_KEYS.OVERDUE_VIEW);
    assert.equal(UserPreferenceValidation.getCanonicalKey("overdue_view"), USER_PREFERENCE_KEYS.OVERDUE_VIEW);
    assert.equal(
        UserPreferenceValidation.getCanonicalKey("todayoverdueview"),
        USER_PREFERENCE_KEYS.OVERDUE_VIEW,
    );

    // Value normalization to uppercase
    assert.equal(UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.OVERDUE_VIEW, "bar"), "BAR");
    assert.equal(
        UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.OVERDUE_VIEW, "button"),
        "BUTTON",
    );

    // Domain validation
    assert.equal(
        UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.OVERDUE_VIEW, "BAR"),
        null,
    );
    assert.equal(
        UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.OVERDUE_VIEW, "BUTTON"),
        null,
    );
    assert.notEqual(
        UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.OVERDUE_VIEW, "INVALID"),
        null,
    );
});

test("note selection preferences (color, shape, variant, pattern) keys, defaults, aliases, allowed values, and normalization are configured", async () => {
    const { USER_PREFERENCE_DEFINITIONS } =
        await import("../src/modules/userpreference/constants/userPreference.constants.ts");
    const { UserPreferenceValidation } =
        await import("../src/modules/userpreference/validations/userPreference.validation.ts");

    // Allowed values
    assert.deepEqual(USER_PREFERENCE_ALLOWED_VALUES[USER_PREFERENCE_KEYS.DEFAULT_NOTE_COLOR], [
        "WHITE", "YELLOW", "ORANGE", "PINK", "RED", "GREEN", "BLUE", "PURPLE", "BROWN", "BLACK",
    ]);
    assert.deepEqual(USER_PREFERENCE_ALLOWED_VALUES[USER_PREFERENCE_KEYS.DEFAULT_NOTE_SHAPE], [
        "SQUARE", "RECTANGLE", "PORTRAIT", "LANDSCAPE", "STRIP",
    ]);
    assert.deepEqual(USER_PREFERENCE_ALLOWED_VALUES[USER_PREFERENCE_KEYS.DEFAULT_NOTE_VARIANT], [
        "PLAIN", "ROUNDED", "SOFT", "FOLDED", "CUT_CORNER", "TICKET",
    ]);
    assert.deepEqual(USER_PREFERENCE_ALLOWED_VALUES[USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN], [
        "NONE", "HORIZONTAL_LINES", "VERTICAL_LINES", "GRID",
    ]);

    // Defaults
    assert.equal(USER_PREFERENCE_DEFINITIONS[USER_PREFERENCE_KEYS.DEFAULT_NOTE_COLOR].defaultValue, "YELLOW");
    assert.equal(USER_PREFERENCE_DEFINITIONS[USER_PREFERENCE_KEYS.DEFAULT_NOTE_SHAPE].defaultValue, "SQUARE");
    assert.equal(USER_PREFERENCE_DEFINITIONS[USER_PREFERENCE_KEYS.DEFAULT_NOTE_VARIANT].defaultValue, "PLAIN");
    assert.equal(USER_PREFERENCE_DEFINITIONS[USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN].defaultValue, "NONE");

    // Key validity and aliases
    assert.equal(UserPreferenceValidation.isValidKey("defaultNoteColor"), true);
    assert.equal(UserPreferenceValidation.isValidKey("noteColor"), true);
    assert.equal(UserPreferenceValidation.isValidKey("stickyNoteColor"), true);
    assert.equal(UserPreferenceValidation.getCanonicalKey("noteColor"), USER_PREFERENCE_KEYS.DEFAULT_NOTE_COLOR);

    assert.equal(UserPreferenceValidation.isValidKey("defaultNoteShape"), true);
    assert.equal(UserPreferenceValidation.isValidKey("noteShape"), true);
    assert.equal(UserPreferenceValidation.isValidKey("shape"), true);
    assert.equal(UserPreferenceValidation.getCanonicalKey("shape"), USER_PREFERENCE_KEYS.DEFAULT_NOTE_SHAPE);

    assert.equal(UserPreferenceValidation.isValidKey("defaultNoteVariant"), true);
    assert.equal(UserPreferenceValidation.isValidKey("paperVariant"), true);
    assert.equal(UserPreferenceValidation.isValidKey("variant"), true);
    assert.equal(UserPreferenceValidation.getCanonicalKey("paperVariant"), USER_PREFERENCE_KEYS.DEFAULT_NOTE_VARIANT);

    assert.equal(UserPreferenceValidation.isValidKey("defaultNoteBackgroundPattern"), true);
    assert.equal(UserPreferenceValidation.isValidKey("paperPattern"), true);
    assert.equal(UserPreferenceValidation.isValidKey("pattern"), true);
    assert.equal(UserPreferenceValidation.getCanonicalKey("paperPattern"), USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN);

    // Normalization
    assert.equal(UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.DEFAULT_NOTE_COLOR, "yellow"), "YELLOW");
    assert.equal(UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.DEFAULT_NOTE_SHAPE, "strip"), "STRIP");
    assert.equal(UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.DEFAULT_NOTE_VARIANT, "cut corner"), "CUT_CORNER");
    assert.equal(UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.DEFAULT_NOTE_VARIANT, "cut-corner"), "CUT_CORNER");
    assert.equal(UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN, "horizontal lines"), "HORIZONTAL_LINES");
    assert.equal(UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN, "grid"), "GRID");

    // Domain validation
    assert.equal(UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.DEFAULT_NOTE_COLOR, "PINK"), null);
    assert.notEqual(UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.DEFAULT_NOTE_COLOR, "CYAN"), null);

    assert.equal(UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.DEFAULT_NOTE_SHAPE, "PORTRAIT"), null);
    assert.notEqual(UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.DEFAULT_NOTE_SHAPE, "HEXAGON"), null);

    assert.equal(UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.DEFAULT_NOTE_VARIANT, "TICKET"), null);
    assert.notEqual(UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.DEFAULT_NOTE_VARIANT, "CIRCULAR"), null);

    assert.equal(UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN, "GRID"), null);
    assert.notEqual(UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN, "DOTS"), null);
});

test("favourite view, status filter, and sort order preference keys, defaults, aliases, and allowed values are configured", async () => {
    const { USER_PREFERENCE_KEYS, USER_PREFERENCE_DEFINITIONS, USER_PREFERENCE_ALLOWED_VALUES } =
        await import("../src/modules/userpreference/constants/userPreference.constants.ts");
    const { UserPreferenceValidation } =
        await import("../src/modules/userpreference/validations/userPreference.validation.ts");

    // Keys exist
    assert.equal(USER_PREFERENCE_KEYS.FAVOURITE_VIEW, "favouriteView");
    assert.equal(USER_PREFERENCE_KEYS.FAVOURITE_STATUS_FILTER, "favouriteStatusFilter");
    assert.equal(USER_PREFERENCE_KEYS.FAVOURITE_SORT_ORDER, "favouriteSortOrder");

    // US-spelling aliases match canonical keys
    assert.equal(USER_PREFERENCE_KEYS.FAVORITE_VIEW, USER_PREFERENCE_KEYS.FAVOURITE_VIEW);
    assert.equal(USER_PREFERENCE_KEYS.FAVORITE_STATUS_FILTER, USER_PREFERENCE_KEYS.FAVOURITE_STATUS_FILTER);
    assert.equal(USER_PREFERENCE_KEYS.FAVORITE_SORT_ORDER, USER_PREFERENCE_KEYS.FAVOURITE_SORT_ORDER);

    // Definitions and defaults
    assert.equal(USER_PREFERENCE_DEFINITIONS[USER_PREFERENCE_KEYS.FAVOURITE_VIEW].defaultValue, "GRID");
    assert.equal(USER_PREFERENCE_DEFINITIONS[USER_PREFERENCE_KEYS.FAVOURITE_STATUS_FILTER].defaultValue, "ALL");
    assert.equal(USER_PREFERENCE_DEFINITIONS[USER_PREFERENCE_KEYS.FAVOURITE_SORT_ORDER].defaultValue, "TITLE_ASC");

    // Allowed values
    assert.ok(USER_PREFERENCE_ALLOWED_VALUES[USER_PREFERENCE_KEYS.FAVOURITE_VIEW].includes("GRID"));
    assert.ok(USER_PREFERENCE_ALLOWED_VALUES[USER_PREFERENCE_KEYS.FAVOURITE_VIEW].includes("LIST"));
    assert.deepEqual(USER_PREFERENCE_ALLOWED_VALUES[USER_PREFERENCE_KEYS.FAVOURITE_STATUS_FILTER], [
        "ALL",
        "ACTIVE",
        "ARCHIVED",
        "TRASHED",
        "DELETED",
    ]);

    // Key validation & aliases
    assert.equal(UserPreferenceValidation.isValidKey("favouriteView"), true);
    assert.equal(UserPreferenceValidation.isValidKey("favourite_view"), true);
    assert.equal(UserPreferenceValidation.isValidKey("favoriteView"), true);
    assert.equal(UserPreferenceValidation.isValidKey("favorite_view"), true);
    assert.equal(UserPreferenceValidation.isValidKey("favouritestatusfilter"), true);
    assert.equal(UserPreferenceValidation.isValidKey("favorite_status_filter"), true);
    assert.equal(UserPreferenceValidation.isValidKey("favouritesortorder"), true);
    assert.equal(UserPreferenceValidation.isValidKey("favorite_sort_order"), true);

    // Canonical key mapping
    assert.equal(UserPreferenceValidation.getCanonicalKey("favouriteView"), USER_PREFERENCE_KEYS.FAVOURITE_VIEW);
    assert.equal(UserPreferenceValidation.getCanonicalKey("favoriteView"), USER_PREFERENCE_KEYS.FAVOURITE_VIEW);
    assert.equal(UserPreferenceValidation.getCanonicalKey("favourite_view"), USER_PREFERENCE_KEYS.FAVOURITE_VIEW);
    assert.equal(UserPreferenceValidation.getCanonicalKey("favorite_view"), USER_PREFERENCE_KEYS.FAVOURITE_VIEW);
    assert.equal(UserPreferenceValidation.getCanonicalKey("favouriteStatusFilter"), USER_PREFERENCE_KEYS.FAVOURITE_STATUS_FILTER);
    assert.equal(UserPreferenceValidation.getCanonicalKey("favoriteStatusFilter"), USER_PREFERENCE_KEYS.FAVOURITE_STATUS_FILTER);
    assert.equal(UserPreferenceValidation.getCanonicalKey("favouriteSortOrder"), USER_PREFERENCE_KEYS.FAVOURITE_SORT_ORDER);
    assert.equal(UserPreferenceValidation.getCanonicalKey("favoriteSortOrder"), USER_PREFERENCE_KEYS.FAVOURITE_SORT_ORDER);

    // Normalization
    assert.equal(UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.FAVOURITE_VIEW, "grid"), "GRID");
    assert.equal(UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.FAVOURITE_VIEW, "list"), "LIST");
    assert.equal(UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.FAVOURITE_STATUS_FILTER, "archived"), "ARCHIVED");
    assert.equal(UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.FAVOURITE_SORT_ORDER, "title a-z"), "TITLE_ASC");
    assert.equal(UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.FAVOURITE_SORT_ORDER, "title z-a"), "TITLE_DESC");
    assert.equal(UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.FAVOURITE_SORT_ORDER, "recently_updated"), "RECENTLY_UPDATED");

    // Domain validation
    assert.equal(UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.FAVOURITE_VIEW, "GRID"), null);
    assert.equal(UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.FAVOURITE_VIEW, "LIST"), null);
    assert.notEqual(UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.FAVOURITE_VIEW, "INVALID"), null);

    assert.equal(UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.FAVOURITE_STATUS_FILTER, "ACTIVE"), null);
    assert.notEqual(UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.FAVOURITE_STATUS_FILTER, "INVALID"), null);

    assert.equal(UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.FAVOURITE_SORT_ORDER, "TITLE_ASC"), null);
    assert.notEqual(UserPreferenceValidation.validateDomainValue(USER_PREFERENCE_KEYS.FAVOURITE_SORT_ORDER, "INVALID"), null);
});

test("sidebar collapsed preference key, defaults, aliases, and boolean normalization are configured", async () => {
    const { USER_PREFERENCE_KEYS, USER_PREFERENCE_DEFINITIONS } =
        await import("../src/modules/userpreference/constants/userPreference.constants.ts");
    const { UserPreferenceValidation } =
        await import("../src/modules/userpreference/validations/userPreference.validation.ts");
    const { UserPreferenceCategory, UserPreferenceValueType } =
        await import("../src/modules/userpreference/constants/userPreference.enums.js");

    // Key exists
    assert.equal(USER_PREFERENCE_KEYS.SIDEBAR_COLLAPSED, "sidebarCollapsed");

    // Definition and defaults
    const def = USER_PREFERENCE_DEFINITIONS[USER_PREFERENCE_KEYS.SIDEBAR_COLLAPSED];
    assert.ok(def);
    assert.equal(def.category, UserPreferenceCategory.APPEARANCE);
    assert.equal(def.type, UserPreferenceValueType.BOOLEAN);
    assert.equal(def.defaultValue, false);

    // Key validation & aliases
    assert.equal(UserPreferenceValidation.isValidKey("sidebarCollapsed"), true);
    assert.equal(UserPreferenceValidation.isValidKey("sidebar_collapsed"), true);
    assert.equal(UserPreferenceValidation.isValidKey("sidebarcollapsed"), true);
    assert.equal(UserPreferenceValidation.isValidKey("sidebarcollapsd"), true);
    assert.equal(UserPreferenceValidation.isValidKey("isSidebarCollapsed"), true);
    assert.equal(UserPreferenceValidation.isValidKey("sidebarCollapse"), true);

    // Canonical key mapping
    assert.equal(UserPreferenceValidation.getCanonicalKey("sidebarCollapsed"), USER_PREFERENCE_KEYS.SIDEBAR_COLLAPSED);
    assert.equal(UserPreferenceValidation.getCanonicalKey("sidebar_collapsed"), USER_PREFERENCE_KEYS.SIDEBAR_COLLAPSED);
    assert.equal(UserPreferenceValidation.getCanonicalKey("sidebarcollapsd"), USER_PREFERENCE_KEYS.SIDEBAR_COLLAPSED);
    assert.equal(UserPreferenceValidation.getCanonicalKey("issidebarcollapsed"), USER_PREFERENCE_KEYS.SIDEBAR_COLLAPSED);
    assert.equal(UserPreferenceValidation.getCanonicalKey("sidebarcollapse"), USER_PREFERENCE_KEYS.SIDEBAR_COLLAPSED);

    // Type validation
    assert.equal(UserPreferenceValidation.isValidValue(true, UserPreferenceValueType.BOOLEAN), true);
    assert.equal(UserPreferenceValidation.isValidValue(false, UserPreferenceValueType.BOOLEAN), true);
    assert.equal(UserPreferenceValidation.isValidValue("true", UserPreferenceValueType.BOOLEAN), true);
    assert.equal(UserPreferenceValidation.isValidValue("false", UserPreferenceValueType.BOOLEAN), true);
    assert.equal(UserPreferenceValidation.isValidValue("invalid", UserPreferenceValueType.BOOLEAN), false);

    // Normalization
    assert.equal(UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.SIDEBAR_COLLAPSED, true), true);
    assert.equal(UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.SIDEBAR_COLLAPSED, false), false);
    assert.equal(UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.SIDEBAR_COLLAPSED, "true"), true);
    assert.equal(UserPreferenceValidation.normalizeValue(USER_PREFERENCE_KEYS.SIDEBAR_COLLAPSED, "false"), false);
});



