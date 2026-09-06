/* US Rail EOC Configuration */
const CONFIG = {
  // FRA / BTS North American Rail Network (public FeatureServer) — FULL network
  NARN_LINES: "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Lines/FeatureServer/0",
  NARN_NODES: "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Nodes/FeatureServer/0",
  RAIL_YARDS: "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Rail_Yards/FeatureServer/0",
  GRADE_CROSSINGS: "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Railroad_Grade_Crossings/FeatureServer/0",

  // Official Class I Freight Railroads View (BNSF, UP, CSX, NS, CN, CPKC only)
  // Same NARN source, pre-filtered ownership/trackage rights for Class I
  CLASS1_LINES: "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Lines_Class_I_Railroads/FeatureServer/0",

  // Near-real-time passenger trains (Amtrak + Brightline + Via)
  AMTRAKER_TRAINS: "https://api.amtraker.com/v3/trains",
  AMTRAKER_STATIONS: "https://api.amtraker.com/v3/stations",

  // Refresh interval (ms)
  REFRESH_MS: 120000, // 2 minutes

  // Max features per query (ArcGIS limit often 1000–2000)
  MAX_RECORDS: 2000,

  // Railroad owner codes → display name & CSS class
  OWNERS: {
    BNSF: { name: "BNSF Railway", cls: "bnsf", color: "#ff6b00" },
    UP:   { name: "Union Pacific", cls: "up", color: "#ffd100" },
    CSXT: { name: "CSX Transportation", cls: "csx", color: "#0057b8" },
    CSX:  { name: "CSX Transportation", cls: "csx", color: "#0057b8" },
    NS:   { name: "Norfolk Southern", cls: "ns", color: "#e0e0e0" },
    CN:   { name: "Canadian National", cls: "cn", color: "#ed1c24" },
    CPKC: { name: "Canadian Pacific Kansas City", cls: "cpkc", color: "#8b0000" },
    CP:   { name: "Canadian Pacific Kansas City", cls: "cpkc", color: "#8b0000" },
    KCS:  { name: "Canadian Pacific Kansas City", cls: "cpkc", color: "#8b0000" },
    ATK:  { name: "Amtrak", cls: "amtrak", color: "#00a3e0" },
    AMTK: { name: "Amtrak", cls: "amtrak", color: "#00a3e0" },
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
};
