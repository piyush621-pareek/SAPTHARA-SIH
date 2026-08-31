import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:saptahara/data/repositories/mock_repositories.dart';
import 'package:saptahara/data/repositories/api_repositories.dart';
import 'package:saptahara/domain/entities/entities.dart';
import 'package:saptahara/domain/repositories/repositories.dart';
import 'package:saptahara/core/connectivity/connectivity_provider.dart';
import 'package:saptahara/services/websocket/socket_service.dart';
import 'package:saptahara/presentation/widgets/mock_map.dart' show MapStyle;

/// Set false to run fully offline on the built-in mock data (no backend).
const bool kUseBackend = true;

/// ---------- Repository singletons ----------
/// Live data comes from the NER backend (Api*Repository); the user profile and
/// local offline report store stay client-side.
final authRepositoryProvider = Provider<AuthRepository>((ref) => MockAuthRepository());

final routeRepositoryProvider = Provider<RouteRepository>(
    (ref) => kUseBackend ? ApiRouteRepository() : MockRouteRepository());

final alertRepositoryProvider = Provider<AlertRepository>((ref) {
  if (kUseBackend) {
    final repo = ApiAlertRepository();
    ref.onDispose(repo.dispose);
    return repo;
  }
  final repo = MockAlertRepository();
  ref.onDispose(repo.dispose);
  return repo;
});

// Reports stay local (offline-first); they upload to the backend via SyncRepo.
final reportRepositoryProvider = Provider<ReportRepository>((ref) => MockReportRepository());

final syncRepositoryProvider = Provider<SyncRepository>((ref) => kUseBackend
    ? ApiSyncRepository(ref.watch(reportRepositoryProvider))
    : MockSyncRepository());

final geofenceRepositoryProvider = Provider<GeofenceRepository>(
    (ref) => kUseBackend ? ApiGeofenceRepository() : MockGeofenceRepository());

final verificationRepositoryProvider = Provider<VerificationRepository>(
    (ref) => kUseBackend ? ApiVerificationRepository() : MockVerificationRepository());

/// ---------- Current user ----------
final currentUserProvider = FutureProvider<MockUser>((ref) {
  return ref.watch(authRepositoryProvider).getCurrentUser();
});

/// ---------- Routes ----------
class RoutesController extends StateNotifier<AsyncValue<List<RouteOption>>> {
  RoutesController(this._repo) : super(AsyncValue.data(_repo.readCached())) {
    refresh();
  }
  final RouteRepository _repo;

  Future<void> refresh() async {
    // Retry a few times with backoff so a cold-start / brief-connectivity blip
    // doesn't leave the screen stuck on "Failed to load".
    for (var attempt = 1; attempt <= 3; attempt++) {
      try {
        state = AsyncValue.data(await _repo.refresh());
        return;
      } catch (e, st) {
        if (attempt == 3) {
          state = AsyncValue.error(e, st);
          return;
        }
        await Future.delayed(Duration(seconds: attempt));
      }
    }
  }
}

final routesControllerProvider =
    StateNotifierProvider<RoutesController, AsyncValue<List<RouteOption>>>((ref) {
  return RoutesController(ref.watch(routeRepositoryProvider));
});

/// Selected route id on the Route screen (also used by Home summary).
final selectedRouteIdProvider = StateProvider<String?>((ref) => null);

final recommendedRouteProvider = Provider<RouteOption?>((ref) {
  final routesAsync = ref.watch(routesControllerProvider);
  return routesAsync.maybeWhen(
    data: (routes) {
      if (routes.isEmpty) return null;
      final sorted = [...routes]..sort((a, b) => b.safetyScore.compareTo(a.safetyScore));
      return sorted.first;
    },
    orElse: () => null,
  );
});

/// ---------- Alerts ----------
class AlertsController extends StateNotifier<AsyncValue<List<HazardAlert>>> {
  AlertsController(this._repo) : super(AsyncValue.data(_repo.readCached())) {
    refresh(); // pull live hazards from the backend on startup
  }
  final AlertRepository _repo;

  Future<void> refresh() async {
    for (var attempt = 1; attempt <= 3; attempt++) {
      try {
        state = AsyncValue.data(await _repo.refresh());
        return;
      } catch (e, st) {
        if (attempt == 3) {
          state = AsyncValue.error(e, st);
          return;
        }
        await Future.delayed(Duration(seconds: attempt));
      }
    }
  }

  void pushLive(HazardAlert alert) {
    state.whenData((alerts) {
      // Dedupe: drop any existing entry with the same id before prepending.
      final deduped = alerts.where((a) => a.id != alert.id).toList();
      state = AsyncValue.data([alert, ...deduped]);
    });
  }
}

