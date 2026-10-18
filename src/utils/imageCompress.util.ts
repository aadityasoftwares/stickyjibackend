import sharp from "sharp";

export const compressImage = async (file: Express.Multer.File): Promise<Buffer> => {
    try {
        const MAX_WIDTH = 1280;
        const QUALITY = 50;

        const buffer = await sharp(file.buffer)
            .rotate()
            .resize({
                width: MAX_WIDTH,
                withoutEnlargement: true,
            })
            .webp({
                quality: QUALITY,
                effort: 4,
            })
            .toBuffer();

        return buffer;
    } catch (error: any) {
        throw new Error("WebP conversion failed: " + error.message);
    }
};
