import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";

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
  // 1. Homepage Stories are larger now
  await page.goto(base, { waitUntil: "networkidle" });
  const storySize = await page
    .locator(".sx-story-image")
    .first()
    .evaluate((el) => el.getBoundingClientRect().width);
  assert.equal(storySize, 96);
  pass("Homepage story cards use the larger 96px size");

  // 2. Feed tabs blur is lighter (blur(3px))
  await page.locator(".sx-post").nth(1).evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 22));
  await expect(page.locator(".sx-feed-tabs")).toBeVisible();
  const blur = await page
    .locator(".sx-feed-tabs")
    .evaluate((el) => getComputedStyle(el, "::before").backdropFilter);
  assert.equal(blur, "blur(3px)");
  pass("Feed tab header blur is reduced to the lighter blur(3px)");

  // 3. Click my own post on Home -> viewer has NO three-dot under Share; Share opens own sheet
  const me = await fetch(`${base}/api/me`).then((r) => r.json());
  await page.goto(base, { waitUntil: "networkidle" });
  const myCard = page
    .locator(".sx-post")
    .filter({ hasText: `@${me.handle}` })
    .first();
  await myCard.locator(".sx-media-tile").first().click();
  await page.waitForURL((url) => url.pathname.startsWith("/video/"));
  await page.locator(".sx-viewer-slide:visible").first().waitFor();

  const activeIndex = await page
    .locator(".sx-viewer-scroll")
    .evaluate((el) => Math.round(el.scrollTop / el.clientHeight));
  const visibleSlide = page.locator(".sx-viewer-slide").nth(activeIndex);
  await expect(visibleSlide.getByRole("button", { name: "Share post", exact: true })).toBeVisible();
  assert.equal(await page.locator("button[aria-label='More options']").count(), 0);
  pass("Three-dot icon under Share is removed from the viewer rail");

  // Share -> own post layout (screenshot 2)
  await visibleSlide.getByRole("button", { name: "Share post", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Send to" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Privacy settings", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Ad settings", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Download", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Add to Story", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "WhatsApp", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Copy link", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Messenger", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Facebook", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Status", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Report", exact: true })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "Repost", exact: true })).toHaveCount(0);
  pass("Own post share sheet matches reference: Privacy / Ad settings / Delete / Download / Add to Story");

  await sheet.getByRole("button", { name: "Close", exact: true }).click();

  // 4. Someone else's post -> third screenshot layout
  await page.goto(base, { waitUntil: "networkidle" });
  const otherCard = page
    .locator(".sx-post")
    .filter({ hasText: "Leo Mart" })
    .first();
  await otherCard.locator(".sx-post-caption").click();
  await page.waitForURL((url) => url.pathname.startsWith("/video/"));
  const otherIndex = await page
    .locator(".sx-viewer-scroll")
    .evaluate((el) => Math.round(el.scrollTop / el.clientHeight));
  const otherSlide = page.locator(".sx-viewer-slide").nth(otherIndex);
  await otherSlide.getByRole("button", { name: "Share post", exact: true }).click();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Repost", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Report", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Not interested", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Add to Story", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Create group", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Duet", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "Privacy settings", exact: true })).toHaveCount(0);
  pass("Other creator's share sheet matches reference: Report / Not interested / Add to Story / Create group / Duet");

  // Report flow inside the sheet must hit the real API
  const reportResponse = page.waitForResponse(
    (r) => r.url().endsWith("/report") && r.request().method() === "POST"
  );
  await sheet.getByRole("button", { name: "Report", exact: true }).click();
  await sheet.getByRole("button", { name: "Submit report", exact: true }).click();
  const reportResult = await reportResponse;
  assert.ok(reportResult.status() === 200 || reportResult.status() === 201);

  // 5. Feed post share icon also opens the same sheet (no three-dot under it)
  await page.goto(base, { waitUntil: "networkidle" });
  const feedShare = page
    .locator(".sx-post")
    .first()
    .getByRole("button", { name: "Share post", exact: true });
  assert.equal(await feedShare.count(), 1);
  await feedShare.click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Close", exact: true }).click();
  pass("Feed post share icon opens the same Send to sheet without a three-dot below it");

  assert.deepEqual(errors, []);
  pass("No browser JavaScript errors");
} finally {
  await browser.close();
}
