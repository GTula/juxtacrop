# juxtacrop

Decision-support tool that helps farmers **explore crop-rotation strategies** that protect soil health and adapt to changing weather and water conditions. It combines NASA Earth observations, FAO crop suitability, crop traits and the farmer's own history, priorities and constraints, and compares the **current rotation with at least three alternatives** — explaining why each was suggested, the evidence behind it, its possible benefits, information gaps and risks that need local review.

> A supportive tool: it highlights patterns and options; it does not replace farmer judgment or local agronomic expertise. It makes **no yield or profit predictions**.

Built for the NASA Space Apps Challenge 2026 — *Field Shift: Adapting Farms with NASA Data*.

## Run it

The whole site is static and lives in `web/`. Locally it only needs Python 3 (no packages) and an Internet connection.

```bash
python server.py
```

- `http://localhost:8000/` — public juxtacrop website
- `http://localhost:8000/demo/` — interactive MVP
- `http://localhost:8000/demo/#iowa` — fictional sample farm, Story County, Iowa (corn–soybean)
- `http://localhost:8000/demo/#uruguay` — fictional sample farm, Río Negro, Uruguay (soybean–wheat)

Every data source is called directly from the browser (results are cached in `localStorage` per location), so there is no backend. `server.py` is only a local preview server for `web/`.

## Guided demo

The first visit to `/demo/` offers a guided tour in English. Choose a sample farm
(Iowa or Uruguay), set up your own field, or dismiss the invitation. Use
the yellow **Guided tour** button beside the logo to open it again. An interrupted tour can be
resumed in the same page session, or restarted by choosing a route again.

The guide waits for real actions: drawing a field and creating plots when
needed, confirming history, selecting an alternative, opening its evidence,
and changing a crop. Reading steps use **Next**. **Back**, **Close**, and Escape
are available; leaving the guide keeps the current field. Loading a sample over
an existing field asks before replacing it. The invitation preference is stored
in this browser; field and tour progress are not saved across reloads.

On small screens the guide scrolls the relevant controls into view and keeps
its card below dialogs. Unknown crop history is reconstructed with the demo's
existing simulation and remains labelled as estimated. Source failures offer a
retry in steps that need rotation data.

Run `npm test` and `npm run check` from `web/` for the controller regression tests
and static checks. The tour controller is in `web/demo/js/tour.js` and its visual
styles are in `web/demo/css/tour.css`.

## Publish it

