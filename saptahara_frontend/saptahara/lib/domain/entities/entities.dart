import 'package:saptahara/core/theme/app_theme.dart';

enum SyncStatus { pending, syncing, synced, failed }

enum ConnectivityState { unknown, checking, online, offline, syncing, degraded }

enum LiveStatus { live, reconnecting, offline }

class RouteOption {
  final String id;
  final String name;
  final RiskLevel riskLevel;
  final int etaMinutes;
  final double distanceKm;
  final int safetyScore; // 0-100
  final List<MapPoint> geometry;
  final List<String> hazards;
  final String status;

  const RouteOption({
    required this.id,
    required this.name,
    required this.riskLevel,
    required this.etaMinutes,
    required this.distanceKm,
    required this.safetyScore,
    required this.geometry,
    this.hazards = const [],
    this.status = 'active',
  });

  String get etaLabel {
    final h = etaMinutes ~/ 60;
    final m = etaMinutes % 60;
    if (h == 0) return '${m}m';
    return '${h}h ${m}m';
  }
}

class MapPoint {
  final double x; // normalized 0-1 within mock map canvas
  final double y;
  const MapPoint(this.x, this.y);
}

enum AlertSeverity { info, warning, critical }

class HazardAlert {
  final String id;
  final String type; // landslide / flood / roadblock / network / other
  final AlertSeverity severity;
  final String title;
  final String detail;
  final double latitude;
  final double longitude;
  final double distanceAheadKm;
  final DateTime timestamp;
  final bool active;

  const HazardAlert({
    required this.id,
    required this.type,
    required this.severity,
    required this.title,
    required this.detail,
    required this.latitude,
    required this.longitude,
    required this.distanceAheadKm,
    required this.timestamp,
    this.active = true,
  });
}

enum ReportType { landslide, flood, roadblock, supplyIssue, other }

extension ReportTypeX on ReportType {
  String get label {
    switch (this) {
      case ReportType.landslide:
        return 'Landslide';
      case ReportType.flood:
        return 'Flood';
      case ReportType.roadblock:
        return 'Roadblock';
      case ReportType.supplyIssue:
        return 'Supply Issue';
      case ReportType.other:
        return 'Other';
    }
  }
}

enum Urgency { low, medium, high, critical }

extension UrgencyX on Urgency {
  String get label {
    switch (this) {
      case Urgency.low:
        return 'Low';
      case Urgency.medium:
        return 'Medium';
      case Urgency.high:
        return 'High';
      case Urgency.critical:
        return 'Critical';
    }
  }
}

class FieldReport {
  final String id;
  final ReportType type;
  final String notes;
  final List<String> mediaIds; // mock attachment refs
  final double latitude;
  final double longitude;
  final Urgency urgency;
  final DateTime createdAt;
  final SyncStatus syncStatus;
  final int retryCount;

  const FieldReport({
    required this.id,
    required this.type,
    required this.notes,
    this.mediaIds = const [],
    required this.latitude,
    required this.longitude,
    required this.urgency,
    required this.createdAt,
    this.syncStatus = SyncStatus.pending,
    this.retryCount = 0,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type.name,
        'notes': notes,
        'mediaIds': mediaIds,
        'latitude': latitude,
        'longitude': longitude,
        'urgency': urgency.name,
        'createdAt': createdAt.toIso8601String(),
        'syncStatus': syncStatus.name,
        'retryCount': retryCount,
      };

  factory FieldReport.fromJson(Map<String, dynamic> j) => FieldReport(
        id: j['id'] as String,
        type: ReportType.values.byName(j['type'] as String),
        notes: (j['notes'] as String?) ?? '',
        mediaIds: (j['mediaIds'] as List?)?.map((e) => e.toString()).toList() ?? const [],
        latitude: (j['latitude'] as num).toDouble(),
        longitude: (j['longitude'] as num).toDouble(),
        urgency: Urgency.values.byName(j['urgency'] as String),
        createdAt: DateTime.parse(j['createdAt'] as String),
        syncStatus: SyncStatus.values.byName((j['syncStatus'] as String?) ?? 'pending'),
        retryCount: (j['retryCount'] as int?) ?? 0,
      );

  FieldReport copyWith({
    SyncStatus? syncStatus,
    int? retryCount,
    List<String>? mediaIds,
  }) {
    return FieldReport(
      id: id,
      type: type,
      notes: notes,
      mediaIds: mediaIds ?? this.mediaIds,
      latitude: latitude,
      longitude: longitude,
      urgency: urgency,
      createdAt: createdAt,
      syncStatus: syncStatus ?? this.syncStatus,
      retryCount: retryCount ?? this.retryCount,
    );
  }
}

class SyncJob {
  final String id;
  final String entityType; // 'report' | 'sos'
  final String entityId;
  final String operation; // 'upload'
  final SyncStatus status;
  final int retryCount;
  final DateTime? lastAttemptAt;
  final String? errorMessage;

