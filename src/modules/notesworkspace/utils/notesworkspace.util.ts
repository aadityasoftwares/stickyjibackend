import mongoose, { Types } from "mongoose";
import type { NotesWorkspaceVisibility, } from "../interfaces/notesworkspace.interface.js";

export class NotesWorkspaceUtil {
    static allowedVisibilities: NotesWorkspaceVisibility[] = [
        "private",
        "team",
        "public",
    ];

    static isValidObjectId(id: string) {
        return mongoose.Types.ObjectId.isValid(id);
    }

    static isValidVisibility(visibility: string): visibility is NotesWorkspaceVisibility {
        return this.allowedVisibilities.includes(
            visibility as NotesWorkspaceVisibility
        );
    }

    static normalizeMembers(members: unknown): Types.ObjectId[] {
        if (!Array.isArray(members)) {
            return [];
        }

        return members
            .filter((member): member is string => typeof member === "string")
            .map((member) => member.trim())
            .filter((member) => mongoose.Types.ObjectId.isValid(member))
            .filter((member, index, array) => array.indexOf(member) === index)
            .map((member) => new mongoose.Types.ObjectId(member));
    }

    static normalizeTitle(title: unknown): string {
        if (typeof title !== "string") {
            return "";
        }

        return title.trim();
    }

    static normalizeDescription(description: unknown): string {
        if (typeof description !== "string") {
            return "";
        }

        return description.trim();
    }

    static normalizeBackgroundColor(color: unknown): string {
        if (
            typeof color !== "string" ||
            !color.trim()
        ) {
            return "#F8F9FA";
        }

        return color.trim();
    }

    static normalizeBackgroundImageUrl(url: unknown): string {
        if (typeof url !== "string") {
            return "";
        }

        return url.trim();
    }

    static escapeRegex(value: string) {
        return value.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );
    }

    static createSearchRegex(value: string) {
        return new RegExp(this.escapeRegex(value.trim()), "i");
    }
}