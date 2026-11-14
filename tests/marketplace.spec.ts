import { test, expect, type Page } from "@playwright/test";
import type { Listing } from "../src/lib/marketplace";

const id = "10000000-0000-4000-8000-000000000001";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
const initial: Listing[] = [
  {
    id,
    title: "Walnut reading chair",
    description: "Solid wood chair.",
    price: 125,
    category: "Home Goods",
    seller_email: "seller@example.com",
    image_url: null,
    location: "Palo Alto, CA",
    created_at: "2026-11-14T01:00:00Z",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    title: "Digital camera",
    description: null,
    price: 250,
    category: "Electronics",
    seller_email: "camera@example.com",
    image_url: null,
    location: "Menlo Park, CA",
    created_at: "2026-11-14T02:00:00Z",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    title: "Wireless headphones",
    description: "Great sound.",
    price: 45,
    category: "Electronics",
    seller_email: "audio@example.com",
    image_url: null,
    location: "Palo Alto, CA",
    created_at: "2026-11-14T03:00:00Z",
  },
];

// Intercept every Supabase data/storage request so tests cannot write to a real project.
async function database(page: Page, rows = initial) {
  const listings = structuredClone(rows);
  const messages: Record<string, unknown>[] = [];
  const writes: string[] = [];
  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split("/").pop();
    if (table === "listings" && request.method() === "GET") {
      const filter = url.searchParams.get("id");
      return route.fulfill({
        json: filter
          ? listings.filter((l) => l.id === filter.replace("eq.", ""))
          : listings,
      });
    }
    if (table === "listings" && request.method() === "POST") {
      writes.push("listing");
      const listing = {
        ...request.postDataJSON(),
        id: "20000000-0000-4000-8000-000000000001",
        created_at: new Date().toISOString(),
      };
      listings.unshift(listing);
      return route.fulfill({ status: 201, json: listing });
    }
    if (table === "messages" && request.method() === "POST") {
      messages.push(request.postDataJSON());
      return route.fulfill({ status: 201, body: "" });
    }
    return route.abort();
  });
  await page.route("**/storage/v1/**", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ contentType: "image/png", body: png });
    writes.push("upload");
    return route.fulfill({ json: { Key: "listing-images/test.png" } });
  });
  return { listings, messages, writes };
}

async function fillListing(page: Page) {
  await page.goto("/create/");
  await page.getByRole("button", { name: /Item for sale/ }).click();
  await page
    .getByLabel("Listing photo")
    .setInputFiles({ name: "chair.png", mimeType: "image/png", buffer: png });
  await page.getByLabel("Title", { exact: false }).fill("New reading chair");
  await page.getByLabel("Price", { exact: false }).fill("125.50");
  await page
    .getByLabel("Category", { exact: false })
    .selectOption("Home Goods");
  await page.getByLabel("Seller email").fill("seller@example.com");
  await page
    .getByLabel("Description", { exact: false })
    .fill("A comfortable chair in excellent condition.");
}

test("browse database listings, search, sort, and bookmark", async ({
  page,
}) => {
  await database(page);
  await page.goto("/");
  await expect(page.locator(".listing-card")).toHaveCount(3);
  await page
    .getByRole("textbox", { name: "Search Marketplace" })
    .fill("camera");
  await expect(page.locator(".listing-card")).toHaveCount(1);
  await page.getByRole("textbox", { name: "Search Marketplace" }).fill("");
  await page
    .getByRole("button", { name: "Electronics", exact: true })
    .first()
    .click();
  await expect(page.locator(".listing-card")).toHaveCount(2);
  await page.getByLabel("Sort listings").selectOption("low");
  await expect(page.locator(".listing-card").first()).toContainText(
    "Wireless headphones",
  );
  await page.getByRole("button", { name: "Save Wireless headphones" }).click();
  await page.getByRole("button", { name: "Saved items" }).click();
  await expect(page.locator(".listing-card")).toHaveCount(1);
  await page
    .getByRole("link", { name: /Wireless headphones/ })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Wireless headphones" }),
  ).toBeVisible();
});

test("Browse all clears filters, saved view, and category URL without reloading", async ({
  page,
}) => {
  await database(page);
  await page.goto("/?category=Electronics");
  await expect(page.locator(".listing-card")).toHaveCount(2);
  const browseAll = page.getByRole("link", { name: "Browse all", exact: true });
  await expect(browseAll).not.toHaveClass(/active/);
  await page.getByRole("button", { name: "Save Wireless headphones" }).click();
  await page.getByRole("button", { name: "Saved items" }).click();
  await page
    .getByRole("textbox", { name: "Search Marketplace" })
    .fill("headphones");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByLabel("Maximum price ($)").fill("50");
  await expect(page.locator(".listing-card")).toHaveCount(1);
  await browseAll.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".listing-card")).toHaveCount(3);
  await expect(
    page.getByRole("textbox", { name: "Search Marketplace" }),
  ).toHaveValue("");
  await expect(
    page.getByRole("heading", { name: "Today's picks" }),
  ).toBeVisible();
  await expect(browseAll).toHaveClass(/active/);
  await expect(page.locator(".filters-panel")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".listing-card")).toHaveCount(3);
  // Same-path links must reset local filter state as well.
  await page
    .getByRole("button", { name: "Electronics", exact: true })
    .first()
    .click();
  await expect(page.locator(".listing-card")).toHaveCount(2);
  await browseAll.click();
  await expect(page.locator(".listing-card")).toHaveCount(3);
});

