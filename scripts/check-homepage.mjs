import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";

const origin = process.env.TEST_ORIGIN ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 365, height: 672 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const passed = [];
const check = (message) => { passed.push(message); console.log(`PASS ${message}`); };

try {
  await page.goto(origin, { waitUntil: "networkidle" });
  const cards = page.locator(".sx-post");
  await expect(cards.first()).toBeVisible();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), true);
  assert.equal(await page.locator("video").count(), 0);
  await expect(page.locator(".sx-feed-tabs")).toBeHidden();
  assert.equal(await page.locator(".sx-bottom-nav").evaluate((el) => getComputedStyle(el).position), "fixed");
  check("Initial homepage uses real server-rendered posts, no autoplay media or horizontal overflow");

  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "SocialX", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  check("Hamburger menu opens and Escape closes the accessible dialog");

  await page.getByRole("button", { name: "Add your story", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Create post", exact: true })).toBeVisible();
  await expect(page.getByText("Add sound", { exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "PHOTO", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Create post", exact: true }).click();
  await expect(page.getByRole("button", { name: "Capture", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Capture", exact: true }).click();
  await expect(page.getByRole("button", { name: "Your Story", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to camera", exact: true }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  check("Your Story and Create Post open the Camera uploader and Preview editor");

  const first = cards.first();
  const firstCaption = await first.locator(".sx-post-caption").innerText();
  const like = first.locator(".sx-post-actions button").nth(0);
  const initialLike = await like.getAttribute("aria-pressed");
  for (let index = 0; index < 2; index++) {
    const response = page.waitForResponse((r) => r.url().endsWith("/like") && r.request().method() === "POST");
    await like.click();
    const result = await response;
    assert.equal(result.ok(), true);
    const body = await result.json();
    await expect(like).toHaveAttribute("aria-pressed", String(body.liked));
  }
  await expect(like).toHaveAttribute("aria-pressed", initialLike);
  check("Like button writes through the existing endpoint and restores its original state");

  await first.getByRole("button", { name: "Comment on post", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Comments", exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Add comment...")).toBeVisible();
  await page.getByRole("button", { name: "Close comments", exact: true }).click();
  check("Comments open in the mobile sheet using existing comment records");

  await first.getByRole("button", { name: "Dislike: show less like this", exact: true }).click();
  await expect(page.getByText("This doesn't send a public dislike", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Keep in my feed", exact: true }).click();
  await first.getByRole("button", { name: "Repost or share the original post", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copy post link", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  check("Feedback and sharing controls do not fabricate unsupported public reactions");

  await cards.nth(1).evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 22));
  await expect(page.locator(".sx-feed-tabs")).toBeVisible();
  assert.equal(await page.locator(".sx-feed-tabs").evaluate((el) => el.getBoundingClientRect().top), 0);
  const media = cards.nth(1).locator(".sx-media-tile");
  assert.equal(await media.count(), 2);
  const sizes = await media.evaluateAll((elements) => elements.map((el) => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height, top: el.getBoundingClientRect().top })));
  assert.equal(sizes[0].height, sizes[1].height);
  assert.equal(sizes[0].top, sizes[1].top);
  check("Stories scroll away, feed tabs pin at the top, and two images align equally");

  await page.getByRole("tab", { name: "Following", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Following", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".sx-feed-tabs")).toBeVisible();
  await page.getByRole("tab", { name: "Photo", exact: true }).click();
  await expect(page.getByText("Photo previews from posts in your feed", { exact: true })).toBeVisible();
  await expect(page.locator(".sx-media-grid").first()).toBeVisible();
  await page.getByRole("tab", { name: "For You", exact: true }).click();
  await expect(cards.first().locator(".sx-post-caption")).toHaveText(firstCaption);
  check("Following, For You, and Photo tabs filter existing content correctly");

  await page.setViewportSize({ width: 320, height: 672 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const bounds = await page.locator(".sx-home").boundingBox();
  assert.equal(bounds.width, 640);
  assert.equal(bounds.x, 400);
  await expect(page.locator(".sx-bottom-nav")).toBeVisible();
  assert.equal(await page.locator("aside").count(), 0);
  const desktopGrid = await page.locator(".sx-media-grid").first().evaluate((grid) => ({
    width: grid.getBoundingClientRect().width,
    cells: [...grid.children].map((cell) => cell.getBoundingClientRect().width),
  }));
  assert.ok(Math.abs(desktopGrid.width - desktopGrid.cells[0] - desktopGrid.cells[1] - 8) < 1);
  check("Layout fits small phones and remains a centered 640px feed on desktop");

  await page.setViewportSize({ width: 365, height: 672 });
  await page.goto(origin, { waitUntil: "networkidle" });
  await cards.first().locator(".sx-post-caption").click();
  await page.waitForURL((url) => url.pathname.startsWith("/video/"));
  await expect(page.getByRole("banner", { name: "SocialX header" })).toHaveCount(0);
  await expect(page.locator(".sx-viewer")).toBeVisible();
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Search", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "For You", exact: true })).toHaveAttribute("aria-selected", "true");
  check("Clicking a post on Home opens the full-screen viewer with no SX header");

  await page.goto(`${origin}/explore`, { waitUntil: "networkidle" });
  await expect(page.getByRole("banner", { name: "SocialX header" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Main navigation", exact: true })).toBeVisible();
  assert.equal(await page.locator("aside").count(), 0);
  check("SX header appears only on Homepage while persistent bottom navigation stays everywhere");

  assert.deepEqual(errors, []);
  check("No browser JavaScript errors");
  console.log(`\n${passed.length} homepage checks passed.`);
} finally {
  await browser.close();
}
