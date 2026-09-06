/**
 * Curated public live railcam locations from major YouTube channels.
 * Click a map marker → floating window with live YouTube embed (when ID known).
 *
 * Channels:
 *  Virtual Railfan, Railside Live, Iron Rail Cams, Official Live Trains,
 *  RBMN, SouthWest RailCams, RailStream
 */
const RAILCAMS = [
  // Virtual Railfan
  { id: "vrf-ashland-s", name: "Ashland, VA — South (Fixed)", lat: 37.7593, lon: -77.4800, railroad: "CSX / Amtrak", channel: "Virtual Railfan", yt: "_Kk5anP-dQg", note: "CSX North End Sub · Amtrak station", free: true },
  { id: "vrf-ashland-ptz", name: "Ashland, VA — PTZ", lat: 37.7595, lon: -77.4795, railroad: "CSX / Amtrak", channel: "Virtual Railfan", yt: "4XYbh4Pegzw", note: "PTZ at station", free: true },
  { id: "vrf-ashland-n", name: "Ashland, VA — North (Fixed)", lat: 37.7600, lon: -77.4805, railroad: "CSX / Amtrak", channel: "Virtual Railfan", yt: "8CgXXdx97DA", note: "North fixed view", free: true },
  { id: "vrf-greeley", name: "Greeley, CO — PTZ", lat: 40.4233, lon: -104.7091, railroad: "UP / BNSF", channel: "Virtual Railfan", yt: "lw9Q0mM6iSM", note: "Colorado", free: true },
  { id: "vrf-muncie", name: "Muncie, IN — PTZ", lat: 40.1934, lon: -85.3864, railroad: "NS / CSX", channel: "Virtual Railfan", yt: "LKIwHaucDF0", note: "Midwest", free: true },
  { id: "vrf-plantcity", name: "Plant City, FL — PTZ", lat: 28.0186, lon: -82.1126, railroad: "CSX", channel: "Virtual Railfan", yt: "IVSoVgGXDoU", note: "CSX Florida", free: true },
  { id: "vrf-folkston-fixed", name: "Folkston, GA — Fixed", lat: 30.8305, lon: -82.0098, railroad: "CSX / NS", channel: "Virtual Railfan", yt: "Vqhfy2IqDz0", note: "Folkston Funnel", free: true },
  { id: "vrf-folkston-ptz", name: "Folkston, GA — Turnout PTZ", lat: 30.8310, lon: -82.0105, railroad: "CSX / NS", channel: "Virtual Railfan", yt: "7DmivRg6FfQ", note: "Folkston Funnel PTZ", free: true },
  { id: "vrf-stlouis-w", name: "St. Louis, MO — West PTZ", lat: 38.6270, lon: -90.1994, railroad: "UP / BNSF / NS", channel: "Virtual Railfan", yt: "9eqVB3JbJHc", note: "Gateway", free: true },
  { id: "vrf-jesup-n", name: "Jesup, GA — North Fixed", lat: 31.6074, lon: -81.8854, railroad: "CSX", channel: "Virtual Railfan", yt: "g1GgLCfImSE", note: "Coastal GA", free: true },
  { id: "vrf-jesup-ptz", name: "Jesup, GA — PTZ", lat: 31.6080, lon: -81.8860, railroad: "CSX", channel: "Virtual Railfan", yt: "1AOrlYblQR8", note: "Coastal GA PTZ", free: true },
  { id: "vrf-seattle", name: "Seattle, WA — South Fixed", lat: 47.6062, lon: -122.3321, railroad: "BNSF / Amtrak", channel: "Virtual Railfan", yt: "K7ZUj82iPkU", note: "Pacific NW", free: true },
  { id: "vrf-elkhart", name: "Elkhart, IN — PTZ", lat: 41.6820, lon: -85.9767, railroad: "NS / CSX", channel: "Virtual Railfan", yt: "YR1PdWaSxgk", note: "Chicago East", free: true },
  { id: "vrf-deshler-d", name: "Deshler, OH — Diamond Fixed", lat: 41.2092, lon: -83.8991, railroad: "CSX / NS", channel: "Virtual Railfan", yt: "Y28qU7UsFko", note: "Classic diamond", free: true },
  { id: "vrf-deshler-ptz", name: "Deshler, OH — PTZ", lat: 41.2095, lon: -83.8995, railroad: "CSX / NS", channel: "Virtual Railfan", yt: "TjMwpB8JRw8", note: "Classic diamond PTZ", free: true },
  { id: "vrf-rochelle", name: "Rochelle, IL — Railroad Park", lat: 41.9239, lon: -89.0687, railroad: "BNSF / UP", channel: "Virtual Railfan", yt: null, note: "Famous diamond — open VRF / RailStream streams", free: true },
  { id: "vrf-fostoria", name: "Fostoria, OH — Iron Triangle", lat: 41.1570, lon: -83.4169, railroad: "CSX / NS", channel: "Virtual Railfan / RailStream", yt: null, note: "Iron Triangle", free: true },
  { id: "vrf-laplata", name: "La Plata, MO", lat: 40.0231, lon: -92.4916, railroad: "BNSF", channel: "Virtual Railfan", yt: null, note: "Southern Transcon", free: true },
  { id: "vrf-barstow", name: "Barstow, CA", lat: 34.8988, lon: -117.0228, railroad: "BNSF / UP", channel: "Virtual Railfan", yt: null, note: "Needles / Cajon", free: true },
  { id: "vrf-galesburg", name: "Galesburg, IL", lat: 40.9478, lon: -90.3712, railroad: "BNSF", channel: "Virtual Railfan", yt: null, note: "BNSF hub", free: true },

  // Railside Live
  { id: "rsl-newlondon", name: "New London, CT", lat: 41.3556, lon: -72.0995, railroad: "Amtrak NEC / SLE / P&W", channel: "Railside Live", yt: "Chsnu4QybCM", note: "NEC · Maritime Society", free: true },
  { id: "rsl-eastgreenwich", name: "East Greenwich, RI", lat: 41.6601, lon: -71.4495, railroad: "Amtrak NEC / MBTA / P&W", channel: "Railside Live", yt: "sFCofJMI4ew", note: "NEC MP 172 high-speed", free: true },
  { id: "rsl-worcester", name: "Worcester, MA", lat: 42.2626, lon: -71.8023, railroad: "CSX / Amtrak / MBTA", channel: "Railside Live", yt: "azMQk5x_xps", note: "Central MA", free: true },
  { id: "rsl-ayer", name: "Ayer, MA", lat: 42.5612, lon: -71.5901, railroad: "Pan Am / CSX / MBTA", channel: "Railside Live", yt: "71YCf0IV-v8", note: "Ayer junction", free: true },
  { id: "rsl-cozad", name: "Cozad, NE", lat: 40.8600, lon: -99.9876, railroad: "UP", channel: "Railside Live", yt: "ePdG9zr-MzY", note: "UP Overland · former depot", free: true },

  // Iron Rail Cams
  { id: "irc-bridgeport", name: "Bridgeport, AL — Depot Museum", lat: 34.9473, lon: -85.7141, railroad: "CSX / NS / Sequatchie Valley", channel: "Iron Rail Cams", yt: "qRZ5E7U7h9Y", note: "CSX Chattanooga Sub", free: true },
  { id: "irc-phoenixville", name: "Phoenixville, PA", lat: 40.1304, lon: -75.5149, railroad: "NS", channel: "Iron Rail Cams", yt: null, note: "Open Iron Rail Cams channel for live ID", free: true },
  { id: "irc-corinth", name: "Corinth, MS", lat: 34.9343, lon: -88.5220, railroad: "NS / CPKC", channel: "Iron Rail Cams", yt: null, note: "Open channel for live ID", free: true },
  { id: "irc-stevenson", name: "Stevenson, AL", lat: 34.8687, lon: -85.8394, railroad: "NS", channel: "Iron Rail Cams", yt: null, note: "Open channel for live ID", free: true },

  // SouthWest RailCams
  { id: "swrc-granby", name: "Granby, CO — Moffat Tunnel Sub", lat: 40.0861, lon: -105.9392, railroad: "UP / Amtrak", channel: "SouthWest RailCams", yt: "azr-_DtCHl4", note: "Moffat Tunnel Sub MP 75.7", free: true },
  { id: "swrc-barstow", name: "Barstow, CA — Needles Sub PTZ", lat: 34.9000, lon: -117.0250, railroad: "BNSF", channel: "SouthWest RailCams", yt: "Hsh-46qLpQE", note: "Needles Sub MP 744.5", free: true },
  { id: "swrc-benson-e", name: "Benson, AZ — East", lat: 31.9681, lon: -110.2946, railroad: "UP", channel: "SouthWest RailCams", yt: "DUbV6r-CrkM", note: "Lordsburg Sub MP 1032", free: true },
  { id: "swrc-benson-ptz", name: "Benson, AZ — PTZ", lat: 31.9685, lon: -110.2940, railroad: "UP", channel: "SouthWest RailCams", yt: "7KCnwGgb7OM", note: "Lordsburg Sub PTZ", free: true },
  { id: "swrc-colfax", name: "Colfax, CA — Roseville Sub", lat: 39.1007, lon: -120.9533, railroad: "UP", channel: "SouthWest RailCams", yt: "8zRCgdkn_e8", note: "Roseville Sub MP 141.9", free: true },
  { id: "swrc-cornelia", name: "Cornelia, GA — NS Greenville", lat: 34.5115, lon: -83.5271, railroad: "NS", channel: "SouthWest RailCams", yt: "QwbkUOoiTKs", note: "Greenville District", free: true },
  { id: "swrc-councilbluffs", name: "Council Bluffs, IA", lat: 41.2619, lon: -95.8608, railroad: "UP", channel: "SouthWest RailCams", yt: "QerYTIciDxU", note: "Omaha Sub", free: true },
  { id: "swrc-daggett", name: "Daggett, CA — Needles Sub", lat: 34.8633, lon: -116.8881, railroad: "BNSF", channel: "SouthWest RailCams", yt: "ECfBCFozPlM", note: "Needles Sub MP 737.8", free: true },
  { id: "swrc-decatur", name: "Decatur, AR — CPKC", lat: 36.3351, lon: -94.4608, railroad: "CPKC", channel: "SouthWest RailCams", yt: "gQJzzwqyEsg", note: "Heavener Sub", free: true },
  { id: "swrc-dexter", name: "Dexter, MO", lat: 36.7959, lon: -89.9573, railroad: "UP", channel: "SouthWest RailCams", yt: "e4YOLMOrEy8", note: "Hoxie Sub", free: true },
  { id: "swrc-kingman", name: "Kingman, AZ — Seligman Sub", lat: 35.1894, lon: -114.0530, railroad: "BNSF", channel: "SouthWest RailCams", yt: "-UCI4W_6wAI", note: "Seligman Sub MP 516.5", free: true },
  { id: "swrc-longview-w", name: "Longview, TX — West", lat: 32.5007, lon: -94.7405, railroad: "UP", channel: "SouthWest RailCams", yt: "bjZcsgQUlKk", note: "Mineola / Little Rock", free: true },
  { id: "swrc-weimar", name: "Weimar, TX", lat: 29.7030, lon: -96.7805, railroad: "UP", channel: "SouthWest RailCams", yt: "0P_NgJxBDRQ", note: "Glidden Sub", free: true },
  { id: "swrc-piqua", name: "Piqua, OH — CSX", lat: 40.1448, lon: -84.2424, railroad: "CSX", channel: "SouthWest RailCams", yt: "Vt9sIV-tPeQ", note: "Toledo Sub", free: true },
  { id: "swrc-springcity", name: "Spring City, TN — NS", lat: 35.6920, lon: -84.8608, railroad: "NS", channel: "SouthWest RailCams", yt: "hLRke9fexGs", note: "CNO&TP South", free: true },

  // RailStream YouTube
  { id: "rs-waldwick", name: "Waldwick, NJ — NJT / NS", lat: 41.0107, lon: -74.1229, railroad: "NJT / NS", channel: "RailStream", yt: "a_IsaWR8fBE", note: "WC Tower", free: true },
  { id: "rs-berea", name: "Berea, OH — CSX / NS", lat: 41.3662, lon: -81.8543, railroad: "CSX / NS", channel: "RailStream", yt: "NKLtXovsWnc", note: "Classic Midwest", free: true },
  { id: "rs-northwood", name: "Northwood, OH — Vickers", lat: 41.6084, lon: -83.4688, railroad: "CSX / NS", channel: "RailStream", yt: "VxijdxNKA9M", note: "Vickers Crossing", free: true },
  { id: "rs-shen", name: "Shenandoah Junction, WV", lat: 39.3501, lon: -77.8550, railroad: "CSX / NS", channel: "RailStream", yt: "QhT13bsgL-U", note: "Shen Junction", free: true },
  { id: "rs-fostoria-csx", name: "Fostoria, OH — CSX (ex-B&O)", lat: 41.1575, lon: -83.4175, railroad: "CSX", channel: "RailStream", yt: "3VJXqn2ZI7Y", note: "Iron Triangle CSX", free: true },
  { id: "rs-atlanta", name: "Atlanta, GA — Howell Wye", lat: 33.7990, lon: -84.4330, railroad: "CSX / NS / Amtrak", channel: "RailStream", yt: "QRj1aojRv7o", note: "BI Tower / Howell Wye", free: true },
  { id: "rs-durand", name: "Durand, MI — Depot", lat: 42.9120, lon: -83.9847, railroad: "CN / Amtrak", channel: "RailStream", yt: "LnxHJ0ioERs", note: "Historic depot", free: true },

  // Channel hubs when no fixed ID
  { id: "rbmn-hub", name: "Reading & Northern (RBMN)", lat: 40.6500, lon: -76.0000, railroad: "RBMN", channel: "RBMN", yt: null, note: "Open youtube.com/@RBMN for current live streams", free: true },
  { id: "olt-hub", name: "Official Live Trains network", lat: 39.8283, lon: -98.5795, railroad: "Various", channel: "Official Live Trains", yt: null, note: "Open youtube.com/@OfficialLiveTrains/streams", free: true },
];

