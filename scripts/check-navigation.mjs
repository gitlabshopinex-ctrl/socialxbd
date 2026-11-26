import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const base = process.env.TEST_ORIGIN ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const pass = (name) => console.log("PASS", name);

try {
  await mkdir(".artifacts", { recursive: true });
  await page.goto(base, { waitUntil: "networkidle" });
  await expect(page.locator(".sx-post").first()).toBeVisible();
  await expect(page.getByRole("banner", { name: "SocialX header" })).toHaveCount(1);

  // 1. Verify custom Shorts SVG icon in bottom navigation
  const shortsLink = page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "Shorts", exact: true });
  await expect(shortsLink).toBeVisible();
  const svgInfo = await shortsLink.locator("svg").evaluate((svg) => ({
    viewBox: svg.getAttribute("viewBox"),
    pathD: svg.querySelectorAll("path")[1]?.getAttribute("d") ?? "",
  }));
  assert.equal(svgInfo.viewBox, "0 0 512 512");
  assert.ok(svgInfo.pathD.startsWith("M450.7 257.4"));
  pass("Custom Shorts SVG icon is rendered in the bottom navigation bar");

  // 2. Click a video on Home -> verify viewer structure
  const firstHomePost = await page.locator(".sx-post").first().getAttribute("aria-label");
  const secondHomePost = await page.locator(".sx-post").nth(1).getAttribute("aria-label");
  await page.locator(".sx-media-tile").first().click();
  await page.waitForURL(
    (url) => url.pathname.startsWith("/video/") && url.searchParams.get("mode") === "shorts"
  );
  await page.locator(".sx-viewer-slide:visible").first().waitFor();
  await expect(page.locator(".sx-viewer-thumbs")).toHaveCount(0);
  const playingCount = await page.locator(".sx-viewer-scroll video.sx-viewer-video").evaluateAll((videos) => videos.filter((v) => !v.paused).length);
  assert.equal(playingCount, 1);
  await expect(page.getByRole("tab", { name: "For You", exact: true })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  pass("Clicking a video on Home opens the full-screen Shorts viewer without thumbnails");

  // 3. Navigate to Shorts page via bottom nav -> must be 100% identical viewer UI with For You active
  await shortsLink.click();
  await page.waitForURL((url) => url.pathname === "/following");
  await page.locator(".sx-viewer-slide:visible").first().waitFor();
  await expect(shortsLink).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".sx-viewer")).toBeVisible();
  const playingCount2 = await page.locator(".sx-viewer-scroll video.sx-viewer-video").evaluateAll((videos) => videos.filter((v) => !v.paused).length);
  assert.equal(playingCount2, 1);
  await expect(page.locator(".sx-viewer-thumbs")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "For You", exact: true })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(page.locator(".sx-viewer-slide .sx-viewer-rail").first()).toBeVisible();
  await expect(page.locator(".sx-viewer-slide .sx-viewer-caption-box").first()).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: ".artifacts/shorts-page.png" });

  // Scroll Shorts page -> pathname stays /following so Shorts nav remains active, rail scrolls with slide
  await page
    .locator(".sx-viewer-scroll")
    .evaluate((el) => el.scrollTo({ top: el.clientHeight, behavior: "instant" }));
  await page.waitForTimeout(350);
  assert.equal(new URL(page.url()).pathname, "/following");
  await expect(shortsLink).toHaveAttribute("aria-current", "page");
  pass("Shorts page is 100% identical to the Home video viewer and keeps For You + Shorts active");

  // 4. Test Upload Camera UI (Screenshot 2) and Preview Editor UI (Screenshot 3)
  await page.getByRole("button", { name: "Create post", exact: true }).click();
  const uploadDialog = page.getByRole("dialog", { name: "Create post", exact: true });
  await expect(uploadDialog).toBeVisible();
  await expect(uploadDialog.getByText("Add sound", { exact: true })).toBeVisible();
  for (const mode of ["10m", "60s", "15s", "PHOTO", "TEXT"]) {
    await expect(uploadDialog.getByRole("tab", { name: mode, exact: true })).toBeVisible();
  }
  await expect(uploadDialog.getByRole("tab", { name: "PHOTO", exact: true })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(uploadDialog.getByText("CAMERA", { exact: true })).toBeVisible();
  await expect(uploadDialog.getByText("CREATE", { exact: true })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: ".artifacts/upload-camera.png" });
  pass("Upload Camera screen matches Screenshot 2 layout and controls");

  // Capture a photo -> transitions to Screenshot 3 Preview Editor
  await uploadDialog.getByRole("button", { name: "Capture", exact: true }).click();
  await expect(uploadDialog.getByRole("button", { name: "Back to camera", exact: true })).toBeVisible();
  await expect(uploadDialog.getByRole("button", { name: "Add text overlay", exact: true })).toBeVisible();
  await expect(uploadDialog.getByRole("button", { name: "Add more photos", exact: true })).toBeVisible();
  await expect(uploadDialog.getByRole("button", { name: "Your Story" })).toBeVisible();
  await expect(uploadDialog.getByRole("button", { name: "Next", exact: true })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: ".artifacts/upload-preview.png" });
  await uploadDialog.getByRole("button", { name: "Back to camera", exact: true }).click();
  await uploadDialog.getByRole("button", { name: "Close", exact: true }).click();
  pass("Post-capture/upload Preview Editor screen matches Screenshot 3 layout and controls");

  // 5. Verify clicking a post on Home still opens the Posts sequence
  await page.goto(base, { waitUntil: "networkidle" });
  await page.locator(".sx-post").first().locator(".sx-post-caption").click();
  await page.waitForURL((url) => url.searchParams.get("mode") === "posts");
  await page.locator(".sx-viewer-slide:visible").first().waitFor();
  const playingPost = await page.locator(".sx-viewer-scroll video.sx-viewer-video").evaluateAll((videos) => videos.filter((v) => !v.paused).length);
  assert.equal(playingPost, 0);
  await expect(page.locator(".sx-viewer-slide").first()).toHaveAttribute("aria-label", firstHomePost);
  await expect(page.locator(".sx-viewer-slide").nth(1)).toHaveAttribute("aria-label", secondHomePost);
  pass("Clicking a post on Home opens the post scroll sequence");

  assert.deepEqual(errors, []);
  pass("No browser JavaScript errors");
} finally {
  await browser.close();
}
