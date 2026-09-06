# RailSystemXplr

US Railroad Network Explorer — mission-style ops map for Class I freight, short lines, Amtrak, and city transit (NYC subway, Metra, SEPTA, etc.).

**GitHub user:** `jasonsaro-ops` · **Repo:** `RailSystemXplr`

## What’s in this repo

| Path | Description |
|------|-------------|
| **Root** (`index.html`, `css/`, `js/`) | **Static Leaflet app** — open or deploy to GitHub Pages with no build step |
| **`typescript-app/`** | Vite + React + TypeScript + MapLibre redesign (PowerGrid-style caching, NTM city presets) |

## Quick start (GitHub Pages — static)

1. Create repo **RailSystemXplr** under `jasonsaro-ops`.
2. Upload **all files from this package** to the repo root (not inside an extra folder).
3. **Settings → Pages → Deploy from branch** `main` / `/ (root)`.
4. Site URL: `https://jasonsaro-ops.github.io/RailSystemXplr/`

Or with git:

```bash
unzip RailSystemXplr-github.zip
cd RailSystemXplr-github   # or rename folder to RailSystemXplr
git init
git add .
git commit -m "Initial RailSystemXplr"
git branch -M main
git remote add origin https://github.com/jasonsaro-ops/RailSystemXplr.git
git push -u origin main
```

## TypeScript app (optional)

```bash
cd typescript-app
npm install
npm run dev      # local
npm run build    # output in typescript-app/dist
```

`vite.config.ts` uses `base: '/RailSystemXplr/'` for Pages if you later publish the built `dist/` instead of the static root.

## Features

- Class I freight layers (BNSF, UP, CSX, NS, CN, CPKC) + full NARN
- National Transit Map — subway / light rail / commuter / bus
- **Major city presets** (NYC, Chicago, Philly, Boston, DC, SF, LA, …)
- Amtrak stations + live Amtrak-family trains (Amtraker)
- Yards, grade crossings, nodes, bridges, mileposts
- Live railcams (YouTube embeds)
- Search, state focus, **Reset filters**
- Dark Ops basemap (Esri) — no API key

## Data sources (public)

BTS/FRA NTAD (NARN, yards, crossings, bridges, mileposts, Amtrak stations), BTS National Transit Map (GTFS), Amtraker. Private railroad wayside devices and live freight positions are not published as open GIS.

## License

Public domain government data layers as provided by BTS/FRA. App code provided for use in your GitHub project.
