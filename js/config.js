/* US Rail EOC Configuration */
const CONFIG = {
  // FRA / BTS North American Rail Network (public FeatureServer) — FULL network
  NARN_LINES: "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Lines/FeatureServer/0",
  NARN_NODES: "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Nodes/FeatureServer/0",
  RAIL_YARDS: "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Rail_Yards/FeatureServer/0",
  GRADE_CROSSINGS: "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Railroad_Grade_Crossings/FeatureServer/0",

  // Additional public infrastructure (BTS / FRA NTAD — no API key)
  AMTRAK_STATIONS: "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Amtrak_Stations/FeatureServer/0",
  RAIL_MILEPOSTS: "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Rail_Mileposts/FeatureServer/0",
  RAILROAD_BRIDGES: "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Railroad_Bridges/FeatureServer/0",
  NTM_STOPS: "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_National_Transit_Map_Stops/FeatureServer/0",
  NTM_ROUTES: "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_National_Transit_Map_Routes/FeatureServer/0",
  PASSENGER_RAIL_LINES: "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Lines_Passenger_Rail/FeatureServer/0",

  // Official Class I Freight Railroads View (BNSF, UP, CSX, NS, CN, CPKC)
  CLASS1_LINES: "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Lines_Class_I_Railroads/FeatureServer/0",
  // Per-carrier system maps (FRA/BTS filtered NARN views)
  SYSTEM_MAPS: {
    bnsf: "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Lines_BNSF/FeatureServer/0",
    up:   "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Lines_UP/FeatureServer/0",
    csx:  "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Lines_CSXT/FeatureServer/0",
    ns:   "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Lines_NS/FeatureServer/0",
    cn:   "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Lines_CN/FeatureServer/0",
    cpkc: "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Lines_CPKC/FeatureServer/0",
  },

  // Near-real-time passenger trains (Amtrak + Brightline + Via) — dual hosts
  AMTRAKER_TRAINS: "https://api.amtraker.com/v3/trains",
  AMTRAKER_TRAINS_ALT: "https://api-v3.amtraker.com/v3/trains",
  AMTRAKER_STATIONS: "https://api.amtraker.com/v3/stations",
  // Named trains that must always be polled (Auto Train often under-reported in bulk)
  PRIORITY_TRAIN_NUMS: ["52", "53"], // Auto Train Lorton↔Sanford

  // OpenRailwayMap tiles (OSM-derived, nationwide) — https://www.openrailwaymap.org/
  OPENRAILWAYMAP: {
    standard: "https://tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png",
    maxspeed: "https://tiles.openrailwaymap.org/maxspeed/{z}/{x}/{y}.png",
    signals: "https://tiles.openrailwaymap.org/signals/{z}/{x}/{y}.png",
    electrification: "https://tiles.openrailwaymap.org/electrification/{z}/{x}/{y}.png",
    gauge: "https://tiles.openrailwaymap.org/gauge/{z}/{x}/{y}.png",
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Style <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a> (CC-BY-SA)',
    maxZoom: 19,
  },


  // Public Class I profiles (for metadata panels — not proprietary ops data)
  CLASS1_PROFILES: {
    bnsf: {
      name: "BNSF Railway",
      parent: "Berkshire Hathaway",
      region: "Western & Midwestern U.S.",
      hq: "Fort Worth, TX",
      marks: ["BNSF", "BN"],
      systemMap: "https://www.bnsf.com/ship-with-bnsf/maps-and-shipping-locations/rail-network-map.html",
      notes: "Largest freight network by track miles in the U.S. Open GIS ownership via FRA/BTS NARN.",
    },
    up: {
      name: "Union Pacific Railroad",
      parent: "Union Pacific Corporation",
      region: "Western U.S.",
      hq: "Omaha, NE",
      marks: ["UP", "UPRR", "SP", "DRGW"],
      systemMap: "https://www.up.com/aboutup/reference/maps/",
      notes: "Western Class I. Public reference maps on up.com; segment ownership in NARN.",
    },
    csx: {
      name: "CSX Transportation",
      parent: "CSX Corporation",
      region: "Eastern U.S.",
      hq: "Jacksonville, FL",
      marks: ["CSXT", "CSX"],
      systemMap: "https://www.csx.com/index.cfm/customers/maps/",
      notes: "Eastern Class I. NARN encodes CSXT ownership and trackage rights.",
    },
    ns: {
      name: "Norfolk Southern Railway",
      parent: "Norfolk Southern Corporation",
      region: "Eastern U.S.",
      hq: "Atlanta, GA",
      marks: ["NS", "NW"],
      systemMap: "https://www.norfolksouthern.com/en/ship-with-ns/shipping-tools/system-map",
      notes: "Eastern Class I. System map via NS customer tools; geometry in NARN.",
    },
    cn: {
      name: "Canadian National Railway",
      parent: "Canadian National Railway Company",
      region: "Canada & mid-America (U.S. Midwest/South)",
      hq: "Montreal, QC",
      marks: ["CN", "GTW", "IC", "WC"],
      systemMap: "https://www.cn.ca/en/our-business/our-network/",
      notes: "Transcontinental CN including U.S. subsidiaries (GTW, IC, etc.) in NARN.",
    },
    cpkc: {
      name: "Canadian Pacific Kansas City",
      parent: "Canadian Pacific Kansas City Limited",
      region: "Canada, U.S. Midwest, Mexico",
      hq: "Calgary, AB",
      marks: ["CPKC", "CP", "CPRS", "KCS", "KCSM"],
      systemMap: "https://www.cpkcr.com/en/our-network",
      notes: "CP+KCS merger network. NARN uses CPKC/CP/KCS ownership codes.",
    },
    amtrak: {
      name: "Amtrak (NRPC)",
      parent: "National Railroad Passenger Corporation",
      region: "Nationwide passenger",
      hq: "Washington, DC",
      marks: ["ATK", "AMTK", "NRC"],
      systemMap: "https://www.amtrak.com/train-routes",
      notes: "Passenger service; many routes on host Class I tracks (PASSNGR flags in NARN).",
    },
  },

  // Refresh interval (ms)
  REFRESH_MS: 120000, // 2 minutes

  // Max features per query (ArcGIS limit often 1000–2000)
  MAX_RECORDS: 2000,

  // Railroad owner codes → display name & CSS class
  OWNERS: {
    BNSF: { name: "BNSF Railway", cls: "bnsf", color: "#ff8c1a" },
    UP:   { name: "Union Pacific", cls: "up", color: "#ffe566" },
    CSXT: { name: "CSX Transportation", cls: "csx", color: "#4db8ff" },
    CSX:  { name: "CSX Transportation", cls: "csx", color: "#4db8ff" },
    NS:   { name: "Norfolk Southern", cls: "ns", color: "#b8f53d" },
    CN:   { name: "Canadian National", cls: "cn", color: "#ff4d5e" },
    CPKC: { name: "Canadian Pacific Kansas City", cls: "cpkc", color: "#ff6b9d" },
    CP:   { name: "Canadian Pacific Kansas City", cls: "cpkc", color: "#ff6b9d" },
    KCS:  { name: "Canadian Pacific Kansas City", cls: "cpkc", color: "#ff6b9d" },
    ATK:  { name: "Amtrak", cls: "amtrak", color: "#3dfff0" },
    AMTK: { name: "Amtrak", cls: "amtrak", color: "#3dfff0" },
  },

  DATA_SOURCES: {
    fra: { name: "FRA Geospatial / Safety Data", url: "https://railroads.dot.gov/" },
    bts: { name: "BTS NTAD North American Rail Network", url: "https://geodata.bts.gov/datasets/usdot::north-american-rail-network-lines/about" },
    stb: { name: "STB Railroad Map Depot", url: "https://www.stb.gov/" },
    orm: { name: "OpenRailwayMap (OSM)", url: "https://www.openrailwaymap.org/" },
    ntm: { name: "National Transit Map (BTS)", url: "https://geodata.bts.gov/datasets/usdot::national-transit-map-routes/about" },
  },


  // Approximate state bounding boxes (for filter + fly-to)
  STATE_BOUNDS: {
    CA: [[32.5, -124.5], [42.0, -114.1]],
    TX: [[25.8, -106.6], [36.5, -93.5]],
    IL: [[36.9, -91.5], [42.5, -87.0]],
    NY: [[40.5, -79.8], [45.0, -71.8]],
    PA: [[39.7, -80.5], [42.3, -74.7]],
    OH: [[38.4, -84.8], [42.0, -80.5]],
    FL: [[24.4, -87.6], [31.0, -80.0]],
    GA: [[30.3, -85.6], [35.0, -80.8]],
    NC: [[33.8, -84.3], [36.6, -75.4]],
    VA: [[36.5, -83.7], [39.5, -75.2]],
    WA: [[45.5, -124.8], [49.0, -116.9]],
    OR: [[41.9, -124.6], [46.3, -116.5]],
    CO: [[36.9, -109.1], [41.0, -102.0]],
    AZ: [[31.3, -114.8], [37.0, -109.0]],
    NM: [[31.3, -109.1], [37.0, -103.0]],
    KS: [[36.9, -102.1], [40.0, -94.6]],
    MO: [[36.0, -95.8], [40.6, -89.1]],
    IN: [[37.8, -88.1], [41.8, -84.8]],
    MI: [[41.7, -90.4], [48.3, -82.1]],
    MN: [[43.5, -97.2], [49.4, -89.5]],
    WI: [[42.5, -92.9], [47.1, -86.8]],
    IA: [[40.4, -96.6], [43.5, -90.1]],
    NE: [[40.0, -104.1], [43.0, -95.3]],
    OK: [[33.6, -103.0], [37.0, -94.4]],
    AR: [[33.0, -94.6], [36.5, -89.6]],
    LA: [[28.9, -94.0], [33.0, -88.8]],
    MS: [[30.2, -91.7], [35.0, -88.1]],
    AL: [[30.2, -88.5], [35.0, -84.9]],
    TN: [[34.9, -90.3], [36.7, -81.6]],
    KY: [[36.5, -89.6], [39.1, -81.9]],
    WV: [[37.2, -82.6], [40.6, -77.7]],
    MD: [[37.9, -79.5], [39.7, -75.0]],
    NJ: [[38.9, -75.6], [41.4, -73.9]],
    CT: [[40.9, -73.7], [42.1, -71.8]],
    MA: [[41.2, -73.5], [42.9, -69.9]],
    NH: [[42.7, -72.6], [45.3, -70.6]],
    VT: [[42.7, -73.4], [45.0, -71.5]],
    ME: [[43.0, -71.1], [47.5, -66.9]],
    SC: [[32.0, -83.4], [35.2, -78.5]],
    ND: [[45.9, -104.1], [49.0, -96.6]],
    SD: [[42.5, -104.1], [45.9, -96.4]],
    MT: [[44.4, -116.0], [49.0, -104.0]],
    ID: [[41.9, -117.2], [49.0, -111.0]],
    UT: [[36.9, -114.1], [42.0, -109.0]],
    NV: [[35.0, -120.0], [42.0, -114.0]],
    WY: [[40.9, -111.1], [45.0, -104.1]],
  },

  // Default map view (continental US)
  DEFAULT_CENTER: [39.5, -98.35],
  DEFAULT_ZOOM: 5,

  CITY_PRESETS: [
    { id: "nyc", name: "New York City", west: -74.28, south: 40.48, east: -73.68, north: 40.95, systems: "MTA Subway · LIRR · Metro-North · NJT" },
    { id: "chi", name: "Chicago", west: -88.0, south: 41.6, east: -87.4, north: 42.1, systems: "CTA · Metra" },
    { id: "phi", name: "Philadelphia", west: -75.35, south: 39.85, east: -74.95, north: 40.15, systems: "SEPTA Regional Rail · Trolleys · MFL/BSL · PATCO" },
    { id: "camden", name: "Camden / South Jersey", west: -75.15, south: 39.88, east: -74.88, north: 40.08, systems: "NJT River Line · PATCO · Atlantic City Line" },
    { id: "bos", name: "Boston", west: -71.25, south: 42.2, east: -70.9, north: 42.45, systems: "MBTA" },
    { id: "dc", name: "Washington DC", west: -77.25, south: 38.8, east: -76.85, north: 39.05, systems: "WMATA · VRE · MARC" },
    { id: "sf", name: "San Francisco Bay", west: -122.55, south: 37.45, east: -121.85, north: 37.95, systems: "BART · Muni · Caltrain" },
    { id: "la", name: "Los Angeles", west: -118.55, south: 33.85, east: -117.85, north: 34.25, systems: "Metro · Metrolink" },
    { id: "sea", name: "Seattle", west: -122.45, south: 47.45, east: -122.15, north: 47.75, systems: "Link · Sounder" },
    { id: "atl", name: "Atlanta", west: -84.55, south: 33.65, east: -84.25, north: 33.9, systems: "MARTA" },
    { id: "den", name: "Denver", west: -105.15, south: 39.6, east: -104.8, north: 39.85, systems: "RTD" },
    { id: "mia", name: "Miami", west: -80.4, south: 25.7, east: -80.1, north: 26.0, systems: "Metrorail · Tri-Rail" },
  ],
};
