import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre';
import type { Map as MaplibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './App.css';

import {
  ARCGIS,
  AMTRAKER_TRAINS,
  BASEMAPS,
  CITY_PRESETS,
  OWNERS,
  STATE_BOUNDS,
} from './config';
import {
  classifyOwner,
  queryArcGIS,
  type BBox,
  type FeatureCollection,
} from './data/arcgis';
import { RAILCAMS } from './data/cameras';

type LayerFlags = {
  class1: boolean;
  narn: boolean;
  yards: boolean;
  crossings: boolean;
  nodes: boolean;
  bridges: boolean;
  mileposts: boolean;
  amtrakStations: boolean;
  passengerLines: boolean;
  ntmRailRoutes: boolean;
  ntmAllRoutes: boolean;
  ntmStops: boolean;
  trains: boolean;
  cameras: boolean;
  owners: Record<string, boolean>;
};

type MetaState = {
  title: string;
  body: React.ReactNode;
} | null;

type Train = {
  trainNum: string;
  trainID?: string;
  routeName?: string;
  lat: number;
  lon: number;
  trainTimely?: string;
  dataSource?: string;
};

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

function bboxFromMap(map: MaplibreMap): BBox {
  const b = map.getBounds();
  return {
    west: b.getWest(),
    south: b.getSouth(),
    east: b.getEast(),
    north: b.getNorth(),
  };
}

function offsetForZoom(z: number): number {
  if (z < 6) return 0.05;
  if (z < 8) return 0.015;
  if (z < 10) return 0.004;
  return 0.001;
}

export default function App() {
  const mapRef = useRef<MapRef>(null);
  const loadTimer = useRef<number | null>(null);

  const [basemap, setBasemap] = useState<keyof typeof BASEMAPS>('dark');
  const [stateFocus, setStateFocus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [meta, setMeta] = useState<MetaState>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityId, setCityId] = useState('');
  const [trainCount, setTrainCount] = useState(0);
  const [lastRefresh, setLastRefresh] = useState('--');
  const [trains, setTrains] = useState<Train[]>([]);

  const [flags, setFlags] = useState<LayerFlags>({
    class1: true,
    narn: false,
    yards: false,
    crossings: false,
    nodes: false,
    bridges: false,
    mileposts: false,
    amtrakStations: true,
    passengerLines: false,
    ntmRailRoutes: true,
    ntmAllRoutes: false,
    ntmStops: false,
    trains: true,
    cameras: true,
    owners: {
      bnsf: true,
      up: true,
      csx: true,
      ns: true,
      cn: true,
      cpkc: true,
      amtrak: true,
      other: true,
    },
  });

  // GeoJSON sources (PowerGrid-style persistent caches via arcgis.ts)
  const [class1Data, setClass1Data] = useState<FeatureCollection>(EMPTY);
  const [narnData, setNarnData] = useState<FeatureCollection>(EMPTY);
  const [passengerData, setPassengerData] = useState<FeatureCollection>(EMPTY);
  const [ntmRailData, setNtmRailData] = useState<FeatureCollection>(EMPTY);
  const [ntmAllData, setNtmAllData] = useState<FeatureCollection>(EMPTY);
  const [ntmStopsData, setNtmStopsData] = useState<FeatureCollection>(EMPTY);
  const [yardsData, setYardsData] = useState<FeatureCollection>(EMPTY);
  const [crossingsData, setCrossingsData] = useState<FeatureCollection>(EMPTY);
  const [nodesData, setNodesData] = useState<FeatureCollection>(EMPTY);
  const [bridgesData, setBridgesData] = useState<FeatureCollection>(EMPTY);
  const [milepostsData, setMilepostsData] = useState<FeatureCollection>(EMPTY);
  const [amtrakData, setAmtrakData] = useState<FeatureCollection>(EMPTY);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2800);
  }, []);

  const activeBbox = useCallback((): BBox => {
    const map = mapRef.current?.getMap();
    if (stateFocus && STATE_BOUNDS[stateFocus]) {
      const [w, s, e, n] = STATE_BOUNDS[stateFocus];
      return { west: w, south: s, east: e, north: n };
    }
    if (map) return bboxFromMap(map);
    return { west: -125, south: 24, east: -66, north: 50 };
  }, [stateFocus]);

  const loadViewport = useCallback(async () => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const bbox = activeBbox();
    const z = map.getZoom();
    const offset = offsetForZoom(z);
    setLoading(true);

    try {
      const jobs: Promise<void>[] = [];

      if (flags.class1 || z < 7) {
        jobs.push(
          queryArcGIS({
            sourceKey: 'class1',
            url: ARCGIS.CLASS_I,
            bbox,
            outFields: 'OBJECTID,RROWNER1,RROWNER2,RROWNER3,PASSNGR,STRACNET,TRACKS,YARDNAME,SUBDIV,MILES,STATEAB,FRAARCID',
            maxAllowableOffset: offset,
          }).then((r) => {
            setClass1Data(r.collection);
            if (r.added) showToast(`Class I: +${r.added} / ${r.total} cached`);
          })
        );
      }

      if (flags.narn && z >= 7) {
        jobs.push(
          queryArcGIS({
            sourceKey: 'narn',
            url: ARCGIS.NARN_LINES,
            bbox,
            outFields: 'OBJECTID,RROWNER1,RROWNER2,RROWNER3,PASSNGR,STRACNET,TRACKS,YARDNAME,SUBDIV,MILES,STATEAB,FRAARCID',
            maxAllowableOffset: offset * 0.5,
          }).then((r) => {
            setNarnData(r.collection);
            if (r.added) showToast(`NARN: +${r.added} / ${r.total}`);
          })
        );
      }

      if (flags.passengerLines) {
        jobs.push(
          queryArcGIS({
            sourceKey: 'passenger',
            url: ARCGIS.PASSENGER_RAIL,
            bbox,
            outFields: 'OBJECTID,RROWNER1,PASSNGR,SUBDIV,STATEAB,TRACKS,FRAARCID',
            maxAllowableOffset: offset,
          }).then((r) => setPassengerData(r.collection))
        );
      }

      // National Transit Map — rail/commuter (0 tram, 1 subway, 2 rail)
      if (flags.ntmRailRoutes) {
        jobs.push(
          queryArcGIS({
            sourceKey: stateFocus ? `ntm-rail-${stateFocus}` : 'ntm-rail',
            url: ARCGIS.NTM_ROUTES,
            bbox,
            where: 'route_type IN (0,1,2)',
            outFields:
              'OBJECTID,route_id,route_short_name,route_long_name,route_type,route_type_text,agency_id,ntd_id,route_color',
            maxAllowableOffset: offset,
            maxRecords: 2000,
          }).then((r) => {
            setNtmRailData(r.collection);
            if (r.added) showToast(`NTM rail/commuter: +${r.added} / ${r.total}`);
          })
        );
      }

      // All transit modes nationwide / in view
      if (flags.ntmAllRoutes) {
        jobs.push(
          queryArcGIS({
            sourceKey: stateFocus ? `ntm-all-${stateFocus}` : 'ntm-all',
            url: ARCGIS.NTM_ROUTES,
            bbox,
            where: '1=1',
            outFields:
              'OBJECTID,route_id,route_short_name,route_long_name,route_type,route_type_text,agency_id,ntd_id,route_color',
            maxAllowableOffset: Math.max(offset, 0.01),
            maxRecords: 2000,
          }).then((r) => {
            setNtmAllData(r.collection);
            if (r.added) showToast(`NTM all modes: +${r.added} / ${r.total}`);
          })
        );
      }

      if (flags.ntmStops && (z >= 10 || cityId)) {
        jobs.push(
          queryArcGIS({
            sourceKey: stateFocus ? `ntm-stops-${stateFocus}` : 'ntm-stops',
            url: ARCGIS.NTM_STOPS,
            bbox,
            outFields: 'OBJECTID,stop_id,stop_name,stop_code,stop_desc,ntd_id,feed_id',
            maxRecords: 2000,
          }).then((r) => {
            setNtmStopsData(r.collection);
            if (r.added) showToast(`NTM stops: +${r.added} / ${r.total}`);
          })
        );
      }

      if (flags.amtrakStations) {
        jobs.push(
          queryArcGIS({
            sourceKey: 'amtrak-stations',
            url: ARCGIS.AMTRAK_STATIONS,
            bbox: stateFocus && STATE_BOUNDS[stateFocus]
              ? (() => {
                  const [w, s, e, n] = STATE_BOUNDS[stateFocus];
                  return { west: w, south: s, east: e, north: n };
                })()
              : { west: -125, south: 24, east: -66, north: 50 },
            outFields: '*',
            maxRecords: 2000,
          }).then((r) => setAmtrakData(r.collection))
        );
      }

      if (flags.yards && z >= 8) {
        jobs.push(
          queryArcGIS({
            sourceKey: 'yards',
            url: ARCGIS.RAIL_YARDS,
            bbox,
            maxRecords: 1500,
          }).then((r) => setYardsData(r.collection))
        );
      }

      if (flags.crossings && z >= 10) {
        jobs.push(
          queryArcGIS({
            sourceKey: 'crossings',
            url: ARCGIS.GRADE_CROSSINGS,
            bbox,
            maxRecords: 2000,
          }).then((r) => setCrossingsData(r.collection))
        );
      }

      if (flags.nodes && z >= 10) {
        jobs.push(
          queryArcGIS({
            sourceKey: 'nodes',
            url: ARCGIS.NARN_NODES,
            bbox,
            outFields: 'OBJECTID,FRANODEID,STATE,PASSNGR,PASSNGRSTN,BNDRY,FRADISTRCT,CTYFIPS',
            maxRecords: 2000,
          }).then((r) => setNodesData(r.collection))
        );
      }

      if (flags.bridges && z >= 9) {
        jobs.push(
          queryArcGIS({
            sourceKey: 'bridges',
            url: ARCGIS.RAILROAD_BRIDGES,
            bbox,
            maxRecords: 2000,
          }).then((r) => setBridgesData(r.collection))
        );
      }

      if (flags.mileposts && z >= 11) {
        jobs.push(
          queryArcGIS({
            sourceKey: 'mileposts',
            url: ARCGIS.RAIL_MILEPOSTS,
            bbox,
            outFields: 'OBJECTID,SUBDIV,MILEPOST,STATEAB',
            maxRecords: 2000,
          }).then((r) => setMilepostsData(r.collection))
        );
      }

      await Promise.allSettled(jobs);
    } finally {
      setLoading(false);
    }
  }, [flags, activeBbox, showToast, stateFocus, cityId]);

  const scheduleLoad = useCallback(() => {
    if (loadTimer.current) window.clearTimeout(loadTimer.current);
    loadTimer.current = window.setTimeout(() => {
      void loadViewport();
    }, 450);
  }, [loadViewport]);

  const loadTrains = useCallback(async () => {
    try {
      const res = await fetch(AMTRAKER_TRAINS);
      const data = await res.json();
      const list: Train[] = [];
      const values = Array.isArray(data) ? data : Object.values(data || {});
      for (const v of values as unknown[]) {
        const arr = Array.isArray(v) ? v : [v];
        for (const t of arr as Record<string, unknown>[]) {
          const lat = Number(t.lat ?? t.latitude);
          const lon = Number(t.lon ?? t.lng ?? t.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          list.push({
            trainNum: String(t.trainNum ?? t.number ?? '?'),
            trainID: t.trainID ? String(t.trainID) : undefined,
            routeName: t.routeName ? String(t.routeName) : String(t.route ?? ''),
            lat,
            lon,
            trainTimely: t.trainTimely ? String(t.trainTimely) : undefined,
            dataSource: 'amtraker',
          });
        }
      }
      setTrains(list);
      setTrainCount(list.length);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    void loadTrains();
    const id = window.setInterval(() => void loadTrains(), 120_000);
    return () => window.clearInterval(id);
  }, [loadTrains]);

  useEffect(() => {
    scheduleLoad();
  }, [flags, stateFocus, scheduleLoad]);

  const onMoveEnd = useCallback(() => scheduleLoad(), [scheduleLoad]);

  const flyState = (st: string) => {
    setStateFocus(st);
    setCityId('');
    if (!st) return;
    const b = STATE_BOUNDS[st];
    if (!b) return;
    mapRef.current?.fitBounds(
      [
        [b[0], b[1]],
        [b[2], b[3]],
      ],
      { padding: 40, duration: 900 }
    );
  };

  const flyCity = (id: string) => {
    setCityId(id);
    const city = CITY_PRESETS.find((c) => c.id === id);
    if (!city) {
      setCityId('');
      return;
    }
    setStateFocus('');
    // Enable transit layers for city view
    setFlags((f) => ({
      ...f,
      ntmRailRoutes: true,
      ntmStops: true,
      amtrakStations: true,
      passengerLines: true,
    }));
    const [w, s, e, n] = city.bbox;
    mapRef.current?.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      { padding: 36, duration: 1000 }
    );
    showToast(`${city.name}: ${city.systems}`);
  };

  const resetFilters = () => {
    setFlags({
      class1: true,
      narn: false,
      yards: false,
      crossings: false,
      nodes: false,
      bridges: false,
      mileposts: false,
      amtrakStations: true,
      passengerLines: false,
      ntmRailRoutes: true,
      ntmAllRoutes: false,
      ntmStops: false,
      trains: true,
      cameras: true,
      owners: {
        bnsf: true,
        up: true,
        csx: true,
        ns: true,
        cn: true,
        cpkc: true,
        amtrak: true,
        other: true,
      },
    });
    setStateFocus('');
    setCityId('');
    setSearchQuery('');
    setMeta(null);
    mapRef.current?.flyTo({ center: [-98.5, 39.8], zoom: 4.2, duration: 800 });
    showToast('Filters reset · nationwide view');
  };

  const searchHits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [] as { label: string; sub?: string; lng: number; lat: number; props?: Record<string, unknown> }[];
    const hits: { label: string; sub?: string; lng: number; lat: number; props?: Record<string, unknown> }[] = [];

    const pushFeat = (fc: FeatureCollection, labelKeys: string[], subKey?: string) => {
      for (const f of fc.features) {
        if (hits.length >= 25) break;
        const p = f.properties || {};
        const label = labelKeys.map((k) => p[k]).filter(Boolean).join(' · ') || '';
        if (!String(label).toLowerCase().includes(q)) continue;
        const g = f.geometry;
        if (!g) continue;
        let lng = 0, lat = 0;
        if (g.type === 'Point' && Array.isArray(g.coordinates)) {
          lng = g.coordinates[0] as number;
          lat = g.coordinates[1] as number;
        } else if (g.type === 'LineString' && Array.isArray(g.coordinates) && g.coordinates[0]) {
          const c0 = g.coordinates[0] as number[];
          lng = c0[0]; lat = c0[1];
        } else if (g.type === 'MultiLineString' && Array.isArray(g.coordinates) && g.coordinates[0]?.[0]) {
          const c0 = (g.coordinates as number[][][])[0][0];
          lng = c0[0]; lat = c0[1];
        } else continue;
        hits.push({
          label: String(label),
          sub: subKey ? String(p[subKey] || '') : undefined,
          lng,
          lat,
          props: p,
        });
      }
    };

    pushFeat(ntmStopsData, ['stop_name', 'stop_code'], 'ntd_id');
    pushFeat(ntmRailData, ['route_long_name', 'route_short_name'], 'route_type_text');
    pushFeat(amtrakData, ['Name', 'Code', 'City'], 'State');
    for (const c of CITY_PRESETS) {
      if (c.name.toLowerCase().includes(q) || c.systems.toLowerCase().includes(q)) {
        hits.push({ label: c.name, sub: c.systems, lng: c.center[0], lat: c.center[1] });
      }
    }
    for (const cam of RAILCAMS) {
      if (cam.name.toLowerCase().includes(q) || (cam.channel || '').toLowerCase().includes(q)) {
        hits.push({ label: cam.name, sub: cam.channel, lng: cam.lng, lat: cam.lat });
      }
    }
    return hits;
  }, [searchQuery, ntmStopsData, ntmRailData, amtrakData]);

  const openProps = (title: string, props: Record<string, unknown>, extra?: React.ReactNode) => {
    const keys = Object.keys(props)
      .filter((k) => !k.startsWith('SHAPE') && props[k] != null && props[k] !== '')
      .slice(0, 28);
    setMeta({
      title,
      body: (
        <>
          {extra}
          <div className="section-title">Attributes</div>
          {keys.map((k) => (
            <div className="kv" key={k}>
              <span className="k">{k}</span>
              <span className="v">{String(props[k])}</span>
            </div>
          ))}
        </>
      ),
    });
  };

  const onMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      const props = (f.properties || {}) as Record<string, unknown>;
      const layer = f.layer?.id || '';

      if (layer.includes('ntm')) {
        const name =
          String(props.route_long_name || props.route_short_name || props.stop_name || props.route_id || 'Transit');
        openProps(name, props, (
          <div className="section-title">National Transit Map</div>
        ));
        return;
      }
      if (layer.includes('rail') || layer.includes('class1') || layer.includes('passenger')) {
        const owner = classifyOwner(props);
        openProps(
          `Rail — ${String(props.RROWNER1 || owner)}`,
          props,
          <div className="section-title">Ownership · {OWNERS[owner]?.name || owner}</div>
        );
        return;
      }
      openProps(String(props.Name || props.stop_name || props.YARDNAME || 'Feature'), props);
    },
    []
  );

  const interactiveLayerIds = useMemo(
    () => [
      'class1-line',
      'narn-line',
      'passenger-line',
      'ntm-rail-line',
      'ntm-all-line',
      'ntm-stops-circle',
      'amtrak-circle',
      'yards-circle',
      'nodes-circle',
      'bridges-circle',
      'crossings-circle',
    ],
    []
  );

  const style = BASEMAPS[basemap].style;

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-mark">
            <i className="fa-solid fa-train" />
          </div>
          <div>
            <h1>RAILSYSTEMXPLR</h1>
            <p>US Railroad Network · NTM · Mission Ops</p>
          </div>
        </div>
        <div className="stats">
          <div className="stat">
            <span>Active trains</span>
            <strong>{trainCount}</strong>
          </div>
          <div className="stat">
            <span>Last refresh</span>
            <strong>{lastRefresh}</strong>
          </div>
        </div>
        <div className="live-pill">
          <span className="dot" /> LIVE
        </div>
        <div className="search-wrap">
          <i className="fa-solid fa-magnifying-glass" />
          <input
            value={searchQuery}
            placeholder="Search stops, routes, cities, railcams…"
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = (e.target as HTMLInputElement).value.trim().toUpperCase();
                if (STATE_BOUNDS[v]) flyState(v);
                else if (searchHits[0]) {
                  mapRef.current?.flyTo({ center: [searchHits[0].lng, searchHits[0].lat], zoom: 13, duration: 800 });
                }
              }
            }}
          />
          {searchHits.length > 0 && (
            <div className="search-results">
              {searchHits.map((h, i) => (
                <button
                  type="button"
                  key={i}
                  className="search-hit"
                  onClick={() => {
                    mapRef.current?.flyTo({ center: [h.lng, h.lat], zoom: 13.5, duration: 800 });
                    setSearchQuery('');
                    if (h.props) openProps(h.label, h.props);
                  }}
                >
                  <strong>{h.label}</strong>
                  {h.sub && <span>{h.sub}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="btn-reset" onClick={resetFilters} title="Reset filters">
          <i className="fa-solid fa-rotate-left" /> Reset
        </button>
      </header>

      <div className="body">
        <aside className="panel">
          <h2>Basemap</h2>
          {(Object.keys(BASEMAPS) as (keyof typeof BASEMAPS)[]).map((k) => (
            <label className="check-row" key={k}>
              <input
                type="radio"
                name="basemap"
                checked={basemap === k}
                onChange={() => setBasemap(k)}
              />
              {BASEMAPS[k].name}
            </label>
          ))}

          <h2>Class I freight</h2>
          {Object.entries(OWNERS)
            .filter(([k]) => k !== 'amtrak' && k !== 'other')
            .map(([k, v]) => (
              <label className="check-row" key={k}>
                <input
                  type="checkbox"
                  checked={flags.owners[k] !== false}
                  onChange={(e) =>
                    setFlags((f) => ({
                      ...f,
                      owners: { ...f.owners, [k]: e.target.checked },
                    }))
                  }
                />
                <span className="swatch" style={{ background: v.color }} />
                {v.name}
              </label>
            ))}
          <label className="check-row">
            <input
              type="checkbox"
              checked={flags.class1}
              onChange={(e) => setFlags((f) => ({ ...f, class1: e.target.checked }))}
            />
            Class I system map (nationwide)
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={flags.narn}
              onChange={(e) => setFlags((f) => ({ ...f, narn: e.target.checked }))}
            />
            Full NARN (all classes · zoom ≥ 7)
          </label>

          <h2>National Transit Map</h2>
          <label className="check-row">
            <input
              type="checkbox"
              checked={flags.ntmRailRoutes}
              onChange={(e) => setFlags((f) => ({ ...f, ntmRailRoutes: e.target.checked }))}
            />
            Rail / subway / tram / commuter
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={flags.ntmAllRoutes}
              onChange={(e) => setFlags((f) => ({ ...f, ntmAllRoutes: e.target.checked }))}
            />
            All transit modes (bus + rail)
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={flags.ntmStops}
              onChange={(e) => setFlags((f) => ({ ...f, ntmStops: e.target.checked }))}
            />
            Transit stops (zoom ≥ 10)
          </label>
          <p className="note">
            BTS National Transit Map — GTFS nationwide (subway, light rail, commuter, bus). Zoom into a city or pick a preset to load dense stops & routes.
          </p>

          <h2>Major city transit</h2>
          <select
            value={cityId}
            onChange={(e) => flyCity(e.target.value)}
          >
            <option value="">Select city…</option>
            {CITY_PRESETS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {cityId && (
            <p className="note">
              {CITY_PRESETS.find((c) => c.id === cityId)?.systems}
            </p>
          )}
          <div className="city-chips">
            {['nyc', 'chi', 'phi', 'bos', 'dc', 'sf', 'la'].map((id) => {
              const c = CITY_PRESETS.find((x) => x.id === id)!;
              return (
                <button
                  type="button"
                  key={id}
                  className={`chip ${cityId === id ? 'active' : ''}`}
                  onClick={() => flyCity(id)}
                >
                  {c.name.split(' ')[0]}
                </button>
              );
            })}
          </div>

          <h2>Passenger</h2>
          <label className="check-row">
            <input
              type="checkbox"
              checked={flags.amtrakStations}
              onChange={(e) => setFlags((f) => ({ ...f, amtrakStations: e.target.checked }))}
            />
            Amtrak stations
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={flags.passengerLines}
              onChange={(e) => setFlags((f) => ({ ...f, passengerLines: e.target.checked }))}
            />
            Passenger rail lines (NARN)
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={flags.trains}
              onChange={(e) => setFlags((f) => ({ ...f, trains: e.target.checked }))}
            />
            Live trains (Amtrak family)
          </label>

          <h2>Infrastructure</h2>
          <label className="check-row">
            <input type="checkbox" checked={flags.yards} onChange={(e) => setFlags((f) => ({ ...f, yards: e.target.checked }))} />
            Rail yards
          </label>
          <label className="check-row">
            <input type="checkbox" checked={flags.crossings} onChange={(e) => setFlags((f) => ({ ...f, crossings: e.target.checked }))} />
            Grade crossings
          </label>
          <label className="check-row">
            <input type="checkbox" checked={flags.nodes} onChange={(e) => setFlags((f) => ({ ...f, nodes: e.target.checked }))} />
            Network nodes
          </label>
          <label className="check-row">
            <input type="checkbox" checked={flags.bridges} onChange={(e) => setFlags((f) => ({ ...f, bridges: e.target.checked }))} />
            Railroad bridges
          </label>
          <label className="check-row">
            <input type="checkbox" checked={flags.mileposts} onChange={(e) => setFlags((f) => ({ ...f, mileposts: e.target.checked }))} />
            Mileposts
          </label>
          <label className="check-row">
            <input type="checkbox" checked={flags.cameras} onChange={(e) => setFlags((f) => ({ ...f, cameras: e.target.checked }))} />
            Live railcams
          </label>

          <h2>State focus</h2>
          <select
            value={stateFocus}
            onChange={(e) => flyState(e.target.value)}
          >
            <option value="">Nationwide (viewport)</option>
            {Object.keys(STATE_BOUNDS)
              .sort()
              .map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
          </select>
          <p className="note">
            State focus constrains NTM + rail queries to that state bbox (PowerGrid-style regional load). Data stays cached when you pan.
          </p>
        </aside>

        <div className="map-wrap">
          {loading && <div className="loading-bar" />}
          <Map
            ref={mapRef}
            initialViewState={{ longitude: -98.5, latitude: 39.8, zoom: 4.2 }}
            mapStyle={style}
            onMoveEnd={onMoveEnd}
            onClick={onMapClick}
            interactiveLayerIds={interactiveLayerIds}
            attributionControl
          >
            <NavigationControl position="top-left" />

            {flags.class1 && (
              <Source id="class1" type="geojson" data={class1Data}>
                <Layer
                  id="class1-line"
                  type="line"
                  paint={{
                    'line-color': [
                      'match',
                      ['downcase', ['coalesce', ['get', 'RROWNER1'], '']],
                      'bnsf', '#e87722',
                      'up', '#ffcc00',
                      'csx', '#3b82f6',
                      'ns', '#e5e7eb',
                      'cn', '#ef4444',
                      'cp', '#a16207',
                      'cpkc', '#a16207',
                      'kcs', '#a16207',
                      '#94a3b8',
                    ],
                    'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.2, 10, 3.2],
                    'line-opacity': 0.9,
                  }}
                />
              </Source>
            )}

            {flags.narn && (
              <Source id="narn" type="geojson" data={narnData}>
                <Layer
                  id="narn-line"
                  type="line"
                  paint={{
                    'line-color': '#64748b',
                    'line-width': 1.5,
                    'line-opacity': 0.75,
                  }}
                />
              </Source>
            )}

            {flags.passengerLines && (
              <Source id="passenger" type="geojson" data={passengerData}>
                <Layer
                  id="passenger-line"
                  type="line"
                  paint={{
                    'line-color': '#00c2ff',
                    'line-width': 2.5,
                    'line-opacity': 0.9,
                  }}
                />
              </Source>
            )}

            {flags.ntmAllRoutes && (
              <Source id="ntm-all" type="geojson" data={ntmAllData}>
                <Layer
                  id="ntm-all-line"
                  type="line"
                  paint={{
                    'line-color': '#64748b',
                    'line-width': 1.2,
                    'line-opacity': 0.55,
                  }}
                />
              </Source>
            )}

            {flags.ntmRailRoutes && (
              <Source id="ntm-rail" type="geojson" data={ntmRailData}>
                <Layer
                  id="ntm-rail-line"
                  type="line"
                  paint={{
                    'line-color': [
                      'match',
                      ['to-number', ['get', 'route_type']],
                      1, '#a855f7',
                      2, '#00c2ff',
                      0, '#f472b6',
                      '#22d3ee',
                    ],
                    'line-width': 2.4,
                    'line-opacity': 0.9,
                  }}
                />
              </Source>
            )}

            {flags.ntmStops && (
              <Source id="ntm-stops" type="geojson" data={ntmStopsData}>
                <Layer
                  id="ntm-stops-circle"
                  type="circle"
                  paint={{
                    'circle-radius': 3.5,
                    'circle-color': '#a855f7',
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#0a0e14',
                  }}
                />
              </Source>
            )}

            {flags.amtrakStations && (
              <Source id="amtrak" type="geojson" data={amtrakData}>
                <Layer
                  id="amtrak-circle"
                  type="circle"
                  paint={{
                    'circle-radius': 5,
                    'circle-color': '#00c2ff',
                    'circle-stroke-width': 1.5,
                    'circle-stroke-color': '#062028',
                  }}
                />
              </Source>
            )}

            {flags.yards && (
              <Source id="yards" type="geojson" data={yardsData}>
                <Layer
                  id="yards-circle"
                  type="circle"
                  paint={{
                    'circle-radius': 5,
                    'circle-color': '#f59e0b',
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#0a0e14',
                  }}
                />
              </Source>
            )}

            {flags.nodes && (
              <Source id="nodes" type="geojson" data={nodesData}>
                <Layer
                  id="nodes-circle"
                  type="circle"
                  paint={{
                    'circle-radius': 3.5,
                    'circle-color': '#8b9bb4',
                  }}
                />
              </Source>
            )}

            {flags.bridges && (
              <Source id="bridges" type="geojson" data={bridgesData}>
                <Layer
                  id="bridges-circle"
                  type="circle"
                  paint={{
                    'circle-radius': 4,
                    'circle-color': '#f59e0b',
                  }}
                />
              </Source>
            )}

            {flags.crossings && (
              <Source id="crossings" type="geojson" data={crossingsData}>
                <Layer
                  id="crossings-circle"
                  type="circle"
                  paint={{
                    'circle-radius': 3,
                    'circle-color': '#ef4444',
                  }}
                />
              </Source>
            )}

            {flags.mileposts && (
              <Source id="mileposts" type="geojson" data={milepostsData}>
                <Layer
                  id="mileposts-circle"
                  type="circle"
                  paint={{
                    'circle-radius': 2.5,
                    'circle-color': '#94a3b8',
                  }}
                />
              </Source>
            )}

            {flags.trains &&
              trains.map((t) => (
                <Marker
                  key={t.trainID || t.trainNum + t.lat}
                  longitude={t.lon}
                  latitude={t.lat}
                  anchor="center"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setMeta({
                      title: `Train ${t.trainNum}`,
                      body: (
                        <>
                          <div className="section-title">Live passenger train</div>
                          <div className="kv">
                            <span className="k">Route</span>
                            <span className="v">{t.routeName || '—'}</span>
                          </div>
                          <div className="kv">
                            <span className="k">Status</span>
                            <span className="v">{t.trainTimely || 'In transit'}</span>
                          </div>
                          <div className="kv">
                            <span className="k">Position</span>
                            <span className="v">
                              {t.lat.toFixed(4)}, {t.lon.toFixed(4)}
                            </span>
                          </div>
                          <p className="note">Amtraker community feed · freight positions are not public.</p>
                        </>
                      ),
                    });
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: '#062018',
                      border: '1.5px solid #00d4aa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#00d4aa',
                      fontSize: 10,
                      boxShadow: '0 0 10px rgba(0,212,170,0.45)',
                      cursor: 'pointer',
                    }}
                  >
                    <i className="fa-solid fa-train" />
                  </div>
                </Marker>
              ))}

            {flags.cameras &&
              RAILCAMS.map((c) => (
                <Marker
                  key={c.youtubeId + c.name}
                  longitude={c.lng}
                  latitude={c.lat}
                  anchor="center"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setMeta({
                      title: c.name,
                      body: (
                        <>
                          <div className="section-title">Live railcam</div>
                          <div className="kv">
                            <span className="k">Channel</span>
                            <span className="v">{c.channel || '—'}</span>
                          </div>
                          <div className="kv">
                            <span className="k">Railroad</span>
                            <span className="v">{c.railroad || '—'}</span>
                          </div>
                          <div className="cam-embed">
                            <iframe
                              src={`https://www.youtube.com/embed/${c.youtubeId}?autoplay=1&mute=1`}
                              title={c.name}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        </>
                      ),
                    });
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      background: '#1a0a0a',
                      border: '1.5px solid #ef4444',
                      color: '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                      cursor: 'pointer',
                    }}
                  >
                    <i className="fa-solid fa-video" />
                  </div>
                </Marker>
              ))}
          </Map>

          {toast && <div className="toast">{toast}</div>}

          <div className={`meta ${meta ? '' : 'hidden'}`}>
            <div className="meta-head">
              <span>{meta?.title}</span>
              <button type="button" onClick={() => setMeta(null)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="meta-body">{meta?.body}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
