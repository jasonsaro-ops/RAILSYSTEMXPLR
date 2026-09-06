/** Public BTS / FRA NTAD endpoints — no API keys */

export const ARCGIS = {
  NARN_LINES:
    'https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Lines/FeatureServer/0',
  CLASS_I:
    'https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Lines_Class_I_Freight_Railroads_View/FeatureServer/0',
  NARN_NODES:
    'https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Nodes/FeatureServer/0',
  RAIL_YARDS:
    'https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Rail_Yards/FeatureServer/0',
  GRADE_CROSSINGS:
    'https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Railroad_Grade_Crossings/FeatureServer/0',
  AMTRAK_STATIONS:
    'https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Amtrak_Stations/FeatureServer/0',
  RAIL_MILEPOSTS:
    'https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Rail_Mileposts/FeatureServer/0',
  RAILROAD_BRIDGES:
    'https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Railroad_Bridges/FeatureServer/0',
  NTM_ROUTES:
    'https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_National_Transit_Map_Routes/FeatureServer/0',
  NTM_STOPS:
    'https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_National_Transit_Map_Stops/FeatureServer/0',
  NTM_AGENCIES:
    'https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_National_Transit_Map_Agencies/FeatureServer/0',
  PASSENGER_RAIL:
    'https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Lines_Passenger_Rail/FeatureServer/0',
} as const;

export const AMTRAKER_TRAINS = 'https://api-v3.amtraker.com/v3/trains';

/** GTFS route_type groups */
export const ROUTE_TYPES = {
  rail: [0, 1, 2], // tram, subway, rail/commuter
  all: null as number[] | null,
} as const;

export const OWNERS: Record<
  string,
  { name: string; color: string; match: RegExp }
> = {
  bnsf: { name: 'BNSF', color: '#e87722', match: /BNSF|BN\b|ATSF|SLSF/i },
  up: { name: 'Union Pacific', color: '#ffcc00', match: /\bUP\b|UNION PACIFIC/i },
  csx: { name: 'CSX', color: '#1e3a8a', match: /\bCSX\b|CSXT|CSX TRANSP/i },
  ns: { name: 'Norfolk Southern', color: '#111827', match: /\bNS\b|NORFOLK SOUTHERN/i },
  cn: { name: 'Canadian National', color: '#ef4444', match: /\bCN\b|CANADIAN NATIONAL|GTW|IC\b/i },
  cpkc: { name: 'CPKC', color: '#7c2d12', match: /CPKC|\bCP\b|KCS|KANSAS CITY SOUTHERN|CANADIAN PACIFIC/i },
  amtrak: { name: 'Amtrak / Passenger', color: '#00c2ff', match: /AMTRAK|NRC|PASSENGER/i },
  other: { name: 'Class II / III / Shortline', color: '#64748b', match: /.*/ },
};

