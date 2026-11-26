import { randomUUID } from "crypto";
import { join } from "path";
import { promises as fs } from "fs";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mediaAssets, moderationLogs, users, videos } from "@/db/schema";
import { getCurrentUserId, getVideoById } from "@/lib/data";
import { extractVideoCover, runModeration } from "@/server/moderation";
import {
  ensureModerationSchedulerStarted,
  scheduleFastRecheck,
} from "@/server/moderation/scheduler";
import { removeStoredMedia, storageProvider, storeMedia, type StoredMedia } from "@/server/media";
import { syncVideoById, syncModerationLogById } from "@/server/supabase-sync";

export const dynamic = "force-dynamic";

const WORK_DIR = join(process.cwd(), "public", "uploads");

/** Remux uploads to H.264 + faststart for instant start and smooth playback (best-effort). */
async function remuxForStreaming(rawPath: string, outPath: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpeg = require("ffmpeg-static") as string | null;
    if (!ffmpeg) return false;
    const { execFile } = await import("node:child_process");
    await new Promise<void>((resolve, reject) => {
      execFile(
        ffmpeg,
        [
          "-y",
          "-i", rawPath,
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-crf", "20",
          "-pix_fmt", "yuv420p",
          "-movflags", "+faststart",
          "-an",
          outPath,
        ],
        { timeout: 180_000, maxBuffer: 8 * 1024 * 1024 },
        (err) => (err ? reject(err) : resolve())
      );
    });
    const stat = await fs.stat(outPath);
    return stat.size > 0;
  } catch {
    return false;
  }
}

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|avif|gif)$/i.test(file.name);
}

function isVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  return /\.(mp4|webm|mov|m4v)$/i.test(file.name);
}

