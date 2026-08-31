import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:uuid/uuid.dart';
import 'package:saptahara/core/storage/local_store.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/domain/entities/entities.dart';
import 'package:saptahara/domain/repositories/repositories.dart';

const _uuid = Uuid();

/// ---------- Auth ----------
class MockAuthRepository implements AuthRepository {
  @override
  Future<MockUser> getCurrentUser() async {
    await Future.delayed(const Duration(milliseconds: 200));
    return const MockUser(
      name: 'Rina Tariang',
      role: 'Field Operations Officer',
      agency: 'NER Disaster Response Cell',
      team: 'Team Kaziranga-3',
    );
  }
}

/// ---------- Routes ----------
class MockRouteRepository implements RouteRepository {
  List<RouteOption> _cache = _seed();

  static List<RouteOption> _seed() => [
        RouteOption(
          id: 'route-a',
          name: 'Route A',
          riskLevel: RiskLevel.safe,
          etaMinutes: 405,
          distanceKm: 245,
          safetyScore: 92,
          geometry: const [
            MapPoint(0.08, 0.85),
            MapPoint(0.22, 0.62),
            MapPoint(0.40, 0.55),
            MapPoint(0.58, 0.40),
            MapPoint(0.80, 0.22),
          ],
          hazards: const [],
        ),
        RouteOption(
          id: 'route-b',
          name: 'Route B',
          riskLevel: RiskLevel.moderate,
          etaMinutes: 372,
          distanceKm: 228,
          safetyScore: 68,
          geometry: const [
            MapPoint(0.08, 0.85),
            MapPoint(0.30, 0.70),
            MapPoint(0.46, 0.68),
            MapPoint(0.64, 0.50),
            MapPoint(0.80, 0.22),
          ],
          hazards: const ['Heavy rainfall corridor'],
        ),
        RouteOption(
          id: 'route-c',
          name: 'Route C',
          riskLevel: RiskLevel.risky,
          etaMinutes: 340,
          distanceKm: 210,
          safetyScore: 34,
          geometry: const [
            MapPoint(0.08, 0.85),
            MapPoint(0.26, 0.88),
            MapPoint(0.48, 0.82),
            MapPoint(0.68, 0.70),
            MapPoint(0.80, 0.22),
          ],
          hazards: const ['Active landslide zone', 'Bridge under repair'],
        ),
      ];

  @override
  List<RouteOption> readCached() => _cache;

  @override
  Future<List<RouteOption>> refresh() async {
    await Future.delayed(const Duration(milliseconds: 650));
    // Deterministic refresh — in a real backend this would re-rank by live risk.
    _cache = _seed();
    return _cache;
  }

  @override
  Future<List<RouteOption>> plan(double oLat, double oLng, double dLat, double dLng) =>
      refresh();
}

/// ---------- Alerts ----------
class MockAlertRepository implements AlertRepository {
  List<HazardAlert> _cache = _seed();
  final _controller = StreamController<HazardAlert>.broadcast();
  Timer? _timer;

  static List<HazardAlert> _seed() {
    final now = DateTime.now();
    return [
      HazardAlert(
        id: 'alert-1',
        type: 'landslide',
        severity: AlertSeverity.critical,
        title: 'Landslide Risk Ahead',
        detail: 'High probability landslide zone on Route C near Dima Hasao, 12km ahead.',
        latitude: 25.45,
        longitude: 93.02,
        distanceAheadKm: 12,
        timestamp: now.subtract(const Duration(minutes: 6)),
      ),
      HazardAlert(
        id: 'alert-2',
        type: 'flood',
        severity: AlertSeverity.warning,
        title: 'Flood Warning',
        detail: 'Water levels rising along Route B corridor near Barak river basin.',
        latitude: 24.83,
        longitude: 92.78,
        distanceAheadKm: 34,
        timestamp: now.subtract(const Duration(minutes: 22)),
      ),
      HazardAlert(
        id: 'alert-3',
        type: 'roadblock',
        severity: AlertSeverity.warning,
        title: 'Road Blocked',
        detail: 'NH-306 partially blocked due to debris clearance work.',
        latitude: 25.12,
        longitude: 93.45,
        distanceAheadKm: 58,
        timestamp: now.subtract(const Duration(hours: 1)),
      ),
      HazardAlert(
        id: 'alert-4',
        type: 'network',
        severity: AlertSeverity.info,
        title: 'Network Unavailable',
        detail: 'Cellular coverage drops for ~40km along the Karbi Anglong stretch.',
        latitude: 25.85,
        longitude: 93.60,
        distanceAheadKm: 90,
        timestamp: now.subtract(const Duration(hours: 2)),
      ),
    ];
  }

  @override
  List<HazardAlert> readCached() => _cache;

  @override
  Future<List<HazardAlert>> refresh() async {
    await Future.delayed(const Duration(milliseconds: 500));
    _cache = _seed();
    return _cache;
  }

