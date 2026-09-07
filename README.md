# RailSystemXplr

US railroad + transit explorer for GitHub Pages.

**Repo:** `jasonsaro-ops/RailSystemXplr`

## Deploy (static — no build)

Upload this package **to the repo root** so `index.html` is at `/`.

Settings → Pages → branch `main` → `/ (root)`.

https://jasonsaro-ops.github.io/RailSystemXplr/

## City transit

Left panel → **Major city transit** → e.g. New York City.

That zooms the map and **plots**:
- Transit routes (subway / light rail / commuter) from BTS National Transit Map
- Transit stops
- Passenger rail lines (NARN)
- Class I + local freight rails in view
- Amtrak stations

## Layers

Freight Class I (BNSF, UP, CSX, NS, CN, CPKC), short lines, passenger/Amtrak, NTM transit, yards, crossings, bridges, mileposts, live trains, railcams.

## Optional TypeScript app

See `typescript-app/` — `npm install && npm run dev`.


## Live tracking limits

- **Passenger (Amtrak / Brightline / Via):** Amtraker public API, ~2 min refresh.
- **Class I freight (BNSF, UP, CSX, NS, CN, CPKC):** No public live GPS feed. TrainMon and similar enthusiast sites do not publish an open API for Class I positions. Carriers treat movements as proprietary. This app shows **system maps** (FRA/BTS NARN) for those railroads, not live freight dots.
- Soft-refresh: click the **RAILSYSTEMXPLR** logo or the refresh button.

## Performance model (PowerGrid-style)

Rather than shipping 50 large static GeoJSON files (tens of MB+), rails load **by region**:

- **State focus** → server filter `STATEAB='XX'` + viewport (same idea as a per-state file, live from FRA/BTS)
- **National low zoom** → Class I system map with geometry simplification
- **Local zoom** → full NARN in the map envelope
- **OBJECTID cache** keeps features while panning (like PowerGrid)

This stays fast on GitHub Pages without a huge static asset pack.


## TrainMon5 / CTC

TrainMon5 displays schematic CTC layouts fed by ATCSMonitor community servers. There is **no public HTTP API** for live occupancy we can embed on GitHub Pages. This dashboard uses FRA/BTS NARN for track topology and Amtraker for passenger GPS. Links to TrainMon5 layouts can be added as external references only.


## OpenRailwayMap

Optional overlays from [OpenRailwayMap](https://www.openrailwaymap.org/) (OpenStreetMap railway data):

- **Infrastructure** — tracks, bridges, tunnels, main/yard/spur, stations, switches
- **Max speeds** — line speed coloring
- **Signalling** — signals & train protection
- **Electrification** — catenary / electrified lines
- **Gauge** — track gauge

Tiles: `https://tiles.openrailwaymap.org/{style}/{z}/{x}/{y}.png`  
Attribution: © OpenStreetMap contributors · OpenRailwayMap (CC-BY-SA)

These are **raster overlays** (same data ORM uses). Clickable FRA/BTS NARN ownership metadata remains on the vector rail layer.
