import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import ranges from "../fixtures/overture-ranges.json" with { type: "json" };
test("automatic mapped footprints need no measurements and survive provider failure", async ({
  page,
}) => {
  await page.route(
    "https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/**",
    async (route) => {
      const r = ranges.find((r) => r.range === route.request().headers().range);
      if (!r) return route.abort();
      await route.fulfill({
        status: r.status,
        headers: r.headers,
        body: Buffer.from(r.base64, "base64"),
      });
    },
  );
  await page.goto("/");
  await page.getByLabel("Space type", { exact: true }).selectOption("patio");
  await page.getByLabel("Date", { exact: true }).fill("2026-06-21");
  await expect(
    page.getByText("outlines with heights", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("heights unknown", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add a measured building" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Sun excluding mapped shadows (partial)", { exact: true }),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page
      .getByRole("heading", { name: "Put your patio on the map." })
      .scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: `test-results/mapped-${width}.png` });
  }
  const lat = await page.getByLabel("Latitude", { exact: true }).inputValue();
  await page.getByRole("button", { name: "North", exact: true }).click();
  await expect(page.getByLabel("Latitude", { exact: true })).not.toHaveValue(
    lat,
  );
  await page.route(
    "https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/**",
    (route) => route.abort(),
  );
  await page.getByLabel("Location", { exact: true }).selectOption("2");
  await expect(page.getByText(/Building data unavailable/)).toBeVisible();
  await expect(
    page.getByText("Potential direct sun", { exact: true }).first(),
  ).toBeVisible();
});
test("climate is opt-in and handles provider data and failure", async ({
  page,
}) => {
  let requests = 0;
  await page.route("https://power.larc.nasa.gov/api/**", async (route) => {
    requests++;
    expect(route.request().url()).not.toContain("44.6488");
    await route.fulfill({
      json: {
        properties: {
          parameter: {
            T2M: {
              JAN: -2,
              FEB: -1,
              MAR: 2,
              APR: 5,
              MAY: 10,
              JUN: 15,
              JUL: 20,
              AUG: 19,
              SEP: 16,
              OCT: 11,
              NOV: 6,
              DEC: 1,
            },
          },
        },
        header: { range: "2001–2025", fill_value: -999 },
        parameters: { T2M: { units: "C" } },
      },
    });
  });
  await page.goto("/");
  expect(requests).toBe(0);
  await page
    .getByRole("button", { name: "Load regional climate averages" })
    .click();
  await expect(page.getByText(/mean temperature:/)).toBeVisible();
  expect(requests).toBe(1);
  await page.getByLabel("Location", { exact: true }).selectOption("2");
  await page.route("https://power.larc.nasa.gov/api/**", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page
    .getByRole("button", { name: "Load regional climate averages" })
    .click();
  await expect(
    page.getByText(/Could not load regional climate averages/),
  ).toBeVisible();
});
test("manual negative coordinates are editable and zones are explicit", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Latitude", { exact: true }).fill("-33.8688");
  await page.getByLabel("Longitude", { exact: true }).fill("151.21");
  await page.getByLabel("Location time zone").fill("Australia/Sydney");
  await page.getByLabel("Location time zone").press("Tab");
  await expect(
    page.getByText("Australia/Sydney ·", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Location", exact: true }),
  ).toHaveValue("-1");
});
test("accessible planner has no serious WCAG violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
test("polar nights, southern seasons and storage work", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Location", { exact: true }).selectOption("3");
  await page.getByRole("button", { name: /Summer ↗/ }).click();
  await expect(page.getByLabel("Date", { exact: true })).toHaveValue(/12-21$/);
  await page
    .getByRole("button", { name: "Save in this browser", exact: true })
    .click();
  await page.getByRole("button", { name: "N", exact: true }).click();
  await page.getByRole("button", { name: "Load saved settings" }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Exact bearing" }),
  ).toHaveValue("225");
  await page.getByLabel("Location", { exact: true }).selectOption("5");
  await page.getByRole("button", { name: /Winter ↗/ }).click();
  await expect(
    page.getByText("No qualifying sunlight", { exact: true }),
  ).toBeVisible();
});
test("planner responds to inputs and location stays opt-in", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Find your place in the sun." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "E", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Exact bearing" }),
  ).toHaveValue("90");
  await page.getByRole("slider", { name: "Time of day" }).fill("900");
  await expect(page.getByRole("img", { name: /Sun azimuth/ })).toBeVisible();
  await page.getByRole("button", { name: /Summer ↗/ }).click();
  await expect(page.getByLabel("Date", { exact: true })).toHaveValue(/06-21$/);
});
for (const width of [320, 390, 768, 1440])
  test(`layout ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/sunside-${width}.png`,
      fullPage: true,
    });
  });
