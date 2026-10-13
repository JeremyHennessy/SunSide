# SunSide authoritative handoff

## Product and implementation

Free consumer sunlight planner with organic-discovery potential; no accounts, subscriptions, paid APIs or backend. React/TypeScript/Vite, SunCalc 2.1.1, Temporal polyfill. Location presets across hemispheres, manual coordinates, opt-in geolocation, user-selected IANA zone, eight directions/exact bearing, date, time playback, calculated SVG sky plot, five-minute intervals, daylight and seasonal comparisons. Explicit save/load/delete browser storage. Actual exposure is not known.

## Calculation conventions and limitations

Degrees clockwise from true north; apparent altitude includes SunCalc refraction. UTC timestamps. Apparent center altitude >0° defines daylight; this differs from sunrise/sunset upper-limb definitions. Outward-facing half-space plus uniform horizon threshold defines potential direct sun. Five-minute midpoint sampling; approximate boundaries, narrow intervals may be missed. Multiple intervals are retained. No sector obstructions, architecture dimensions, automatic zone lookup, geocoder or real building shadows. Representative season dates are approximate. Civil days use the explicit IANA zone and DST; users must confirm zones for manual/device coordinates. Engine is independent from UI in `src/solar/engine.ts`.

## Verification

40 model tests pass: published NREL SPA example (39.742476N, −105.1786E, 2003-10-17T19:30:30Z; expected azimuth 194.34024°, altitude 39.88838°, tolerance 0.5°); 24 independent NOAA low-accuracy equation fixtures covering six locations × four seasonal dates (recorded UTC instants, coordinates, expected angles, 1.5° tolerance and source in tests/noaa-fixtures.json). The separate script scripts/noaa-fixtures.mjs reproduces the NOAA reference and is never used by the app. NOAA fixtures are geometric altitude compared with apparent SunCalc altitude, so this is a broad angular regression, not a sub-degree accuracy guarantee. Also bearing wrap, night, obstruction, cardinal SVG mapping, multiple intervals, Halifax DST, Kiritimati date line, Singapore non-DST, polar day/night and directional invariants.

Eight Chromium tests pass: control interaction, editable negative coordinates/explicit zone, southern seasons/polar nights/local saving, WCAG 2A/AA/2.1AA axe audit (zero detected violations), plus no-overflow screenshots at 320/390/768/1440. All four actual full-page screenshots inspected. Build/typecheck/format check pass; JS gzip about 111KB. Dependency audit reports zero vulnerabilities. Real-device Safari and a dedicated performance audit are still pending.

## Source and deployment

Initial repository was verified public and empty by Git clone and GitHub connection. Bootstrap main SHA: dc3c2d6411a674e263e4440bba3af7346b26b2a8. GitHub Actions run 38337376392 completed successfully. Cloudflare project `sunside` created separately, Git integration verified against SunSide repo ID 1416342098, main production and all previews. Assigned hostname: https://sunside-3g7.pages.dev. Build command npm run build, output dist, Node 22.16.0. Initial deployment 2d92a48e-84a3-4faa-91ba-5dfb2995b830 succeeded at 2026-10-13T02:33:57Z with the exact bootstrap SHA. It required an API deployment trigger after the first push; automatic push deployment remains to be verified on the release-quality branch. Latest release evidence will be appended after merge. Documentation cannot contain its own commit hash.

## Commercial readiness

Home metadata and original explanatory content implemented. Search-intent research found existing balcony/window planners and apartment-exposure tools; no volume or revenue estimates are asserted. Differentiation: clear assumptions, hemispheres and explicit zone handling. Three static indexable guides, privacy/terms pages, sitemap, canonical/social metadata and share image implemented. Search Console submission/indexing and publisher approval are not verified. No ads, tracking, affiliate links, earnings or approvals. Future experiments: apartment comparison and relevant disclosed affiliate placements after audience evidence.

## Next three priorities

1. Validate on real mobile Safari/Android, measure performance and expand precise SPA reference fixtures near horizon/extreme latitudes.
2. Validate search indexing and collect user feedback without adding tracking prematurely.
3. Add user-measured directional obstructions and apartment comparison before monetization.
