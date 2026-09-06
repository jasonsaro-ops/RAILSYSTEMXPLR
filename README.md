# RailSystemXplr — US Railroad Network Explorer

Professional, professional railroad network explorer for the **United States railroad network**.

Built for GitHub Pages hosting under `jasonsaro-ops`.

## Features

- **Full national rail network** from the official FRA / BTS **North American Rail Network (NARN)**
- **Layer controls** for every major Class I railroad:
  - BNSF · Union Pacific · CSX · Norfolk Southern · Canadian National · CPKC
  - Amtrak / passenger · Class II / III / shortlines
- **Infrastructure layers** (on-demand): rail yards, grade crossings, network nodes
- **Near-real-time passenger trains** (Amtrak, Brightline, Via Rail) via the public Amtraker API
- Auto-refresh every **2 minutes**
- Click any rail segment or train → floating metadata window
- Global search (train number / route name)
- State focus filter + fly-to
- Dark ops basemap (no API key), street-level OSM, and satellite
- Fully static — works on GitHub Pages

## Important data notes

| Data | Source | Real-time? |
|------|--------|------------|
| Rail lines, ownership, trackage rights, passenger flag, STRACNET | FRA / BTS NARN | Static (updated by FRA) |
| Rail yards, grade crossings, nodes | FRA / BTS NTAD | Static |
| Amtrak / Brightline / Via train positions | Amtraker community API | Near real-time (~minutes) |
| Freight train positions (BNSF, NS, CSX, UP, etc.) | **Not publicly available** | Proprietary |

Speed restrictions, live track cameras, and precise out-of-service status are not published in open federal feeds at national scale. The dashboard surfaces every attribute the NARN provides.

## Quick start (local)

```bash
# any static server
npx serve .
# or
python -m http.server 8080
```

Open `http://localhost:8080`.

## Deploy to GitHub Pages

1. Create a new repository (e.g. `RailSystemXplr`) under **jasonsaro-ops**.
2. Push the contents of this folder to the `main` branch (or `gh-pages`).
3. In repo Settings → Pages → Source: Deploy from branch → `main` / root (or `/docs` if you prefer).
4. Site will be live at `https://jasonsaro-ops.github.io/RailSystemXplr/`.

```bash
git init
git add .
git commit -m "Initial RailSystemXplr dashboard"
git branch -M main
git remote add origin https://github.com/jasonsaro-ops/RailSystemXplr.git
git push -u origin main
```

## Architecture

- Pure HTML / CSS / vanilla JS + Leaflet
- No build step, no API keys required for core function
- Viewport-driven queries against ArcGIS FeatureServer (max ~2000 features per request)
- PreferCanvas rendering for dense rail geometry

## Attribution

- North American Rail Network: Federal Railroad Administration & Bureau of Transportation Statistics (public domain U.S. Government work)
- Train positions: [Amtraker](https://amtraker.com) (community project — please attribute)
- Basemaps: OpenStreetMap, CARTO, Esri

## Roadmap ideas (future)

- Vector tile or PMTiles version of NARN for nationwide smooth zoom
- GTFS-RT integration for additional commuter systems
- Saved views / bookmark presets for EOC consoles
- Optional paid freight AIS-style feeds if a commercial key is supplied

---

**Not an official FRA or railroad system.** For operational decision-making always verify with primary railroad or FRA sources.
