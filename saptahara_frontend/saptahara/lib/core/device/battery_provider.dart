import 'package:battery_plus/battery_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Real device battery percentage (0-100). Read once when Profile builds.
final batteryLevelProvider = FutureProvider<int>((ref) async {
  try {
    return await Battery().batteryLevel;
  } catch (_) {
    return 100; // sensible fallback if the platform channel is unavailable
  }
});
