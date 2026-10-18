export class RankUtil {
    public static readonly BASE_CHARACTERS = "0123456789abcdefghijklmnopqrstuvwxyz";
    public static readonly BASE_PAD = 8;
    public static readonly STEP = 36n ** 5n; // 60,466,176n
    public static readonly MIN_RANK = "0".repeat(8);
    public static readonly MAX_RANK = "z".repeat(8);
    public static readonly MAX_RANK_LENGTH = 32;

    public static parseBase36(s: string): bigint {
        const chars = RankUtil.BASE_CHARACTERS;
        let acc = 0n;
        for (let i = 0; i < s.length; i++) {
            const char = s[i].toLowerCase();
            const val = chars.indexOf(char);
            if (val === -1) {
                throw new Error(`Invalid base36 character: "${char}" in rank "${s}".`);
            }
            acc = acc * 36n + BigInt(val);
        }
        return acc;
    }

    public static toBase36(n: bigint, pad = 0): string {
        if (n <= 0n) {
            return "0".padStart(pad, "0");
        }
        const chars = RankUtil.BASE_CHARACTERS;
        let s = "";
        let curr = n;
        while (curr > 0n) {
            const rem = Number(curr % 36n);
            s = chars[rem] + s;
            curr = curr / 36n;
        }
        return s.padStart(pad, "0");
    }

    public static isValidRank(rank: unknown): rank is string {
        if (typeof rank !== "string" || rank.trim().length === 0) {
            return false;
        }
        const trimmed = rank.trim().toLowerCase();
        if (trimmed.length > RankUtil.MAX_RANK_LENGTH) {
            return false;
        }
        for (let i = 0; i < trimmed.length; i++) {
            if (!RankUtil.BASE_CHARACTERS.includes(trimmed[i])) {
                return false;
            }
        }
        return true;
    }

    public static isRankSpaceExhausted(rank: string | null | undefined): boolean {
        if (!rank) {
            return false;
        }
        return rank.length > RankUtil.MAX_RANK_LENGTH;
    }

    public static generateInitialRank(): string {
        return RankUtil.toBase36(RankUtil.STEP, RankUtil.BASE_PAD);
    }

    public static generateRankAfter(rank: string | null | undefined): string | null {
        if (!rank || !RankUtil.isValidRank(rank)) {
            return RankUtil.generateInitialRank();
        }
        const cleaned = rank.trim().toLowerCase();
        const len = Math.max(cleaned.length, RankUtil.BASE_PAD);
        const rPadded = cleaned.padEnd(len, "0");
        const rNum = RankUtil.parseBase36(rPadded);
        const maxNum = RankUtil.parseBase36(RankUtil.MAX_RANK.padEnd(len, "z"));
        const stepAtLen = RankUtil.STEP * (36n ** BigInt(Math.max(0, len - RankUtil.BASE_PAD)));
        if (rNum + stepAtLen < maxNum) {
            return RankUtil.toBase36(rNum + stepAtLen, len);
        }
        return RankUtil.generateRankBetween(cleaned, RankUtil.MAX_RANK.padEnd(len, "z"));
    }

    public static generateRankBefore(rank: string | null | undefined): string | null {
        if (!rank || !RankUtil.isValidRank(rank)) {
            return RankUtil.generateInitialRank();
        }
        const cleaned = rank.trim().toLowerCase();
        const len = Math.max(cleaned.length, RankUtil.BASE_PAD);
        const rPadded = cleaned.padEnd(len, "0");
        const rNum = RankUtil.parseBase36(rPadded);
        const minNum = RankUtil.parseBase36(RankUtil.MIN_RANK.padEnd(len, "0"));
        const stepAtLen = RankUtil.STEP * (36n ** BigInt(Math.max(0, len - RankUtil.BASE_PAD)));
        if (rNum > minNum + stepAtLen) {
            return RankUtil.toBase36(rNum - stepAtLen, len);
        }
        return RankUtil.generateRankBetween(RankUtil.MIN_RANK.padEnd(len, "0"), cleaned);
    }

    public static generateRankBetween(
        beforeRank: string | null | undefined,
        afterRank: string | null | undefined,
    ): string | null {
        const hasBefore = Boolean(beforeRank && RankUtil.isValidRank(beforeRank));
        const hasAfter = Boolean(afterRank && RankUtil.isValidRank(afterRank));

        if (!hasBefore && !hasAfter) {
            return RankUtil.generateInitialRank();
        }
        if (!hasBefore && hasAfter) {
            return RankUtil.generateRankBefore(afterRank!);
        }
        if (hasBefore && !hasAfter) {
            return RankUtil.generateRankAfter(beforeRank!);
        }

        const b = beforeRank!.trim().toLowerCase();
        const a = afterRank!.trim().toLowerCase();

        if (b >= a) {
            return null;
        }

        let len = Math.max(b.length, a.length);
        let pB = b.padEnd(len, "0");
        let pA = a.padEnd(len, "0");
        let nB = RankUtil.parseBase36(pB);
        let nA = RankUtil.parseBase36(pA);

        while (nA - nB <= 1n) {
            len += 1;
            pB = b.padEnd(len, "0");
            pA = a.padEnd(len, "0");
            nB = RankUtil.parseBase36(pB);
            nA = RankUtil.parseBase36(pA);
            if (len > RankUtil.MAX_RANK_LENGTH) {
                return null;
            }
        }

        const mid = (nB + nA) / 2n;
        let res = RankUtil.toBase36(mid, len);
        while (res.length > RankUtil.BASE_PAD && res.endsWith("0")) {
            res = res.slice(0, -1);
        }
        return res;
    }

    public static generateNSequentialRanks(count: number): string[] {
        if (count <= 0) {
            return [];
        }
        const ranks: string[] = [];
        for (let i = 0; i < count; i++) {
            ranks.push(RankUtil.toBase36(BigInt(i + 1) * RankUtil.STEP, RankUtil.BASE_PAD));
        }
        return ranks;
    }
}
