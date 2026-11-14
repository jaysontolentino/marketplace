import { test, expect } from "@playwright/test";

test("browse, filter, save, sort, and navigate to a listing", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".listing-card")).toHaveCount(12);
  await page
    .getByRole("textbox", { name: "Search Marketplace" })
    .fill("camera");
  await expect(page.locator(".listing-card")).toHaveCount(1);
  await page.getByRole("textbox", { name: "Search Marketplace" }).fill("");
  await page
    .getByRole("button", { name: "Electronics", exact: true })
    .first()
    .click();
  await expect(page.locator(".listing-card")).toHaveCount(3);
  await page.getByLabel("Sort listings").selectOption("low");
  await expect(page.locator(".listing-card").first()).toContainText(
    "Sony wireless headphones",
  );
  await page
    .getByRole("button", { name: "Save Sony wireless headphones" })
    .click();
  await page.getByRole("button", { name: "Saved items" }).click();
  await expect(page.locator(".listing-card")).toHaveCount(1);
  await page
    .getByRole("link", { name: /Sony wireless headphones/ })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Sony wireless headphones" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "alex@example.com" }),
  ).toBeVisible();
});

test("create a listing, persist it, and save a buyer message", async ({
  page,
}) => {
  await page.goto("/create/");
  await page.getByRole("button", { name: /Item for sale/ }).click();
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  await page
    .getByLabel("Listing photo")
    .setInputFiles({ name: "chair.png", mimeType: "image/png", buffer: image });
  await page.getByLabel("Title", { exact: false }).fill("Walnut reading chair");
  await page.getByLabel("Price", { exact: false }).fill("125");
  await page
    .getByLabel("Category", { exact: false })
    .selectOption("Home Goods");
  await page.getByLabel("Seller email").fill("seller@example.com");
  await page
    .getByLabel("Description", { exact: false })
    .fill("A comfortable chair in excellent condition.");
  await expect(page.locator(".live-preview")).toContainText(
    "Walnut reading chair",
  );
  await page.getByRole("button", { name: "Publish demo listing" }).click();
  await expect(page).toHaveURL(/\/listing\/\?id=/);
  await expect(
    page.getByRole("heading", { name: "Walnut reading chair" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Walnut reading chair" }),
  ).toBeVisible();
  await page.getByLabel("Your email").fill("buyer@example.com");
  await page.getByLabel("Your message").fill("Can I pick it up this weekend?");
  await page.getByRole("button", { name: "Save demo message" }).click();
  await expect(page.getByRole("status")).toContainText("Demo message saved!");
  const messages = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("marketplace-messages") || "[]"),
  );
  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatchObject({
    buyer_email: "buyer@example.com",
    seller_email: "seller@example.com",
    message: "Can I pick it up this weekend?",
  });
});

test("mobile layout and category navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".listing-card")).toHaveCount(12);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Toggle categories" }).click();
  await page
    .getByRole("button", { name: "Home Goods", exact: true })
    .first()
    .click();
  await expect(page.locator(".listing-card")).toHaveCount(3);
  await expect(page.locator(".sidebar")).not.toHaveClass(/sidebar-open/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.screenshot({
    path: "artifacts/marketplace-mobile.png",
    fullPage: true,
  });
  await page.goto("/create/");
  await page.getByRole("button", { name: /Item for sale/ }).click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("desktop reference screenshot and empty states", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/");
  await expect(page.locator(".listing-card")).toHaveCount(12);
  await page.screenshot({
    path: "artifacts/marketplace-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("textbox", { name: "Search Marketplace" })
    .fill("no such product xyz");
  await expect(
    page.getByRole("heading", { name: "No finds just yet" }),
  ).toBeVisible();
  await page.goto("/listing/?id=missing");
  await expect(
    page.getByRole("heading", { name: "Listing not found" }),
  ).toBeVisible();
});