  const SyncJob({
    required this.id,
    required this.entityType,
    required this.entityId,
    required this.operation,
    this.status = SyncStatus.pending,
    this.retryCount = 0,
    this.lastAttemptAt,
    this.errorMessage,
  });

  SyncJob copyWith({
    SyncStatus? status,
    int? retryCount,
    DateTime? lastAttemptAt,
    String? errorMessage,
  }) {
    return SyncJob(
      id: id,
      entityType: entityType,
      entityId: entityId,
      operation: operation,
      status: status ?? this.status,
      retryCount: retryCount ?? this.retryCount,
      lastAttemptAt: lastAttemptAt ?? this.lastAttemptAt,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}

class Geofence {
  final String id;
  final String name;
  final List<MapPoint> polygon;
  final String ruleType; // 'hazard' | 'restricted'
  final AlertSeverity severity;
  final bool active;

  const Geofence({
    required this.id,
    required this.name,
    required this.polygon,
    required this.ruleType,
    required this.severity,
    this.active = true,
  });
}

enum VerificationStatus { verified, pending, tamperFlag }

class VerificationReceipt {
  final String id;
  final String reportId;
  final String transactionHash;
  final DateTime timestamp;
  final VerificationStatus status;
  final String verificationUrl;

  const VerificationReceipt({
    required this.id,
    required this.reportId,
    required this.transactionHash,
    required this.timestamp,
    required this.status,
    required this.verificationUrl,
  });
}

enum SosState { idle, confirming, sending, sent, failed }

// ---------- Fleet tracking ----------

class FleetVehicle {
  final String id;
  final String name;
  final String type; // truck, ambulance, supply
  final String status; // moving, idle, offline
  final double latitude;
  final double longitude;
  final double speed; // km/h
  final String? currentRoute;
  final DateTime lastSeen;

  const FleetVehicle({
    required this.id,
    required this.name,
    required this.type,
    required this.status,
    required this.latitude,
    required this.longitude,
    this.speed = 0,
    this.currentRoute,
    required this.lastSeen,
  });

  factory FleetVehicle.fromJson(Map<String, dynamic> j) => FleetVehicle(
        id: j['id']?.toString() ?? '',
        name: (j['name'] ?? j['registration'] ?? 'Vehicle').toString(),
        type: (j['type'] ?? 'truck').toString(),
        status: (j['status'] ?? 'idle').toString(),
        latitude: (j['latitude'] as num?)?.toDouble() ?? 0,
        longitude: (j['longitude'] as num?)?.toDouble() ?? 0,
        speed: (j['speed'] as num?)?.toDouble() ?? 0,
        currentRoute: j['current_route']?.toString(),
        lastSeen: DateTime.tryParse(j['last_seen']?.toString() ?? '') ?? DateTime.now(),
      );
}

// ---------- District connectivity ----------

enum ConnStatus { good, degraded, down, unknown }

class DistrictStatus {
  final String name;
  final String state;
  final ConnStatus road;
  final ConnStatus network;
  final int openRoutes;
  final int totalRoutes;
  final String? note;

  const DistrictStatus({
    required this.name,
    required this.state,
    this.road = ConnStatus.unknown,
    this.network = ConnStatus.unknown,
    this.openRoutes = 0,
    this.totalRoutes = 0,
    this.note,
  });
}

// ---------- Delivery tracking ----------

enum DeliveryStage { scheduled, inTransit, delayed, delivered, cancelled }

class DeliveryInfo {
  final String id;
  final String description;
  final String origin;
  final String destination;
  final DeliveryStage stage;
  final String? vehicleId;
  final DateTime eta;
  final DateTime? actualArrival;
  final String? delayReason;

  const DeliveryInfo({
    required this.id,
    required this.description,
    required this.origin,
    required this.destination,
    required this.stage,
    this.vehicleId,
    required this.eta,
    this.actualArrival,
    this.delayReason,
  });
}
