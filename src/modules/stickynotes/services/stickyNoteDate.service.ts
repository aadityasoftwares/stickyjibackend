import { Types } from "mongoose";
import { AppError } from "../../../utils/errors/app.error.js";
import { STICKY_NOTE_CONSTANTS } from "../constants/stickyNote.constants.js";
import { StickyNoteDatePreset, StickyNoteDateState } from "../constants/stickyNote.enums.js";
import { StickyNoteMessages } from "../constants/stickyNote.messages.js";
import { StickyNoteValidation } from "../validations/stickyNote.validation.js";
import { StickyNoteRepository } from "../repositories/stickynote.repository.js";
export interface IResolvedStickyNoteDateFilter {
    noteDate?: string;
    noteDateFrom?: string;
    noteDateTo?: string;
    noteDateState?: StickyNoteDateState;
}
interface IDateParts {
    year: number;
    month: number;
    day: number;
}
export class StickyNoteDateService {
    private readonly repository = new StickyNoteRepository();
    async getTodayDateKey(userId: string, now = new Date()): Promise<string> {
        return this.getDateKeyInTimeZone(await this.resolveUserTimeZone(userId), now);
    }
    static getCalendarDaysBetween(from: string, to: string): number {
        if (!StickyNoteValidation.isValidDateKey(from) || !StickyNoteValidation.isValidDateKey(to)) {
            throw new AppError(StickyNoteMessages.INVALID_NOTE_DATE, 400);
        }
        return (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86400000;
    }
    normalizeNullableDateKey(value: unknown): string | null {
        if (value === null || value === undefined || value === "") return null;
        if (!StickyNoteValidation.isValidDateKey(value))
            throw new AppError(StickyNoteMessages.INVALID_NOTE_DATE, 400);
        return value.trim();
    }
    isValidPreset(value: unknown): value is StickyNoteDatePreset {
        return StickyNoteValidation.isValidDatePreset(value);
    }
    async resolveFilter(
        options: {
            noteDate?: string | undefined;
            datePreset?: StickyNoteDatePreset | undefined;
        },
        userId: string,
        now = new Date(),
    ): Promise<IResolvedStickyNoteDateFilter> {
        const { noteDate, datePreset } = options;
        if (noteDate !== undefined && datePreset !== undefined)
            throw new AppError(StickyNoteMessages.DATE_FILTER_CONFLICT, 400);
        if (noteDate !== undefined) {
            const normalizedDate = this.normalizeNullableDateKey(noteDate);
            if (!normalizedDate) throw new AppError(StickyNoteMessages.INVALID_NOTE_DATE, 400);
            return { noteDate: normalizedDate };
        }
        if (datePreset === undefined || datePreset === StickyNoteDatePreset.ALL) return {};
        if (!this.isValidPreset(datePreset)) throw new AppError(StickyNoteMessages.INVALID_DATE_PRESET, 400);
        if (datePreset === StickyNoteDatePreset.UNSCHEDULED)
            return { noteDateState: StickyNoteDateState.UNSCHEDULED };
        if (datePreset === StickyNoteDatePreset.SCHEDULED)
            return { noteDateState: StickyNoteDateState.SCHEDULED };
        const today = this.getDateKeyInTimeZone(await this.resolveUserTimeZone(userId), now);
        switch (datePreset) {
            case StickyNoteDatePreset.TODAY:
                return { noteDate: today };
            case StickyNoteDatePreset.YESTERDAY:
                return { noteDate: this.addDaysToDateKey(today, -1) };
            case StickyNoteDatePreset.TOMORROW:
                return { noteDate: this.addDaysToDateKey(today, 1) };
            case StickyNoteDatePreset.THIS_WEEK: {
                const start = this.getIsoWeekStart(today);
                return {
                    noteDateFrom: start,
                    noteDateTo: this.addDaysToDateKey(start, 6),
                };
            }
            case StickyNoteDatePreset.NEXT_WEEK: {
                const start = this.addDaysToDateKey(this.getIsoWeekStart(today), 7);
                return {
                    noteDateFrom: start,
                    noteDateTo: this.addDaysToDateKey(start, 6),
                };
            }
            case StickyNoteDatePreset.THIS_MONTH:
                return {
                    noteDateFrom: this.getMonthStart(today),
                    noteDateTo: this.getMonthEnd(today),
                };
            case StickyNoteDatePreset.NEXT_7_DAYS:
                return {
                    noteDateFrom: today,
                    noteDateTo: this.addDaysToDateKey(today, 6),
                };
            case StickyNoteDatePreset.PAST:
                return {
                    noteDateTo: this.addDaysToDateKey(today, -1),
                    noteDateState: StickyNoteDateState.SCHEDULED,
                };
            case StickyNoteDatePreset.UPCOMING:
                return {
                    noteDateFrom: this.addDaysToDateKey(today, 1),
                    noteDateState: StickyNoteDateState.SCHEDULED,
                };
            default:
                return {};
        }
    }
    async resolveUserTimeZone(userId: string): Promise<string> {
        if (!Types.ObjectId.isValid(userId)) return STICKY_NOTE_CONSTANTS.TIMEZONE.DEFAULT;
        const preference = await this.repository.findTimeZonePreference(userId);
        const preferred = await this.resolveTimeZoneValue(preference?.value);
        if (preferred) return preferred;
        const fallback = await this.repository.findDefaultTimeZone();
        return this.getValidTimeZoneCode(fallback) ?? STICKY_NOTE_CONSTANTS.TIMEZONE.DEFAULT;
    }
    private async resolveTimeZoneValue(value: unknown): Promise<string | null> {
        const candidate = this.extractTimeZoneCandidate(value);
        if (!candidate) return null;
        if (this.isValidTimeZone(candidate)) return candidate;
        return this.getValidTimeZoneCode(await this.repository.findTimeZone(candidate));
    }
    private getValidTimeZoneCode(
        timezone: { code?: unknown; name?: unknown } | null | undefined,
    ): string | null {
        for (const candidate of [timezone?.code, timezone?.name]) {
            if (typeof candidate === "string" && this.isValidTimeZone(candidate)) return candidate;
        }
        return null;
    }
    private extractTimeZoneCandidate(value: unknown): string | null {
        if (typeof value === "string") return value.trim() || null;
        if (value instanceof Types.ObjectId) return value.toString();
        if (!value || typeof value !== "object") return null;
        const record = value as Record<string, unknown>;
        for (const candidate of [
            record.timezoneId,
            record.timeZoneId,
            record.id,
            record._id,
            record.code,
            record.value,
        ]) {
            if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
            if (candidate instanceof Types.ObjectId) return candidate.toString();
        }
        return null;
    }
    private isValidTimeZone(timeZone: string): boolean {
        try {
            new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
            return true;
        } catch {
            return false;
        }
    }
    private getDateKeyInTimeZone(timeZone: string, now: Date): string {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).formatToParts(now);
        return this.formatDateKey(
            Number(parts.find((part) => part.type === "year")?.value),
            Number(parts.find((part) => part.type === "month")?.value),
            Number(parts.find((part) => part.type === "day")?.value),
        );
    }
    private addDaysToDateKey(dateKey: string, days: number): string {
        const parts = this.parseDateKey(dateKey);
        const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
        return this.formatDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    }
    private getIsoWeekStart(dateKey: string): string {
        const parts = this.parseDateKey(dateKey);
        const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
        return this.addDaysToDateKey(dateKey, -(weekday === 0 ? 6 : weekday - 1));
    }
    private getMonthStart(dateKey: string): string {
        const parts = this.parseDateKey(dateKey);
        return this.formatDateKey(parts.year, parts.month, 1);
    }
    private getMonthEnd(dateKey: string): string {
        const parts = this.parseDateKey(dateKey);
        const date = new Date(Date.UTC(parts.year, parts.month, 0));
        return this.formatDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    }
    private parseDateKey(value: string): IDateParts {
        if (!StickyNoteValidation.isValidDateKey(value))
            throw new AppError(StickyNoteMessages.INVALID_NOTE_DATE, 400);
        return {
            year: Number(value.slice(0, 4)),
            month: Number(value.slice(5, 7)),
            day: Number(value.slice(8, 10)),
        };
    }
    private formatDateKey(year: number, month: number, day: number): string {
        return [
            String(year).padStart(4, "0"),
            String(month).padStart(2, "0"),
            String(day).padStart(2, "0"),
        ].join("-");
    }
}
