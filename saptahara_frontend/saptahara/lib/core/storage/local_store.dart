import 'package:shared_preferences/shared_preferences.dart';

/// Thin synchronous-after-init wrapper over SharedPreferences so repositories
/// can read/write without awaiting on every call. Call [init] once in main().
class LocalStore {
  LocalStore._();
  static SharedPreferences? _prefs;

  static Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  static String? getString(String key) => _prefs?.getString(key);

  static Future<void> setString(String key, String value) async {
    await _prefs?.setString(key, value);
  }

  static Future<void> remove(String key) async {
    await _prefs?.remove(key);
  }
}
