import { randomUUID } from "crypto";
import { join } from "path";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentHandle, getCurrentUserIdentity, getCurrentUserId, getProfile } from "@/lib/data";
import { runModeration } from "@/server/moderation";
import { removeStoredMedia, storeMedia, type StoredMedia } from "@/server/media";
import { syncUserByHandle } from "@/server/supabase-sync";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const viewerId = await getCurrentUserId();
  const profile = await getProfile(decodeURIComponent(handle), viewerId);
  if (!profile) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(profile);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const currentHandle = await getCurrentHandle();
  if (decodeURIComponent(handle) !== currentHandle) {
    return Response.json({ error: "You can only edit your own profile" }, { status: 403 });
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.handle, currentHandle))
    .limit(1);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const contentType = req.headers.get("content-type") ?? "";
  let name = existing.name;
  let bio = existing.bio;
  let requestedHandle = currentHandle;
  let avatarBuffer: Buffer | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const rawName = String(form.get("name") ?? existing.name).trim().slice(0, 60);
    const rawBio = String(form.get("bio") ?? existing.bio).trim().slice(0, 160);
    name = rawName || existing.name;
    bio = rawBio;
    if (typeof form.get("handle") === "string") {
      requestedHandle = String(form.get("handle")).trim().toLowerCase();
    }
    const file = form.get("avatar");
    if (file instanceof File && file.size > 0) {
      if (!file.type.startsWith("image/")) {
        return Response.json({ error: "Please choose an image file" }, { status: 400 });
      }
      if (file.size > 5 * 1024 * 1024) {
        return Response.json({ error: "Photo too large (max 5MB)" }, { status: 413 });
      }
      avatarBuffer = Buffer.from(await file.arrayBuffer());
    }
  } else {
    const body = (await req.json().catch(() => null)) as {
      name?: string;
      bio?: string;
      handle?: string;
    } | null;
    name = (body?.name ?? existing.name).trim().slice(0, 60) || existing.name;
    bio = (body?.bio ?? existing.bio).trim().slice(0, 160);
    if (typeof body?.handle === "string") {
      requestedHandle = body.handle.trim().toLowerCase();
    }
  }

  if (!name) return Response.json({ error: "Name is required" }, { status: 400 });

  // Username change: validate format and availability.
  let handleToSave: string | null = null;
  if (requestedHandle !== currentHandle) {
    if (!/^[a-z0-9._]{3,24}$/.test(requestedHandle)) {
      return Response.json(
        { error: "Username must be 3-24 characters: lowercase letters, numbers, . or _" },
        { status: 400 }
      );
    }
    const taken = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.handle, requestedHandle))
      .limit(1);
    if (taken.length > 0) {
      return Response.json({ error: "Username already taken" }, { status: 409 });
    }
    handleToSave = requestedHandle;
  }

  let newAvatarUrl: string | null = null;
  let savedAvatar: StoredMedia | null = null;

  if (avatarBuffer) {
    const dir = join(process.cwd(), "public", "uploads");
    const { mkdir, writeFile } = await import("fs/promises");
    await mkdir(dir, { recursive: true });

    const processed = await sharp(avatarBuffer)
      .rotate()
      .resize({ width: 512, height: 512, fit: "cover", withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();

    // AI check on a temporary local copy, then store via the media service.
    const tempName = `tmp-avatar-${randomUUID()}.webp`;
    const tempPath = join(dir, tempName);
    await writeFile(tempPath, processed);
    const check = await runModeration({ caption: "", imageFilePaths: [tempPath], deep: true });
    await import("fs/promises").then((fs) => fs.unlink(tempPath).catch(() => {}));
    if (check.verdict === "rejected") {
      return Response.json(
        { error: check.reason, moderation: { status: "auto_deleted", reason: check.reason } },
        { status: 422 }
      );
    }

    savedAvatar = await storeMedia({
      buffer: processed,
      fileName: `socialx-avatar-${randomUUID()}.webp`,
      mimeType: "image/webp",
    });
    newAvatarUrl = savedAvatar.url;
  }

  const nextHandle = handleToSave ?? currentHandle;
  const identity = await getCurrentUserIdentity();
  await db
    .update(users)
    .set({
      ...(newAvatarUrl ? { avatarUrl: newAvatarUrl } : {}),
      ...(handleToSave ? { handle: handleToSave } : {}),
      name,
      bio,
    })
    .where(eq(users.handle, currentHandle));

  if (newAvatarUrl && savedAvatar) {
    // Remove the previous avatar from whichever provider held it (local only; remote URLs are external).
    if (
      existing.avatarUrl?.startsWith("/uploads/") ||
      existing.avatarUrl?.startsWith("/api/media/file/")
    ) {
      await removeStoredMedia({ url: existing.avatarUrl, provider: "local" });
    }
  }

  void syncUserByHandle(nextHandle);

  const response = NextResponse.json({
    ok: true,
    handle: nextHandle,
    avatarUrl: newAvatarUrl ?? existing.avatarUrl,
    name,
    bio,
  });
  const cookieOptions = {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax" as const,
  };
  // Stable id keeps the session valid even after the username changes.
  response.cookies.set("sx_uid", String(identity.id), cookieOptions);
  response.cookies.set("sx_handle", nextHandle, cookieOptions);
  return response;
}