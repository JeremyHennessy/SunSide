# SunSide

Know your sunny side. Free browser-based potential sunlight planning for balconies, windows and patios.

## Develop

Use Node 22.12+ (Node 24 recommended). `npm run lint` checks source formatting; typecheck verifies TypeScript. Build regenerates the static guides from `scripts/content.mjs`.

```sh
npm ci
npm run dev
npm test
npm run test:browser
npm run build
```

Install Chromium once with `npx playwright install chromium`. Browser tests capture 320, 390, 768 and 1440px screenshots. `TEST_URL` runs them against a deployed site. Build output is `dist`.

## Model

SunCalc **2.1.1** supplies apparent solar altitude and azimuth in degrees clockwise from true north. UTC instants are passed directly. Potential sun requires altitude above the user-supplied uniform horizon and an azimuth within 90° of the outward facing bearing. Optional measured walls can block rays to a patio point. It does not model light penetrating rooms, balcony floors, unmeasured buildings, trees or weather. Daylight means apparent sun center above 0°, not the standard upper-limb sunrise event at approximately −0.833° geometric altitude.

Exposure uses midpoint classification of five-minute bins. Boundaries are estimates, generally within one bin for simple crossings; very short intervals can be missed. Do not interpret the results as minute-level measurements. Temporal creates IANA-zone local-day boundaries, including 23/25-hour DST days. Manual coordinates and geolocation require the user to confirm the selected location zone. No reverse geocoder is used.

SunCalc BSD attribution is distributed in `public/suncalc-license.txt`. Calculation sources: [SunCalc](https://github.com/mourner/suncalc), [NOAA details](https://gml.noaa.gov/grad/solcalc/calcdetails.html), [NREL SPA published example](https://www.nrel.gov/docs/fy08osti/34302.pdf). NOAA's calculator is no longer actively maintained; it is a reference, not a service dependency.

## Hosting

Separate Cloudflare Pages project `sunside`, GitHub `JeremyHennessy/SunSide`, production branch `main`, build `npm run build`, output `dist`, Node 22.16.0. Public application: https://sunside-3g7.pages.dev/. Git integration is configured, but automatic push triggers have not fired during verification; deployments currently succeed using the Cloudflare API to build the chosen Git branch. No custom domain or paid service is configured. See `docs/CONTINUATION.md` for exact release evidence and priorities.

## Patio shadows and climate

Open-patio mode accepts sun from every bearing. Up to five user-measured vertical rectangular walls can block rays to a single patio point; supply bearing, near-wall distance, width, top height and patio height above a shared level-ground datum. No dimensions are guessed. No automatic building lookup, building depth, roofs, trees or terrain are modeled. The diagram projects these measured walls using the calculated sun position; it is not a mapped building footprint.

Optional NASA POWER monthly mean air temperatures load only on request, with coordinates rounded to 0.5° latitude and 0.625° longitude. Requests go directly to NASA; results stay in a bounded memory cache. NASA POWER/MERRA-2 regional climatology is not a current forecast or patio thermometer. The provider period is displayed from the response. No paid weather API, tracking or multi-provider averaging is used.

