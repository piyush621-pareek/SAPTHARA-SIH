import 'package:saptahara/domain/entities/entities.dart';

/// Repository interfaces — implemented today by Mock*Repository classes
/// using local/deterministic data. Swap for Api*Repository later; no
/// screen code changes required.

abstract class AuthRepository {
  Future<MockUser> getCurrentUser();
}

class MockUser {
  final String name;
  final String role;
  final String agency;
  final String team;
  const MockUser({required this.name, required this.role, required this.agency, required this.team});
}

abstract class RouteRepository {
  /// Returns cached routes instantly (offline-first read).
  List<RouteOption> readCached();

  /// Simulates a network refresh; throws on simulated failure.
  Future<List<RouteOption>> refresh();
}

abstract class AlertRepository {
  List<HazardAlert> readCached();
  Future<List<HazardAlert>> refresh();
  Stream<HazardAlert> watchLive();
}

abstract class ReportRepository {
  List<FieldReport> getAll();
  FieldReport saveOffline(FieldReport report);
  FieldReport updateStatus(String id, SyncStatus status, {int? retryCount});
}

abstract class SyncRepository {
  List<SyncJob> getOutbox();
  SyncJob enqueue(String entityType, String entityId);
  Future<bool> flushOne(SyncJob job); // simulated upload; returns success
  Future<void> flushAll();
}

abstract class GeofenceRepository {
  List<Geofence> getAll();
  Geofence? intersecting(RouteOption route);
}

abstract class VerificationRepository {
  Future<VerificationReceipt> getReceipt(String reportId);
}