export async function POST(req: Request) {
  ensureModerationSchedulerStarted();

  const viewerId = await getCurrentUserId();
  const [viewerRow] = await db
    .select({ handle: users.handle })
    .from(users)
    .where(eq(users.id, viewerId))
    .limit(1);
  const viewerHandle = viewerRow?.handle ?? "unknown";

  const contentType = req.headers.get("content-type") ?? "";
  let videoUrl = "";
  let coverUrl: string | null = null;
  let mediaUrlsJson: string | null = null;
  let videoMediaId: string | null = null;
  let coverMediaId: string | null = null;
  let caption = "";
  let musicName = "original sound";
  const stored: StoredMedia[] = [];
  const tempPaths: string[] = [];
  let tempVideoForMod: string | null = null;
  const tempImagesForMod: string[] = [];
  const remoteImagesForMod: string[] = [];

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      caption = String(form.get("caption") ?? "").slice(0, 300);
      musicName = String(form.get("musicName") ?? "").slice(0, 120) || "original sound";

      const uploadedFiles: File[] = [];
      for (const entry of form.getAll("files")) {
        if (entry instanceof File && entry.size > 0) uploadedFiles.push(entry);
      }
      const singleFile = form.get("file");
      if (singleFile instanceof File && singleFile.size > 0 && uploadedFiles.length === 0) {
        uploadedFiles.push(singleFile);
      }
      if (uploadedFiles.length === 0) {
        return Response.json({ error: "Please select a photo or video to post" }, { status: 400 });
      }

      await fs.mkdir(WORK_DIR, { recursive: true });
      const firstVideo = uploadedFiles.find(isVideoFile);
      const imageFiles = uploadedFiles.filter(isImageFile);

      if (firstVideo) {
        if (firstVideo.size > 200 * 1024 * 1024) {
          return Response.json({ error: "File too large (max 200MB)" }, { status: 413 });
        }
        const extMatch = firstVideo.name.match(/\.(mp4|webm|mov|m4v)$/i);
        const ext = extMatch ? extMatch[1].toLowerCase() : firstVideo.type.includes("webm") ? "webm" : "mp4";
        const rawPath = join(WORK_DIR, `tmp-${randomUUID()}-raw.${ext}`);
        const processedPath = join(WORK_DIR, `tmp-${randomUUID()}.mp4`);
        tempPaths.push(rawPath, processedPath);
        await fs.writeFile(rawPath, Buffer.from(await firstVideo.arrayBuffer()));

        const remuxed = await remuxForStreaming(rawPath, processedPath);
        const finalPath = remuxed ? processedPath : rawPath;
        tempVideoForMod = finalPath;

        const videoBuffer = await fs.readFile(finalPath);
        const videoStored = await storeMedia({
          buffer: videoBuffer,
          fileName: `socialx-${randomUUID()}.mp4`,
          mimeType: "video/mp4",
        });
        stored.push(videoStored);
        videoUrl = videoStored.url;
        videoMediaId = videoStored.remoteId;

        const coverPath = join(WORK_DIR, `tmp-cover-${randomUUID()}.jpg`);
        tempPaths.push(coverPath);
        if (await extractVideoCover(finalPath, coverPath)) {
          const coverBuffer = await fs.readFile(coverPath);
          const coverStored = await storeMedia({
            buffer: coverBuffer,
            fileName: `socialx-cover-${randomUUID()}.jpg`,
            mimeType: "image/jpeg",
          });
          stored.push(coverStored);
          coverUrl = coverStored.url;
          coverMediaId = coverStored.remoteId;
        }
      } else if (imageFiles.length > 0) {
        const savedPhotos: { url: string; mediaId: string | null }[] = [];
        for (const imgFile of imageFiles.slice(0, 10)) {
          if (imgFile.size > 200 * 1024 * 1024) {
            return Response.json({ error: "Photo too large (max 200MB per image)" }, { status: 413 });
          }
          const rawBuf = Buffer.from(await imgFile.arrayBuffer());
          // Preserve full original resolution (up to 8192px) as visually lossless WebP.
          const processed = await sharp(rawBuf)
            .rotate()
            .resize({ width: 8192, height: 8192, fit: "inside", withoutEnlargement: true })
            .webp({ quality: 94, effort: 6, smartSubsample: true })
            .toBuffer();

          const tempPath = join(WORK_DIR, `tmp-${randomUUID()}.webp`);
          tempPaths.push(tempPath);
          await fs.writeFile(tempPath, processed);
          tempImagesForMod.push(tempPath);

          const photoStored = await storeMedia({
            buffer: processed,
            fileName: `socialx-${randomUUID()}.webp`,
            mimeType: "image/webp",
          });
          stored.push(photoStored);
          savedPhotos.push({ url: photoStored.url, mediaId: photoStored.remoteId });
        }
        videoUrl = "";
        coverUrl = savedPhotos[0]?.url ?? null;
        coverMediaId = savedPhotos[0]?.mediaId ?? null;
        mediaUrlsJson = JSON.stringify(savedPhotos);
      } else {
        return Response.json({ error: "Unsupported file format" }, { status: 400 });
      }
    } else {
      const body = (await req.json().catch(() => null)) as {
        videoUrl?: string;
        coverUrl?: string;
        images?: string[];
        caption?: string;
        musicName?: string;
      } | null;
      const validImages = Array.isArray(body?.images)
        ? body!.images.filter((u) => typeof u === "string" && /^(https?:\/\/|\/)/.test(u)).slice(0, 10)
        : [];
      if (validImages.length > 0) {
        videoUrl = "";
        coverUrl = validImages[0];
        mediaUrlsJson = JSON.stringify(validImages.map((url) => ({ url, mediaId: null })));
        for (const url of validImages) {
          if (/^https?:\/\//i.test(url)) remoteImagesForMod.push(url);
        }
      } else if (body?.videoUrl && /^(https?:\/\/|\/)/.test(body.videoUrl)) {
        videoUrl = body.videoUrl;
        coverUrl = body.coverUrl ?? null;
      } else {
        return Response.json({ error: "A valid photo or video is required" }, { status: 400 });
      }
      caption = (body?.caption ?? "").slice(0, 300);
      musicName = (body?.musicName ?? "").slice(0, 120) || "original sound";
    }

    // ---- Fast server-side open-source AI moderation ----
    const result = await runModeration({
      caption,
      musicName,
      coverUrl,
      remoteImageUrls: remoteImagesForMod,
      videoFilePath: tempVideoForMod,
      imageFilePaths: tempImagesForMod.length > 0 ? tempImagesForMod : undefined,
      deep: false,
    });

    const now = new Date();

    // 1. Obscene / prohibited -> auto-delete from storage & block publishing.
    if (result.verdict === "rejected") {
      await Promise.all(stored.map((item) => removeStoredMedia(item).catch(() => false)));
      await db
        .insert(moderationLogs)
        .values({
          videoId: null,
          action: "auto_deleted",
          status: "auto_deleted",
          authorHandle: viewerHandle,
          captionSnapshot: caption,
          imageScore: result.details.imageScore != null ? String(result.details.imageScore) : null,
          textScore: result.details.textScore != null ? String(result.details.textScore) : null,
          imageVerdict: result.details.imageVerdict,
          textVerdict: result.details.textVerdict,
          reason: result.reason,
          details: JSON.stringify({ ...result.details, stage: "upload" }),
          reviewedBy: "ai-moderator",
          reviewedAt: now,
        })
        .catch((err) => console.error("[moderation] auto_deleted log failed:", err));

      return Response.json(
        {
          error: result.reason,
          moderation: {
            status: "auto_deleted",
            action: "auto_deleted",
            reason: result.reason,
            provider: result.provider,
            durationMs: result.durationMs,
            details: result.details,
          },
        },
        { status: 422 }
      );
    }

    const provider = storageProvider();
    const isHidden = result.verdict === "hidden_recheck";
    const [row] = await db
      .insert(videos)
      .values({
        userId: viewerId,
        videoUrl,
        coverUrl,
        mediaUrls: mediaUrlsJson,
        mediaId: videoMediaId,
        coverMediaId,
        storageProvider: provider,
        caption,
        musicName,
        status: isHidden ? "hidden_recheck" : "approved",
        recheckCount: 0,
        nextRecheckAt: isHidden ? new Date(Date.now() + 2500) : null,
        moderatedAt: now,
        moderationReason: result.reason,
      })
      .returning({ id: videos.id });

    if (stored.length > 0) {
      await db
        .insert(mediaAssets)
        .values(
          stored.map((item) => ({
            provider: item.provider,
            remoteId: item.remoteId,
            url: item.url,
            fileName: item.fileName,
            mimeType: item.mimeType,
            kind: item.mimeType.startsWith("video/") ? "video" : "image",
            sizeBytes: item.sizeBytes,
            videoId: row.id,
            uploadedBy: viewerHandle,
          }))
        )
        .catch((err) => console.error("[media] asset insert failed:", err));
    }

    const [logRow] = await db
      .insert(moderationLogs)
      .values({
        videoId: row.id,
        action: isHidden ? "hidden_recheck" : "approved",
        status: isHidden ? "hidden_recheck" : "approved",
        authorHandle: viewerHandle,
        captionSnapshot: caption,
        imageScore: result.details.imageScore != null ? String(result.details.imageScore) : null,
        textScore: result.details.textScore != null ? String(result.details.textScore) : null,
        imageVerdict: result.details.imageVerdict,
        textVerdict: result.details.textVerdict,
        reason: result.reason,
        details: JSON.stringify({ ...result.details, stage: "upload" }),
        reviewedBy: isHidden ? null : "ai-moderator",
        reviewedAt: isHidden ? null : now,
      })
      .returning({ id: moderationLogs.id })
      .catch(() => []);
    if (logRow?.id) void syncModerationLogById(logRow.id);
    void syncVideoById(row.id);

    if (isHidden) {
      scheduleFastRecheck(row.id, 2500);
      return Response.json(
        {
          video: null,
          hiddenId: row.id,
          moderation: {
            status: "hidden_recheck",
            action: "hidden_recheck",
            reason: result.reason,
            provider: result.provider,
            durationMs: result.durationMs,
            details: result.details,
          },
        },
        { status: 202 }
      );
    }

    const video = await getVideoById(row.id, viewerId);
    return Response.json(
      {
        video,
        storage: { provider, mediaId: videoMediaId },
        moderation: {
          status: "approved",
          action: "approved",
          reason: result.reason,
          provider: result.provider,
          durationMs: result.durationMs,
          details: result.details,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    // Roll back anything already pushed to storage if the request fails midway.
    await Promise.all(stored.map((item) => removeStoredMedia(item).catch(() => false)));
    return Response.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 502 }
    );
  } finally {
    Promise.all(tempPaths.map((file) => fs.unlink(file).catch(() => {})));
  }
}
