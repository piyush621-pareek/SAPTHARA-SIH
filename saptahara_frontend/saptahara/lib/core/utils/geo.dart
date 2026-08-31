import 'package:saptahara/domain/entities/entities.dart';

/// Wraps a real WGS84 coordinate as a MapPoint carrying raw geographic values:
/// x = longitude, y = latitude. The LiveMap (flutter_map) reads them back as
/// LatLng(y, x). (Note: the legacy normalized MockMap is no longer used.)
MapPoint toMapPoint(double lat, double lng) => MapPoint(lng, lat);

/// Centroid of a GeoJSON polygon ring given as [[lng,lat], ...].
({double lat, double lng}) ringCentroid(List<dynamic> ring) {
  double sx = 0, sy = 0;
  var n = 0;
  for (final p in ring) {
    if (p is List && p.length >= 2) {
      sx += (p[0] as num).toDouble();
      sy += (p[1] as num).toDouble();
      n++;
    }
  }
  if (n == 0) return (lat: 0, lng: 0);
  return (lat: sy / n, lng: sx / n);
}
