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
    },
    useClass1Only: true,
    basemaps: {},
    activeBasemap: "dark",
    railCache: new Map(), // key = feature OBJECTID → layer
    pointCache: { nodes: new Map(), yards: new Map(), crossings: new Map() },
    trainMarkers: new Map(),
    loadedTileKeys: new Set(), // rails viewport keys already fetched
    lastTrainData: null,
    lastRefresh: null,
    queryInFlight: false,
    searchIndex: [], // stations + recent trains for search
  };

  // ---------- Init ----------
  function init() {
    initMap();
    initBasemaps();
    initLayerControls();
    initSearch();
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
    setInterval(loadTrains, CONFIG.REFRESH_MS);

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

    // Add empty layer groups
    Object.values(state.layers).forEach((lg) => lg.addTo(state.map));
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
      const st = e.target.value;
      if (st && CONFIG.STATE_BOUNDS[st]) {
        state.map.fitBounds(CONFIG.STATE_BOUNDS[st], { padding: [40, 40] });
      } else {
        state.map.setView(CONFIG.DEFAULT_CENTER, CONFIG.DEFAULT_ZOOM);
      }
      // reload rails for new view
      setTimeout(loadRailsForView, 300);
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
      props.rrowner1, props.rrowner2, props.rrowner3,
      props.OWNER, props.owner, props.RR,
    ].filter(Boolean).map((s) => String(s).toUpperCase().trim());

    for (const c of candidates) {
      if (c.includes("BNSF") || c === "BN") return "bnsf";
      if (c.includes("UP") || c === "UPRR") return "up";
      if (c.includes("CSX") || c === "CSXT") return "csx";
      if (c === "NS" || c.includes("NORFOLK")) return "ns";
      if (c === "CN" || c.includes("CANADIAN NATIONAL") || c === "GTW" || c === "IC") return "cn";
      if (c.includes("CPKC") || c === "CP" || c === "CPRS" || c === "KCS" || c === "KCSM") return "cpkc";
      if (c.includes("AMTRAK") || c === "ATK" || c === "AMTK" || c === "NRC") return "amtrak";
    }
    // Passenger flag can still mark Amtrak
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

  async function loadRailsForView() {
    if (state.queryInFlight) return;
    const bounds = state.map.getBounds();
    const zoom = state.map.getZoom();
    state.queryInFlight = true;

    // Zoom-aware strategy (ArcGIS maxRecordCount = 2000)
    // Low zoom → Class I official view + simplified geometry (full national system map)
    // Mid/high zoom → full NARN clipped to viewport
    const forceClass1 = state.useClass1Only || zoom < 7;
    const endpoint = forceClass1 && CONFIG.CLASS1_LINES
      ? CONFIG.CLASS1_LINES
      : CONFIG.NARN_LINES;

    // Geometry simplification in map units (degrees) — faster draw at national view
    let maxOffset = 0;
    if (zoom <= 5) maxOffset = 0.08;
    else if (zoom <= 7) maxOffset = 0.03;
    else if (zoom <= 9) maxOffset = 0.008;
    else if (zoom <= 11) maxOffset = 0.002;

    const geom = {
      xmin: bounds.getWest(),
      ymin: bounds.getSouth(),
      xmax: bounds.getEast(),
      ymax: bounds.getNorth(),
      spatialReference: { wkid: 4326 },
    };

    // At very low zoom expand envelope slightly so edges aren't clipped
    if (zoom <= 5) {
      const pad = 2;
      geom.xmin -= pad; geom.xmax += pad;
      geom.ymin -= pad; geom.ymax += pad;
    }

    try {
      // Fetch up to 2 pages when zoomed in enough to need density
      const pages = zoom >= 8 ? 2 : 1;
      let allFeatures = [];

      for (let page = 0; page < pages; page++) {
        const params = new URLSearchParams({
          f: "geojson",
          where: "1=1",
          outFields: "OBJECTID,RROWNER1,RROWNER2,RROWNER3,PASSNGR,STRACNET,TRACKS,YARDNAME,SUBDIV,MILES,STATEAB,FRAARCID",
          geometry: JSON.stringify(geom),
          geometryType: "esriGeometryEnvelope",
          inSR: "4326",
          spatialRel: "esriSpatialRelIntersects",
          outSR: "4326",
          resultRecordCount: String(CONFIG.MAX_RECORDS),
          resultOffset: String(page * CONFIG.MAX_RECORDS),
        });
        if (maxOffset > 0) {
          params.set("maxAllowableOffset", String(maxOffset));
        }

        const url = `${endpoint}/query?${params.toString()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("NARN query failed: " + res.status);
        const geojson = await res.json();
        if (geojson.error) throw new Error(geojson.error.message || "ArcGIS error");
        if (!geojson.features || !geojson.features.length) break;
        allFeatures = allFeatures.concat(geojson.features);
        if (geojson.features.length < CONFIG.MAX_RECORDS) break;
      }

      if (!allFeatures.length) {
        toast("No rail segments in view", "error");
        return;
      }

      const enabledOwners = getEnabledOwners();
      let added = 0;

      // PowerGrid-style: keep previously loaded segments; only add new OBJECTIDs
      allFeatures.forEach((feature) => {
        const oid = feature.properties?.OBJECTID ?? feature.properties?.FRAARCID;
        if (oid == null) return;
        const key = String(oid);
        if (state.railCache.has(key)) return;

        const cls = classifyOwner(feature.properties);
        if (!enabledOwners.has(cls)) return;

        const layer = L.geoJSON(feature, {
          style: () => styleForOwner(cls, feature.properties, zoom),
          onEachFeature: (f, lyr) => {
            lyr._railProps = f.properties;
            lyr.feature = f;
            lyr.on("click", () => showRailMeta(f.properties, lyr.getBounds?.()));
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

      // Re-apply owner filter visibility on cached layers
      applyOwnerFilter();

      const mode = forceClass1 ? "Class I system map" : "Full NARN";
      toast(`${mode}: +${added} new / ${state.railCache.size} cached`, "success");
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
  async function loadTrains() {
    try {
      const res = await fetch(CONFIG.AMTRAKER_TRAINS);
      if (!res.ok) throw new Error("Amtraker HTTP " + res.status);
      const data = await res.json();
      state.lastTrainData = data;
      state.lastRefresh = new Date();
      renderTrains(data);
      updateStatusBar();
      // build light search index
      rebuildSearchIndex(data);
    } catch (err) {
      console.error("Train load failed", err);
      toast("Live train feed unavailable", "error");
      document.getElementById("live-indicator").style.opacity = "0.4";
    }
  }

  function renderTrains(data) {
    state.layers.trains.clearLayers();
    state.trainMarkers.clear();
    let count = 0;

    Object.values(data).forEach((arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((t) => {
        if (t.lat == null || t.lon == null) return;
        count++;
        const label = escapeHtml(t.trainNum || "");
        const icon = L.divIcon({
          className: "rsx-marker-wrap",
          html: `<div class="train-marker" title="${escapeHtml(t.routeName || t.trainNum)}">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path fill="currentColor" d="M12 2c-4 0-7 1.5-7 4v8c0 1.1.9 2 2 2h1l-1.5 3h2l1-2h3l1 2h2L13 16h1c1.1 0 2-.9 2-2V6c0-2.5-3-4-7-4zm-3.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm7 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM7 8h10v3H7V8z"/>
            </svg>
            <span class="tm-num">${label}</span>
          </div>`,
          iconSize: [36, 22],
          iconAnchor: [18, 11],
        });
        const marker = L.marker([t.lat, t.lon], { icon, zIndexOffset: 1000 });
        marker.trainData = t;
        marker.on("click", () => showTrainMeta(t));
        marker.addTo(state.layers.trains);
        state.trainMarkers.set(t.trainID || t.trainNum + "-" + t.lat, marker);
      });
    });

    document.getElementById("train-count").textContent = count;
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
      m.on("click", () => showYardMeta(p, title));
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
      m.on("click", () => showCrossingMeta(p, title));
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
    m.on("click", () => showNodeMeta(p, title));
    return m;
  }

  function showNodeMeta(p, title) {
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
    openMeta(title || "Network Node", html);
  }

  function showCrossingMeta(p, title) {
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
    openMeta(title || "Grade Crossing", html);
  }

  function showYardMeta(p, title) {
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
      <div class="section-title">Yard / Facility</div>
      ${rows || "<em>Named facility</em>"}
      <div class="section-title">Attributes</div>
      ${extra || ""}
    `);
  }


  async function loadAmtrakStations() {
    await loadNamedPointLayer(CONFIG.AMTRAK_STATIONS, state.layers.amtrakStations, "amtrakStations", (p) => {
      return p.Name || p.StationName || p.STNNAME || p.Code || "Amtrak Station";
    }, "amtrak");
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
    if (state.map.getZoom() < 10) return;
    // Prefer rail / subway / tram stops when location_type or route info available
    await loadNamedPointLayer(CONFIG.NTM_STOPS, state.layers.transitStops, "transitStops", (p) => {
      return p.stop_name || p.STOP_NAME || p.stop_id || "Transit Stop";
    }, "transit", null);
  }

  async function loadTransitRoutes() {
    // Commuter / rail routes from National Transit Map (route_type 0,1,2)
    const bounds = state.map.getBounds();
    const geom = {
      xmin: bounds.getWest(), ymin: bounds.getSouth(),
      xmax: bounds.getEast(), ymax: bounds.getNorth(),
      spatialReference: { wkid: 4326 },
    };
    const params = new URLSearchParams({
      f: "geojson",
      where: "route_type IN (0,1,2)",
      outFields: "OBJECTID,route_id,route_short_name,route_long_name,route_type,route_type_text,agency_id,ntd_id",
      geometry: JSON.stringify(geom),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outSR: "4326",
      resultRecordCount: "1500",
      maxAllowableOffset: state.map.getZoom() < 9 ? "0.01" : "0.001",
    });
    try {
      const res = await fetch(`${CONFIG.NTM_ROUTES}/query?${params}`);
      const geojson = await res.json();
      if (!geojson.features) return;
      // Clear only this layer group redraw for routes (lines change by viewport)
      state.layers.transitRoutes.clearLayers();
      L.geoJSON(geojson, {
        style: (f) => {
          const t = f.properties.route_type;
          const color = t === 1 ? "#a855f7" : t === 2 ? "#00c2ff" : "#f472b6";
          return { color, weight: 2.5, opacity: 0.85 };
        },
        onEachFeature: (f, layer) => {
          const p = f.properties;
          const name = p.route_long_name || p.route_short_name || p.route_id || "Transit route";
          layer.on("click", () => {
            openMeta(name, `
              <div class="section-title">Commuter / Transit Route</div>
              <div class="kv"><span class="k">Name</span><span class="v">${escapeHtml(name)}</span></div>
              <div class="kv"><span class="k">Short name</span><span class="v">${escapeHtml(p.route_short_name || "—")}</span></div>
              <div class="kv"><span class="k">Type</span><span class="v">${escapeHtml(p.route_type_text || String(p.route_type))}</span></div>
              <div class="kv"><span class="k">Agency / NTD</span><span class="v">${escapeHtml(String(p.agency_id || ""))} · ${escapeHtml(String(p.ntd_id || ""))}</span></div>
              <p style="margin-top:0.5rem;font-size:0.72rem;color:var(--text-muted)">National Transit Map (BTS) — GTFS-based. Includes subway (1), rail/commuter (2), tram (0).</p>
            `);
          });
        },
      }).addTo(state.layers.transitRoutes);
      toast(`Transit routes: ${geojson.features.length}`, "success");
    } catch (e) {
      console.error("transit routes", e);
    }
  }

  async function loadPassengerLines() {
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
        style: { color: "#00c2ff", weight: 3, opacity: 0.9 },
        onEachFeature: (f, layer) => {
          layer.on("click", () => showRailMeta(f.properties));
        },
      }).addTo(state.layers.passengerLines);
      toast(`Passenger rail lines: ${geojson.features.length}`, "success");
    } catch (e) {
      console.error("passenger lines", e);
    }
  }

  async function loadNamedPointLayer(endpoint, layerGroup, cacheKey, titleFn, kind, whereClause) {
    if (!endpoint) return;
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
        marker.on("click", () => showInfraMeta(kind, title, p));
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

  function showInfraMeta(kind, title, p) {
    if (kind === "amtrak") {
      openMeta(title, `
        <div class="section-title">Amtrak Station</div>
        <div class="kv"><span class="k">Name</span><span class="v">${escapeHtml(p.Name || p.StationName || "—")}</span></div>
        <div class="kv"><span class="k">Code</span><span class="v">${escapeHtml(p.Code || p.STNCODE || "—")}</span></div>
        <div class="kv"><span class="k">Address</span><span class="v">${escapeHtml([p.Address1, p.City, p.State, p.ZipCode].filter(Boolean).join(", ") || "—")}</span></div>
        <div class="kv"><span class="k">Type</span><span class="v">${escapeHtml(p.StnType || p.StaType || "—")}</span></div>
        <p style="margin-top:0.5rem;font-size:0.72rem;color:var(--text-muted)">Source: BTS NTAD Amtrak Stations (from Amtrak).</p>
      `);
      return;
    }
    if (kind === "bridge") {
      const keys = ["Name","RROwner","RROWNER","Subdivision","Rail_MilePost","Bridge_Type","City","State","County"];
      const rows = keys.filter((k) => p[k] != null && p[k] !== "").map((k) =>
        `<div class="kv"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(String(p[k]))}</span></div>`
      ).join("");
      openMeta(title, `<div class="section-title">Railroad Bridge</div>${rows || "<em>Bridge structure</em>"}
        <p style="margin-top:0.5rem;font-size:0.72rem;color:var(--text-muted)">Source: FRA / BTS NTAD Railroad Bridges (approximate inventory).</p>`);
      return;
    }
    if (kind === "milepost") {
      openMeta(title, `
        <div class="section-title">Rail Milepost</div>
        <div class="kv"><span class="k">Milepost</span><span class="v">${escapeHtml(String(p.MILEPOST ?? "—"))}</span></div>
        <div class="kv"><span class="k">Subdivision</span><span class="v">${escapeHtml(p.SUBDIV || "—")}</span></div>
        <div class="kv"><span class="k">State</span><span class="v">${escapeHtml(p.STATEAB || "—")}</span></div>
      `);
      return;
    }
    // transit stop
    openMeta(title, `
      <div class="section-title">Transit / Commuter Stop</div>
      <div class="kv"><span class="k">Name</span><span class="v">${escapeHtml(p.stop_name || "—")}</span></div>
      <div class="kv"><span class="k">Stop ID</span><span class="v">${escapeHtml(String(p.stop_id || "—"))}</span></div>
      <div class="kv"><span class="k">Code</span><span class="v">${escapeHtml(p.stop_code || "—")}</span></div>
      <div class="kv"><span class="k">NTD / Feed</span><span class="v">${escapeHtml(String(p.ntd_id || ""))} · ${escapeHtml(String(p.feed_id || ""))}</span></div>
      <div class="kv"><span class="k">Description</span><span class="v">${escapeHtml(p.stop_desc || "—")}</span></div>
      <p style="margin-top:0.5rem;font-size:0.72rem;color:var(--text-muted)">National Transit Map (BTS) — GTFS stops (includes rail, subway, bus, etc.).</p>
    `);
  }

  function showGenericMeta(title, props) {
    const keys = Object.keys(props).filter((k) => !k.startsWith("SHAPE") && props[k] != null).slice(0, 30);
    const rows = keys.map((k) =>
      `<div class="kv"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(String(props[k]))}</span></div>`
    ).join("");
    openMeta(title, rows || "<em>No attributes</em>");
  }

  // ---------- Metadata floating window ----------
  function initMetaWindow() {
    document.getElementById("meta-close").addEventListener("click", () => {
      document.getElementById("meta-window").classList.add("hidden");
    });
  }

  function showRailMeta(props, bounds) {
    const owner = classifyOwner(props);
    const ownerInfo = CONFIG.OWNERS[Object.keys(CONFIG.OWNERS).find((k) => CONFIG.OWNERS[k].cls === owner)] || { name: owner.toUpperCase() };

    const html = `
      <div class="section-title">Ownership &amp; Control</div>
      <div class="kv"><span class="k">Primary Owner</span><span class="v">${escapeHtml(props.RROWNER1 || "—")}</span></div>
      <div class="kv"><span class="k">Owner 2</span><span class="v">${escapeHtml(props.RROWNER2 || "—")}</span></div>
      <div class="kv"><span class="k">Owner 3</span><span class="v">${escapeHtml(props.RROWNER3 || "—")}</span></div>
      <div class="kv"><span class="k">Classified As</span><span class="v"><span class="badge orange">${escapeHtml(ownerInfo.name || owner)}</span></span></div>

      <div class="section-title">Infrastructure</div>
      <div class="kv"><span class="k">Tracks</span><span class="v">${escapeHtml(props.TRACKS ?? "—")}</span></div>
      <div class="kv"><span class="k">Subdivision</span><span class="v">${escapeHtml(props.SUBDIV || "—")}</span></div>
      <div class="kv"><span class="k">Miles</span><span class="v">${escapeHtml(props.MILES ?? "—")}</span></div>
      <div class="kv"><span class="k">State</span><span class="v">${escapeHtml(props.STATEAB || "—")}</span></div>
      <div class="kv"><span class="k">Yard</span><span class="v">${escapeHtml(props.YARDNAME || "—")}</span></div>

      <div class="section-title">Service Flags</div>
      <div class="kv"><span class="k">Passenger</span><span class="v">${escapeHtml(props.PASSNGR || "—")}</span></div>
      <div class="kv"><span class="k">STRACNET</span><span class="v">${escapeHtml(props.STRACNET || "—")}</span></div>
      <div class="kv"><span class="k">FRA ARC ID</span><span class="v">${escapeHtml(props.FRAARCID || props.OBJECTID || "—")}</span></div>
    `;
    openMeta("Rail Segment — " + (props.RROWNER1 || "Unknown"), html);
  }

  function showTrainMeta(t) {
    const stations = (t.stations || []).slice(0, 12).map((s) =>
      `<div class="kv"><span class="k">${escapeHtml(s.code)}</span><span class="v">${escapeHtml(s.name || "")} · ${escapeHtml(s.status || "")}</span></div>`
    ).join("");

    const html = `
      <div class="section-title">Train</div>
      <div class="kv"><span class="k">Number</span><span class="v">${escapeHtml(t.trainNum)}</span></div>
      <div class="kv"><span class="k">Name</span><span class="v">${escapeHtml(t.routeName || "—")}</span></div>
      <div class="kv"><span class="k">ID</span><span class="v">${escapeHtml(t.trainID || "—")}</span></div>
      <div class="kv"><span class="k">Status</span><span class="v"><span class="badge green">${escapeHtml(t.trainTimely || "In transit")}</span></span></div>
      <div class="kv"><span class="k">Position</span><span class="v">${t.lat?.toFixed(4)}, ${t.lon?.toFixed(4)}</span></div>
      <div class="kv"><span class="k">Source</span><span class="v">${escapeHtml(t.dataSource || "amtraker")}</span></div>

      <div class="section-title">Recent / Upcoming Stops</div>
      ${stations || "<em>No station list</em>"}
      <p style="margin-top:0.8rem;font-size:0.72rem;color:var(--text-muted)">Passenger data via Amtraker (community). Freight live positions are not public.</p>
    `;
    openMeta(`Train ${t.trainNum} — ${t.routeName || ""}`, html);
  }

    function openMeta(title, bodyHtml) {
    document.getElementById("meta-title").textContent = title;
    document.getElementById("meta-body").innerHTML = bodyHtml;
    document.getElementById("meta-window").classList.remove("hidden");
  }

  // ---------- Search ----------
  function initSearch() {
    const input = document.getElementById("global-search");
    const results = document.getElementById("search-results");
    let debounce;

    input.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => runSearch(input.value.trim()), 180);
    });
    input.addEventListener("focus", () => {
      if (input.value.trim()) results.classList.remove("hidden");
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".search-wrap")) results.classList.add("hidden");
    });
  }

  function rebuildSearchIndex(trainData) {
    const items = [];
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
    state.searchIndex = items;
  }

  function runSearch(q) {
    const results = document.getElementById("search-results");
    if (!q || q.length < 1) {
      results.classList.add("hidden");
      return;
    }
    const lower = q.toLowerCase();
    const hits = state.searchIndex
      .filter((i) => i.label.toLowerCase().includes(lower))
      .slice(0, 12);

    // also allow railroad name quick jumps
    const ownerHits = Object.entries(CONFIG.OWNERS)
      .filter(([, v]) => v.name.toLowerCase().includes(lower) || v.cls.includes(lower))
      .map(([, v]) => ({ type: "owner", label: v.name, cls: v.cls }));

    const all = [...hits, ...ownerHits].slice(0, 15);
    if (!all.length) {
      results.innerHTML = `<div class="search-item"><em>No matches</em></div>`;
      results.classList.remove("hidden");
      return;
    }

    results.innerHTML = all
      .map(
        (h, idx) =>
          `<div class="search-item" data-idx="${idx}">
            <div class="type">${h.type}</div>
            <div>${escapeHtml(h.label)}</div>
          </div>`
      )
      .join("");
    results.classList.remove("hidden");

    results.querySelectorAll(".search-item").forEach((el) => {
      el.addEventListener("click", () => {
        const h = all[+el.dataset.idx];
        if (h.type === "train" && h.lat != null) {
          state.map.setView([h.lat, h.lon], 12);
          showTrainMeta(h.data);
        } else if (h.type === "owner") {
          // ensure that layer is on
          const cb = document.querySelector(`input[data-layer="${h.cls}"]`);
          if (cb && !cb.checked) {
            cb.checked = true;
            applyRailVisibility();
          }
          toast(`Showing ${h.label}`, "success");
        }
        results.classList.add("hidden");
        document.getElementById("global-search").value = "";
      });
    });
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
      m.on("click", () => showCameraMeta(cam));
      m.addTo(state.layers.cameras);
    });
  }

  function showCameraMeta(cam) {
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
    openMeta("Railcam — " + cam.name, html);
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
  function bindUI() {
    document.getElementById("btn-refresh").addEventListener("click", () => {
      loadTrains();
      loadRailsForView();
      toast("Refreshing…");
    });
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
