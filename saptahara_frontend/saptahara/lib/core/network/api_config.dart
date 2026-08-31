import 'package:saptahara/core/storage/local_store.dart';

/// Backend connection + geo configuration.
///
/// Resolution order for the backend base URL:
///   1. an in-app override saved from Settings (works on a real phone — just
///      enter your PC's LAN IP, e.g. http://192.168.1.10:8080), then
///   2. the value compiled in via --dart-define=API_BASE_URL=..., else
///   3. the Android-emulator default (10.0.2.2 aliases the host's localhost).
class ApiConfig {
  ApiConfig._();

  static const String _prefsKey = 'backend_url';

  static const String _compiledBase = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8080',
  );

  /// The active backend origin (override wins over the compiled default).
  static String get baseUrl {
    final override = LocalStore.getString(_prefsKey);
    return (override != null && override.isNotEmpty) ? override : _compiledBase;
  }

  static String get socketUrl => baseUrl;

  /// Persists a user-entered backend URL (from Settings). Empty clears it.
  static Future<void> setBackendUrl(String url) async {
    final trimmed = url.trim();
    if (trimmed.isEmpty) {
      await LocalStore.remove(_prefsKey);
    } else {
      await LocalStore.setString(_prefsKey, trimmed);
    }
  }

  static String? get savedBackendUrl => LocalStore.getString(_prefsKey);

  static String get apiV1 => '$baseUrl/api/v1';

  /// Demo device/vehicle identity used for SOS (a seeded backend vehicle).
  static const String deviceId = String.fromEnvironment(
    'DEVICE_ID',
    defaultValue: '12c50ea8-15b1-47b9-afa5-cd83e9ccdd52',
  );

  /// Fixed "current location" for the field officer in the demo (Dirang, on the
  /// Guwahati–Tawang corridor). Swap for a geolocator fix in production.
  static const double demoLat = 27.3597;
  static const double demoLng = 92.2417;

  /// Fixed demo trip endpoints used by the route screen.
  static const double originLat = 26.1445; // Guwahati
  static const double originLng = 91.7362;
  static const double destLat = 27.5859; // Tawang
  static const double destLng = 91.8594;

  /// Bounding box for normalizing real lat/lng into the mock map's 0..1 space.
  static const double lngMin = 91.5;
  static const double lngMax = 93.0;
  static const double latMin = 26.0;
  static const double latMax = 28.0;
}