final alertsControllerProvider =
    StateNotifierProvider<AlertsController, AsyncValue<List<HazardAlert>>>((ref) {
  final controller = AlertsController(ref.watch(alertRepositoryProvider));
  final sub = ref.watch(alertRepositoryProvider).watchLive().listen(controller.pushLive);
  ref.onDispose(sub.cancel);
  return controller;
});

/// Stream of live socket-pushed alerts (emergency:alert / hazard:breach).
/// The app shell listens to this to surface a toast the moment one arrives.
final liveAlertStreamProvider = StreamProvider<HazardAlert>((ref) {
  return ref.watch(alertRepositoryProvider).watchLive();
});

/// Map deep-link target. Tapping an alert toast sets this; the Home map centers
/// on it and highlights the location. `nonce` makes repeat taps re-trigger.
typedef FocusTarget = ({double lat, double lng, int nonce});
final focusedAlertProvider = StateProvider<FocusTarget?>((ref) => null);

/// ---------- Reports + outbox ----------
class ReportsController extends StateNotifier<List<FieldReport>> {
  ReportsController(this._repo) : super(_repo.getAll());
  final ReportRepository _repo;

  FieldReport add(FieldReport report) {
    final saved = _repo.saveOffline(report);
    state = _repo.getAll();
    return saved;
  }

  void updateStatus(String id, SyncStatus status, {int? retryCount}) {
    _repo.updateStatus(id, status, retryCount: retryCount);
    state = _repo.getAll();
  }
}

final reportsControllerProvider = StateNotifierProvider<ReportsController, List<FieldReport>>((ref) {
  return ReportsController(ref.watch(reportRepositoryProvider));
});

class SyncController extends StateNotifier<List<SyncJob>> {
  SyncController(this.ref, this._syncRepo) : super(_syncRepo.getOutbox());
  final Ref ref;
  final SyncRepository _syncRepo;

  SyncJob enqueueReport(String reportId) {
    final job = _syncRepo.enqueue('report', reportId);
    state = _syncRepo.getOutbox();
    ref.read(reportsControllerProvider.notifier).updateStatus(reportId, SyncStatus.pending);
    return job;
  }

  Future<void> flushAll() async {
    final connectivity = ref.read(connectivityProvider.notifier);
    if (!ref.read(connectivityProvider.notifier).isOnline) return;
    connectivity.setSyncing();
    for (final job in List<SyncJob>.from(_syncRepo.getOutbox())) {
      if (job.status == SyncStatus.synced) continue;
      ref.read(reportsControllerProvider.notifier).updateStatus(job.entityId, SyncStatus.syncing);
      state = _syncRepo.getOutbox();
      final success = await _syncRepo.flushOne(job);
      state = _syncRepo.getOutbox();
      ref.read(reportsControllerProvider.notifier).updateStatus(
            job.entityId,
            success ? SyncStatus.synced : SyncStatus.failed,
          );
    }
    connectivity.resolveOnline();
  }
}

final syncControllerProvider = StateNotifierProvider<SyncController, List<SyncJob>>((ref) {
  return SyncController(ref, ref.watch(syncRepositoryProvider));
});

/// Last successful sync time (surfaced on Profile).
final lastSyncTimeProvider = StateProvider<DateTime?>((ref) => null);

/// ---------- Settings ----------
final notificationsEnabledProvider = StateProvider<bool>((ref) => true);
enum LocationPermission { granted, denied, unknown }
final locationPermissionProvider = StateProvider<LocationPermission>((ref) => LocationPermission.unknown);
final mapStyleProvider = StateProvider<MapStyle>((ref) => MapStyle.standard);
enum ApiEnvironment { dev, staging, prod }
final apiEnvironmentProvider = StateProvider<ApiEnvironment>((ref) => ApiEnvironment.dev);

/// ---------- Live status (real Socket.IO connection) ----------
/// Connects the Socket.IO client and tracks its live connection state.
class SocketStatusController extends StateNotifier<LiveStatus> {
  SocketStatusController() : super(LiveStatus.reconnecting) {
    final socket = SocketService.instance..connect();
    state = socket.isConnected ? LiveStatus.live : LiveStatus.reconnecting;
    _sub = socket.onConnected.listen((connected) {
      if (mounted) {
        state = connected ? LiveStatus.live : LiveStatus.reconnecting;
      }
    });
  }

  StreamSubscription<bool>? _sub;

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}

final socketStatusProvider =
    StateNotifierProvider<SocketStatusController, LiveStatus>(
        (ref) => SocketStatusController());

/// The header LIVE pill: the manual offline toggle wins; otherwise it reflects
/// the REAL Socket.IO connection (LIVE when connected, RECONNECTING otherwise).
final liveStatusProvider = Provider<LiveStatus>((ref) {
  final connectivity = ref.watch(connectivityProvider);
  if (connectivity == ConnectivityState.offline ||
      connectivity == ConnectivityState.unknown) {
    return LiveStatus.offline;
  }
  return ref.watch(socketStatusProvider);
});
