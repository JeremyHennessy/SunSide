import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const run = Math.floor((Date.now() - 6 * 3600000) / 3600000) * 3600000;
function capabilities(layer: string) {
  return `<WMS_Capabilities xmlns="http://www.opengis.net/wms"><Capability><Layer><Layer><Name>${layer}</Name><EX_GeographicBoundingBox><westBoundLongitude>-180</westBoundLongitude><eastBoundLongitude>180</eastBoundLongitude><southBoundLatitude>-90</southBoundLatitude><northBoundLatitude>90</northBoundLatitude></EX_GeographicBoundingBox><Dimension name="time">${new Date(run - 24 * 3600000).toISOString()}/${new Date(run + 10 * 86400000).toISOString()}/PT1H</Dimension><Dimension name="reference_time" default="${new Date(run).toISOString()}"/></Layer></Layer></Capability></WMS_Capabilities>`;
}
test("clouds are opt-in, preserve geometric hours and show related models honestly", async ({
  page,
}) => {
  let requests = 0,
    active = 0,
    maxActive = 0;
  await page.route("https://geo.weather.gc.ca/geomet?**", async (route) => {
    requests++;
    const q = new URL(route.request().url()).searchParams;
    const layer = q.get("LAYERS")!;
    if (q.get("REQUEST") === "GetCapabilities") {
      await route.fulfill({
        contentType: "application/xml",
        body: capabilities(layer),
      });
      return;
    }
    expect(q.get("BBOX")).not.toContain("44.6488");
    expect(q.get("DIM_REFERENCE_TIME")).toBe(
      new Date(run).toISOString().replace(".000Z", "Z"),
    );
    const member = layer.startsWith("REPS.")
      ? Number(layer.split(".").pop())
      : 0;
    const value =
      member === 21
        ? null
        : member
          ? member * 4
          : layer.startsWith("GDPS")
            ? 20
            : layer.startsWith("RDPS")
              ? 60
              : 80;
    active++;
    maxActive = Math.max(active, maxActive);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await route.fulfill({
      json: {
        layer,
        features: [
          {
            geometry: { coordinates: [-63.6, 44.7] },
            properties: {
              value,
              time: q.get("TIME"),
              dim_reference_time: q.get("DIM_REFERENCE_TIME"),
            },
          },
        ],
      },
    });
    active--;
  });
  await page.goto("/");
  expect(requests).toBe(0);
  const hours = await page.locator(".stats").innerText();
  await page
    .getByRole("button", { name: "Load cloud forecasts", exact: true })
    .click();
  await expect(
    page.getByText("≈ 53% cloud cover", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/3 products · 1 forecast family/)).toBeVisible();
  expect(await page.locator(".stats").innerText()).toBe(hours);
  expect(requests).toBe(6);
  await page.getByRole("button", { name: "Compare regional ensemble" }).click();
  await expect(
    page.getByText("20 of 21 members · 4–80% cloud cover", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Some members are missing/)).toBeVisible();
  expect(maxActive).toBeLessThanOrEqual(3);
  expect(requests).toBe(28);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .locator(".cloud-section")
      .screenshot({ path: `test-results/cloud-${width}.png` });
  }
  const before = requests;
  await page.getByRole("slider", { name: "Time of day" }).fill("840");
  await expect(
    page.getByRole("button", { name: "Load cloud forecasts", exact: true }),
  ).toBeVisible();
  expect(requests).toBe(before);
  await page.getByLabel("Date", { exact: true }).fill("2030-01-01");
  await page
    .getByRole("button", { name: "Load cloud forecasts", exact: true })
    .click();
  await expect(
    page.getByText(/No fresh cloud forecast available/),
  ).toBeVisible();
  await expect(
    page.getByText("≈ 53% cloud cover", { exact: true }),
  ).toHaveCount(0);
});
test("NWS opaque sky is separate from total cloud and invalid ECCC data is excluded", async ({
  page,
}) => {
  await page.route("https://geo.weather.gc.ca/geomet?**", async (route) => {
    const q = new URL(route.request().url()).searchParams,
      layer = q.get("LAYERS")!;
    if (q.get("REQUEST") === "GetCapabilities")
      await route.fulfill({
        contentType: "application/xml",
        body: capabilities(layer),
      });
    else
      await route.fulfill({
        json: {
          layer,
          features: [
            {
              properties: {
                value: layer.startsWith("HRDPS") ? null : 20,
                time: q.get("TIME"),
                dim_reference_time: q.get("DIM_REFERENCE_TIME"),
              },
            },
          ],
        },
      });
  });
  await page.route("https://api.weather.gov/**", async (route) => {
    if (route.request().url().includes("/points/"))
      await route.fulfill({
        json: {
          properties: {
            forecastGridData: "https://api.weather.gov/gridpoints/OKX/33,37",
          },
        },
      });
    else
      await route.fulfill({
        json: {
          properties: {
            updateTime: new Date(run).toISOString(),
            skyCover: {
              uom: "wmoUnit:percent",
              values: [
                {
                  validTime: `${new Date(run - 86400000).toISOString()}/P10D`,
                  value: 80,
                },
              ],
            },
          },
        },
      });
  });
  await page.goto("/");
  await page.getByLabel("Location", { exact: true }).selectOption("1");
  await page
    .getByRole("button", { name: "Load cloud forecasts", exact: true })
    .click();
  await expect(
    page.getByText("≈ 20% cloud cover", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/2 products · 1 forecast family/)).toBeVisible();
  await expect(
    page.getByText(/Unavailable, outside coverage, or too old: HRDPS/),
  ).toBeVisible();
});
test("cloud outage does not break solar planning", async ({ page }) => {
  await page.route("https://geo.weather.gc.ca/**", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load cloud forecasts", exact: true })
    .click();
  await expect(
    page.getByText(/No fresh cloud forecast available/),
  ).toBeVisible();
  await page.getByRole("button", { name: "E", exact: true }).click();
  await expect(page.locator(".stats")).toContainText("Potential direct sun");
});
