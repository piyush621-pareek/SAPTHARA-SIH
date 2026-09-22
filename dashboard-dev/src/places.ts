// Human-readable NER place names for coordinates, so the dashboard shows
// "near Dirang" instead of raw latitude/longitude. Offline + instant (no
// geocoding round-trip) — a curated list of NER towns with a nearest-match.

interface Place { name: string; lat: number; lng: number }

const PLACES: Place[] = [
  { name: "Guwahati", lat: 26.1445, lng: 91.7362 },
  { name: "Tezpur", lat: 26.6338, lng: 92.7926 },
  { name: "Bhalukpong", lat: 27.0136, lng: 92.6355 },
  { name: "Bomdila", lat: 27.2646, lng: 92.4159 },
  { name: "Dirang", lat: 27.3597, lng: 92.2417 },
  { name: "Sela Pass", lat: 27.5033, lng: 92.1042 },
  { name: "Tawang", lat: 27.5859, lng: 91.8594 },
  { name: "Shillong", lat: 25.5788, lng: 91.8933 },
  { name: "Silchar", lat: 24.8333, lng: 92.7789 },
  { name: "Nagaon", lat: 26.3486, lng: 92.684 },
  { name: "Jorhat", lat: 26.7509, lng: 94.2036 },
  { name: "Dibrugarh", lat: 27.4728, lng: 94.912 },
  { name: "Dimapur", lat: 25.9091, lng: 93.7266 },
  { name: "Kohima", lat: 25.6751, lng: 94.1086 },
  { name: "Imphal", lat: 24.817, lng: 93.9368 },
  { name: "Aizawl", lat: 23.7271, lng: 92.7176 },
  { name: "Agartala", lat: 23.8315, lng: 91.2868 },
  { name: "Itanagar", lat: 27.0844, lng: 93.6053 },
  { name: "Tura", lat: 25.5145, lng: 90.2201 },
  { name: "Gangtok", lat: 27.3389, lng: 88.6065 },
  { name: "Rangia", lat: 26.45, lng: 91.61 },
  { name: "Mangaldai", lat: 26.44, lng: 92.03 },
  { name: "North Lakhimpur", lat: 27.23, lng: 94.1 },
  { name: "Golaghat", lat: 26.51, lng: 93.96 },
  { name: "Barpeta", lat: 26.32, lng: 91.0 },
  { name: "Goalpara", lat: 26.17, lng: 90.62 },
  { name: "Bongaigaon", lat: 26.48, lng: 90.55 },
  { name: "Diphu", lat: 25.84, lng: 93.43 },
  { name: "Haflong", lat: 25.17, lng: 93.02 },
  { name: "Karimganj", lat: 24.87, lng: 92.36 },
  { name: "Pasighat", lat: 28.07, lng: 95.33 },
  { name: "Namchi", lat: 27.17, lng: 88.36 },
  { name: "Siliguri", lat: 26.7271, lng: 88.3953 },
];

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const NEPAL_PLACES: Place[] = [
  { name: "Kathmandu", lat: 27.7172, lng: 85.3240 },
  { name: "Pokhara", lat: 28.2096, lng: 83.9856 },
  { name: "Biratnagar", lat: 26.4525, lng: 87.2718 },
  { name: "Bharatpur", lat: 27.6833, lng: 84.4333 },
  { name: "Nepalgunj", lat: 28.0500, lng: 81.6167 },
  { name: "Janakpur", lat: 26.7288, lng: 85.9263 },
  { name: "Butwal", lat: 27.7006, lng: 83.4483 },
  { name: "Dharan", lat: 26.8065, lng: 87.2846 },
  { name: "Hetauda", lat: 27.4167, lng: 85.0333 },
  { name: "Birgunj", lat: 27.0104, lng: 84.8770 },
  { name: "Dhangadhi", lat: 28.6833, lng: 80.6000 },
  { name: "Lumbini", lat: 27.4833, lng: 83.2833 },
];

export type OperatingMode = "india" | "nepal";

/** Curated NER towns (sorted A–Z) for From/To pickers and dropdowns. */
export const NER_PLACES = [...PLACES].sort((a, b) => a.name.localeCompare(b.name));
export const NEPAL_CITIES = [...NEPAL_PLACES].sort((a, b) => a.name.localeCompare(b.name));
export type NerPlace = Place;

/** Return places list for the active mode. */
export function placesForMode(mode: OperatingMode): Place[] {
  return mode === "nepal" ? NEPAL_CITIES : NER_PLACES;
}

const ALL_PLACES = [...PLACES, ...NEPAL_PLACES];

/** Nearest named place: "Dirang" if within ~8 km, else "near Dirang". */
export function placeName(lat: number | null, lng: number | null, mode?: OperatingMode): string {
  if (lat == null || lng == null) return "—";
  const pool = mode === "nepal" ? NEPAL_PLACES : mode === "india" ? PLACES : ALL_PLACES;
  let best = pool[0], bestD = Infinity;
  for (const p of pool) {
    const d = haversineKm(lat, lng, p.lat, p.lng);
    if (d < bestD) { bestD = d; best = p; }
  }
  if (bestD <= 8) return best.name;
  if (bestD <= 60) return `near ${best.name}`;
  return `${Math.round(bestD)} km from ${best.name}`;
}
