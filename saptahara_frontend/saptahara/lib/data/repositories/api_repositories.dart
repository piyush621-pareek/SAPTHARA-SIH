import 'dart:async';
import 'package:saptahara/core/network/api_client.dart';
import 'package:saptahara/core/network/api_config.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/core/utils/geo.dart';
import 'package:saptahara/domain/entities/entities.dart';
import 'package:saptahara/domain/repositories/repositories.dart';
import 'package:saptahara/services/websocket/socket_service.dart';

/// Shared store mapping a local (offline-created) report id to the tamper-proof
/// ledger receipt returned by the backend when it was synced. Powers the
/// blockchain-style verification screen with the REAL chain hash.
class ReceiptStore {
  ReceiptStore._();
  static final ReceiptStore instance = ReceiptStore._();
  final Map<String, VerificationReceipt> _byLocalId = {};

  void put(String localReportId, VerificationReceipt receipt) {
    _byLocalId[localReportId] = receipt;
  }

  VerificationReceipt? get(String localReportId) => _byLocalId[localReportId];
}

// --------------------------------------------------------------------------
// Alerts  ←  GET /hazards  +  Socket.IO (emergency:alert, hazard:breach)
// --------------------------------------------------------------------------
class ApiAlertRepository implements AlertRepository {
  List<HazardAlert> _cache = const [];
  final _live = StreamController<HazardAlert>.broadcast();
  bool _wired = false;

  @override
  List<HazardAlert> readCached() => _cache;

  @override
  Future<List<HazardAlert>> refresh() async {
    final body = await ApiClient.instance.getJson('/hazards');
    final list = (body is Map && body['data'] is List) ? body['data'] as List : const [];
    final now = DateTime.now();
    _cache = list.whereType<Map>().map((h) {
      final ring = (h['geometry']?['coordinates'] is List &&
              (h['geometry']['coordinates'] as List).isNotEmpty)
          ? (h['geometry']['coordinates'][0] as List)
          : const [];
      final c = ringCentroid(ring);
      final sev = (h['severity'] as num?)?.toInt() ?? 1;
      final risk = double.tryParse('${h['risk_score']}') ?? 0.0;
      return HazardAlert(
        id: h['id']?.toString() ?? '',
        type: (h['kind'] ?? 'other').toString(),
        severity: _sevFromInt(sev),
        title: (h['label'] ?? 'Hazard zone').toString(),
        detail:
            'Active ${h['kind']} zone · severity $sev · ${(risk * 100).round()}% risk',
        latitude: c.lat,
        longitude: c.lng,
        distanceAheadKm: 0,
        timestamp: now,
      );
    }).toList();
    return _cache;
  }

  @override
  Stream<HazardAlert> watchLive() {
    if (!_wired) {
      _wired = true;
      final socket = SocketService.instance..connect();
      socket.onEmergency.listen((d) {
        final loc = d['location'] as Map? ?? const {};
        _live.add(HazardAlert(
          id: d['incidentId']?.toString() ?? DateTime.now().toString(),
          type: 'sos',
          severity: AlertSeverity.critical,
          title: (d['message'] ?? 'SOS distress signal').toString(),
          detail: 'Emergency via ${d['channel'] ?? 'sms_2g'}',
          latitude: (loc['latitude'] as num?)?.toDouble() ?? 0,
          longitude: (loc['longitude'] as num?)?.toDouble() ?? 0,
          distanceAheadKm: 0,
          timestamp: DateTime.now(),
        ));
      });
      socket.onBreach.listen((d) {
        final loc = d['location'] as Map? ?? const {};
        final hazards = (d['hazards'] as List?)
                ?.map((h) => (h is Map ? h['label'] : h).toString())
                .join(', ') ??
            'hazard zone';
        _live.add(HazardAlert(
          id: 'breach-${DateTime.now().microsecondsSinceEpoch}',
          type: 'landslide',
          severity: AlertSeverity.warning,
          title: 'Geofence Breach',
          detail: 'Vehicle entered: $hazards',
          latitude: (loc['latitude'] as num?)?.toDouble() ?? 0,
          longitude: (loc['longitude'] as num?)?.toDouble() ?? 0,
          distanceAheadKm: 0,
          timestamp: DateTime.now(),
        ));
      });
    }
    return _live.stream;
  }