test("Browse all closes the mobile drawer and resets empty results", async ({
  page,
}) => {
  await database(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?category=Electronics");
  await page
    .getByRole("textbox", { name: "Search Marketplace" })
    .fill("missing item");
  await expect(
    page.getByRole("heading", { name: "No finds just yet" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Browse all listings", exact: true })
    .click();
  await expect(page.locator(".listing-card")).toHaveCount(3);
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "Toggle categories" }).click();
  await page.getByRole("button", { name: "Saved items" }).click();
  await page.getByRole("link", { name: "Browse all", exact: true }).click();
  await expect(page.locator(".sidebar")).not.toHaveClass(/sidebar-open/);
  await expect(page.locator(".listing-card")).toHaveCount(3);
});

test("upload photo, insert listing, reload detail, and send message through Supabase", async ({
  page,
}) => {
  const db = await database(page);
  await fillListing(page);
  await expect(page.locator(".live-preview")).toContainText(
    "New reading chair",
  );
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page).toHaveURL(/\/listing\/\?id=/);
  expect(db.writes).toEqual(["upload", "listing"]);
  expect(db.listings[0]).toMatchObject({
    title: "New reading chair",
    price: 125.5,
    category: "Home Goods",
    seller_email: "seller@example.com",
  });
  expect(db.listings[0].image_url).toMatch(
    /\/storage\/v1\/object\/public\/listing-images\/[0-9a-f-]+\.png$/,
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "New reading chair" }),
  ).toBeVisible();
  await page.getByLabel("Your email").fill("buyer@example.com");
  await page.getByLabel("Your message").fill("Can I pick it up this weekend?");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Your message has been sent!",
  );
  expect(db.messages).toEqual([
    {
      listing_id: db.listings[0].id,
      buyer_email: "buyer@example.com",
      seller_email: "seller@example.com",
      message: "Can I pick it up this weekend?",
    },
  ]);
  expect(
    await page.evaluate(() => [
      localStorage.getItem("marketplace-listings"),
      localStorage.getItem("marketplace-messages"),
    ]),
  ).toEqual([null, null]);
});

test("upload failure prevents listing insertion and keeps form retryable", async ({
  page,
}) => {
  const db = await database(page);
  await page.route("**/storage/v1/**", (route) =>
    route.fulfill({
      status: 403,
      json: {
        statusCode: "403",
        error: "Unauthorized",
        message: "Upload denied by policy",
      },
    }),
  );
  await fillListing(page);
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Could not upload your photo",
  );
  expect(db.writes).toEqual([]);
  await expect(
    page.getByRole("button", { name: "Publish listing" }),
  ).toBeEnabled();
});

test("listing insertion failure never reports publication success", async ({
  page,
}) => {
  await database(page);
  await page.route("**/rest/v1/listings*", async (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 403,
          json: { code: "42501", message: "Listing insert denied" },
        })
      : route.fallback(),
  );
  await fillListing(page);
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "the listing could not be saved",
  );
  await expect(page).toHaveURL(/\/create\//);
});

test("message failure stays visible and allows retry", async ({ page }) => {
  const db = await database(page);
  await page.route("**/rest/v1/messages*", (route) =>
    route.fulfill({
      status: 403,
      json: { code: "42501", message: "Message insert denied" },
    }),
  );
  await page.goto("/listing/?id=" + id);
  await page.getByLabel("Your email").fill("buyer@example.com");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Could not send your message",
  );
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(db.messages).toHaveLength(0);
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toBeEnabled();
});

test("database errors do not fall back to local listings", async ({ page }) => {
  await database(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      "marketplace-listings",
      JSON.stringify([{ title: "Old browser listing" }]),
    ),
  );
  await page.route("**/rest/v1/listings*", (route) =>
    route.fulfill({
      status: 403,
      json: { message: "Database temporarily unavailable" },
    }),
  );
  await page.goto("/");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Could not load listings",
  );
  await expect(page.locator(".listing-card")).toHaveCount(0);
  await expect(page.getByText("Old browser listing")).toHaveCount(0);
});

test("empty database and missing items show real empty states", async ({
  page,
}) => {
  await database(page, []);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "No finds just yet" }),
  ).toBeVisible();
  await page.goto("/listing/?id=" + id);
  await expect(
    page.getByRole("heading", { name: "Listing not found" }),
  ).toBeVisible();
  await page.goto("/listing/?id=not-a-uuid");
  await expect(
    page.getByRole("heading", { name: "Listing not found" }),
  ).toBeVisible();
});

test("mobile categories and listing form fit the viewport", async ({
  page,
}) => {
  await database(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".listing-card")).toHaveCount(3);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Toggle categories" }).click();
  await page
    .getByRole("button", { name: "Home Goods", exact: true })
    .first()
    .click();
  await expect(page.locator(".listing-card")).toHaveCount(1);
  await page.goto("/create/");
  await page.getByRole("button", { name: /Item for sale/ }).click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
