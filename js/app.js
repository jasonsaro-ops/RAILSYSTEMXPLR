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
    useClass1Only: false,
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

    // Initial load
    loadRailsForView();
    loadTrains();
    loadCameras();
    setInterval(loadTrains, CONFIG.REFRESH_MS);

    // Re-query rails when map moves significantly
    let moveTimer;
    state.map.on("moveend", () => {
      clearTimeout(moveTimer);
      moveTimer = setTimeout(loadRailsForView, 400);
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
    // Dark professional (Carto Dark Matter — no key required for reasonable use)
    state.basemaps.dark = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }
    );

    // Classic OSM street
    state.basemaps.osm = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }
    );

    // Esri World Imagery (satellite) — public endpoint
    state.basemaps.satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution:
          "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics",
        maxZoom: 19,
      }
    );

    state.basemaps.dark.addTo(state.map);
  }

  function setBasemap(name) {
    if (state.activeBasemap === name) return;
    state.map.removeLayer(state.basemaps[state.activeBasemap]);
    state.basemaps[name].addTo(state.map);
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

  function styleForOwner(cls, props) {
    const colors = {
      bnsf: "#ff6b00",
      up: "#ffd100",
      csx: "#0057b8",
      ns: "#cccccc",
      cn: "#ed1c24",
      cpkc: "#8b0000",
      amtrak: "#00a3e0",
      other: "#7a8a9e",
    };
    const weight = cls === "amtrak" ? 3.5 : 2.2;
    const opacity = cls === "other" ? 0.55 : 0.85;
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

    // Don't overload at very low zoom – sample or skip dense query
    if (zoom < 6) {
      // At national view we still want a sparse network; query with lower density via resultOffset or just proceed
    }

    state.queryInFlight = true;
    try {
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
        outFields: "OBJECTID,RROWNER1,RROWNER2,RROWNER3,PASSNGR,STRACNET,TRACKS,YARDNAME,SUBDIV,MILES,STATEAB,FRAARCID",
        geometry: JSON.stringify(geom),
        geometryType: "esriGeometryEnvelope",
        inSR: "4326",
        spatialRel: "esriSpatialRelIntersects",
        outSR: "4326",
        resultRecordCount: String(CONFIG.MAX_RECORDS),
      });

      const endpoint = state.useClass1Only && CONFIG.CLASS1_LINES
        ? CONFIG.CLASS1_LINES
        : CONFIG.NARN_LINES;
      const url = `${endpoint}/query?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("NARN query failed: " + res.status);
      const geojson = await res.json();

      if (!geojson.features) {
        console.warn("No features returned", geojson);
        return;
      }

      // Clear previous rail layers for simplicity (viewport-driven)
      state.layers.rails.clearLayers();
      state.railCache.clear();

      const enabledOwners = getEnabledOwners();

      L.geoJSON(geojson, {
        style: (feature) => {
          const cls = classifyOwner(feature.properties);
          return styleForOwner(cls, feature.properties);
        },
        filter: (feature) => {
          const cls = classifyOwner(feature.properties);
          return enabledOwners.has(cls);
        },
        onEachFeature: (feature, layer) => {
          layer._railProps = feature.properties;
          layer.on("click", () => showRailMeta(feature.properties, layer.getBounds?.()));
          // subtle hover
          layer.on("mouseover", () => layer.setStyle({ weight: 5, opacity: 1 }));
          layer.on("mouseout", () => {
            const cls = classifyOwner(feature.properties);
            layer.setStyle(styleForOwner(cls, feature.properties));
          });
        },
      }).addTo(state.layers.rails);

      toast(`Loaded ${geojson.features.length} rail segments`, "success");
    } catch (err) {
      console.error(err);
      toast("Rail network load error — check console / CORS", "error");
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

    // data is keyed by train number → array of train objects
    Object.values(data).forEach((arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((t) => {
        if (t.lat == null || t.lon == null) return;
        count++;
        const icon = L.divIcon({
          className: "",
          html: `<div class="train-marker" title="${escapeHtml(t.routeName || t.trainNum)}"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
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
                className: "",
                html: `<div class="yard-marker"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6],
              }),
            });
          }
          return L.circleMarker(latlng, {
            radius: type === "crossing" ? 3 : 4,
            color: type === "crossing" ? "#ffb020" : "#8b9bb4",
            fillColor: type === "crossing" ? "#ffb020" : "#8b9bb4",
            fillOpacity: 0.7,
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
        className: "",
        html: `<div class="camera-marker" title="${escapeHtml(cam.name)}"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
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
