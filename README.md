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
