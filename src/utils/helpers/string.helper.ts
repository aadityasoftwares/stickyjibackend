export class StringHelper {
    static normalize(value: string): string {
        return value.trim();
    }

    static normalizeUpper(value: string): string {
        return value.trim().toUpperCase();
    }

    static normalizeLower(value: string): string {
        return value.trim().toLowerCase();
    }

    static normalizeOptional(value?: string): string | undefined {
        return value?.trim();
    }

    static normalizeUpperOptional(value?: string): string | undefined {
        return value?.trim().toUpperCase();
    }

    static normalizeLowerOptional(value?: string): string | undefined {
        return value?.trim().toLowerCase();
    }

    static isEmpty(value?: string | null): boolean {
        return !value || value.trim().length === 0;
    }

    static isNotEmpty(value?: string | null): boolean {
        return !!value && value.trim().length > 0;
    }

    static emptyToUndefined(value?: string | null): string | undefined {
        if (!value) {
            return undefined;
        }

        const normalized = value.trim();

        return normalized.length > 0 ? normalized : undefined;
    }

    static emptyToNull(value?: string | null): string | null {
        if (!value) {
            return null;
        }

        const normalized = value.trim();

        return normalized.length > 0 ? normalized : null;
    }

    static slugify(value: string): string {
        return value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
    }

    static titleCase(value: string): string {
        return value
            .trim()
            .toLowerCase()
            .replace(/\b\w/g, (character) => character.toUpperCase());
    }

    static camelCase(value: string): string {
        return value
            .trim()
            .toLowerCase()
            .replace(/[-_\s]+(.)?/g, (_, character: string) => (character ? character.toUpperCase() : ""));
    }

    static pascalCase(value: string): string {
        const camel = this.camelCase(value);

        return camel.length > 0 ? camel.charAt(0).toUpperCase() + camel.slice(1) : camel;
    }

    static removeWhitespace(value: string): string {
        return value.replace(/\s+/g, "");
    }

    static normalizeWhitespace(value: string): string {
        return value.trim().replace(/\s+/g, " ");
    }

    static removeSpecialCharacters(value: string): string {
        return value.replace(/[^a-zA-Z0-9\s]/g, "");
    }

    static numbersOnly(value: string): string {
        return value.replace(/\D/g, "");
    }

    static lettersOnly(value: string): string {
        return value.replace(/[^a-zA-Z]/g, "");
    }

    static normalizeEmail(value: string): string {
        return value.trim().toLowerCase();
    }

    static normalizeEmailOptional(value?: string): string | undefined {
        return value?.trim().toLowerCase();
    }

    static normalizeCountryCode(value: string): string {
        return value.trim().toUpperCase();
    }

    static normalizeCurrencyCode(value: string): string {
        return value.trim().toUpperCase();
    }

    static normalizeLanguageCode(value: string): string {
        return value.trim().toLowerCase();
    }

    static normalizeLocale(value: string): string {
        return value.trim();
    }

    static normalizeDialCode(value: string): string {
        return value.trim();
    }

    static truncate(value: string, maxLength: number): string {
        if (value.length <= maxLength) {
            return value;
        }

        return value.substring(0, maxLength);
    }

    static firstCharacter(value: string): string {
        return value.charAt(0);
    }

    static lastCharacter(value: string): string {
        return value.charAt(value.length - 1);
    }

    static startsWith(value: string, search: string): boolean {
        return value.startsWith(search);
    }

    static endsWith(value: string, search: string): boolean {
        return value.endsWith(search);
    }

    static contains(value: string, search: string): boolean {
        return value.includes(search);
    }

    static mask(value: string, visibleCharacters = 4, maskCharacter = "*"): string {
        if (value.length <= visibleCharacters) {
            return value;
        }

        const maskedLength = value.length - visibleCharacters;

        return maskCharacter.repeat(maskedLength) + value.slice(-visibleCharacters);
    }

    static equalsIgnoreCase(first?: string | null, second?: string | null): boolean {
        if (first === null || first === undefined || second === null || second === undefined) {
            return first === second;
        }

        return first.trim().toLowerCase() === second.trim().toLowerCase();
    }

    static toString(value?: unknown): string {
        if (value === undefined || value === null) {
            return "";
        }

        return String(value);
    }
}
