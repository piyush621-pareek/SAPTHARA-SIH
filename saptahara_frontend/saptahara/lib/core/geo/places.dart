import 'dart:math' as math;

/// Human-readable NER place names for coordinates, so the app shows
/// "near Dirang" instead of raw latitude/longitude (many users don't read
/// lat/lng). Offline + instant — a curated list of NER towns, nearest match.
class Places {
  Places._();

  static const _places = <(String, double, double)>[
    ('Guwahati', 26.1445, 91.7362),
    ('Tezpur', 26.6338, 92.7926),
    ('Bhalukpong', 27.0136, 92.6355),
    ('Bomdila', 27.2646, 92.4159),
    ('Dirang', 27.3597, 92.2417),
    ('Sela Pass', 27.5033, 92.1042),
    ('Tawang', 27.5859, 91.8594),
    ('Shillong', 25.5788, 91.8933),
    ('Silchar', 24.8333, 92.7789),
    ('Nagaon', 26.3486, 92.6840),
    ('Jorhat', 26.7509, 94.2036),
    ('Dibrugarh', 27.4728, 94.9120),
    ('Dimapur', 25.9091, 93.7266),
    ('Kohima', 25.6751, 94.1086),
    ('Imphal', 24.8170, 93.9368),
    ('Aizawl', 23.7271, 92.7176),
    ('Agartala', 23.8315, 91.2868),
    ('Itanagar', 27.0844, 93.6053),
    ('Tura', 25.5145, 90.2201),
    ('Gangtok', 27.3389, 88.6065),
    ('Rangia', 26.45, 91.61),
    ('Mangaldai', 26.44, 92.03),
    ('North Lakhimpur', 27.23, 94.10),
    ('Golaghat', 26.51, 93.96),
    ('Barpeta', 26.32, 91.00),
    ('Goalpara', 26.17, 90.62),
    ('Bongaigaon', 26.48, 90.55),
    ('Diphu', 25.84, 93.43),
    ('Haflong', 25.17, 93.02),
    ('Karimganj', 24.87, 92.36),
    ('Pasighat', 28.07, 95.33),
    ('Namchi', 27.17, 88.36),
    // Nepal: flood & landslide hotspots (2025-26 crisis corridors)
    ('Kathmandu', 27.7172, 85.3240),
    ('Pokhara', 28.2096, 83.9856),
    ('Birgunj', 27.0104, 84.8779),
    ('Hetauda', 27.4287, 85.0322),
    ('Butwal', 27.7006, 83.4486),
    ('Bharatpur', 27.6833, 84.4333),
    ('Dharan', 26.8121, 87.2835),
    ('Biratnagar', 26.4525, 87.2718),
    ('Janakpur', 26.7288, 85.9263),
    ('Nepalgunj', 28.05, 81.6167),
    ('Dhangadhi', 28.6833, 80.60),
    ('Sindhupalchok', 27.95, 85.70),
    ('Gorkha', 28.00, 84.6333),
    ('Manang', 28.6667, 84.0167),
    ('Myagdi', 28.5667, 83.2167),
    ('Kaski', 28.3333, 83.95),
    ('Lamjung', 28.30, 84.40),
    ('Rasuwa', 28.10, 85.30),
    ('Dolakha', 27.7833, 86.0667),
    ('Sunsari', 26.65, 87.15),
    // India-Nepal corridor towns
    ('Siliguri', 26.7271, 88.3953),
    ('Raxaul', 26.9787, 84.8512),
    ('Jogbani', 26.3964, 87.2648),
  ];

  /// Public list of selectable NER places (name, lat, lng) for route pickers.
  static List<({String name, double lat, double lng})> get all => (_places
          .map((p) => (name: p.$1, lat: p.$2, lng: p.$3))
          .toList())
      ..sort((a, b) => a.name.compareTo(b.name));

  static double _km(double aLat, double aLng, double bLat, double bLng) {
    const r = 6371.0;
    double rad(double d) => d * math.pi / 180.0;
    final dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
    final s = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(rad(aLat)) * math.cos(rad(bLat)) * math.sin(dLng / 2) * math.sin(dLng / 2);
    return 2 * r * math.asin(math.min(1.0, math.sqrt(s)));
  }

  /// Nearest named NER place: "Dirang" if within ~8 km, else "near Dirang".
  static String name(double? lat, double? lng) {
    if (lat == null || lng == null) return '—';
    var best = _places.first;
    var bestD = double.infinity;
    for (final p in _places) {
      final d = _km(lat, lng, p.$2, p.$3);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (bestD <= 8) return best.$1;
    if (bestD <= 60) return 'near ${best.$1}';
    return '${bestD.round()} km from ${best.$1}';
  }
}