  void dispose() => _live.close();

  AlertSeverity _sevFromInt(int sev) {
    if (sev >= 4) return AlertSeverity.critical;
    if (sev == 3) return AlertSeverity.warning;
    return AlertSeverity.info;
  }
}

// --------------------------------------------------------------------------
// Routes  ←  POST /routing/route  (hazard-aware rerouting engine)
// --------------------------------------------------------------------------
class ApiRouteRepository implements RouteRepository {
  List<RouteOption> _cache = const [];

  @override
  List<RouteOption> readCached() => _cache;

  @override
  Future<List<RouteOption>> refresh() =>
      plan(ApiConfig.originLat, ApiConfig.originLng, ApiConfig.destLat, ApiConfig.destLng);

  @override
  Future<List<RouteOption>> plan(
      double oLat, double oLng, double dLat, double dLng) async {
    final body = await ApiClient.instance.postJson('/routing/route', {
      'origin': {'latitude': oLat, 'longitude': oLng},
      'destination': {'latitude': dLat, 'longitude': dLng},
    });
    final data = body is Map ? body['data'] as Map? : null;
    final alts = (data?['alternatives'] as List?) ?? const [];
    _cache = alts.whereType<Map>().map(_toRoute).toList();
    return _cache;
  }

  RouteOption _toRoute(Map a) {
    final coords = (a['geometry']?['coordinates'] as List?) ?? const [];
    final geometry = coords
        .whereType<List>()
        .map((c) => toMapPoint((c[1] as num).toDouble(), (c[0] as num).toDouble()))
        .toList();
    final safety = (a['safety_score'] as num?)?.toInt() ?? 50;
    final distanceKm = (a['distance_km'] as num?)?.toDouble() ?? 0;
    final hazards =
        (a['hazards'] as List?)?.map((h) => h.toString()).toList() ?? const <String>[];
    return RouteOption(
      id: a['id']?.toString() ?? 'route',
      name: (a['name'] ?? 'Route').toString(),
      riskLevel: safety >= 70
          ? RiskLevel.safe
          : safety >= 40
              ? RiskLevel.moderate
              : RiskLevel.risky,
      etaMinutes: (distanceKm / 40.0 * 60).round(),
      distanceKm: distanceKm,
      safetyScore: safety,
      geometry: geometry,
      hazards: hazards,
      status: (a['status'] ?? 'active').toString(),
    );
  }
}

// --------------------------------------------------------------------------
// Geofences  ←  GET /hazards  (polygon overlays)
// --------------------------------------------------------------------------
class ApiGeofenceRepository implements GeofenceRepository {
  List<Geofence> _cache = const [];

  ApiGeofenceRepository() {
    // Fire-and-forget preload; getAll() returns the cache once populated.
    _load();
  }

  Future<void> _load() async {
    try {
      final body = await ApiClient.instance.getJson('/hazards');
      final list = (body is Map && body['data'] is List) ? body['data'] as List : const [];
      _cache = list.whereType<Map>().map((h) {
        final ring = (h['geometry']?['coordinates'] is List &&
                (h['geometry']['coordinates'] as List).isNotEmpty)
            ? (h['geometry']['coordinates'][0] as List)
            : const [];
        final poly = ring
            .whereType<List>()
            .map((c) => toMapPoint((c[1] as num).toDouble(), (c[0] as num).toDouble()))
            .toList();
        final sev = (h['severity'] as num?)?.toInt() ?? 1;
        return Geofence(
          id: h['id']?.toString() ?? '',
          name: (h['label'] ?? 'Hazard zone').toString(),
          polygon: poly,
          ruleType: 'hazard',
          severity: sev >= 4 ? AlertSeverity.critical : AlertSeverity.warning,
        );
      }).toList();
    } catch (_) {
      // keep whatever we had
    }
  }

