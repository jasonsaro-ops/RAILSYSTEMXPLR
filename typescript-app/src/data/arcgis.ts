/**
 * PowerGrid-style ArcGIS FeatureServer loader:
 * - viewport queries with maxAllowableOffset
 * - persistent feature caches by OBJECTID (never wipe on pan)
 * - pagination when transfer limit exceeded
 */

export type BBox = { west: number; south: number; east: number; north: number };

export type GeoJSONFeature = {
  type: 'Feature';
  id?: string | number;
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
};

export type FeatureCollection = {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
};

const featureCaches = new Map<string, Map<string, GeoJSONFeature>>();

function cacheFor(sourceKey: string) {
  if (!featureCaches.has(sourceKey)) featureCaches.set(sourceKey, new Map());
  return featureCaches.get(sourceKey)!;
}

export function getCachedCollection(sourceKey: string): FeatureCollection {
  const c = cacheFor(sourceKey);
  return { type: 'FeatureCollection', features: Array.from(c.values()) };
}

export function cacheSize(sourceKey: string) {
  return cacheFor(sourceKey).size;
}

export function clearCache(sourceKey?: string) {
  if (sourceKey) featureCaches.delete(sourceKey);
  else featureCaches.clear();
}

function featureId(f: GeoJSONFeature, fallbackPrefix: string): string {
  const p = f.properties || {};
  const id =
    p.OBJECTID ??
    p.objectid ??
    p.FRAARCID ??
    p.CrossingID ??
    p.CROSSING ??
    p.stop_id ??
    p.route_id ??
    p.FRANODEID ??
    p.Code ??
    null;
  if (id != null) return String(id);
  // geometry fallback
  try {
    const c = f.geometry?.coordinates as number[];
    if (Array.isArray(c) && typeof c[0] === 'number') return `${fallbackPrefix}:${c[0]},${c[1]}`;
  } catch {
    /* ignore */
  }
  return `${fallbackPrefix}:${Math.random()}`;
}

export type QueryOpts = {
  sourceKey: string;
  url: string;
  bbox: BBox;
  where?: string;
  outFields?: string;
  maxRecords?: number;
  /** geometry simplification in degrees — larger = fewer vertices */
  maxAllowableOffset?: number;
  /** if true, only return newly added features count */
  merge?: boolean;
};

export async function queryArcGIS(opts: QueryOpts): Promise<{
  collection: FeatureCollection;
  added: number;
  total: number;
}> {
  const {
    sourceKey,
    url,
    bbox,
    where = '1=1',
    outFields = '*',
    maxRecords = 2000,
    maxAllowableOffset,
    merge = true,
  } = opts;

  const cache = cacheFor(sourceKey);
  if (!merge) cache.clear();

  const geom = {
    xmin: bbox.west,
    ymin: bbox.south,
    xmax: bbox.east,
    ymax: bbox.north,
    spatialReference: { wkid: 4326 },
  };

  let added = 0;
  let resultOffset = 0;
  let exceeded = true;
  let pages = 0;

  while (exceeded && pages < 4) {
    const params = new URLSearchParams({
      f: 'geojson',
      where,
      outFields,
      geometry: JSON.stringify(geom),
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outSR: '4326',
      resultRecordCount: String(maxRecords),
      resultOffset: String(resultOffset),
    });
    if (maxAllowableOffset != null) {
      params.set('maxAllowableOffset', String(maxAllowableOffset));
    }

    const res = await fetch(`${url}/query?${params}`);
    if (!res.ok) throw new Error(`ArcGIS ${res.status}`);
    const geojson = (await res.json()) as FeatureCollection & {
      properties?: { exceededTransferLimit?: boolean };
      exceededTransferLimit?: boolean;
    };

    const features = geojson.features || [];
    for (const f of features) {
      const id = featureId(f, sourceKey);
      if (cache.has(id)) continue;
      f.id = id;
      cache.set(id, f);
      added++;
    }

    exceeded =
      Boolean(geojson.exceededTransferLimit) ||
      Boolean((geojson as { properties?: { exceededTransferLimit?: boolean } }).properties?.exceededTransferLimit) ||
      features.length >= maxRecords;
    resultOffset += features.length;
    pages++;
    if (features.length === 0) break;
  }

  return {
    collection: getCachedCollection(sourceKey),
    added,
    total: cache.size,
  };
}

/** Classify NARN owner from properties */
export function classifyOwner(props: Record<string, unknown>): string {
  const owners = [props.RROWNER1, props.RROWNER2, props.RROWNER3]
    .filter(Boolean)
    .map(String)
    .join(' ');
  const pass = String(props.PASSNGR || '').toUpperCase();
  if (pass && pass !== 'N' && pass !== '0' && /A|P|Y|1/.test(pass)) return 'amtrak';
  for (const [key, cfg] of Object.entries(
    // inline to avoid circular — match order matters
    {
      bnsf: /BNSF|BN\b|ATSF|SLSF/i,
      up: /\bUP\b|UNION PACIFIC/i,
      csx: /\bCSX\b|CSXT/i,
      ns: /\bNS\b|NORFOLK SOUTHERN/i,
      cn: /\bCN\b|CANADIAN NATIONAL|GTW/i,
      cpkc: /CPKC|\bCP\b|KCS|KANSAS CITY/i,
      amtrak: /AMTRAK|NRC/i,
    } as Record<string, RegExp>
  )) {
    if (cfg.test(owners)) return key;
  }
  return 'other';
}