[juxtacrop.earth](https://juxtacrop.earth/) is deployed by Vercel on every push to `main`. `vercel.json` tells it to run the checks in `web/` and publish the `web/` folder (no install step, no framework).

Any other static host works too (Netlify, Cloudflare Pages, GitHub Pages…): publish `web/` as is. All links are relative, so it also works under a sub-path such as `user.github.io/juxtacrop/`; `web/.nojekyll` keeps GitHub Pages from filtering files.

## Flow

1. **Location** – search (OpenStreetMap Nominatim), coordinates or GPS. All NASA/FAO data load for that point.
2. **Field** – outline the boundary on Esri imagery. Elevation (Copernicus DEM) is sampled on a 10×10 grid → slope and low spots.
3. **Plots** – draw management units or split automatically; each gets its own slope.
4. **History** – crops of the last 6 seasons (3 summers + 3 winters) and drainage → the *current rotation*. Seasons left as “I don’t know” are reconstructed from satellite history (simulated in this prototype) and flagged as estimates.
5. **Priorities & constraints** – soil organic matter, water, erosion, nitrogen, pest cycles, income/forage; irrigation, equipment, livestock.
6. **Compare** – current rotation vs. 3 generated strategies + an editable *My plan* (drag crops from the catalog). Optional *what-if* sliders shift rainfall and temperature (clearly labelled as hypotheses).

## Data sources and how they are used

| Source | Access | Used for |
|---|---|---|
| **NASA POWER** (climatology, daily T max/min) | POWER API | Monthly temperature, frost days (Tmin ≤ 0 °C), hot days (Tmax ≥ 35 °C), evapotranspiration, temperature trend → **sowing calendar** (frost-free season, when summer/winter crops can be sown) and frost/heat risk per crop |
| **NASA GPM IMERG** | POWER daily API (`IMERG_PRECTOT`, 2001→) | Monthly rain climatology, last-12-month anomaly, heavy-rain days (≥ 50 mm), rain trend → **rain on bare soil**, rain vs. crop water use, waterlogging risk |
| **NASA SMAP L4** root-zone soil moisture | GIBS tiles, value decoded from the official color map, 15th of every month since 2015 | Typical driest months, drought-prone months, recent anomaly → water-risk evidence, cover-crop water-use warnings; map overlay |
| **NASA MODIS NDVI** (monthly) | GIBS tiles, decoded, last 10 years | Months when the land is typically bare (NDVI < 0.4) → evidence for cover crops; map overlay |
| **Copernicus DEM** GLO-90 | Open-Meteo elevation API (CORS-enabled, no key) | Slope per plot, low spots → RUSLE slope factor for **erosion exposure**, waterlogging risk; slope overlay |
| **FAO GAEZ v4** | GAEZ ImageServer `identify` per crop | Suitability index (rainfed, high input) 1981–2010 and 2041–2070 (RCP 4.5 ensemble) → filters candidate crops, flags declining suitability |
| Agronomic literature (SARE, FAO, extension) | `js/data.js` | Qualitative crop traits: water use, rooting depth, N fixation, residue, cover, tolerances, pest host group |
| Farmer | UI | Field, plots, history, drainage, priorities, constraints |

## How the engine works (`js/engine.js`)

1. **Conditions** – raw data → monthly climate, frost/heat/heavy-rain days, soil-moisture and greenness climatologies, trends, and a sowing calendar (summer crops when mean temperature ≥ 15 °C and < 1 frost day; winter crops when it drops ≤ 16 °C; hard winters if the coldest month < −2 °C).
2. **Schedule** – a 3-year rotation (6 seasons) is placed on a 36-month calendar: sowing windows, growth length counted in months above each crop's base temperature, winter dormancy, winter-kill of non-hardy crops, cover crops that end when the next crop is sown, perennials, late or infeasible double-crops, frost-free fit.
3. **Indicators** – living-cover months, rain on bare soil (IMERG), erosion exposure (rain on bare soil × RUSLE slope factor from the elevation model), crop water use and rain shortfall during each crop cycle, legume nitrogen, organic-matter inputs, same-host crops in a row, plant families, harvests, GAEZ suitability, plus frost/heat/waterlogging/timing/equipment risks.
4. **Suggestions** – templates (current crops + cover crops, diversified 3-family rotation, water-wise rotation, perennial forage phase) are filled with crops that pass GAEZ/irrigation/equipment/season checks, repaired if infeasible, compared with the current rotation and ranked by the farmer's priority weights. Each comes with *why*, *evidence* (with source tags), *benefits*, *information gaps* and *risks to review locally*.

## Limits

- Climate, rain and soil-moisture data are regional (≈ 9–50 km); they describe the area, not the individual plot.
- SMAP and MODIS values are decoded from GIBS visualisation tiles (quantised color scales), not from the science files.
- Crop traits are typical values; indicators compare inputs and exposure, not measured soil health.
- No soil test, market or price data are used.
- The 90 m elevation model is coarse for small fields; slope is indicative.
- Crop-history reconstruction from satellite imagery is simulated (mock loader and plausible crops).

## Structure

- `web/` – the whole static site: scroll-driven presentation website at `/`
- `web/demo/index.html`, `web/demo/css/styles.css` – interactive MVP UI at `/demo/`
- `web/demo/js/data.js` – crop knowledge base, priorities, source catalogue
- `web/demo/js/sources.js` – live data access (POWER, IMERG, GIBS decoding, GAEZ, elevation)
- `web/demo/js/engine.js` – conditions, scheduling, indicators, suggestions
- `web/demo/js/app.js` – map, drawing, panels, comparison view
- `server.py` – local preview server for `web/`