export const STATE_BOUNDS: Record<string, [number, number, number, number]> = {
  // [west, south, east, north]
  AL: [-88.47, 30.22, -84.89, 35.01],
  AK: [-179.15, 51.21, -129.99, 71.44],
  AZ: [-114.82, 31.33, -109.04, 37.0],
  AR: [-94.62, 33.0, -89.64, 36.5],
  CA: [-124.48, 32.53, -114.13, 42.01],
  CO: [-109.06, 36.99, -102.04, 41.0],
  CT: [-73.73, 40.98, -71.79, 42.05],
  DE: [-75.79, 38.45, -75.05, 39.84],
  FL: [-87.63, 24.52, -80.03, 31.0],
  GA: [-85.61, 30.36, -80.84, 35.0],
  HI: [-178.33, 18.91, -154.81, 28.4],
  ID: [-117.24, 41.99, -111.04, 49.0],
  IL: [-91.51, 36.97, -87.02, 42.51],
  IN: [-88.1, 37.77, -84.78, 41.76],
  IA: [-96.64, 40.38, -90.14, 43.5],
  KS: [-102.05, 36.99, -94.59, 40.0],
  KY: [-89.57, 36.5, -81.96, 39.15],
  LA: [-94.04, 28.93, -88.82, 33.02],
  ME: [-71.08, 43.06, -66.95, 47.46],
  MD: [-79.49, 37.91, -75.05, 39.72],
  MA: [-73.51, 41.24, -69.93, 42.89],
  MI: [-90.42, 41.7, -82.41, 48.31],
  MN: [-97.24, 43.5, -89.49, 49.38],
  MS: [-91.66, 30.17, -88.1, 35.0],
  MO: [-95.77, 35.99, -89.1, 40.61],
  MT: [-116.05, 44.36, -104.04, 49.0],
  NE: [-104.05, 40.0, -95.31, 43.0],
  NV: [-120.0, 35.0, -114.04, 42.0],
  NH: [-72.56, 42.7, -70.7, 45.31],
  NJ: [-75.56, 38.93, -73.89, 41.36],
  NM: [-109.05, 31.33, -103.0, 37.0],
  NY: [-79.76, 40.5, -71.86, 45.01],
  NC: [-84.32, 33.84, -75.46, 36.59],
  ND: [-104.05, 45.94, -96.55, 49.0],
  OH: [-84.82, 38.4, -80.52, 41.98],
  OK: [-103.0, 33.62, -94.43, 37.0],
  OR: [-124.57, 41.99, -116.46, 46.29],
  PA: [-80.52, 39.72, -74.69, 42.27],
  RI: [-71.86, 41.15, -71.12, 42.02],
  SC: [-83.35, 32.05, -78.54, 35.22],
  SD: [-104.06, 42.48, -96.44, 45.94],
  TN: [-90.31, 34.98, -81.65, 36.68],
  TX: [-106.65, 25.84, -93.51, 36.5],
  UT: [-114.05, 37.0, -109.04, 42.0],
  VT: [-73.44, 42.73, -71.46, 45.02],
  VA: [-83.68, 36.54, -75.24, 39.47],
  WA: [-124.79, 45.54, -116.92, 49.0],
  WV: [-82.64, 37.2, -77.72, 40.64],
  WI: [-92.89, 42.49, -86.81, 47.08],
  WY: [-111.06, 40.99, -104.05, 45.01],
  DC: [-77.12, 38.79, -76.91, 38.99],
};

export const BASEMAPS = {
  dark: {
    name: 'Dark Ops (Esri)',
    // Esri World Dark Gray Canvas — no API key
    style: {
      version: 8 as const,
      sources: {
        esri: {
          type: 'raster' as const,
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: 'Tiles © Esri — Dark Gray Canvas',
        },
        esriRef: {
          type: 'raster' as const,
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
        },
      },
      layers: [
        { id: 'esri-dark', type: 'raster' as const, source: 'esri' },
        { id: 'esri-ref', type: 'raster' as const, source: 'esriRef' },
      ],
    },
  },
  light: {
    name: 'Light Canvas',
    style: {
      version: 8 as const,
      sources: {
        esri: {
          type: 'raster' as const,
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: 'Tiles © Esri',
        },
      },
      layers: [{ id: 'esri-light', type: 'raster' as const, source: 'esri' }],
    },
  },
  osm: {
    name: 'Street (OSM)',
    style: {
      version: 8 as const,
      sources: {
        osm: {
          type: 'raster' as const,
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap',
        },
      },
      layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
    },
  },
  sat: {
    name: 'Satellite',
    style: {
      version: 8 as const,
      sources: {
        sat: {
          type: 'raster' as const,
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: 'Tiles © Esri',
        },
      },
      layers: [{ id: 'sat', type: 'raster' as const, source: 'sat' }],
    },
  },
};


/** Major metro transit focuses — fly + enable NTM rail/subway layers */
export type CityPreset = {
  id: string;
  name: string;
  bbox: [number, number, number, number]; // west, south, east, north
  center: [number, number]; // lng, lat
  zoom: number;
  systems: string;
};

