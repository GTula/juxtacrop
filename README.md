# juxtacrop

Decision-support tool that helps farmers **explore crop-rotation strategies** that protect soil health and adapt to changing weather and water conditions. It combines NASA Earth observations, FAO crop suitability, crop traits and the farmer's own history, priorities and constraints, and compares the **current rotation with at least three alternatives** — explaining why each was suggested, the evidence behind it, its possible benefits, information gaps and risks that need local review.

> A supportive tool: it highlights patterns and options; it does not replace farmer judgment or local agronomic expertise. It makes **no yield or profit predictions**.

Built for the NASA Space Apps Challenge 2026 — *Field Shift: Adapting Farms with NASA Data*.

## Run it

Requires Python 3 (no packages) and an Internet connection.

```bash
python server.py
```

- `http://localhost:8000/` — public juxtacrop website
- `http://localhost:8000/demo/` — interactive MVP
- `http://localhost:8000/demo/#iowa` — fictional sample farm, Story County, Iowa (corn–soybean)
- `http://localhost:8000/demo/#uruguay` — fictional sample farm, Río Negro, Uruguay (soybean–wheat)

`server.py` serves the website from `web/`, mounts the MVP at `/demo/`, and proxies the SRTM elevation API (OpenTopoData has no CORS). Every other source is called directly from the browser; results are cached in `localStorage` per location.

## Flow

1. **Location** – search (OpenStreetMap Nominatim), coordinates or GPS. All NASA/FAO data load for that point.
2. **Field** – outline the boundary on Esri / **Sentinel-2** / **Landsat** imagery. SRTM elevation is sampled on a 10×10 grid → slope and low spots.
3. **Plots** – draw management units or split automatically; each gets its own slope.
4. **History** – crops of the last 6 seasons (3 summers + 3 winters) and drainage → the *current rotation*.
5. **Priorities & constraints** – soil organic matter, water, erosion, nitrogen, pest cycles, income/forage; irrigation, equipment, livestock.
6. **Compare** – current rotation vs. 3 generated strategies + an editable *My plan* (drag crops from the catalog). Optional *what-if* sliders shift rainfall and temperature (clearly labelled as hypotheses).

## Data sources and how they are used

| Source | Access | Used for |
|---|---|---|
| **NASA POWER** (climatology, daily T max/min) | POWER API | Monthly temperature, frost days (Tmin ≤ 0 °C), hot days (Tmax ≥ 35 °C), evapotranspiration, temperature trend → **sowing calendar** (frost-free season, when summer/winter crops can be sown) and frost/heat risk per crop |
| **NASA GPM IMERG** | POWER daily API (`IMERG_PRECTOT`, 2001→) | Monthly rain climatology, last-12-month anomaly, heavy-rain days (≥ 50 mm), rain trend → **rain on bare soil**, rain vs. crop water use, waterlogging risk |
| **NASA SMAP L4** root-zone soil moisture | GIBS tiles, value decoded from the official color map, 15th of every month since 2015 | Typical driest months, drought-prone months, recent anomaly → water-risk evidence, cover-crop water-use warnings; map overlay |
| **NASA MODIS NDVI** (monthly) | GIBS tiles, decoded, last 10 years | Months when the land is typically bare (NDVI < 0.4) → evidence for cover crops; map overlay |
| **NASA/USGS Landsat** | GIBS WELD annual composites (1983–2000) + least-cloudy Landsat 8/9 scene per season (Esri Living Atlas, 2013→) | Visual history of the field |
| **Sentinel-2** cloudless 2023 (EOX) | WMTS tiles | 10 m imagery to recognise and outline the field |
| **NASA SRTM** 30 m | OpenTopoData via `server.py` | Slope per plot, low spots → RUSLE slope factor for **erosion exposure**, waterlogging risk; slope overlay |
| **FAO GAEZ v4** | GAEZ ImageServer `identify` per crop | Suitability index (rainfed, high input) 1981–2010 and 2041–2070 (RCP 4.5 ensemble) → filters candidate crops, flags declining suitability |
| Agronomic literature (SARE, FAO, extension) | `js/data.js` | Qualitative crop traits: water use, rooting depth, N fixation, residue, cover, tolerances, pest host group |
| Farmer | UI | Field, plots, history, drainage, priorities, constraints |

## How the engine works (`js/engine.js`)

1. **Conditions** – raw data → monthly climate, frost/heat/heavy-rain days, soil-moisture and greenness climatologies, trends, and a sowing calendar (summer crops when mean temperature ≥ 15 °C and < 1 frost day; winter crops when it drops ≤ 16 °C; hard winters if the coldest month < −2 °C).
2. **Schedule** – a 3-year rotation (6 seasons) is placed on a 36-month calendar: sowing windows, growth length counted in months above each crop's base temperature, winter dormancy, winter-kill of non-hardy crops, cover crops that end when the next crop is sown, perennials, late or infeasible double-crops, frost-free fit.
3. **Indicators** – living-cover months, rain on bare soil (IMERG), erosion exposure (rain on bare soil × RUSLE slope factor from SRTM), crop water use and rain shortfall during each crop cycle, legume nitrogen, organic-matter inputs, same-host crops in a row, plant families, harvests, GAEZ suitability, plus frost/heat/waterlogging/timing/equipment risks.
4. **Suggestions** – templates (current crops + cover crops, diversified 3-family rotation, water-wise rotation, perennial forage phase) are filled with crops that pass GAEZ/irrigation/equipment/season checks, repaired if infeasible, compared with the current rotation and ranked by the farmer's priority weights. Each comes with *why*, *evidence* (with source tags), *benefits*, *information gaps* and *risks to review locally*.

## Limits

- Climate, rain and soil-moisture data are regional (≈ 9–50 km); they describe the area, not the individual plot.
- SMAP and MODIS values are decoded from GIBS visualisation tiles (quantised color scales), not from the science files.
- Crop traits are typical values; indicators compare inputs and exposure, not measured soil health.
- No soil test, market or price data are used.

## Structure

- `web/` – public, scroll-driven presentation website
- `index.html`, `css/styles.css` – interactive MVP UI (mounted at `/demo/`)
- `js/data.js` – crop knowledge base, priorities, source catalogue
- `js/sources.js` – live data access (POWER, IMERG, GIBS decoding, GAEZ, SRTM, Landsat)
- `js/engine.js` – conditions, scheduling, indicators, suggestions
- `js/app.js` – map, drawing, panels, comparison view
- `server.py` – static server + SRTM proxy
