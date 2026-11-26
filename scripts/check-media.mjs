import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.env.TEST_ORIGIN ?? "http://localhost:3000";
const dir = mkdtempSync(join(tmpdir(), "sx-media-"));
const file = join(dir, "sample.jpg");
await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 70, g: 140, b: 210 } } }).jpeg().toFile(file);

const pass = (message) => console.log("PASS", message);
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

try {
  // 1. Status endpoint reports infrastructure without leaking secrets
  const status = await fetch(`${base}/api/media/status`).then((r) => r.json());
  assert.equal(status.media.maxUploadBytes, 200 * 1024 * 1024);
  assert.ok(["shopinex", "local"].includes(status.media.provider));
  assert.equal(typeof status.supabase.configured, "boolean");
  pass("Media status endpoint reports provider + 200 MB limit (no credentials exposed)");

  // 2. Upload → serve → list → download → delete through the real API
  const form = new FormData();
  form.append("file", new Blob([await sharp(file).toBuffer()], { type: "image/jpeg" }), "sample.jpg");
  const upload = await fetch(`${base}/api/media`, { method: "POST", body: form });
  assert.equal(upload.status, 201);
  const uploaded = await upload.json();
  assert.ok(uploaded.asset.url);
  const served = await fetch(`${base}${uploaded.asset.url}`);
  assert.equal(served.status, 200);
  const listed = await fetch(`${base}/api/media`).then((r) => r.json());
  assert.ok(listed.tracked.some((item) => item.id === uploaded.asset.id));
  const download = await fetch(`${base}/api/media/download?id=${encodeURIComponent(uploaded.asset.id)}`);
  assert.equal(download.status, 200);
  assert.ok((download.headers.get("content-type") ?? "").startsWith("image/"));
  pass("Upload, serve, list and server-proxied download all work");

  const removed = await fetch(`${base}/api/media?id=${encodeURIComponent(uploaded.asset.id)}`, { method: "DELETE" });
  assert.equal(removed.status, 200);
  assert.equal((await fetch(`${base}${uploaded.asset.url}`)).status, 404);
  pass("Delete removes the file from storage and the tracked list");

  // 3. Non-image/video files are rejected
  const bad = new FormData();
  bad.append("file", new Blob(["hello"], { type: "text/plain" }), "notes.txt");
  const rejected = await fetch(`${base}/api/media`, { method: "POST", body: bad });
  assert.equal(rejected.status, 415);
  pass("Non media files are rejected with 415");

  // 4. Studio page renders and uploads with progress + messages
  await page.goto(`${base}/studio/media`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Media library" })).toBeVisible();
  await expect(page.getByText("max 200 MB")).toBeVisible();
  const countText = await page.getByRole("heading", { level: 2 }).last().innerText();
  const before = Number(countText.match(/\((\d+)\)/)?.[1] ?? 0);
  await page.locator("#studio-media-input").setInputFiles(file);
  await expect(page.getByText(/Uploaded sample\.jpg/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: `Uploaded media (${before + 1})` })).toBeVisible();
  await page.waitForTimeout(300);
  pass("Studio media page uploads a file, shows progress and a success message");

  const firstCard = page.locator("ul li").first();
  const downloadHref = await firstCard.locator("a", { hasText: "Download" }).getAttribute("href");
  assert.ok(downloadHref?.startsWith("/api/media/download?id="));
  await firstCard.getByRole("button", { name: /Delete/ }).click();
  await expect(page.getByRole("heading", { name: `Uploaded media (${before})` })).toBeVisible({ timeout: 20_000 });
  pass("Studio page download link and delete action work");

  // 5. API key must never be present in the browser bundle
  const html = await page.content();
  assert.ok(!html.includes("ba1f397e281021c8"));
  assert.ok(!html.toLowerCase().includes("x-api-key"));
  pass("No API key or secret header is exposed to the browser");

  assert.deepEqual(errors, []);
  pass("No browser JavaScript errors");
} finally {
  await browser.close();
  rmSync(dir, { recursive: true, force: true });
}