export const CITY_PRESETS: CityPreset[] = [
  { id: 'nyc', name: 'New York City', bbox: [-74.28, 40.48, -73.68, 40.95], center: [-73.97, 40.75], zoom: 11.2, systems: 'MTA Subway · LIRR · Metro-North · NJT' },
  { id: 'chi', name: 'Chicago', bbox: [-88.0, 41.6, -87.4, 42.1], center: [-87.65, 41.88], zoom: 11, systems: 'CTA · Metra · South Shore' },
  { id: 'phi', name: 'Philadelphia', bbox: [-75.35, 39.85, -74.95, 40.15], center: [-75.16, 39.95], zoom: 11.5, systems: 'SEPTA · PATCO · NJT' },
  { id: 'bos', name: 'Boston', bbox: [-71.25, 42.2, -70.9, 42.45], center: [-71.06, 42.36], zoom: 11.5, systems: 'MBTA' },
  { id: 'dc', name: 'Washington DC', bbox: [-77.25, 38.8, -76.85, 39.05], center: [-77.02, 38.9], zoom: 11.3, systems: 'WMATA · VRE · MARC' },
  { id: 'sf', name: 'San Francisco Bay', bbox: [-122.55, 37.45, -121.85, 37.95], center: [-122.27, 37.78], zoom: 10.5, systems: 'BART · Muni · Caltrain' },
  { id: 'la', name: 'Los Angeles', bbox: [-118.55, 33.85, -117.85, 34.25], center: [-118.25, 34.05], zoom: 10.8, systems: 'Metro · Metrolink' },
  { id: 'sea', name: 'Seattle', bbox: [-122.45, 47.45, -122.15, 47.75], center: [-122.33, 47.61], zoom: 11.5, systems: 'Link · Sounder' },
  { id: 'den', name: 'Denver', bbox: [-105.15, 39.6, -104.8, 39.85], center: [-104.99, 39.74], zoom: 11.2, systems: 'RTD' },
  { id: 'atl', name: 'Atlanta', bbox: [-84.55, 33.65, -84.25, 33.9], center: [-84.39, 33.75], zoom: 11.5, systems: 'MARTA' },
  { id: 'mia', name: 'Miami', bbox: [-80.4, 25.7, -80.1, 26.0], center: [-80.25, 25.85], zoom: 11.2, systems: 'Metrorail · Tri-Rail' },
  { id: 'dal', name: 'Dallas–Fort Worth', bbox: [-97.15, 32.65, -96.7, 33.0], center: [-96.9, 32.85], zoom: 10.8, systems: 'DART · Trinity Railway' },
  { id: 'hou', name: 'Houston', bbox: [-95.55, 29.65, -95.2, 29.9], center: [-95.37, 29.76], zoom: 11.2, systems: 'METRORail' },
  { id: 'por', name: 'Portland OR', bbox: [-122.85, 45.4, -122.5, 45.6], center: [-122.68, 45.52], zoom: 11.5, systems: 'MAX · WES' },
  { id: 'min', name: 'Minneapolis–St. Paul', bbox: [-93.4, 44.85, -93.0, 45.1], center: [-93.2, 44.98], zoom: 11.2, systems: 'Metro Transit' },
  { id: 'bal', name: 'Baltimore', bbox: [-76.75, 39.2, -76.5, 39.4], center: [-76.61, 39.29], zoom: 11.5, systems: 'MTA Maryland · MARC' },
  { id: 'sd', name: 'San Diego', bbox: [-117.3, 32.65, -117.05, 32.85], center: [-117.16, 32.72], zoom: 11.5, systems: 'MTS · COASTER' },
  { id: 'phx', name: 'Phoenix', bbox: [-112.2, 33.35, -111.85, 33.6], center: [-112.07, 33.45], zoom: 11.2, systems: 'Valley Metro' },
  { id: 'slc', name: 'Salt Lake City', bbox: [-112.05, 40.65, -111.8, 40.85], center: [-111.89, 40.76], zoom: 11.5, systems: 'UTA TRAX · FrontRunner' },
  { id: 'pit', name: 'Pittsburgh', bbox: [-80.1, 40.35, -79.85, 40.5], center: [-79.99, 40.44], zoom: 12, systems: 'Pittsburgh Light Rail' },
];
