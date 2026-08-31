// =============================================================================
// Guwahati -> Tawang highway corridor (NH-15 / NH-13, Assam -> Arunachal).
// Real waypoints along the mountain route used to drive the virtual trucks.
// Coordinates are [latitude, longitude].
// =============================================================================

/** Ordered waypoints from Guwahati up to Tawang. */
const GUWAHATI_TAWANG = [
  { name: "Guwahati", lat: 26.1445, lng: 91.7362 },
  { name: "Rangia", lat: 26.4462, lng: 91.6106 },
  { name: "Tezpur", lat: 26.6338, lng: 92.7926 },
  { name: "Bhalukpong", lat: 27.0136, lng: 92.6355 },
  { name: "Bomdila", lat: 27.2646, lng: 92.4159 },
  { name: "Dirang", lat: 27.3597, lng: 92.2417 },
  { name: "Sela Pass", lat: 27.5033, lng: 92.1042 },
  { name: "Tawang", lat: 27.5859, lng: 91.8594 },
];

const R_EARTH_KM = 6371.0088;
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

/** Great-circle distance in km between two {lat,lng} points. */
function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing (degrees, 0..360) from a -> b. */
function bearingDeg(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Linear interpolation between two points at fraction t in [0,1]. */
function lerpPoint(a, b, t) {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/**
 * Samples a polyline route by cumulative distance. Lets each truck be placed at
 * an arbitrary "kilometres travelled" offset and advanced smoothly each tick.
 */
class RouteSampler {
  constructor(waypoints) {
    this.waypoints = waypoints;
    this.segments = [];
    let cumulative = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to = waypoints[i + 1];
      const length = haversineKm(from, to);
      this.segments.push({ from, to, length, startKm: cumulative });
      cumulative += length;
    }
    this.totalKm = cumulative;
  }

  /**
   * Returns { lat, lng, heading, segmentName } for a given distance travelled.
   * Distance is clamped to the route; the caller decides wrap/stop behaviour.
   */
  pointAtKm(km) {
    const d = Math.max(0, Math.min(km, this.totalKm));
    for (const seg of this.segments) {
      if (d >= seg.startKm && d <= seg.startKm + seg.length) {
        const t = seg.length === 0 ? 0 : (d - seg.startKm) / seg.length;
        const p = lerpPoint(seg.from, seg.to, t);
        return {
          lat: p.lat,
          lng: p.lng,
          heading: bearingDeg(seg.from, seg.to),
          segmentName: `${seg.from.name}→${seg.to.name}`,
        };
      }
    }
    const last = this.waypoints[this.waypoints.length - 1];
    const prev = this.waypoints[this.waypoints.length - 2];
    return {
      lat: last.lat,
      lng: last.lng,
      heading: bearingDeg(prev, last),
      segmentName: last.name,
    };
  }
}

module.exports = {
  GUWAHATI_TAWANG,
  RouteSampler,
  haversineKm,
  bearingDeg,
};
