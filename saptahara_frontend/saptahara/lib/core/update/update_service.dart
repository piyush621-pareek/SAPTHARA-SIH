import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:saptahara/core/network/api_client.dart';

/// The version this build reports. Bump it in lockstep with the server's
/// APP_VERSION so the in-app updater knows when a newer APK is available.
const String kAppVersion = '1.1.0';

class UpdateInfo {
  final String version;
  final String apkUrl;
  final String notes;
  final bool mandatory;
  const UpdateInfo(this.version, this.apkUrl, this.notes, this.mandatory);
}

/// Compares two dotted version strings; returns true if [remote] > [local].
bool isNewer(String remote, String local) {
  int part(List<String> p, int i) => i < p.length ? (int.tryParse(p[i]) ?? 0) : 0;
  final r = remote.split('.'), l = local.split('.');
  for (var i = 0; i < 3; i++) {
    if (part(r, i) != part(l, i)) return part(r, i) > part(l, i);
  }
  return false;
}

/// Checks the backend for a newer app build. Returns null if up to date or on
/// any error (the check must never block or crash the app).
final updateCheckProvider = FutureProvider<UpdateInfo?>((ref) async {
  try {
    final body = await ApiClient.instance.getJson('/app/version');
    final data = body is Map ? body['data'] as Map? : null;
    if (data == null) return null;
    final version = data['version']?.toString() ?? kAppVersion;
    if (!isNewer(version, kAppVersion)) return null;
    return UpdateInfo(
      version,
      data['apk_url']?.toString() ?? '',
      data['notes']?.toString() ?? 'A new version is available.',
      data['mandatory'] == true,
    );
  } catch (_) {
    return null;
  }
});
