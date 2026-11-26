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

try {
  // Theme follows Bangladesh Standard Time (UTC+6): 06:00-18:00 = day (white), else night (black)
  const dhakaHour = (new Date().getUTCHours() + 6) % 24;
  const isDay = dhakaHour >= 6 && dhakaHour < 18;
  const expectedBg = isDay ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)";
  const expectedText = isDay ? "rgb(22, 24, 35)" : "rgb(255, 255, 255)";
  const themeName = isDay ? "day" : "night";

  await page.goto(`${base}/profile`, { waitUntil: "networkidle" });
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav).toBeVisible();
  assert.equal(await nav.evaluate((el) => getComputedStyle(el).backgroundColor), expectedBg);
  assert.equal(await page.locator(".sx-profile-page").evaluate((el) => getComputedStyle(el).backgroundColor), expectedBg);
  assert.equal(await page.locator(".sx-profile-page").evaluate((el) => getComputedStyle(el).color), expectedText);
  await expect(nav.getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");
  console.log(`PASS Bangladesh time (${dhakaHour}:00) -> ${themeName} theme: page + navigation use ${isDay ? "white" : "black"} background`);

  // Create (+) icon must look exactly like the homepage one (white square, black plus)
  const profilePlus = await page
    .locator(".sx-bottom-nav-create > span")
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, color: cs.color };
    });
  assert.equal(profilePlus.bg, "rgb(255, 255, 255)");
  assert.equal(profilePlus.color, "rgb(0, 0, 0)");
  await page.goto(base, { waitUntil: "networkidle" });
  const homePlus = await page
    .locator(".sx-bottom-nav-create > span")
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, color: cs.color };
    });
  assert.deepEqual(profilePlus, homePlus);
  console.log("PASS Profile create (+) icon matches the homepage exactly");

  await page.goto(`${base}/profile`, { waitUntil: "networkidle" });

  const myVideos = page.locator('.sx-profile-page a[href^="/profile/video/"]');
  await expect(myVideos.first()).toBeVisible();
  const profileIds = await myVideos.evaluateAll((links) => links.map((link) => Number(link.getAttribute("href").split("/").at(-1))));
  assert.ok(profileIds.length >= 2, "fixture should include multiple own videos");

  // Pencil opens the full-page Edit profile screen (reference layout, no Others section)
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit profile" });
  await expect(editor).toBeVisible();
  await expect(editor.getByRole("heading", { name: "Edit profile" })).toBeVisible();
  await expect(editor.getByRole("button", { name: /Change photo/ }).first()).toBeVisible();
  await expect(editor.getByText("Basic info")).toBeVisible();
  const liveHandle = await editor.locator(".sx-edit-row").nth(1).locator(".sx-edit-readonly").innerText();
  await expect(editor.getByText("socialx.com/@" + liveHandle)).toBeVisible();
  // The red-circled "Others" section must NOT exist
  assert.equal(await editor.getByText("AI self", { exact: true }).count(), 0);
  assert.equal(await editor.getByText("Change display order", { exact: true }).count(), 0);
  assert.equal(await editor.getByText("TikTok Studio", { exact: true }).count(), 0);

  // Rows navigate to field sub-pages; main page keeps Cancel + Save
  await expect(editor.locator(".sx-edit-row")).toHaveCount(4);
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor).toHaveCount(0);
  console.log("PASS Pencil opens reference Edit profile page; Others section absent; Change photo present");

  // Camera icon on the avatar opens the image picker directly
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  const chooserPromise = page.waitForEvent("filechooser");
  await editor.locator("button.sx-edit-avatar").click();
  const chooser = await chooserPromise;
  assert.ok(chooser, "camera/change-photo must open a file picker");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  console.log("PASS Camera icon on the avatar opens the photo picker");

  // Name row -> "Name Change" sub-page with one left-aligned input
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await editor.locator(".sx-edit-row").nth(0).click();
  const namePage = page.getByRole("dialog", { name: "Name Change" });
  await expect(namePage).toBeVisible();
  await expect(namePage.getByRole("heading", { name: "Name Change" })).toBeVisible();
  const fieldNameInput = namePage.getByRole("textbox", { name: "Name" });
  await expect(fieldNameInput).toBeVisible();
  assert.equal(await fieldNameInput.evaluate((el) => getComputedStyle(el).textAlign), "left");
  const profileName = (await editor.locator(".sx-edit-row").nth(0).locator(".sx-edit-readonly").innerText()).trim();
  await expect(fieldNameInput).toHaveValue(profileName);
  await namePage.getByRole("button", { name: "Back", exact: true }).click();
  await expect(namePage).toHaveCount(0);
  console.log("PASS Name row opens Name Change sub-page with a single left-aligned input");

  // Username row -> availability: own handle available, taken handle unavailable
  await editor.locator(".sx-edit-row").nth(1).click();
  const unamePage = page.getByRole("dialog", { name: "Username Change" });
  await expect(unamePage).toBeVisible();
  await expect(unamePage.getByRole("heading", { name: "Username Change" })).toBeVisible();
  const fieldUnameInput = unamePage.getByRole("textbox", { name: "Username" });
  assert.equal(await fieldUnameInput.evaluate((el) => getComputedStyle(el).textAlign), "left");
  await expect(unamePage.getByText("Available", { exact: true })).toBeVisible();
  await fieldUnameInput.fill("maya.moves");
  await expect(unamePage.getByText("Unavailable", { exact: true })).toBeVisible();
  await expect(unamePage.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await fieldUnameInput.fill(liveHandle);
  await expect(unamePage.getByText("Available", { exact: true })).toBeVisible();
  await unamePage.getByRole("button", { name: "Back", exact: true }).click();
  console.log("PASS Username Change page reports Available/Unavailable from the real database");

  // Bio row -> "Bio Change" sub-page
  await editor.locator(".sx-edit-row").nth(3).click();
  const bioPage = page.getByRole("dialog", { name: "Bio Change" });
  await expect(bioPage).toBeVisible();
  await expect(bioPage.getByRole("heading", { name: "Bio Change" })).toBeVisible();
  await expect(bioPage.getByRole("textbox", { name: "Bio" })).toBeVisible();
  await bioPage.getByRole("button", { name: "Back", exact: true }).click();
  await expect(bioPage).toHaveCount(0);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(editor).toHaveCount(0);
  console.log("PASS Bio row opens Bio Change sub-page");

  await myVideos.first().click();
  await page.waitForURL((url) => url.pathname === `/profile/video/${profileIds[0]}`);
  const scroller = page.locator(".sx-profile-viewer .sx-viewer-scroll");
  await expect(scroller).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Profile video controls" })).toBeVisible();
  await expect(page.locator(".sx-profile-video-footer")).toBeVisible();
  const slideIds = await scroller.locator(".sx-viewer-slide").evaluateAll((slides) => slides.map((slide) => Number(slide.getAttribute("data-post-id"))));
  assert.deepEqual(slideIds, profileIds);
  assert.equal(await scroller.evaluate((el) => getComputedStyle(el).scrollBehavior), "auto");
  assert.equal(await scroller.evaluate((el) => getComputedStyle(el.firstElementChild).scrollSnapStop), "normal");
  console.log("PASS Profile viewer shows only own videos, back/search and a views footer");

  await page.mouse.move(180, 375);
  await page.mouse.wheel(0, 700);
  await expect.poll(async () => scroller.evaluate((el) => Math.round(el.scrollTop / el.clientHeight))).toBe(1);
  await expect.poll(async () => new URL(page.url()).pathname).toBe(`/profile/video/${profileIds[1]}`);
  assert.equal(await scroller.locator("video.sx-viewer-video").evaluateAll((videos) => videos.filter((v) => !v.paused).length), 1);
  console.log("PASS Real wheel scroll smoothly reaches next own video and updates URL");

  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(300);
  const end = await scroller.evaluate((el) => ({ top: el.scrollTop, max: el.scrollHeight - el.clientHeight, height: el.clientHeight }));
  assert.ok(Math.abs(end.top - end.max) < 2, `expected end of own videos, got ${JSON.stringify(end)}`);
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(300);
  const afterEnd = await scroller.evaluate((el) => el.scrollTop);
  assert.ok(Math.abs(afterEnd - end.max) < 2);
  console.log("PASS Reaching the last own video stops scrolling; no other creator appears");

  await page.getByRole("button", { name: "Back to profile" }).click();
  await page.waitForURL((url) => url.pathname === "/profile");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  console.log("PASS Back returns to Profile with original black navigation");

  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.locator(".sx-media-tile").first().click();
  await page.waitForURL((url) => url.pathname.startsWith("/video/"));
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Feed filters" })).toBeVisible();
  console.log("PASS Other video viewers keep their previous navigation and feed tabs");

  assert.deepEqual(errors, []);
  console.log("PASS No browser JavaScript errors");
} finally {
  await browser.close();
}