  @override
  List<Geofence> getAll() => _cache;

  @override
  Geofence? intersecting(RouteOption route) {
    if (route.hazards.isEmpty || _cache.isEmpty) return null;
    for (final g in _cache) {
      if (route.hazards.any((h) => h.contains(g.name) || g.name.contains(h))) {
        return g;
      }
    }
    return _cache.first;
  }
}

// --------------------------------------------------------------------------
// Sync  →  POST /reports  (real upload; anchors report to the ledger)
// --------------------------------------------------------------------------
class ApiSyncRepository implements SyncRepository {
  ApiSyncRepository(this._reports);
  final ReportRepository _reports;
  final List<SyncJob> _outbox = [];

  @override
  List<SyncJob> getOutbox() => List.unmodifiable(_outbox.reversed);

  @override
  SyncJob enqueue(String entityType, String entityId) {
    final job = SyncJob(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
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
    _outbox[idx] =
        _outbox[idx].copyWith(status: SyncStatus.syncing, lastAttemptAt: DateTime.now());

    FieldReport? report;
    for (final r in _reports.getAll()) {
      if (r.id == job.entityId) {
        report = r;
        break;
      }
    }
    if (report == null) {
      _outbox[idx] = _outbox[idx].copyWith(status: SyncStatus.failed);
      return false;
    }

    try {
      final body = await ApiClient.instance.postJson('/reports', {
        'report_type': _typeToApi(report.type),
        'notes': report.notes,
        'urgency': report.urgency.name,
        'media_ids': report.mediaIds,
        'latitude': report.latitude,
        'longitude': report.longitude,
      });
      final data = body is Map ? body['data'] as Map? : null;
      final hash = data?['ledger_hash']?.toString();
      if (hash != null && hash.isNotEmpty) {
        ReceiptStore.instance.put(
          report.id,
          VerificationReceipt(
            id: data?['id']?.toString() ?? report.id,
            reportId: report.id,
            transactionHash: hash,
            timestamp: DateTime.tryParse(data?['created_at']?.toString() ?? '') ??
                DateTime.now(),
            status: VerificationStatus.verified,
            verificationUrl: '${ApiConfig.baseUrl}/api/v1/ledger/verify',
          ),
        );
      }
      _outbox[idx] = _outbox[idx].copyWith(status: SyncStatus.synced);
      return true;
    } catch (e) {
      _outbox[idx] = _outbox[idx].copyWith(
        status: SyncStatus.failed,
        retryCount: _outbox[idx].retryCount + 1,
        errorMessage: e.toString(),
      );
      return false;
    }
  }

  @override
  Future<void> flushAll() async {
    for (final job in List<SyncJob>.from(_outbox)) {
      if (job.status == SyncStatus.pending || job.status == SyncStatus.failed) {
        await flushOne(job);
      }
    }
  }

  String _typeToApi(ReportType t) {
    switch (t) {
      case ReportType.landslide:
        return 'landslide';
      case ReportType.flood:
        return 'flood';
      case ReportType.roadblock:
        return 'roadblock';
      case ReportType.supplyIssue:
        return 'supply_issue';
      case ReportType.other:
        return 'other';
    }
  }
}

// --------------------------------------------------------------------------
// Verification  ←  ledger receipt captured at sync time
// --------------------------------------------------------------------------
class ApiVerificationRepository implements VerificationRepository {
  @override
  Future<VerificationReceipt> getReceipt(String reportId) async {
    final cached = ReceiptStore.instance.get(reportId);
    if (cached != null) return cached;
    // Report not yet synced to the ledger.
    return VerificationReceipt(
      id: reportId,
      reportId: reportId,
      transactionHash: 'pending-sync',
      timestamp: DateTime.now(),
      status: VerificationStatus.pending,
      verificationUrl: '${ApiConfig.baseUrl}/api/v1/ledger/verify',
    );
  }
}
