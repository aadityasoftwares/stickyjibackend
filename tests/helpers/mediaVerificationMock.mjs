// Existing lifecycle suites isolate storage/content IO. mediaSecurity.test.mjs exercises the real verifier.
import { MediaContentService } from "../../src/modules/media/services/mediaContent.service.ts";
MediaContentService.prototype.verify = async () => "a".repeat(64);
process.env.MEDIA_CLAMSCAN_PATH = "mocked-by-mediaVerificationMock";
process.env.CLOUDFLARE_R2_PRIVATE_BUCKET_NAME = "test-private";
process.env.CLOUDFLARE_R2_BUCKET_IS_PRIVATE = "false";