const CAMERA_CHANNELS = [
  { name: "Virtual Railfan", url: "https://www.youtube.com/@VirtualRailfan/streams" },
  { name: "Railside Live", url: "https://www.youtube.com/@railsidelive/streams" },
  { name: "Iron Rail Cams", url: "https://www.youtube.com/@IronRailCams" },
  { name: "Official Live Trains", url: "https://www.youtube.com/@OfficialLiveTrains/streams" },
  { name: "RBMN", url: "https://www.youtube.com/@RBMN" },
  { name: "SouthWest RailCams", url: "https://www.youtube.com/@SouthWestRailCams/streams" },
  { name: "RailStream (YouTube)", url: "https://www.youtube.com/@Railstream/streams" },
  { name: "RailStream (full network)", url: "https://app.railstream.net/cameras" },
];

const CLASS1_EMERGENCY = [
  { code: "BNSF", name: "BNSF Railway", phone: "800-832-5452", url: "https://www.bnsf.com/about-bnsf/community/emergency-response.html" },
  { code: "UP", name: "Union Pacific", phone: "888-877-7267", url: "https://www.up.com/aboutup/community/emergency/index.htm" },
  { code: "CSX", name: "CSX Transportation", phone: "800-232-0144", url: "https://www.csx.com/index.cfm/about-us/safety/emergency-response/" },
  { code: "NS", name: "Norfolk Southern", phone: "800-453-2530", url: "https://www.norfolksouthern.com/en/safety/emergency-response" },
  { code: "CN", name: "Canadian National", phone: "800-465-9239", url: "https://www.cn.ca/en/safety/emergency-response/" },
  { code: "CPKC", name: "CPKC", phone: "800-716-9132", url: "https://www.cpkcr.com/" },
  { code: "AMTK", name: "Amtrak", phone: "800-331-0008", url: "https://www.amtrak.com/" },
];

const RESOURCES = {
  askrail: "https://www.askrail.us/",
  virtualRailfan: "https://virtualrailfan.com/cam-locations/",
  virtualRailfanYT: "https://www.youtube.com/@VirtualRailfan/streams",
  railstream: "https://app.railstream.net/cameras",
  upMaps: "https://www.up.com/aboutup/reference/maps/",
  fraMaps: "https://railroads.dot.gov/rail-network-development/maps-and-data/maps-geographic-information-system/maps-geographic",
  ntsb: "https://www.ntsb.gov/investigations/AccidentReports/Pages/railroad.aspx",
  btsNarn: "https://geodata.bts.gov/datasets/usdot::north-american-rail-network-lines/about",
};
