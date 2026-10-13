import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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
