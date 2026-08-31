import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:saptahara/domain/entities/entities.dart';

/// Simulated connectivity — driven by the Settings offline toggle.
/// A real `connectivity_plus`-based checker can replace this later
/// with no screen-level changes (same provider, same state shape).
class ConnectivityController extends StateNotifier<ConnectivityState> {
  ConnectivityController() : super(ConnectivityState.online);

  bool get isOnline => state == ConnectivityState.online || state == ConnectivityState.syncing;

  void setOfflineMode(bool offline) {
    state = offline ? ConnectivityState.offline : ConnectivityState.online;
  }

  void setSyncing() => state = ConnectivityState.syncing;

  void setDegraded() => state = ConnectivityState.degraded;

  void resolveOnline() => state = ConnectivityState.online;
}

final connectivityProvider =
    StateNotifierProvider<ConnectivityController, ConnectivityState>((ref) {
  return ConnectivityController();
});

extension ConnectivityStateX on ConnectivityState {
  String get label {
    switch (this) {
      case ConnectivityState.unknown:
        return 'UNKNOWN';
      case ConnectivityState.checking:
        return 'CHECKING';
      case ConnectivityState.online:
        return 'LIVE';
      case ConnectivityState.offline:
        return 'OFFLINE';
      case ConnectivityState.syncing:
        return 'SYNCING';
      case ConnectivityState.degraded:
        return 'RECONNECTING';
    }
  }
}
