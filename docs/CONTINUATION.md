# SunSide authoritative handoff

## Product and implementation

Free consumer sunlight planner with organic-discovery potential; no accounts, subscriptions, paid APIs or backend. React/TypeScript/Vite, SunCalc 2.1.1, Temporal polyfill. Location presets across hemispheres, manual coordinates, opt-in geolocation, user-selected IANA zone, eight directions/exact bearing, date, time playback, calculated SVG sky plot, five-minute intervals, daylight and seasonal comparisons. Explicit save/load/delete browser storage. Actual exposure is not known.

## Calculation conventions and limitations

Degrees clockwise from true north; apparent altitude includes SunCalc refraction. UTC timestamps. Apparent center altitude >0° defines daylight; this differs from sunrise/sunset upper-limb definitions. Outward-facing half-space plus uniform horizon threshold defines potential direct sun. Five-minute midpoint sampling; approximate boundaries, narrow intervals may be missed. Multiple intervals are retained. No sector obstructions, architecture dimensions, automatic zone lookup, geocoder or real building shadows. Representative season dates are approximate. Civil days use the explicit IANA zone and DST; users must confirm zones for manual/device coordinates. Engine is independent from UI in `src/solar/engine.ts`.

## Verification

16 model tests pass: published NREL SPA example (39.742476N, −105.1786E, 2003-10-17T19:30:30Z; expected azimuth 194.34024°, altitude 39.88838°, tolerance 0.5°); bearing wrap, night, obstruction, cardinal SVG mapping, multiple intervals, Halifax DST, Kiritimati date line, Singapore non-DST, polar day/night, six locations × four dates × four bearings. Cross-location tests are invariant checks, not independent numerical references. More independent reference fixtures are still needed.

Five Chromium tests pass: control interaction plus no-overflow screenshots at 320/390/768/1440. All four actual full-page screenshots inspected. Build/typecheck pass; JS gzip about 111KB. Dependency audit after Vitest 5.0.4 upgrade reports zero vulnerabilities. Accessibility uses semantic controls, keyboard focus and SVG text alternative; a complete automated accessibility/performance audit is still pending.

## Source and deployment

Initial repository was verified public and empty by Git clone and GitHub connection. Bootstrap directly to main is authorized. Cloudflare project `sunside` created separately, Git integration verified against SunSide repo ID 1416342098, main production and all previews. Assigned hostname: https://sunside-3g7.pages.dev. Build command npm run build, output dist, Node 22.16.0. Production deployment and GitHub Actions evidence pending first push. Main SHA will be recorded after push; documentation cannot contain its own commit hash.

## Commercial readiness

Home metadata and original explanatory content implemented. Search-intent research found existing balcony/window planners and apartment-exposure tools; no volume or revenue estimates are asserted. Differentiation: clear assumptions, hemispheres and explicit zone handling. Standalone indexable guide/privacy/terms pages, sitemap, canonical/social metadata and publisher readiness still need finishing. No ads, tracking, affiliate links, earnings or approvals. Future experiments: useful directional guides, apartment comparison, relevant disclosed affiliate placements after audience evidence.

## Next three priorities

1. Expand independent numerical fixtures across all reference locations; full accessibility and mobile browser audit.
2. Finish static guide/legal pages, metadata/social assets and search-indexing foundations.
3. Validate demand with user feedback, then add measured obstruction sectors and apartment comparison before any monetization.
