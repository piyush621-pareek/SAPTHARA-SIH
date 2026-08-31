import 'package:geolocator/geolocator.dart';
import 'package:saptahara/core/network/api_config.dart';

/// Real device GPS with permission handling. Falls back to the demo corridor
/// coordinate when location is unavailable or denied, so the flow never blocks.
class LocationService {
  LocationService._();
  static final LocationService instance = LocationService._();

  /// Returns the current fix, or the demo fallback. Never throws.
  Future<({double lat, double lng, bool live})> current() async {
    final pos = await rawPosition();
    if (pos == null) return _fallback();
    return (lat: pos.latitude, lng: pos.longitude, live: true);
  }

  /// Raw geolocator Position (with speed/heading) or null if unavailable.
  /// Handles the permission flow; never throws.
  Future<Position?> rawPosition() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return null;
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        return null;
      }
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 8),
        ),
      );
    } catch (_) {
      return null;
    }
  }

  ({double lat, double lng, bool live}) _fallback() =>
      (lat: ApiConfig.demoLat, lng: ApiConfig.demoLng, live: false);
}
