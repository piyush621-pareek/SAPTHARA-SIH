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
  ];

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
