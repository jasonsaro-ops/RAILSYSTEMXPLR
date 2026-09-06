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
    railCache: new Map(), // key = feature id → layer
    trainMarkers: new Map(),
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
    setInterval(loadTrains, CONFIG.REFRESH_MS);

    // Re-query rails when map moves significantly
    let moveTimer;
    state.map.on("moveend", () => {
      clearTimeout(moveTimer);
      moveTimer = setTimeout(loadRailsForView, 650);
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

      state.layers.rails.clearLayers();
      state.railCache.clear();

      if (!allFeatures.length) {
        toast("No rail segments in view", "error");
        return;
      }

      const enabledOwners = getEnabledOwners();
      const fc = { type: "FeatureCollection", features: allFeatures };

      L.geoJSON(fc, {
        style: (feature) => {
          const cls = classifyOwner(feature.properties);
          return styleForOwner(cls, feature.properties, zoom);
        },
        filter: (feature) => {
          const cls = classifyOwner(feature.properties);
          return enabledOwners.has(cls);
        },
        onEachFeature: (feature, layer) => {
          layer._railProps = feature.properties;
          layer.feature = feature;
          layer.on("click", () => showRailMeta(feature.properties, layer.getBounds?.()));
          layer.on("mouseover", () => layer.setStyle({ weight: Math.min(6, (layer.options.weight || 2) + 2), opacity: 1 }));
          layer.on("mouseout", () => {
            const cls = classifyOwner(feature.properties);
            layer.setStyle(styleForOwner(cls, feature.properties, zoom));
          });
        },
      }).addTo(state.layers.rails);

      const mode = forceClass1 ? "Class I system map" : "Full NARN";
      toast(`${mode}: ${allFeatures.length} segments`, "success");
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
    await loadPointLayer(CONFIG.RAIL_YARDS, state.layers.yards, "yard", (p) => {
      return p.NAME || p.YARDNAME || p.name || "Rail Yard";
    });
  }

  async function loadCrossings() {
    await loadPointLayer(CONFIG.GRADE_CROSSINGS, state.layers.crossings, "crossing", (p) => {
      return p.CROSSING || p.CrossingID || p.OBJECTID || "Grade Crossing";
    });
  }

  async function loadNodes() {
    await loadPointLayer(CONFIG.NARN_NODES, state.layers.nodes, "node", (p) => {
      return p.NODE_ID || p.OBJECTID || "Network Node";
    });
  }

  async function loadPointLayer(endpoint, layerGroup, type, titleFn) {
    const bounds = state.map.getBounds();
    const geom = {
      xmin: bounds.getWest(),
      ymin: bounds.getSouth(),
      xmax: bounds.getEast(),
      ymax: bounds.getNorth(),
      spatialReference: { wkid: 4326 },
    };
    const params = new URLSearchParams({
      f: "geojson",
      where: "1=1",
      outFields: "*",
      geometry: JSON.stringify(geom),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outSR: "4326",
      resultRecordCount: "1500",
    });
    try {
      const res = await fetch(`${endpoint}/query?${params}`);
      const geojson = await res.json();
      layerGroup.clearLayers();
      if (!geojson.features) return;
      L.geoJSON(geojson, {
        pointToLayer: (feature, latlng) => {
          if (type === "yard") {
            return L.marker(latlng, {
              icon: L.divIcon({
                className: "rsx-marker-wrap",
                html: `<div class="yard-marker" title="Yard">
                  <svg viewBox="0 0 24 24" width="12" height="12"><rect x="3" y="8" width="18" height="10" rx="1" fill="currentColor" opacity="0.9"/><rect x="6" y="4" width="4" height="4" fill="currentColor"/><rect x="14" y="4" width="4" height="4" fill="currentColor"/></svg>
                </div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              }),
            });
          }
          if (type === "crossing") {
            return L.marker(latlng, {
              icon: L.divIcon({
                className: "rsx-marker-wrap",
                html: `<div class="crossing-marker">✕</div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              }),
            });
          }
          return L.circleMarker(latlng, {
            radius: 3.5,
            color: "#8b9bb4",
            fillColor: "#8b9bb4",
            fillOpacity: 0.75,
            weight: 1,
          });
        },
        onEachFeature: (feature, layer) => {
          layer.on("click", () => showGenericMeta(titleFn(feature.properties), feature.properties));
        },
      }).addTo(layerGroup);
    } catch (e) {
      console.error(type + " load error", e);
    }
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

  function showGenericMeta(title, props) {
    const keys = Object.keys(props).filter((k) => !k.startsWith("SHAPE") && props[k] != null).slice(0, 25);
    const rows = keys.map((k) =>
      `<div class="kv"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(String(props[k]))}</span></div>`
    ).join("");
    openMeta(title, rows || "<em>No attributes</em>");
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
