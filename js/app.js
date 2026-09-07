/**
 * RailSystemXplr — US Railroad Network Explorer
 * Public-data powered dashboard for the continental US railroad network.
 */
(function () {
  "use strict";

  // ---------- State ----------
  const state = {
    map: null,
    layers: {
      rails: L.layerGroup(),
      trains: L.layerGroup(),
      yards: L.layerGroup(),
      crossings: L.layerGroup(),
      nodes: L.layerGroup(),
      cameras: L.layerGroup(),
      amtrakStations: L.layerGroup(),
      mileposts: L.layerGroup(),
      bridges: L.layerGroup(),
      transitStops: L.layerGroup(),
      transitRoutes: L.layerGroup(),
      transitSubway: L.layerGroup(),
      transitLightRail: L.layerGroup(),
      transitCommuter: L.layerGroup(),
      transitBus: L.layerGroup(),
      passengerLines: L.layerGroup(),
    },
    useClass1Only: false,
    activeState: null, // two-letter state focus (PowerGrid-style region)
    basemaps: {},
    activeBasemap: "dark",
    railCache: new Map(), // key = feature OBJECTID → layer
    pointCache: { nodes: new Map(), yards: new Map(), crossings: new Map() },
    trainMarkers: new Map(),
    loadedTileKeys: new Set(), // rails viewport keys already fetched
    lastTrainData: null,
    lastRefresh: null,
    queryInFlight: false,
    searchIndex: [], // stations + trains + cities for search
    amtrakStationIndex: [], // nationwide Amtrak stations for search
  };

  // ---------- Init ----------
  function init() {
    initMap();
    initBasemaps();
    initLayerControls();
    initSearch();
    initCityFocus();
    initMetaWindow();
    bindUI();

    // Sync Class I toggle from DOM (default checked)
    const c1 = document.querySelector('input[data-layer="class1only"]');
    if (c1) state.useClass1Only = c1.checked;

    // Initial load
    loadRailsForView();
    loadTrains();
    loadCameras();
    // Default passenger infra
    loadAmtrakStations();
    setInterval(() => { loadTrains(); if (typeof loadRailsForView === "function") loadRailsForView(); }, CONFIG.REFRESH_MS);

    // Re-query rails when map moves significantly
    let moveTimer;
    state.map.on("moveend", () => {
      clearTimeout(moveTimer);
      moveTimer = setTimeout(() => {
        loadRailsForView();
        // Incremental infra loads (stay on map once loaded)
        const y = document.querySelector('input[data-layer="yards"]');
        const c = document.querySelector('input[data-layer="crossings"]');
        const n = document.querySelector('input[data-layer="nodes"]');
        if (y && y.checked) loadYards();
        if (c && c.checked) loadCrossings();
        if (n && n.checked) loadNodes();
        const a = document.querySelector('input[data-layer="amtrakStations"]');
        const mp = document.querySelector('input[data-layer="mileposts"]');
        const br = document.querySelector('input[data-layer="bridges"]');
        const ts = document.querySelector('input[data-layer="transitStops"]');
        const tr = document.querySelector('input[data-layer="transitRoutes"]');
        const pl = document.querySelector('input[data-layer="passengerLines"]');
        if (a && a.checked) loadAmtrakStations();
        if (mp && mp.checked) loadMileposts();
        if (br && br.checked) loadBridges();
        if (ts && ts.checked) loadTransitStops();
        if (tr && tr.checked) loadTransitRoutes();
        // Auto-load rail transit modes if checked (NJT River Line, SEPTA, light rail nationwide)
        else if (
          isLayerChecked("transitLightRail") ||
          isLayerChecked("transitCommuter") ||
          isLayerChecked("transitSubway") ||
          isLayerChecked("transitBus")
        ) {
          loadTransitRoutes();
        }
        if (pl && pl.checked) loadPassengerLines();
      }, 500);
    });

    state.map.on("zoomend", updateZoomLabel);
    state.map.on("mousemove", (e) => {
      document.getElementById("coords").textContent =
        e.latlng.lat.toFixed(4) + ", " + e.latlng.lng.toFixed(4);
    });
    updateZoomLabel();
  }

  function initMap() {
    state.map = L.map("map", {
      center: CONFIG.DEFAULT_CENTER,
      zoom: CONFIG.DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true, // better performance for many lines
    });

    // Mount only checked / core layers (fixes transit stops always-on)
    const layerChecked = (key) => {
      if (key === "rails") return true;
      const el = document.querySelector(`input[data-layer="${key}"]`);
      if (!el) return key === "trains" || key === "cameras";
      return el.checked;
    };
    Object.entries(state.layers).forEach(([key, lg]) => {
      if (lg && layerChecked(key)) lg.addTo(state.map);
    });
  }

  function initBasemaps() {
    // Dark Ops — Esri World Dark Gray (NO API key required)
    state.basemaps.dark = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri — Dark Gray Canvas",
        maxZoom: 16,
      }
    );
    // Dark labels overlay (optional companion)
    state.basemaps.darkLabels = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Esri",
        maxZoom: 16,
        opacity: 0.85,
      }
    );

    // Street — OpenStreetMap (no key)
    state.basemaps.osm = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
        subdomains: "abc",
      }
    );

    // Satellite — Esri World Imagery (no key)
    state.basemaps.satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics",
        maxZoom: 19,
      }
    );

    // Light gray canvas for alternate professional view
    state.basemaps.light = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri — Light Gray Canvas",
        maxZoom: 16,
      }
    );

    state.basemaps.dark.addTo(state.map);
    state.basemaps.darkLabels.addTo(state.map);
    state._darkLabelsOn = true;

    // OpenRailwayMap overlays (transparent nationwide OSM railway styles)
    state.ormLayers = {};
    state.activeOrm = "off";
    if (CONFIG.OPENRAILWAYMAP) {
      const ormAttr = CONFIG.OPENRAILWAYMAP.attribution || "";
      const mz = CONFIG.OPENRAILWAYMAP.maxZoom || 19;
      ["standard", "maxspeed", "signals", "electrification", "gauge"].forEach((style) => {
        const url = CONFIG.OPENRAILWAYMAP[style];
        if (!url) return;
        state.ormLayers[style] = L.tileLayer(url, {
          attribution: ormAttr,
          maxZoom: mz,
          minZoom: 2,
          opacity: 0.95,
          zIndex: 450,
          className: "orm-tiles",
        });
      });
    }
  }

  function setOpenRailwayMap(style) {
    // Remove previous ORM overlay
    if (state.activeOrm && state.activeOrm !== "off" && state.ormLayers[state.activeOrm]) {
      state.map.removeLayer(state.ormLayers[state.activeOrm]);
    }
    state.activeOrm = style || "off";
    if (style && style !== "off" && state.ormLayers[style]) {
      state.ormLayers[style].addTo(state.map);
      toast("OpenRailwayMap · " + style, "success");
    } else {
      toast("OpenRailwayMap off");
    }
  }

  function setBasemap(name) {
    if (state.activeBasemap === name) return;
    // Remove current base + any dark labels
    if (state.basemaps[state.activeBasemap]) {
      state.map.removeLayer(state.basemaps[state.activeBasemap]);
    }
    if (state._darkLabelsOn && state.basemaps.darkLabels) {
      state.map.removeLayer(state.basemaps.darkLabels);
      state._darkLabelsOn = false;
    }
    state.basemaps[name].addTo(state.map);
    if (name === "dark" && state.basemaps.darkLabels) {
      state.basemaps.darkLabels.addTo(state.map);
      state._darkLabelsOn = true;
    }
    state.activeBasemap = name;
  }

  // ---------- Layer controls ----------
  function initLayerControls() {
    document.querySelectorAll('input[name="basemap"]').forEach((el) => {
      el.addEventListener("change", () => setBasemap(el.value));
    });
    document.querySelectorAll('input[name="orm"]').forEach((el) => {
      el.addEventListener("change", () => {
        if (el.checked) setOpenRailwayMap(el.value);
      });
    });
    function toggleOrmLegend(show) {
      const leg = document.getElementById("orm-legend");
      if (!leg) {
        console.warn("orm-legend element missing");
        toast("Legend panel missing — redeploy latest build", "error");
        return;
      }
      if (typeof show === "boolean") {
        leg.classList.toggle("hidden", !show);
      } else {
        leg.classList.toggle("hidden");
      }
    }
    const legBtn = document.getElementById("btn-orm-legend");
    if (legBtn) {
      legBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleOrmLegend();
      });
    }
    const legClose = document.getElementById("orm-legend-close");
    if (legClose) {
      legClose.addEventListener("click", (e) => {
        e.preventDefault();
        toggleOrmLegend(false);
      });
    }
    // Event delegation backup (in case button is re-rendered)
    document.body.addEventListener("click", (e) => {
      const tbtn = e.target.closest("#btn-orm-legend");
      if (tbtn) {
        e.preventDefault();
        toggleOrmLegend();
      }
      if (e.target.closest("#orm-legend-close")) toggleOrmLegend(false);
    });

    document.querySelectorAll("input[data-layer]").forEach((el) => {
      el.addEventListener("change", () => {
        const key = el.dataset.layer;
        if (key === "trains") {
          if (el.checked) state.layers.trains.addTo(state.map);
          else state.map.removeLayer(state.layers.trains);
        } else if (key === "cameras") {
          if (el.checked) {
            state.layers.cameras.addTo(state.map);
            loadCameras();
          } else state.map.removeLayer(state.layers.cameras);
        } else if (key === "class1only") {
          state.useClass1Only = el.checked;
          // Clear cache so next load uses correct endpoint coverage
          clearRailCache();
          loadRailsForView();
        } else if (key === "yards") {
          if (el.checked) {
            state.layers.yards.addTo(state.map);
            loadYards();
          } else state.map.removeLayer(state.layers.yards);
        } else if (key === "crossings") {
          if (el.checked) {
            state.layers.crossings.addTo(state.map);
            loadCrossings();
          } else state.map.removeLayer(state.layers.crossings);
        } else if (key === "nodes") {
          if (el.checked) {
            state.layers.nodes.addTo(state.map);
            loadNodes();
          } else state.map.removeLayer(state.layers.nodes);
        } else if (key === "amtrakStations") {
          if (el.checked) {
            state.layers.amtrakStations.addTo(state.map);
            loadAmtrakStations();
          } else state.map.removeLayer(state.layers.amtrakStations);
        } else if (key === "mileposts") {
          if (el.checked) {
            state.layers.mileposts.addTo(state.map);
            loadMileposts();
          } else state.map.removeLayer(state.layers.mileposts);
        } else if (key === "bridges") {
          if (el.checked) {
            state.layers.bridges.addTo(state.map);
            loadBridges();
          } else state.map.removeLayer(state.layers.bridges);
        } else if (key === "transitStops") {
          if (el.checked) {
            state.layers.transitStops.addTo(state.map);
            loadTransitStops();
          } else state.map.removeLayer(state.layers.transitStops);
        } else if (key === "transitRoutes") {
          if (el.checked) {
            state.layers.transitRoutes.addTo(state.map);
            loadTransitRoutes();
          } else state.map.removeLayer(state.layers.transitRoutes);
        } else if (key === "transitSubway" || key === "transitLightRail" || key === "transitCommuter" || key === "transitBus") {
          if (el.checked) {
            if (state.layers[key]) state.layers[key].addTo(state.map);
            loadTransitRoutes(); // fetch NTM GTFS routes for all agencies in view (NJT, SEPTA, etc.)
          } else if (state.layers[key]) {
            state.map.removeLayer(state.layers[key]);
          }
        } else if (key === "passengerLines") {
          if (el.checked) {
            state.layers.passengerLines.addTo(state.map);
            loadPassengerLines();
          } else state.map.removeLayer(state.layers.passengerLines);
        } else {
          applyRailVisibility();
        }
      });
    });

    document.getElementById("filter-passenger-only").addEventListener("change", applyRailVisibility);
    document.getElementById("filter-stracnet").addEventListener("change", applyRailVisibility);

    document.getElementById("state-filter").addEventListener("change", (e) => {
      const st = e.target.value || null;
      state.activeState = st;
      clearRailCache();
      if (st && CONFIG.STATE_BOUNDS[st]) {
        state.map.fitBounds(CONFIG.STATE_BOUNDS[st], { padding: [40, 40] });
      } else {
        state.map.setView(CONFIG.DEFAULT_CENTER, CONFIG.DEFAULT_ZOOM);
      }
      // NJ / PA / NY / etc. — enable local transit modes and load NTM (NJT, SEPTA, …)
      const transitHeavy = ["NJ", "PA", "NY", "CA", "IL", "MA", "MD", "DC", "WA", "OR", "CO", "TX", "FL", "GA", "OH", "MN"];
      if (st && transitHeavy.includes(st)) {
        ["transitLightRail", "transitCommuter", "transitSubway"].forEach((key) => {
          const el = document.querySelector(`input[data-layer="${key}"]`);
          if (el) el.checked = true;
          if (state.layers[key] && !state.map.hasLayer(state.layers[key])) {
            state.layers[key].addTo(state.map);
          }
        });
        setTimeout(() => loadTransitRoutes(), 500);
      }
      setTimeout(loadRailsForView, 350);
      toast(st ? ("Loading " + st + " rail + transit…") : "Nationwide view", "success");
    });
  }

  function applyRailVisibility() {
    const enabledOwners = new Set();
    document.querySelectorAll("input[data-layer]").forEach((el) => {
      if (el.checked && ["bnsf", "up", "csx", "ns", "cn", "cpkc", "amtrak", "other"].includes(el.dataset.layer)) {
        enabledOwners.add(el.dataset.layer);
      }
    });
    const passOnly = document.getElementById("filter-passenger-only").checked;
    const stracnetOnly = document.getElementById("filter-stracnet").checked;

    state.layers.rails.eachLayer((layer) => {
      const props = layer.feature?.properties || layer._railProps || {};
      const ownerCls = classifyOwner(props);
      let show = enabledOwners.has(ownerCls);

      if (passOnly) {
        const p = (props.PASSNGR || props.passngr || "").toString().toUpperCase();
        if (!p || p === "N" || p === "0") show = false;
      }
      if (stracnetOnly) {
        const s = (props.STRACNET || props.stracnet || "").toString().toUpperCase();
        if (s !== "S" && s !== "C") show = false;
      }

      if (show) {
        if (!state.map.hasLayer(layer)) state.layers.rails.addLayer(layer);
        layer.setStyle?.(styleForOwner(ownerCls, props));
      } else {
        state.layers.rails.removeLayer(layer);
      }
    });
  }

  // ---------- Rail network loading ----------
  function classifyOwner(props) {
    const candidates = [
      props.RROWNER1, props.RROWNER2, props.RROWNER3,
      props.TRKRGHTS1, props.TRKRGHTS2, props.TRKRGHTS3,
      props.rrowner1, props.rrowner2, props.rrowner3,
      props.OWNER, props.owner, props.RR, props.RROWNER,
    ].filter(Boolean).map((s) => String(s).toUpperCase().trim());

    const match = (c) => {
      // Order matters — more specific first
      if (c === "BNSF" || c.includes("BNSF") || c === "BN" || c === "BNS") return "bnsf";
      if (c === "CSXT" || c === "CSX" || c.includes("CSX")) return "csx";
      if (c === "NS" || c === "NW" || c.includes("NORFOLK")) return "ns";
      if (c === "UP" || c === "UPRR" || c === "SP" || c === "DRGW") return "up";
      if (c.startsWith("UP ") || c.endsWith(" UP") || c.includes("UNION PACIFIC")) return "up";
      if (c === "CN" || c === "GTW" || c === "IC" || c === "WC" || c.includes("CANADIAN NATIONAL")) return "cn";
      if (c === "CPKC" || c === "CP" || c === "CPRS" || c === "KCS" || c === "KCSM" || c.includes("CPKC")) return "cpkc";
      if (c === "ATK" || c === "AMTK" || c === "NRC" || c.includes("AMTRAK")) return "amtrak";
      return null;
    };

    for (const c of candidates) {
      const hit = match(c);
      if (hit) return hit;
    }
    const pass = (props.PASSNGR || props.passngr || "").toString().toUpperCase();
    if (pass === "A" || pass === "B" || pass === "P") return "amtrak";
    return "other";
  }

  function styleForOwner(cls, props, zoom) {
    const colors = {
      bnsf: "#ff6b00",
      up: "#ffd100",
      csx: "#3d8bfd",
      ns: "#e8e8e8",
      cn: "#ed1c24",
      cpkc: "#c41e3a",
      amtrak: "#00c2ff",
      other: "#6b7c93",
    };
    const z = zoom != null ? zoom : (state.map ? state.map.getZoom() : 6);
    let weight = cls === "amtrak" ? 3.2 : 2.4;
    if (z <= 5) weight = cls === "amtrak" ? 2.0 : 1.4;
    else if (z <= 7) weight = cls === "amtrak" ? 2.6 : 1.8;
    else if (z >= 12) weight = cls === "amtrak" ? 4 : 3;
    const opacity = cls === "other" ? 0.5 : 0.9;
    return {
      color: colors[cls] || colors.other,
      weight,
      opacity,
      lineCap: "round",
      lineJoin: "round",
    };
  }

  function clearRailCache() {
    state.railCache.forEach((lyr) => {
      try { state.layers.rails.removeLayer(lyr); } catch (e) {}
    });
    state.railCache.clear();
  }

  async function loadRailsForView() {
    if (state.queryInFlight) return;
    if (!state.map) return;
    // Ensure rails group is on the map
    if (state.layers.rails && !state.map.hasLayer(state.layers.rails)) {
      state.layers.rails.addTo(state.map);
    }

    const bounds = state.map.getBounds();
    const zoom = state.map.getZoom();
    state.queryInFlight = true;

    // PowerGrid-style: state focus = server-side STATEAB filter (like loading one region file)
    // National low zoom = Class I system map with simplification
    // Local zoom = full NARN in viewport
    const st = state.activeState;
    const forceClass1 = !st && zoom < 7 && state.useClass1Only;
    const endpoint = forceClass1 && CONFIG.CLASS1_LINES
      ? CONFIG.CLASS1_LINES
      : CONFIG.NARN_LINES;

    let maxOffset = 0;
    if (!st) {
      if (zoom <= 5) maxOffset = 0.08;
      else if (zoom <= 7) maxOffset = 0.03;
      else if (zoom <= 9) maxOffset = 0.008;
      else if (zoom <= 11) maxOffset = 0.002;
    }

    const geom = {
      xmin: bounds.getWest(),
      ymin: bounds.getSouth(),
      xmax: bounds.getEast(),
      ymax: bounds.getNorth(),
      spatialReference: { wkid: 4326 },
    };
    if (zoom <= 5 && !st) {
      const pad = 2;
      geom.xmin -= pad; geom.xmax += pad;
      geom.ymin -= pad; geom.ymax += pad;
    }

    // State filter — equivalent to loading a per-state "file" from the server
    let where = "1=1";
    if (st) {
      const safe = String(st).replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2);
      if (safe.length === 2) where = "STATEAB='" + safe + "'";
    }

    try {
      const pages = (st || zoom >= 8) ? 3 : 1;
      let allFeatures = [];

      for (let page = 0; page < pages; page++) {
        const params = new URLSearchParams({
          f: "geojson",
          where: where,
          outFields: "*",
          geometry: JSON.stringify(geom),
          geometryType: "esriGeometryEnvelope",
          inSR: "4326",
          spatialRel: "esriSpatialRelIntersects",
          outSR: "4326",
          resultRecordCount: String(CONFIG.MAX_RECORDS || 2000),
          resultOffset: String(page * (CONFIG.MAX_RECORDS || 2000)),
        });
        if (maxOffset > 0) params.set("maxAllowableOffset", String(maxOffset));

        const res = await fetch(endpoint + "/query?" + params.toString());
        if (!res.ok) throw new Error("NARN query failed: " + res.status);
        const geojson = await res.json();
        if (geojson.error) throw new Error(geojson.error.message || "ArcGIS error");
        if (!geojson.features || !geojson.features.length) break;
        allFeatures = allFeatures.concat(geojson.features);
        if (geojson.features.length < (CONFIG.MAX_RECORDS || 2000)) break;
      }

      if (!allFeatures.length) {
        toast(st ? ("No rail segments in " + st) : "No rail segments in view", "error");
        return;
      }

      let added = 0;
      allFeatures.forEach((feature) => {
        const oid = feature.properties?.OBJECTID ?? feature.properties?.FRAARCID;
        if (oid == null) return;
        const key = (st ? st + ":" : "") + String(oid);
        if (state.railCache.has(key)) return;

        const cls = classifyOwner(feature.properties);
        const layer = L.geoJSON(feature, {
          style: () => styleForOwner(cls, feature.properties, zoom),
          onEachFeature: (f, lyr) => {
            lyr._railProps = f.properties;
            lyr.feature = f;
            lyr.on("click", (ev) => showRailMeta(f.properties, lyr.getBounds?.(), ev.latlng));
            lyr.on("mouseover", () => lyr.setStyle({ weight: Math.min(6, (lyr.options.weight || 2) + 2), opacity: 1 }));
            lyr.on("mouseout", () => {
              const c = classifyOwner(f.properties);
              lyr.setStyle(styleForOwner(c, f.properties, zoom));
            });
          },
        });
        layer.addTo(state.layers.rails);
        state.railCache.set(key, layer);
        added++;
      });

      applyRailVisibility();
      const mode = st
        ? ("State " + st)
        : (forceClass1 ? "Class I system map" : "Full NARN");
      toast(mode + ": +" + added + " new / " + state.railCache.size + " cached", "success");
    } catch (err) {
      console.error(err);
      toast("Rail network load error — " + (err.message || "see console"), "error");
    } finally {
      state.queryInFlight = false;
    }
  }

  function getEnabledOwners() {
    const s = new Set();
    document.querySelectorAll("input[data-layer]").forEach((el) => {
      if (el.checked && ["bnsf", "up", "csx", "ns", "cn", "cpkc", "amtrak", "other"].includes(el.dataset.layer)) {
        s.add(el.dataset.layer);
      }
    });
    return s;
  }

  // ---------- Trains (Amtraker) ----------
  async function fetchAmtrakerTrains() {
    const urls = [CONFIG.AMTRAKER_TRAINS, CONFIG.AMTRAKER_TRAINS_ALT].filter(Boolean);
    let lastErr = null;
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        return await res.json();
      } catch (e) {
        lastErr = e;
        console.warn("Amtraker host failed", url, e);
      }
    }
    throw lastErr || new Error("All Amtraker hosts failed");
  }

  async function mergePriorityTrains(data) {
    // Auto Train (#52 Sanford→Lorton, #53 Lorton→Sanford) is often missing from bulk feed
    const nums = CONFIG.PRIORITY_TRAIN_NUMS || ["52", "53"];
    const base = CONFIG.AMTRAKER_TRAINS || "https://api.amtraker.com/v3/trains";
    await Promise.all(
      nums.map(async (num) => {
        if (data[num] && Array.isArray(data[num]) && data[num].length) return;
        try {
          const res = await fetch(base + "/" + num, { cache: "no-store" });
          if (!res.ok) return;
          const j = await res.json();
          // endpoint may return [] or { "52": [...] }
          let arr = Array.isArray(j) ? j : j[num];
          if (!arr && j && typeof j === "object") arr = Object.values(j).flat();
          if (Array.isArray(arr) && arr.length) data[num] = arr;
        } catch (e) {
          console.warn("priority train", num, e);
        }
      })
    );
    return data;
  }

  async function loadTrains() {
    try {
      let data = await fetchAmtrakerTrains();
      data = await mergePriorityTrains(data || {});
      state.lastTrainData = data;
      state.lastRefresh = new Date();
      renderTrains(data);
      updateStatusBar();
      rebuildSearchIndex(data);
      const live = document.getElementById("live-indicator");
      if (live) live.style.opacity = "1";
    } catch (err) {
      console.error("Train load failed", err);
      toast("Live train feed unavailable — " + (err.message || "network"), "error");
      const live = document.getElementById("live-indicator");
      if (live) live.style.opacity = "0.4";
    }
  }

  function trainHasPosition(t) {
    const lat = t.lat ?? t.latitude;
    const lon = t.lon ?? t.lng ?? t.longitude;
    return lat != null && lon != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lon));
  }

  function renderTrains(data) {
    state.layers.trains.clearLayers();
    state.trainMarkers.clear();
    let count = 0;
    let autoCount = 0;

    Object.values(data || {}).forEach((arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((t) => {
        if (!trainHasPosition(t)) return;
        const lat = Number(t.lat ?? t.latitude);
        const lon = Number(t.lon ?? t.lng ?? t.longitude);
        count++;
        const isAuto = /auto\s*train/i.test(t.routeName || "") || ["52", "53"].includes(String(t.trainNum));
        if (isAuto) autoCount++;
        const label = escapeHtml(t.trainNum || "");
        const title = escapeHtml((t.routeName || "") + " #" + (t.trainNum || ""));
        const icon = L.divIcon({
          className: "rsx-marker-wrap",
          html: `<div class="train-marker${isAuto ? " train-auto" : ""}" title="${title}">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path fill="currentColor" d="M12 2c-4 0-7 1.5-7 4v8c0 1.1.9 2 2 2h1l-1.5 3h2l1-2h3l1 2h2L13 16h1c1.1 0 2-.9 2-2V6c0-2.5-3-4-7-4zm-3.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm7 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM7 8h10v3H7V8z"/>
            </svg>
            <span class="tm-num">${label}</span>
          </div>`,
          iconSize: [36, 22],
          iconAnchor: [18, 11],
        });
        const marker = L.marker([lat, lon], { icon, zIndexOffset: 1000 });
        marker.trainData = t;
        marker.on("click", (ev) => showTrainMeta(t, ev.latlng));
        marker.addTo(state.layers.trains);
        state.trainMarkers.set(t.trainID || t.trainNum + "-" + lat, marker);
      });
    });

    const el = document.getElementById("train-count");
    if (el) el.textContent = count;
    if (autoCount) toast(`Auto Train live: ${autoCount}`, "success");
  }

  // ---------- Yards / Crossings / Nodes (on demand) ----------
  async function loadYards() {
    await loadPointLayer(CONFIG.RAIL_YARDS, state.layers.yards, "yards", describeYard);
  }

  async function loadCrossings() {
    await loadPointLayer(CONFIG.GRADE_CROSSINGS, state.layers.crossings, "crossings", describeCrossing);
  }

  async function loadNodes() {
    await loadPointLayer(CONFIG.NARN_NODES, state.layers.nodes, "nodes", describeNode);
  }

  function featureKey(props, type) {
    return String(
      props.OBJECTID ?? props.FRANODEID ?? props.CrossingID ?? props.CROSSING ??
      props.YARDNAME ?? props.NAME ?? Math.random()
    ) + ":" + type;
  }

  function describeNode(p) {
    const station = (p.PASSNGRSTN || "").toString().trim();
    const pass = (p.PASSNGR || "").toString().toUpperCase();
    const bndry = p.BNDRY;
    const parts = [];
    if (station) parts.push(station);
    if (pass === "Y" || pass === "1" || pass === "A" || pass === "P") parts.push("Passenger station node");
    else if (pass && pass !== "N" && pass !== "0") parts.push("Passenger flag: " + pass);
    if (bndry === 1 || bndry === "1") parts.push("Network boundary node");
    if (!parts.length) parts.push("Rail network junction / node");
    return parts.join(" · ");
  }

  function describeCrossing(p) {
    const street = p.STREET || p.Street || p.HIGHWAY || p.Highway || "";
    const rr = p.RailroadCode || p.RAILROAD || p.Railroad || "";
    const cid = p.CrossingID || p.CROSSING || "";
    const bits = [];
    if (street) bits.push(street);
    if (rr) bits.push(rr);
    if (cid) bits.push("Xing #" + cid);
    return bits.length ? bits.join(" · ") : "Grade Crossing";
  }

  function describeYard(p) {
    return p.NAME || p.YARDNAME || p.name || p.YardName || "Rail Yard";
  }

  async function loadPointLayer(endpoint, layerGroup, cacheKey, titleFn) {
    // PowerGrid-style: keep already-loaded features; only fetch missing IDs for current viewport
    if (state.map.getZoom() < 9 && cacheKey !== "yards") {
      // Nodes/crossings dense — only show when reasonably zoomed
      return;
    }
    const bounds = state.map.getBounds();
    const geom = {
      xmin: bounds.getWest(),
      ymin: bounds.getSouth(),
      xmax: bounds.getEast(),
      ymax: bounds.getNorth(),
      spatialReference: { wkid: 4326 },
    };
    const outFields = cacheKey === "nodes"
      ? "OBJECTID,FRANODEID,COUNTRY,STATE,STFIPS,CTYFIPS,STCYFIPS,FRADISTRCT,PASSNGR,PASSNGRSTN,BNDRY"
      : "*";
    const params = new URLSearchParams({
      f: "geojson",
      where: "1=1",
      outFields,
      geometry: JSON.stringify(geom),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outSR: "4326",
      resultRecordCount: "2000",
    });
    try {
      const res = await fetch(`${endpoint}/query?${params}`);
      const geojson = await res.json();
      if (!geojson.features) return;
      const cache = state.pointCache[cacheKey];
      let added = 0;
      geojson.features.forEach((feature) => {
        const key = featureKey(feature.properties, cacheKey);
        if (cache.has(key)) return;
        const latlng = L.latLng(
          feature.geometry.coordinates[1],
          feature.geometry.coordinates[0]
        );
        const layer = pointToMarker(feature, latlng, cacheKey, titleFn);
        if (!layer) return;
        layer._rsxKey = key;
        layer._rsxProps = feature.properties;
        layer.addTo(layerGroup);
        cache.set(key, layer);
        added++;
      });
      if (added) toast(`${cacheKey}: +${added} features`, "success");
    } catch (e) {
      console.error(cacheKey + " load error", e);
    }
  }

  function pointToMarker(feature, latlng, type, titleFn) {
    const p = feature.properties || {};
    const title = titleFn(p);
    if (type === "yards") {
      const m = L.marker(latlng, {
        icon: L.divIcon({
          className: "rsx-marker-wrap",
          html: `<div class="yard-marker" title="${escapeHtml(title)}">
            <svg viewBox="0 0 24 24" width="12" height="12"><rect x="3" y="8" width="18" height="10" rx="1" fill="currentColor" opacity="0.9"/><rect x="6" y="4" width="4" height="4" fill="currentColor"/><rect x="14" y="4" width="4" height="4" fill="currentColor"/></svg>
          </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      });
      m.on("click", (ev) => showYardMeta(p, title, ev.latlng));
      return m;
    }
    if (type === "crossings") {
      const m = L.marker(latlng, {
        icon: L.divIcon({
          className: "rsx-marker-wrap",
          html: `<div class="crossing-marker" title="${escapeHtml(title)}">✕</div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
      });
      m.on("click", (ev) => showCrossingMeta(p, title, ev.latlng));
      return m;
    }
    // nodes — style by role
    const isStation = !!(p.PASSNGRSTN || (p.PASSNGR && String(p.PASSNGR).toUpperCase() !== "N" && String(p.PASSNGR) !== "0"));
    const isBoundary = p.BNDRY === 1 || p.BNDRY === "1";
    const color = isStation ? "#00c2ff" : isBoundary ? "#ffb020" : "#8b9bb4";
    const m = L.circleMarker(latlng, {
      radius: isStation ? 5 : 3.5,
      color,
      fillColor: color,
      fillOpacity: 0.85,
      weight: 1.5,
    });
    m.bindTooltip(title, { direction: "top", opacity: 0.9, className: "rsx-tip" });
    m.on("click", (ev) => showNodeMeta(p, title, ev.latlng));
    return m;
  }

  function showNodeMeta(p, title, latlng) {
    const station = (p.PASSNGRSTN || "").toString().trim() || "—";
    const pass = (p.PASSNGR || "—").toString();
    const role = [];
    if (p.PASSNGRSTN) role.push("Passenger station node");
    if (p.BNDRY === 1 || p.BNDRY === "1") role.push("Network boundary");
    if (!role.length) role.push("Rail junction / topology node (NARN)");
    const html = `
      <div class="section-title">Network Node</div>
      <div class="kv"><span class="k">Role</span><span class="v">${escapeHtml(role.join(" · "))}</span></div>
      <div class="kv"><span class="k">Station name</span><span class="v">${escapeHtml(station)}</span></div>
      <div class="kv"><span class="k">Passenger flag</span><span class="v">${escapeHtml(pass)}</span></div>
      <div class="kv"><span class="k">FRA Node ID</span><span class="v">${escapeHtml(String(p.FRANODEID ?? "—"))}</span></div>
      <div class="kv"><span class="k">State</span><span class="v">${escapeHtml(p.STATE || "—")}</span></div>
      <div class="kv"><span class="k">County FIPS</span><span class="v">${escapeHtml(p.CTYFIPS || p.STCYFIPS || "—")}</span></div>
      <div class="kv"><span class="k">FRA District</span><span class="v">${escapeHtml(String(p.FRADISTRCT ?? "—"))}</span></div>
      <div class="kv"><span class="k">Boundary node</span><span class="v">${p.BNDRY === 1 || p.BNDRY === "1" ? "Yes" : "No"}</span></div>
      <p style="margin-top:0.75rem;font-size:0.72rem;color:var(--text-muted)">
        NARN nodes are topology points (junctions, station ends, boundaries). Public national data does <strong>not</strong> include proprietary wayside devices (hot-box detectors, dragging-equipment detectors, switch heaters, AEI readers). Those are railroad-owned and not published as open GIS.
      </p>
    `;
    openMeta(title || "Network Node", html, latlng);
  }

  function showCrossingMeta(p, title, latlng) {
    const html = `
      <div class="section-title">Highway–Rail Grade Crossing</div>
      <div class="kv"><span class="k">Street / Highway</span><span class="v">${escapeHtml(p.STREET || p.Street || p.HIGHWAY || "—")}</span></div>
      <div class="kv"><span class="k">Crossing ID</span><span class="v">${escapeHtml(p.CrossingID || p.CROSSING || "—")}</span></div>
      <div class="kv"><span class="k">Railroad</span><span class="v">${escapeHtml(p.RailroadCode || p.RAILROAD || "—")}</span></div>
      <div class="kv"><span class="k">Division</span><span class="v">${escapeHtml(p.RailroadDivision || p.RRDIV || "—")}</span></div>
      <div class="kv"><span class="k">Subdivision</span><span class="v">${escapeHtml(p.RRSUBDIV || "—")}</span></div>
      <div class="kv"><span class="k">Milepost</span><span class="v">${escapeHtml(p.MILEPOST || p.Milepost || "—")}</span></div>
      <div class="kv"><span class="k">Timetable station</span><span class="v">${escapeHtml(p.TimetableStation || p.TTSTN || "—")}</span></div>
      <div class="kv"><span class="k">Type</span><span class="v">${escapeHtml(String(p.TYPEXING || p.TYPE || "—"))}</span></div>
      <p style="margin-top:0.6rem;font-size:0.72rem;color:var(--text-muted)">Source: FRA National Highway–Rail Crossing Inventory (NTAD).</p>
    `;
    openMeta(title || "Grade Crossing", html, latlng);
  }

  function showYardMeta(p, title, latlng) {
    const keys = ["NAME","YARDNAME","RROWNER1","STATE","STATEAB","CITY","STFIPS"];
    const rows = keys
      .filter((k) => p[k] != null && p[k] !== "")
      .map((k) => `<div class="kv"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(String(p[k]))}</span></div>`)
      .join("");
    const extra = Object.keys(p)
      .filter((k) => !keys.includes(k) && !k.startsWith("SHAPE") && p[k] != null && p[k] !== "")
      .slice(0, 12)
      .map((k) => `<div class="kv"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(String(p[k]))}</span></div>`)
      .join("");
    openMeta(title || "Rail Yard", `
      <div class="disp-badge">YARD</div>
      <div class="section-title">Yard / Facility</div>
      ${rows || "<em>Named facility</em>"}
      <div class="section-title">All published attributes</div>
      ${extra || ""}
      <p class="disp-note">Source: FRA/BTS NTAD Rail Yards.</p>
    `, latlng);
  }


  async function loadAmtrakStations() {
    // Map markers for current viewport (BTS NTAD)
    await loadNamedPointLayer(CONFIG.AMTRAK_STATIONS, state.layers.amtrakStations, "amtrakStations", (p) => {
      return p.Name || p.StationName || p.STNNAME || p.Code || "Amtrak Station";
    }, "amtrak");
  }

  /** Nationwide Amtrak station list for search (Amtraker public API + BTS fallback) */
  async function loadAmtrakStationIndex() {
    // Prefer Amtraker stations API — full national list with lat/lon/codes
    try {
      const res = await fetch(CONFIG.AMTRAKER_STATIONS);
      if (res.ok) {
        const data = await res.json();
        const items = [];
        // Amtraker returns object keyed by station code
        const list = Array.isArray(data) ? data : Object.values(data || {});
        list.forEach((s) => {
          if (!s) return;
          const lat = s.lat ?? s.latitude ?? s.Lat;
          const lon = s.lon ?? s.lng ?? s.longitude ?? s.Lon;
          if (lat == null || lon == null) return;
          const name = s.name || s.stationName || s.Name || "";
          const code = s.code || s.stationCode || s.Code || "";
          const city = s.city || s.City || "";
          const st = s.state || s.State || "";
          items.push({
            type: "station",
            label: [name, code && `(${code})`, city, st].filter(Boolean).join(" · "),
            name, code, city, state: st,
            lat: Number(lat), lon: Number(lon),
            data: s,
          });
        });
        if (items.length) {
          state.amtrakStationIndex = items;
          rebuildSearchIndex(state.lastTrainData);
          toast(`Amtrak stations indexed: ${items.length}`, "success");
          return;
        }
      }
    } catch (e) {
      console.warn("Amtraker stations", e);
    }
    // Fallback: query BTS NTAD without geometry filter (paginated-ish)
    try {
      const params = new URLSearchParams({
        f: "geojson",
        where: "1=1",
        outFields: "Name,Code,City,State,ZipCode,Address1,StnType,OBJECTID",
        outSR: "4326",
        resultRecordCount: "2000",
      });
      const res = await fetch(`${CONFIG.AMTRAK_STATIONS}/query?${params}`);
      const geojson = await res.json();
      const items = [];
      (geojson.features || []).forEach((f) => {
        const p = f.properties || {};
        const c = f.geometry && f.geometry.coordinates;
        if (!c) return;
        items.push({
          type: "station",
          label: [p.Name, p.Code && `(${p.Code})`, p.City, p.State].filter(Boolean).join(" · "),
          name: p.Name || "", code: p.Code || "", city: p.City || "", state: p.State || "",
          lat: c[1], lon: c[0],
          data: p,
        });
      });
      state.amtrakStationIndex = items;
      rebuildSearchIndex(state.lastTrainData);
      toast(`Amtrak stations indexed: ${items.length}`, "success");
    } catch (e) {
      console.error("Amtrak station index", e);
    }
  }

  async function loadMileposts() {
    if (state.map.getZoom() < 10) return;
    await loadNamedPointLayer(CONFIG.RAIL_MILEPOSTS, state.layers.mileposts, "mileposts", (p) => {
      const mp = p.MILEPOST != null ? "MP " + p.MILEPOST : "Milepost";
      const sub = p.SUBDIV || "";
      return sub ? mp + " · " + sub : mp;
    }, "milepost");
  }

  async function loadBridges() {
    if (state.map.getZoom() < 9) return;
    await loadNamedPointLayer(CONFIG.RAILROAD_BRIDGES, state.layers.bridges, "bridges", (p) => {
      return p.Name || p.BRIDGE_NAME || p.RROwner || p.RROWNER || "Railroad Bridge";
    }, "bridge");
  }

  async function loadTransitStops() {
    if (!isLayerChecked("transitStops")) {
      if (state.layers.transitStops && state.map.hasLayer(state.layers.transitStops)) {
        state.map.removeLayer(state.layers.transitStops);
      }
      return;
    }
    if (state.map.getZoom() < 10) return;
    // Prefer rail / subway / tram stops when location_type or route info available
    await loadNamedPointLayer(CONFIG.NTM_STOPS, state.layers.transitStops, "transitStops", (p) => {
      return p.stop_name || p.STOP_NAME || p.stop_id || "Transit Stop";
    }, "transit", null);
  }

  async function loadTransitRoutes() {
    // Split NTM routes by GTFS route_type for ALL agencies nationwide:
    // 0 = tram/light rail (NJT River Line, HBLR, NLR, SEPTA trolleys…),
    // 1 = subway/metro, 2 = rail/commuter (NJT/SEPTA/Metra…), 3 = bus
    const groups = {
      0: state.layers.transitLightRail,
      1: state.layers.transitSubway,
      2: state.layers.transitCommuter,
      3: state.layers.transitBus,
    };
    const typeKey = { 0: "transitLightRail", 1: "transitSubway", 2: "transitCommuter", 3: "transitBus" };
    // Mount only layers the user enabled
    Object.entries(groups).forEach(([rt, g]) => {
      const key = typeKey[rt];
      if (g && state.map && isLayerChecked(key) && !state.map.hasLayer(g)) g.addTo(state.map);
    });
    // also keep combined group for backward compat
    if (!state.layers.transitRoutes) state.layers.transitRoutes = L.layerGroup();
    // Only show combined routes layer when its checkbox is on; typed layers controlled separately
    if (isLayerChecked("transitRoutes") && !state.map.hasLayer(state.layers.transitRoutes)) {
      state.layers.transitRoutes.addTo(state.map);
    }

    const bounds = state.map.getBounds();
    const geom = {
      xmin: bounds.getWest(), ymin: bounds.getSouth(),
      xmax: bounds.getEast(), ymax: bounds.getNorth(),
      spatialReference: { wkid: 4326 },
    };
    const params = new URLSearchParams({
      f: "geojson",
      where: "1=1",
      outFields: "OBJECTID,route_id,route_short_name,route_long_name,route_type,route_type_text,agency_id,ntd_id,route_color,route_text_color",
      geometry: JSON.stringify(geom),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outSR: "4326",
      resultRecordCount: "2000",
      maxAllowableOffset: state.map.getZoom() < 9 ? "0.01" : "0.001",
    });
    try {
      const res = await fetch(`${CONFIG.NTM_ROUTES}/query?${params}`);
      const geojson = await res.json();
      if (!geojson.features) return;

      // clear mode groups + combined
      Object.values(groups).forEach((g) => g && g.clearLayers());
      state.layers.transitRoutes.clearLayers();

      const counts = { 0: 0, 1: 0, 2: 0, 3: 0, other: 0 };
      const colors = { 0: "#f472b6", 1: "#a855f7", 2: "#00c2ff", 3: "#22c55e" };
      const labels = { 0: "Light Rail / Tram", 1: "Subway / Metro", 2: "Commuter Rail", 3: "Bus" };

      const agencies = new Set();
      geojson.features.forEach((f) => {
        const rt = Number(f.properties.route_type);
        const key = typeKey[rt];
        // Skip types user turned off (still count for toast)
        if (key && !isLayerChecked(key) && !isLayerChecked("transitRoutes")) return;
        const target = (key && isLayerChecked(key) ? groups[rt] : null)
          || (isLayerChecked("transitRoutes") ? state.layers.transitRoutes : null);
        if (!target) return;

        const color = colors[rt] != null ? colors[rt] : "#94a3b8";
        const weight = rt === 3 ? 2 : (rt === 0 || rt === 1 ? 4 : 3.5);
        if (counts[rt] != null) counts[rt]++; else counts.other++;
        if (f.properties.agency_id) agencies.add(String(f.properties.agency_id));

        L.geoJSON(f, {
          style: { color, weight, opacity: 0.92 },
          onEachFeature: (feat, layer) => {
            const p = feat.properties;
            const name = p.route_long_name || p.route_short_name || p.route_id || "Transit route";
            layer.on("click", (ev) => {
              openMeta(name, `
                <div class="disp-badge">TRANSIT ROUTE</div>
                <div class="section-title">${labels[rt] || "Transit Route"}</div>
                <div class="kv"><span class="k">Name</span><span class="v">${escapeHtml(name)}</span></div>
                <div class="kv"><span class="k">Short name</span><span class="v">${escapeHtml(p.route_short_name || "—")}</span></div>
                <div class="kv"><span class="k">Type</span><span class="v">${escapeHtml(p.route_type_text || labels[rt] || String(rt))}</span></div>
                <div class="kv"><span class="k">Agency / NTD</span><span class="v">${escapeHtml(String(p.agency_id || ""))} · ${escapeHtml(String(p.ntd_id || ""))}</span></div>
                <div class="kv"><span class="k">Route ID</span><span class="v">${escapeHtml(String(p.route_id || "—"))}</span></div>
                <p class="disp-note">National Transit Map (BTS GTFS) — includes NJ Transit, SEPTA, PATCO, and agencies nationwide.</p>
              `, ev.latlng);
            });
          },
        }).addTo(target);
      });

      const ag = [...agencies].slice(0, 8).join(", ");
      toast(`Transit: LR ${counts[0]} · subway ${counts[1]} · rail ${counts[2]} · bus ${counts[3]}${ag ? " · " + ag : ""}`, "success");
    } catch (e) {
      console.error("transit routes", e);
      toast("Transit routes load error — " + (e.message || "see console"), "error");
    }
  }


  async function loadPassengerLines() {
    if (!state.layers.passengerLines) state.layers.passengerLines = L.layerGroup();
    if (!state.map.hasLayer(state.layers.passengerLines)) {
      state.layers.passengerLines.addTo(state.map);
    }
    const bounds = state.map.getBounds();
    const geom = {
      xmin: bounds.getWest(), ymin: bounds.getSouth(),
      xmax: bounds.getEast(), ymax: bounds.getNorth(),
      spatialReference: { wkid: 4326 },
    };
    const params = new URLSearchParams({
      f: "geojson",
      where: "1=1",
      outFields: "OBJECTID,RROWNER1,RROWNER2,PASSNGR,SUBDIV,STATEAB,TRACKS,FRAARCID",
      geometry: JSON.stringify(geom),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outSR: "4326",
      resultRecordCount: "2000",
      maxAllowableOffset: state.map.getZoom() < 8 ? "0.02" : "0.002",
    });
    try {
      const res = await fetch(`${CONFIG.PASSENGER_RAIL_LINES}/query?${params}`);
      const geojson = await res.json();
      if (!geojson.features) return;
      state.layers.passengerLines.clearLayers();
      L.geoJSON(geojson, {
        style: { color: "#00c2ff", weight: 4, opacity: 0.95 },
        onEachFeature: (f, layer) => {
          layer.on("click", (ev) => showRailMeta(f.properties, layer.getBounds?.(), ev.latlng));
        },
      }).addTo(state.layers.passengerLines);
      toast(`Passenger rail lines: ${geojson.features.length}`, "success");
    } catch (e) {
      console.error("passenger lines", e);
    }
  }

  function isLayerChecked(key) {
    const el = document.querySelector(`input[data-layer="${key}"]`);
    return el ? el.checked : true;
  }

  async function loadNamedPointLayer(endpoint, layerGroup, cacheKey, titleFn, kind, whereClause) {
    if (!endpoint) return;
    // Do not force-add layer if user turned it off
    if (cacheKey && !isLayerChecked(cacheKey)) return;
    if (layerGroup && state.map && isLayerChecked(cacheKey) && !state.map.hasLayer(layerGroup)) {
      layerGroup.addTo(state.map);
    }
    const bounds = state.map.getBounds();
    const geom = {
      xmin: bounds.getWest(), ymin: bounds.getSouth(),
      xmax: bounds.getEast(), ymax: bounds.getNorth(),
      spatialReference: { wkid: 4326 },
    };
    const params = new URLSearchParams({
      f: "geojson",
      where: whereClause || "1=1",
      outFields: "*",
      geometry: JSON.stringify(geom),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outSR: "4326",
      resultRecordCount: "2000",
    });
    try {
      const res = await fetch(`${endpoint}/query?${params}`);
      const geojson = await res.json();
      if (!geojson.features) return;
      const cache = state.pointCache[cacheKey] || (state.pointCache[cacheKey] = new Map());
      let added = 0;
      geojson.features.forEach((feature) => {
        if (!feature.geometry || !feature.geometry.coordinates) return;
        const coords = feature.geometry.coordinates;
        // Handle Point
        let lon, lat;
        if (feature.geometry.type === "Point") {
          lon = coords[0]; lat = coords[1];
        } else return;
        const p = feature.properties || {};
        const key = String(p.OBJECTID ?? p.Code ?? p.stop_id ?? (lon + "," + lat));
        if (cache.has(key)) return;
        const title = titleFn(p);
        const marker = infraMarker([lat, lon], kind, title);
        marker.on("click", (ev) => showInfraMeta(kind, title, p, ev.latlng || L.latLng(lat, lon)));
        marker.addTo(layerGroup);
        cache.set(key, marker);
        added++;
      });
      if (added) toast(`${cacheKey}: +${added}`, "success");
    } catch (e) {
      console.error(cacheKey, e);
    }
  }

  function infraMarker(latlng, kind, title) {
    const colors = {
      amtrak: "#00c2ff",
      milepost: "#94a3b8",
      bridge: "#f59e0b",
      transit: "#a855f7",
    };
    const c = colors[kind] || "#8b9bb4";
    if (kind === "amtrak") {
      return L.marker(latlng, {
        icon: L.divIcon({
          className: "rsx-marker-wrap",
          html: `<div class="amtrak-marker" title="${escapeHtml(title)}"><i class="fa-solid fa-train"></i></div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
        zIndexOffset: 800,
      });
    }
    if (kind === "bridge") {
      return L.marker(latlng, {
        icon: L.divIcon({
          className: "rsx-marker-wrap",
          html: `<div class="bridge-marker" title="${escapeHtml(title)}">▭</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      });
    }
    if (kind === "milepost") {
      return L.circleMarker(latlng, {
        radius: 3, color: c, fillColor: c, fillOpacity: 0.8, weight: 1,
      }).bindTooltip(title, { className: "rsx-tip", direction: "top" });
    }
    return L.circleMarker(latlng, {
      radius: 4, color: c, fillColor: c, fillOpacity: 0.85, weight: 1,
    }).bindTooltip(title, { className: "rsx-tip", direction: "top" });
  }

  function showInfraMeta(kind, title, p, latlng) {
    const extraRows = (props, skip = []) =>
      Object.keys(props || {})
        .filter((k) => !skip.includes(k) && !/^SHAPE/i.test(k) && props[k] != null && props[k] !== "")
        .slice(0, 40)
        .map((k) => `<div class="kv"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(String(props[k]))}</span></div>`)
        .join("");

    if (kind === "amtrak") {
      const name = p.Name || p.StationName || p.STNNAME || p.name || title || "Amtrak Station";
      const code = p.Code || p.code || p.STNCODE || p.stationCode || "—";
      const html = `
        <div class="disp-badge">AMTRAK STATION</div>
        <div class="kv"><span class="k">Station</span><span class="v">${escapeHtml(name)}</span></div>
        <div class="kv"><span class="k">Code</span><span class="v">${escapeHtml(String(code))}</span></div>
        <div class="kv"><span class="k">City / State</span><span class="v">${escapeHtml([p.City || p.city, p.State || p.state || p.STATE].filter(Boolean).join(", ") || "—")}</span></div>
        <div class="kv"><span class="k">Address</span><span class="v">${escapeHtml(p.Address || p.address1 || p.ADDRESS || "—")}</span></div>
        <div class="kv"><span class="k">ZIP</span><span class="v">${escapeHtml(String(p.Zip || p.zip || p.ZIP || "—"))}</span></div>
        <div class="kv"><span class="k">Lat / Lon</span><span class="v">${escapeHtml(String(p.lat ?? p.Lat ?? "—"))}, ${escapeHtml(String(p.lon ?? p.Lon ?? p.lng ?? "—"))}</span></div>
        <div class="section-title">Inventory attributes</div>
        ${extraRows(p, ["Name","StationName","STNNAME","name","Code","code","SHAPE","Shape"])}
        <p class="disp-note">Sources: BTS NTAD Amtrak Stations · Amtraker station index. Live arrivals on train markers.</p>
      `;
      const ll = latlng || (p.lat != null ? L.latLng(Number(p.lat), Number(p.lon ?? p.lng ?? p.Lon)) : null);
      openMeta("Station · " + name, html, ll);
      return;
    }
    if (kind === "bridge") {
      openMeta(title, `
        <div class="disp-badge">BRIDGE</div>
        <div class="section-title">Railroad Bridge</div>
        ${extraRows(p)}
        <p class="disp-note">Source: FRA/BTS NTAD Railroad Bridges (approximate inventory).</p>
      `, latlng);
      return;
    }
    if (kind === "milepost") {
      openMeta(title, `
        <div class="disp-badge">MILEPOST</div>
        <div class="kv"><span class="k">Milepost</span><span class="v">${escapeHtml(String(p.MILEPOST ?? p.Milepost ?? "—"))}</span></div>
        <div class="kv"><span class="k">Subdivision</span><span class="v">${escapeHtml(p.SUBDIV || p.Subdivision || "—")}</span></div>
        <div class="kv"><span class="k">Railroad</span><span class="v">${escapeHtml(p.RROWNER1 || p.RR || "—")}</span></div>
        <div class="kv"><span class="k">State</span><span class="v">${escapeHtml(p.STATEAB || p.State || "—")}</span></div>
        <div class="section-title">Attributes</div>
        ${extraRows(p)}
        <p class="disp-note">Source: FRA/BTS NTAD Rail Mileposts.</p>
      `, latlng);
      return;
    }
    // transit stop
    openMeta(title, `
      <div class="disp-badge">TRANSIT STOP</div>
      <div class="kv"><span class="k">Name</span><span class="v">${escapeHtml(p.stop_name || p.Name || "—")}</span></div>
      <div class="kv"><span class="k">Stop ID</span><span class="v">${escapeHtml(String(p.stop_id || "—"))}</span></div>
      <div class="kv"><span class="k">Code</span><span class="v">${escapeHtml(p.stop_code || "—")}</span></div>
      <div class="kv"><span class="k">Location type</span><span class="v">${escapeHtml(String(p.location_type ?? "—"))}</span></div>
      <div class="kv"><span class="k">NTD / Feed</span><span class="v">${escapeHtml(String(p.ntd_id || ""))} · ${escapeHtml(String(p.feed_id || ""))}</span></div>
      <div class="kv"><span class="k">Description</span><span class="v">${escapeHtml(p.stop_desc || "—")}</span></div>
      <div class="section-title">GTFS attributes</div>
      ${extraRows(p)}
      <p class="disp-note">National Transit Map (BTS) — GTFS stops nationwide.</p>
    `, latlng);
  }

  function showGenericMeta(title, props, latlng) {
    const keys = Object.keys(props).filter((k) => !k.startsWith("SHAPE") && props[k] != null).slice(0, 40);
    const rows = keys.map((k) =>
      `<div class="kv"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(String(props[k]))}</span></div>`
    ).join("");
    openMeta(title, `<div class="disp-badge">ASSET</div>${rows || "<em>No attributes</em>"}`, latlng);
  }

  // ---------- Metadata floating window ----------
  function initMetaWindow() {
    document.getElementById("meta-close").addEventListener("click", () => {
      document.getElementById("meta-window").classList.add("hidden");
    });
  }

  function showRailMeta(props, bounds, latlng) {
    const owner = classifyOwner(props);
    const profile = (CONFIG.CLASS1_PROFILES && CONFIG.CLASS1_PROFILES[owner]) || null;
    const ownerName = (profile && profile.name)
      || (CONFIG.OWNERS[owner.toUpperCase()] || CONFIG.OWNERS[owner] || {}).name
      || props.RROWNER1 || owner;
    const tracks = props.TRACKS != null ? String(props.TRACKS) : "—";
    const pass = (props.PASSNGR || props.passngr || "").toString().toUpperCase();
    const passLabel = {
      A: "Amtrak", B: "Amtrak + other", P: "Passenger", C: "Commuter",
      N: "Freight only", F: "Freight", Y: "Yes",
    }[pass] || (pass || "—");
    const strac = (props.STRACNET || props.stracnet || "").toString().toUpperCase();
    const stracLabel = strac === "S" ? "STRACNET primary" : strac === "C" ? "STRACNET connector" : (strac || "—");
    const subdiv = props.SUBDIV || props.SUBDIVISION || props.Subdivision || "—";
    const miles = props.MILES != null ? Number(props.MILES).toFixed(3) + " mi" : "—";
    const trackDir = tracks === "1" ? "Single track" : tracks === "2" ? "Double track (bi-directional capacity)" : (tracks !== "—" ? tracks + " tracks" : "—");

    const skip = new Set(["SHAPE", "Shape", "shape", "geometry"]);
    const allRows = Object.keys(props || {})
      .filter((k) => !skip.has(k) && !/^SHAPE/i.test(k) && props[k] != null && props[k] !== "")
      .sort()
      .map((k) => `<div class="kv"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(String(props[k]))}</span></div>`)
      .join("");

    const profileHtml = profile ? `
      <div class="section-title">Class I carrier profile</div>
      <div class="kv"><span class="k">Railroad</span><span class="v">${escapeHtml(profile.name)}</span></div>
      <div class="kv"><span class="k">Parent</span><span class="v">${escapeHtml(profile.parent || "—")}</span></div>
      <div class="kv"><span class="k">Region</span><span class="v">${escapeHtml(profile.region || "—")}</span></div>
      <div class="kv"><span class="k">HQ</span><span class="v">${escapeHtml(profile.hq || "—")}</span></div>
      <div class="kv"><span class="k">Reporting marks</span><span class="v">${escapeHtml((profile.marks || []).join(", "))}</span></div>
      <div class="kv"><span class="k">Notes</span><span class="v">${escapeHtml(profile.notes || "")}</span></div>
      ${profile.systemMap ? `<p style="margin:0.4rem 0"><a class="ext-link" href="${escapeHtml(profile.systemMap)}" target="_blank" rel="noopener">Official system map / network ↗</a></p>` : ""}
    ` : (owner === "other" ? `<p class="disp-note">Class II/III, terminal, or shortline — see RROWNER fields below.</p>` : "");

    const html = `
      <div class="disp-badge">${escapeHtml(String(owner).toUpperCase())}</div>
      <div class="kv"><span class="k">Display name</span><span class="v">${escapeHtml(ownerName)}</span></div>
      <div class="kv"><span class="k">Primary Owner</span><span class="v">${escapeHtml(props.RROWNER1 || "—")}</span></div>
      <div class="kv"><span class="k">Owner 2 / 3</span><span class="v">${escapeHtml([props.RROWNER2, props.RROWNER3].filter(Boolean).join(" · ") || "—")}</span></div>
      <div class="kv"><span class="k">Trackage Rights</span><span class="v">${escapeHtml([props.TRKRGHTS1, props.TRKRGHTS2, props.TRKRGHTS3, props.TRKRGHTS4].filter(Boolean).join(" · ") || "—")}</span></div>
      <div class="kv"><span class="k">Subdivision</span><span class="v">${escapeHtml(subdiv)}</span></div>
      <div class="kv"><span class="k">Tracks / direction</span><span class="v">${escapeHtml(trackDir)}</span></div>
      <div class="kv"><span class="k">Passenger</span><span class="v">${escapeHtml(passLabel)}</span></div>
      <div class="kv"><span class="k">STRACNET</span><span class="v">${escapeHtml(stracLabel)}</span></div>
      <div class="kv"><span class="k">State</span><span class="v">${escapeHtml(props.STATEAB || props.STATE || "—")}</span></div>
      <div class="kv"><span class="k">Segment length</span><span class="v">${escapeHtml(miles)}</span></div>
      <div class="kv"><span class="k">FRA ARC / OBJECTID</span><span class="v">${escapeHtml(String(props.FRAARCID || props.OBJECTID || "—"))}</span></div>
      <div class="kv"><span class="k">Yard</span><span class="v">${escapeHtml(props.YARDNAME || "—")}</span></div>
      ${profileHtml}
      <div class="section-title">All NARN attributes (this segment)</div>
      ${allRows || "<em>No attributes returned</em>"}
      <p class="disp-note">Source: FRA/BTS North American Rail Network. Proprietary CTC/AEI/hot-box data is not public. Carrier ops systems (UP/BNSF/CSX/NS/CN/CPKC) do not publish live freight GPS APIs.</p>
    `;
    const ll = latlng || (bounds && bounds.getCenter ? bounds.getCenter() : null);
    openMeta("TRACK · " + (props.RROWNER1 || ownerName) + (subdiv && subdiv !== "—" ? " · " + subdiv : ""), html, ll);
  }

  function showTrainMeta(t, latlng) {
    const stations = (t.stations || []).slice(0, 12).map((s) =>
      `<div class="kv"><span class="k">${escapeHtml(s.code)}</span><span class="v">${escapeHtml(s.name || "")} · ${escapeHtml(s.status || "")}</span></div>`
    ).join("");

    const html = `
      <div class="section-title">Train</div>
      <div class="kv"><span class="k">Number</span><span class="v">${escapeHtml(t.trainNum)}</span></div>
      <div class="kv"><span class="k">Name</span><span class="v">${escapeHtml(t.routeName || "—")}</span></div>
      <div class="kv"><span class="k">ID</span><span class="v">${escapeHtml(t.trainID || "—")}</span></div>
      <div class="kv"><span class="k">Status</span><span class="v"><span class="badge green">${escapeHtml(t.trainTimely || t.trainState || t.statusMsg || "In transit")}</span></span></div>
      <div class="kv"><span class="k">Position</span><span class="v">${Number(t.lat).toFixed(4)}, ${Number(t.lon).toFixed(4)}</span></div>
      <div class="kv"><span class="k">Heading / Speed</span><span class="v">${escapeHtml(String(t.heading ?? "—"))} · ${t.velocity != null ? Number(t.velocity).toFixed(1) + " mph" : "—"}</span></div>
      <div class="kv"><span class="k">Origin → Dest</span><span class="v">${escapeHtml(t.origCode || "")} → ${escapeHtml(t.destCode || "")}</span></div>
      <div class="kv"><span class="k">Provider</span><span class="v">${escapeHtml(t.provider || t.dataSource || "amtraker")}</span></div>

      <div class="section-title">Recent / Upcoming Stops</div>
      ${stations || "<em>No station list</em>"}
      <p style="margin-top:0.8rem;font-size:0.72rem;color:var(--text-muted)">Passenger data via Amtraker (community). Freight live positions are not public.</p>
    `;
    openMeta(`Train ${t.trainNum} — ${t.routeName || ""}`, html, latlng || (t.lat != null ? L.latLng(Number(t.lat), Number(t.lon)) : null));
  }

  function openMeta(title, bodyHtml, latlng) {
    const win = document.getElementById("meta-window");
    document.getElementById("meta-title").textContent = title;
    document.getElementById("meta-body").innerHTML = bodyHtml;
    win.classList.remove("hidden");
    win.classList.add("dispatcher-panel");

    const place = () => {
      // Normalize latlng from Leaflet LatLng, array, or {lat,lng}
      let ll = latlng;
      if (ll && typeof ll.lat === "function") ll = L.latLng(ll.lat(), ll.lng());
      else if (Array.isArray(ll) && ll.length >= 2) ll = L.latLng(ll[0], ll[1]);
      else if (ll && ll.lat != null && (ll.lng != null || ll.lon != null)) {
        ll = L.latLng(Number(ll.lat), Number(ll.lng != null ? ll.lng : ll.lon));
      } else if (!(ll && typeof ll.lat === "number")) {
        ll = null;
      }

      if (ll && state.map) {
        try {
          const pt = state.map.latLngToContainerPoint(ll);
          const mapEl = document.getElementById("map") || state.map.getContainer();
          const mapRect = mapEl.getBoundingClientRect();
          const w = Math.max(win.offsetWidth || 0, 320);
          const h = Math.max(win.offsetHeight || 0, 200);
          let left = mapRect.left + pt.x + 18;
          let top = mapRect.top + pt.y - 24;
          if (left + w > window.innerWidth - 10) left = mapRect.left + pt.x - w - 18;
          if (top + h > window.innerHeight - 10) top = window.innerHeight - h - 10;
          if (left < 10) left = 10;
          if (top < 56) top = 56;
          win.style.position = "fixed";
          win.style.left = Math.round(left) + "px";
          win.style.top = Math.round(top) + "px";
          win.style.right = "auto";
          win.style.bottom = "auto";
          win.classList.add("anchored");
          return;
        } catch (e) {
          console.warn("meta position", e);
        }
      }
      // Dock right if no coordinates
      win.classList.remove("anchored");
      win.style.left = "";
      win.style.top = "80px";
      win.style.right = "24px";
      win.style.bottom = "auto";
    };
    // Layout after paint so width/height are correct
    requestAnimationFrame(() => requestAnimationFrame(place));
  }

  // ---------- Search ----------
  
  function initCityFocus() {
    const sel = document.getElementById("city-focus");
    const chips = document.getElementById("city-chips");
    const sys = document.getElementById("city-systems");
    if (!sel || !CONFIG.CITY_PRESETS) return;
    CONFIG.CITY_PRESETS.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      sel.appendChild(opt);
    });
    const quick = ["nyc", "chi", "phi", "bos", "dc", "sf", "la"];
    quick.forEach((id) => {
      const c = CONFIG.CITY_PRESETS.find((x) => x.id === id);
      if (!c || !chips) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = c.name.split(" ")[0];
      b.addEventListener("click", () => flyToCity(c.id));
      chips.appendChild(b);
    });
    sel.addEventListener("change", () => flyToCity(sel.value));
    const resetBtn = document.getElementById("btn-reset-filters");
    if (resetBtn) resetBtn.addEventListener("click", resetAllFilters);
  }

  function flyToCity(id) {
    const c = (CONFIG.CITY_PRESETS || []).find((x) => x.id === id);
    if (!c) return;
    const sel = document.getElementById("city-focus");
    if (sel) sel.value = id;
    const sys = document.getElementById("city-systems");
    if (sys) sys.textContent = c.systems || "";

    // Enable passenger + local rail transit (NJT/SEPTA/light rail) without forcing all bus stops
    const enableKeys = ["amtrakStations", "passengerLines", "amtrak", "other", "transitLightRail", "transitCommuter", "transitSubway"];
    enableKeys.forEach((key) => {
      const el = document.querySelector(`input[data-layer="${key}"]`);
      if (!el) return;
      el.checked = true;
    });
    // Mount passenger layers; transit route types only if already checked by user
    ["amtrakStations", "passengerLines"].forEach((key) => {
      const el = document.querySelector(`input[data-layer="${key}"]`);
      if (el) el.checked = true;
      if (state.layers[key] && !state.map.hasLayer(state.layers[key])) {
        state.layers[key].addTo(state.map);
      }
    });
    ["transitSubway", "transitLightRail", "transitCommuter", "transitBus", "transitRoutes"].forEach((key) => {
      if (!isLayerChecked(key)) return;
      if (state.layers[key] && !state.map.hasLayer(state.layers[key])) {
        state.layers[key].addTo(state.map);
      }
    });
    if (state.layers.rails && !state.map.hasLayer(state.layers.rails)) {
      state.layers.rails.addTo(state.map);
    }

    let cityLoadDone = false;
    const onDone = () => {
      if (cityLoadDone) return;
      cityLoadDone = true;
      state.map.off("moveend", onDone);
      state.useClass1Only = false; // show Class I + local detail
      // Explicit city bbox query (don't rely only on map bounds mid-animation)
      const cityBounds = L.latLngBounds([c.south, c.west], [c.north, c.east]);
      state.map.fitBounds(cityBounds, { padding: [20, 20], maxZoom: 12.5, animate: false });
      Promise.all([
        loadTransitRoutes(),
        loadTransitStops(),
        loadAmtrakStations(),
        loadPassengerLines(),
        loadRailsForView(),
      ]).then(() => {
        toast(c.name + " — transit routes + freight/passenger rails plotted", "success");
      }).catch((err) => {
        console.error(err);
        toast("City load partial — check console", "error");
      });
    };
    state.map.once("moveend", onDone);
    state.map.fitBounds(
      [
        [c.south, c.west],
        [c.north, c.east],
      ],
      { padding: [48, 48], maxZoom: 12.5, animate: true }
    );
    toast(c.name + " — " + (c.systems || "loading transit…"), "success");
    setTimeout(onDone, 900);
  }

  function resetAllFilters() {
    document.querySelectorAll("input[data-layer]").forEach((el) => {
      const on = ["bnsf", "up", "csx", "ns", "cn", "cpkc", "amtrak", "other", "trains", "cameras", "class1only", "amtrakStations"].includes(el.dataset.layer);
      el.checked = on;
    });
    const pass = document.getElementById("filter-passenger-only");
    if (pass) pass.checked = false;
    const city = document.getElementById("city-focus");
    if (city) city.value = "";
    const sys = document.getElementById("city-systems");
    if (sys) sys.textContent = "";
    const st = document.getElementById("state-focus");
    if (st) st.value = "";
    state.map.setView(CONFIG.DEFAULT_CENTER, CONFIG.DEFAULT_ZOOM);
    toast("Filters reset", "success");
    if (typeof loadRailsForView === "function") loadRailsForView();
  }

function initSearch() {
    const input = document.getElementById("global-search");
    const results = document.getElementById("search-results");
    let debounce;
    state.searchScope = state.searchScope || "all";

    input.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => runSearch(input.value.trim()), 320);
    });
    input.addEventListener("focus", () => {
      if (input.value.trim()) results.classList.remove("hidden");
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".search-wrap")) results.classList.add("hidden");
    });

    const scope = document.getElementById("search-scope");
    if (scope) {
      scope.querySelectorAll(".scope-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          scope.querySelectorAll(".scope-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          state.searchScope = btn.dataset.scope || "all";
          const placeholders = {
            all: "County, township, ZIP, station, train…",
            county: "County name — e.g. Somerset County NJ",
            township: "Township — e.g. Montgomery Township NJ",
            zip: "5-digit ZIP — e.g. 08558",
          };
          input.placeholder = placeholders[state.searchScope] || placeholders.all;
          if (input.value.trim()) runSearch(input.value.trim());
        });
      });
    }
  }

  function rebuildSearchIndex(trainData) {
    const items = [];
    // Live trains
    Object.values(trainData || {}).forEach((arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((t) => {
        items.push({
          type: "train",
          label: `Train ${t.trainNum} — ${t.routeName || ""}`,
          lat: t.lat,
          lon: t.lon,
          data: t,
        });
      });
    });
    // Nationwide Amtrak stations (La Plata, etc.)
    (state.amtrakStationIndex || []).forEach((s) => items.push(s));
    // City presets
    (CONFIG.CITY_PRESETS || []).forEach((c) => {
      items.push({
        type: "city",
        label: c.name + (c.systems ? " · " + c.systems : ""),
        lat: (c.south + c.north) / 2,
        lon: (c.west + c.east) / 2,
        data: c,
      });
    });
    // Railcams
    if (typeof RAILCAMS !== "undefined") {
      RAILCAMS.forEach((cam) => {
        items.push({
          type: "camera",
          label: cam.name + (cam.channel ? " · " + cam.channel : ""),
          lat: cam.lat, lon: cam.lng || cam.lon,
          data: cam,
        });
      });
    }
    state.searchIndex = items;
  }

  function runSearch(q) {
    const results = document.getElementById("search-results");
    if (!q || q.length < 1) {
      results.classList.add("hidden");
      return;
    }
    const lower = q.toLowerCase().trim();
    const tokens = lower.split(/\s+/).filter(Boolean);

    const matchItem = (i) => {
      const hay = [i.label, i.name, i.code, i.city, i.state]
        .filter(Boolean).join(" ").toLowerCase();
      return tokens.every((tok) => hay.includes(tok));
    };

    const stationHits = (state.amtrakStationIndex || []).filter(matchItem).slice(0, 10);
    const otherHits = state.searchIndex
      .filter((i) => i.type !== "station" && matchItem(i))
      .slice(0, 8);

    const scope = state.searchScope || "all";
    const local = scope === "all" ? [...stationHits, ...otherHits] : [];
    if (local.length) renderSearchResults(local, results);
    else if (scope !== "all") {
      results.innerHTML = `<div class="search-item"><em>Looking up ${escapeHtml(scope)}…</em></div>`;
      results.classList.remove("hidden");
    } else {
      renderSearchResults([], results);
    }

    geocodePlaces(q).then((places) => {
      const current = document.getElementById("global-search").value.trim();
      if (current.toLowerCase() !== lower) return;
      const merged = scope === "all" ? [...places, ...local] : [...places];
      const seen = new Set();
      const uniq = merged.filter((h) => {
        const k = (h.label || "").toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }).slice(0, 18);
      renderSearchResults(uniq, results);
    }).catch(() => {
      if (!local.length) renderSearchResults([], results);
    });
  }

  function renderSearchResults(all, resultsEl) {
    const results = resultsEl || document.getElementById("search-results");
    if (!all.length) {
      results.innerHTML = `<div class="search-item"><em>No matches — try ZIP, county, township, station, or train #</em></div>`;
      results.classList.remove("hidden");
      return;
    }
    const typeLabel = (t) =>
      ({ station: "Station", train: "Train", city: "City", camera: "Camera", owner: "Railroad",
         zip: "ZIP", county: "County", township: "Township", place: "Place" }[t] || t || "Result");

    results.innerHTML = all
      .map(
        (h, idx) =>
          `<div class="search-item" data-idx="${idx}">
            <div class="search-type">${escapeHtml(typeLabel(h.type))}</div>
            <div>${escapeHtml(h.label)}</div>
          </div>`
      )
      .join("");
    results.classList.remove("hidden");

    results.querySelectorAll(".search-item").forEach((el) => {
      el.addEventListener("click", () => {
        const h = all[+el.dataset.idx];
        if (!h) return;
        if (h.type === "place" || h.type === "zip" || h.type === "county" || h.type === "township") {
          if (h.bbox && h.bbox.length === 4) {
            // Nominatim: [south, north, west, east] or [minLat, maxLat, minLon, maxLon]
            const [s, n, w, e] = h.bbox.map(Number);
            state.map.fitBounds([[s, w], [n, e]], { padding: [48, 48], maxZoom: 14 });
          } else if (h.lat != null && h.lon != null) {
            const z = h.type === "zip" ? 13 : h.type === "county" ? 10 : 12;
            state.map.setView([h.lat, h.lon], z);
          }
          if (typeof loadRailsForView === "function") setTimeout(loadRailsForView, 400);
          toast("Centered on " + h.label, "success");
        } else if ((h.type === "train" || h.type === "station" || h.type === "camera") && h.lat != null) {
          state.map.setView([h.lat, h.lon], h.type === "station" ? 13 : 12);
          if (h.type === "train") showTrainMeta(h.data);
          else if (h.type === "station") showInfraMeta("amtrak", h.name || h.label, h.data || {}, (h.lat != null ? L.latLng(h.lat, h.lon) : null));
          else if (h.type === "camera" && h.data) {
            openMeta(h.label, `<p>Railcam · ${escapeHtml(h.data.channel || "")}</p>
              <iframe width="100%" height="220" src="https://www.youtube.com/embed/${escapeHtml(h.data.youtubeId || h.data.vid || h.data.yt || "")}?autoplay=1" allowfullscreen></iframe>`,
              h.lat != null ? L.latLng(h.lat, h.lon) : null);
          }
        } else if (h.type === "city" && h.data) {
          flyToCity(h.data.id);
        } else if (h.type === "owner") {
          const cb = document.querySelector(`input[data-layer="${h.cls}"]`);
          if (cb && !cb.checked) {
            cb.checked = true;
            if (typeof applyRailVisibility === "function") applyRailVisibility();
          }
          toast("Showing " + h.label, "success");
        }
        results.classList.add("hidden");
        document.getElementById("global-search").value = "";
      });
    });
  }

  let _geocodeTimer = null;
  let _geocodeCache = new Map();

  async function geocodePlaces(q) {
    const key = q.toLowerCase().trim();
    const scope = state.searchScope || "all";
    const cacheKey = scope + "|" + key;
    if (_geocodeCache.has(cacheKey)) return _geocodeCache.get(cacheKey);
    if (key.length < 2) return [];

    const isZip = /^\d{5}(-\d{4})?$/.test(key.replace(/\s/g, ""));
    const results = [];

    // Build one or more Nominatim queries based on scope
    const queries = [];
    if (scope === "zip" || (scope === "all" && isZip)) {
      queries.push({ postalcode: key.replace(/\D/g, "").slice(0, 5), countrycodes: "us", format: "json", addressdetails: "1", limit: "5" });
    }
    if (scope === "county" || scope === "all") {
      let cq = q;
      if (scope === "county" && !/county/i.test(q)) cq = q + " County";
      queries.push({ q: cq, countrycodes: "us", format: "json", addressdetails: "1", limit: "6", featuretype: "settlement" });
      // boundary search helps counties
      queries.push({ q: cq + " USA", countrycodes: "us", format: "json", addressdetails: "1", limit: "4" });
    }
    if (scope === "township" || scope === "all") {
      let tq = q;
      if (scope === "township" && !/township|twp/i.test(q)) tq = q + " Township";
      queries.push({ q: tq, countrycodes: "us", format: "json", addressdetails: "1", limit: "6" });
    }
    if (scope === "all" && !isZip) {
      queries.push({ q: q, countrycodes: "us", format: "json", addressdetails: "1", limit: "5" });
    }

    // Dedupe query strings
    const seenQ = new Set();
    const uniqueQueries = [];
    for (const p of queries) {
      const sig = JSON.stringify(p);
      if (seenQ.has(sig)) continue;
      seenQ.add(sig);
      uniqueQueries.push(p);
    }

    for (const p of uniqueQueries.slice(0, 3)) {
      try {
        const url = "https://nominatim.openstreetmap.org/search?" + new URLSearchParams(p).toString();
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) continue;
        const data = await res.json();
        if (!Array.isArray(data)) continue;
        for (const r of data) {
          const addr = r.address || {};
          let type = "place";
          if (isZip || addr.postcode) type = "zip";
          else if (addr.county || /county/i.test(r.display_name || "") || r.type === "administrative") {
            if (/township|twp/i.test(r.display_name || "") || addr.township) type = "township";
            else if (/county/i.test(r.display_name || "") || addr.county) type = "county";
          } else if (addr.township || /township|twp/i.test(r.display_name || "")) type = "township";

          // Scope filter
          if (scope === "county" && type !== "county" && type !== "place") continue;
          if (scope === "township" && type !== "township" && type !== "place") continue;
          if (scope === "zip" && type !== "zip") continue;

          let bbox = null;
          if (Array.isArray(r.boundingbox) && r.boundingbox.length === 4) {
            bbox = r.boundingbox.map(Number);
          }
          const label =
            r.display_name ||
            [addr.postcode, addr.township, addr.county, addr.state].filter(Boolean).join(", ");
          const lat = parseFloat(r.lat);
          const lon = parseFloat(r.lon);
          if (Number.isNaN(lat) || Number.isNaN(lon)) continue;
          results.push({ type, label, lat, lon, bbox, data: r });
        }
      } catch (e) {
        console.warn("geocode", e);
      }
    }

    // Prefer county/township/zip ordering when scope is all
    const rank = { zip: 0, county: 1, township: 2, place: 3 };
    results.sort((a, b) => (rank[a.type] ?? 9) - (rank[b.type] ?? 9));

    const dedup = [];
    const seen = new Set();
    for (const r of results) {
      const k = (r.label || "").toLowerCase().slice(0, 80);
      if (seen.has(k)) continue;
      seen.add(k);
      dedup.push(r);
    }
    const out = dedup.slice(0, 8);
    _geocodeCache.set(cacheKey, out);
    return out;
  }

  // ---------- Live railcams ----------
  function loadCameras() {
    if (typeof RAILCAMS === "undefined") return;
    state.layers.cameras.clearLayers();
    RAILCAMS.forEach((cam) => {
      const icon = L.divIcon({
        className: "rsx-marker-wrap",
        html: `<div class="camera-marker" title="${escapeHtml(cam.name)}">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path fill="currentColor" d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
          </svg>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const m = L.marker([cam.lat, cam.lon], { icon, zIndexOffset: 900 });
      m.on("click", (ev) => showCameraMeta(cam, ev.latlng));
      m.addTo(state.layers.cameras);
    });
  }

  function showCameraMeta(cam, latlng) {
    let embed = "";
    if (cam.yt) {
      embed = `<iframe src="https://www.youtube.com/embed/${escapeHtml(cam.yt)}?autoplay=1" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin"></iframe>
        <p style="margin-top:0.4rem"><a class="ext-link" href="https://www.youtube.com/watch?v=${escapeHtml(cam.yt)}" target="_blank" rel="noopener">Open on YouTube ↗</a></p>`;
    } else {
      const chLinks = (typeof CAMERA_CHANNELS !== "undefined" ? CAMERA_CHANNELS : [])
        .map((c) => `<a class="ext-link" href="${escapeHtml(c.url)}" target="_blank" rel="noopener">${escapeHtml(c.name)} ↗</a>`)
        .join("");
      embed = `<p style="font-size:0.8rem;color:var(--text-muted)">No fixed public embed ID for this marker right now. Open the channel live list:</p>${chLinks}`;
    }
    const html = `
      <div class="section-title">Live Railcam</div>
      <div class="kv"><span class="k">Location</span><span class="v">${escapeHtml(cam.name)}</span></div>
      <div class="kv"><span class="k">Railroad</span><span class="v">${escapeHtml(cam.railroad || "—")}</span></div>
      <div class="kv"><span class="k">Channel</span><span class="v">${escapeHtml(cam.channel || "—")}</span></div>
      <div class="kv"><span class="k">Notes</span><span class="v">${escapeHtml(cam.note || "")}</span></div>
      ${embed}
      <p style="margin-top:0.6rem;font-size:0.7rem;color:var(--text-muted)">Third-party streams (VRF, Railside Live, Iron Rail Cams, SouthWest RailCams, RailStream, etc.). IDs rotate; if offline, use the channel /streams page. Some cams require membership on the operator site.</p>
    `;
    openMeta("Railcam — " + cam.name, html, latlng || (cam.lat != null ? L.latLng(cam.lat, cam.lon || cam.lng) : null));
  }

  function showEmergencyContacts() {
    const rows = (typeof CLASS1_EMERGENCY !== "undefined" ? CLASS1_EMERGENCY : [])
      .map((c) => `
        <div class="kv">
          <span class="k">${escapeHtml(c.code)}</span>
          <span class="v">${escapeHtml(c.name)}<br>
            <a href="tel:${escapeHtml(c.phone)}">${escapeHtml(c.phone)}</a>
            · <a href="${escapeHtml(c.url)}" target="_blank" rel="noopener">info ↗</a>
          </span>
        </div>`)
      .join("");
    const html = `
      <div class="section-title">Class I / Amtrak Emergency</div>
      ${rows || "<em>No contacts loaded</em>"}
      <div class="section-title">AskRail</div>
      <p style="font-size:0.82rem;line-height:1.45">AskRail provides railcar hazmat / consist lookup for <strong>verified first responders only</strong> (no public API).</p>
      <p><a class="ext-link" href="https://www.askrail.us/" target="_blank" rel="noopener">AskRail portal ↗</a></p>
      <p><a class="ext-link" href="https://public.railinc.com/products-services/askrail" target="_blank" rel="noopener">Railinc AskRail info ↗</a></p>
      <p style="margin-top:0.6rem;font-size:0.7rem;color:var(--text-muted)">Always confirm contacts with the railroad. This is not a substitute for official emergency channels.</p>
    `;
    openMeta("Emergency & AskRail", html);
  }

  // ---------- UI helpers ----------
  async function softRefresh() {
    const brand = document.getElementById("brand-refresh");
    if (brand) brand.classList.add("refreshing");
    toast("Soft refresh — live data…");
    try {
      await Promise.all([
        loadTrains(),
        typeof loadRailsForView === "function" ? loadRailsForView() : Promise.resolve(),
        typeof loadAmtrakStations === "function" ? loadAmtrakStations() : Promise.resolve(),
        typeof loadAmtrakStationIndex === "function" ? loadAmtrakStationIndex() : Promise.resolve(),
      ]);
      // re-pull transit if those layers are on
      const tr = document.querySelector('input[data-layer="transitSubway"]');
      if (tr && tr.checked && typeof loadTransitRoutes === "function") await loadTransitRoutes();
      updateStatusBar();
      toast("Refresh complete", "success");
    } catch (e) {
      console.error(e);
      toast("Refresh partial — " + (e.message || "error"), "error");
    } finally {
      if (brand) setTimeout(() => brand.classList.remove("refreshing"), 600);
    }
  }

  function bindUI() {
    const btn = document.getElementById("btn-refresh");
    if (btn) btn.addEventListener("click", () => softRefresh());
    const brand = document.getElementById("brand-refresh");
    if (brand) {
      brand.addEventListener("click", () => softRefresh());
      brand.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); softRefresh(); }
      });
    }
    document.getElementById("btn-fullscreen").addEventListener("click", () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    });
    const em = document.getElementById("btn-emergency");
    if (em) em.addEventListener("click", showEmergencyContacts);
  }

  function updateStatusBar() {
    const el = document.getElementById("last-refresh");
    const ageEl = document.getElementById("data-age");
    if (state.lastRefresh) {
      el.textContent = state.lastRefresh.toLocaleTimeString();
      const ageSec = Math.round((Date.now() - state.lastRefresh.getTime()) / 1000);
      ageEl.textContent = ageSec < 60 ? ageSec + "s" : Math.round(ageSec / 60) + "m";
    }
  }

  function updateZoomLabel() {
    document.getElementById("zoom-level").textContent = "Z " + state.map.getZoom();
  }

  function toast(msg, type = "") {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className = "toast " + (type || "");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add("hidden"), 3200);
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------- Boot ----------
  document.addEventListener("DOMContentLoaded", init);
})();