  @override
  Stream<HazardAlert> watchLive() {
    _timer?.cancel();
    // Simulated live hazard stream — emits a fresh alert periodically for demo.
    _timer = Timer.periodic(const Duration(seconds: 45), (_) {
      final alert = HazardAlert(
        id: _uuid.v4(),
        type: 'weather',
        severity: AlertSeverity.info,
        title: 'Weather Update',
        detail: 'Live telemetry: conditions stable along active route.',
        latitude: 25.3 + Random().nextDouble() * 0.5,
        longitude: 93.1 + Random().nextDouble() * 0.5,
        distanceAheadKm: Random().nextInt(80).toDouble(),
        timestamp: DateTime.now(),
      );
      _controller.add(alert);
    });
    return _controller.stream;
  }

  void dispose() {
    _timer?.cancel();
    _controller.close();
  }
}

/// ---------- Reports (disk-persisted, offline-first) ----------
class MockReportRepository implements ReportRepository {
  static const _key = 'field_reports';
  final List<FieldReport> _reports = [];

  MockReportRepository() {
    _load();
  }

  void _load() {
    final raw = LocalStore.getString(_key);
    if (raw == null) return;
    try {
      final list = jsonDecode(raw) as List;
      _reports
        ..clear()
        ..addAll(list.whereType<Map>().map((m) => FieldReport.fromJson(m.cast<String, dynamic>())));
    } catch (_) {/* corrupt store — start clean */}
  }

  void _persist() {
    LocalStore.setString(_key, jsonEncode(_reports.map((r) => r.toJson()).toList()));
  }

  @override
  List<FieldReport> getAll() => List.unmodifiable(_reports.reversed);

  @override
  FieldReport saveOffline(FieldReport report) {
    _reports.add(report);
    _persist();
    return report;
  }

  @override
  FieldReport updateStatus(String id, SyncStatus status, {int? retryCount}) {
    final idx = _reports.indexWhere((r) => r.id == id);
    if (idx == -1) throw StateError('Report not found: $id');
    final updated = _reports[idx].copyWith(syncStatus: status, retryCount: retryCount);
    _reports[idx] = updated;
    _persist();
    return updated;
  }
}

/// ---------- Sync / Outbox ----------
class MockSyncRepository implements SyncRepository {
  final List<SyncJob> _outbox = [];
  final Random _rand = Random();

  @override
  List<SyncJob> getOutbox() => List.unmodifiable(_outbox.reversed);

  @override
  SyncJob enqueue(String entityType, String entityId) {
    final job = SyncJob(
      id: _uuid.v4(),
      entityType: entityType,
      entityId: entityId,
      operation: 'upload',
      status: SyncStatus.pending,
    );
    _outbox.add(job);
    return job;
  }

  @override
  Future<bool> flushOne(SyncJob job) async {
    final idx = _outbox.indexWhere((j) => j.id == job.id);
    if (idx == -1) return false;
    _outbox[idx] = _outbox[idx].copyWith(status: SyncStatus.syncing, lastAttemptAt: DateTime.now());
    await Future.delayed(Duration(milliseconds: 500 + _rand.nextInt(700)));
    // ~85% simulated success rate, deterministic-ish for demo stability.
    final success = _rand.nextInt(100) < 85;
    _outbox[idx] = _outbox[idx].copyWith(
      status: success ? SyncStatus.synced : SyncStatus.failed,
      retryCount: success ? _outbox[idx].retryCount : _outbox[idx].retryCount + 1,
      errorMessage: success ? null : 'Simulated upload timeout',
    );
    return success;
  }

  @override
  Future<void> flushAll() async {
    for (final job in List<SyncJob>.from(_outbox)) {
      if (job.status == SyncStatus.pending || job.status == SyncStatus.failed) {
        await flushOne(job);
      }
    }
  }
}

/// ---------- Geofences ----------
class MockGeofenceRepository implements GeofenceRepository {
  static final List<Geofence> _fences = [
    Geofence(
      id: 'geo-1',
      name: 'Dima Hasao Landslide Zone',
      polygon: const [
        MapPoint(0.60, 0.60),
        MapPoint(0.75, 0.62),
        MapPoint(0.72, 0.78),
        MapPoint(0.58, 0.76),
      ],
      ruleType: 'hazard',
      severity: AlertSeverity.critical,
    ),
  ];

  @override
  List<Geofence> getAll() => _fences;

  @override
  Geofence? intersecting(RouteOption route) {
    // Simplified mock intersection: Route C is flagged as intersecting the fence.
    if (route.id == 'route-c') return _fences.first;
    return null;
  }
}

/// ---------- Verification / Blockchain receipt ----------
class MockVerificationRepository implements VerificationRepository {
  @override
  Future<VerificationReceipt> getReceipt(String reportId) async {
    await Future.delayed(const Duration(milliseconds: 600));
    return VerificationReceipt(
      id: _uuid.v4(),
      reportId: reportId,
      transactionHash: '0x${_uuid.v4().replaceAll('-', '').substring(0, 40)}',
      timestamp: DateTime.now(),
      status: VerificationStatus.verified,
      verificationUrl: 'https://polygonscan.com/tx/mock',
    );
  }
}
