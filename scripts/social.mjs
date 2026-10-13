import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(
  "<style>body{margin:0}</style>" + readFileSync("public/social.svg", "utf8"),
);
await page.screenshot({ path: "public/social.png" });
await browser.close();
