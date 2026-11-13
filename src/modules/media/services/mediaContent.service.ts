import { createHash } from "node:crypto";
import { createWriteStream, createReadStream } from "node:fs";
import { mkdtemp, rm, open } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { MediaSecurity } from "../constants/mediaSecurity.constants.js";
import { AppError } from "../../../utils/errors/app.error.js";
import type { CloudflareR2Service } from "../storage/cloudflareR2.service.js";
import type { IMedia } from "../interfaces/media.interface.js";

/** Streams to bounded temporary disk; never buffers an entire upload in Node memory. */
export class MediaContentService {
    async verify(storage: CloudflareR2Service, media: IMedia): Promise<string> {
        const format = MediaSecurity.format(media.mimeType);
        const directory = await mkdtemp(join(tmpdir(), "stickyji-verify-"));
        const file = join(directory, `upload.${format.extension}`);
        const hash = createHash("sha256");
        let bytes = 0;
        try {
            const body = await storage.readObject(media.storageKey, media.bucket);
            await pipeline(
                body,
                new Transform({
                    transform(chunk: Buffer, _encoding, callback) {
                        bytes += chunk.length;
                        if (bytes > media.size || bytes > MediaSecurity.maxFileBytes()) {
                            callback(new AppError("Uploaded content exceeds its declared size.", 400));
                            return;
                        }
                        hash.update(chunk);
                        callback(null, chunk);
                    },
                }),
                createWriteStream(file, { flags: "wx" }),
            );
            if (bytes !== media.size) throw new AppError("Uploaded content size mismatch.", 400);
            if (media.mimeType.startsWith("image/")) {
                const decoder = sharp(file, { limitInputPixels: 40_000_000, failOn: "warning" });
                const metadata = await decoder.metadata();
                const expected = format.extension === "jpg" ? "jpeg" : format.extension;
                if (metadata.format !== expected || (metadata.pages ?? 1) > 1)
                    throw new AppError("Invalid image content.", 400);
                await decoder.stats(); // Decode pixels, not just attacker-supplied headers.
            } else if (media.mimeType.startsWith("text/")) {
                const decoder = new TextDecoder("utf-8", { fatal: true });
                for await (const chunk of createReadStream(file)) {
                    const text = decoder.decode(chunk, { stream: true });
                    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text))
                        throw new AppError("Invalid text content.", 400);
                }
                decoder.decode();
            } else {
                const handle = await open(file, "r");
                const header = Buffer.alloc(8);
                try {
                    await handle.read(header, 0, 8, 0);
                } finally {
                    await handle.close();
                }
                const valid =
                    format.extension === "pdf"
                        ? header.subarray(0, 5).toString() === "%PDF-"
                        : header.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
                if (!valid) throw new AppError("File contents do not match the declared type.", 400);
                if (format.extension === "docx" || format.extension === "xlsx")
                    await this.verifyOfficePackage(file, bytes, format.extension);
            }
            if (process.env.MEDIA_CLAMSCAN_PATH) {
                // Exit 1 (infected), 2 (scanner failure), timeout and missing binary all fail closed.
                await promisify(execFile)(process.env.MEDIA_CLAMSCAN_PATH, ["--no-summary", "--", file], {
                    timeout: 60_000,
                    windowsHide: true,
                    maxBuffer: 65536,
                });
            }
            return hash.digest("hex");
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError("Content verification failed; the file remains unavailable.", 422);
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    }

    private async verifyOfficePackage(file: string, size: number, extension: string) {
        const handle = await open(file, "r");
        try {
            const tail = Buffer.alloc(Math.min(size, 65557));
            await handle.read(tail, 0, tail.length, size - tail.length);
            const end = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
            if (end < 0 || end + 22 > tail.length) throw new Error("Missing ZIP directory");
            const count = tail.readUInt16LE(end + 10);
            const length = tail.readUInt32LE(end + 12);
            const offset = tail.readUInt32LE(end + 16);
            if (
                count > 10000 ||
                length > 1048576 ||
                offset + length > size ||
                tail.readUInt16LE(end + 4) !== 0
            )
                throw new Error("Unsupported archive");
            const directory = Buffer.alloc(length);
            await handle.read(directory, 0, length, offset);
            const names = new Set<string>();
            let cursor = 0;
            let expanded = 0;
            for (let index = 0; index < count; index++) {
                if (cursor + 46 > length || directory.readUInt32LE(cursor) !== 0x02014b50)
                    throw new Error("Invalid ZIP entry");
                if (directory.readUInt16LE(cursor + 8) & 1)
                    throw new Error("Encrypted archives are unsupported");
                const nameLength = directory.readUInt16LE(cursor + 28);
                const extra = directory.readUInt16LE(cursor + 30);
                const comment = directory.readUInt16LE(cursor + 32);
                if (cursor + 46 + nameLength + extra + comment > length)
                    throw new Error("Invalid ZIP entry bounds");
                const name = directory.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
                if (
                    names.has(name) ||
                    name.includes("..") ||
                    name.includes("\\") ||
                    name.startsWith("/") ||
                    /vbaProject|activeX|embeddings/i.test(name)
                )
                    throw new Error("Unsafe Office package");
                names.add(name);
                expanded += directory.readUInt32LE(cursor + 24);
                if (expanded > 104857600) throw new Error("Archive expands beyond safety limit");
                cursor += 46 + nameLength + extra + comment;
            }
            if (
                !names.has("[Content_Types].xml") ||
                !names.has(extension === "docx" ? "word/document.xml" : "xl/workbook.xml")
            )
                throw new Error("Not an Office package");
        } finally {
            await handle.close();
        }
    }
}
