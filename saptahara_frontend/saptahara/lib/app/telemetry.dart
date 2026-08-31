import 'dart:async';
import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:saptahara/core/location/location_service.dart';
import 'package:saptahara/core/network/api_client.dart';
import 'package:saptahara/core/network/api_config.dart';
import 'package:saptahara/core/storage/local_store.dart';

class TelemetryState {
  final bool streaming;
  final int pending; // points cached offline awaiting sync
  final DateTime? lastSentAt;
  final bool lastOk;
  const TelemetryState({
    this.streaming = false,
    this.pending = 0,
    this.lastSentAt,
    this.lastOk = true,
  });

  TelemetryState copyWith({
    bool? streaming,
    int? pending,
    DateTime? lastSentAt,
    bool? lastOk,
  }) =>
      TelemetryState(
        streaming: streaming ?? this.streaming,
        pending: pending ?? this.pending,
        lastSentAt: lastSentAt ?? this.lastSentAt,
        lastOk: lastOk ?? this.lastOk,
      );
}

/// Driver-role capability inside Saptahara: periodically captures GPS and
/// pushes it to POST /telemetry/batch so this device shows up as a live,
/// moving vehicle on the command dashboard. Offline points are cached to disk
/// and flushed (with the backend's native dedup) on the next successful send —
/// the platform's "edge-first, resilient offline sync".
class TelemetryController extends StateNotifier<TelemetryState> {
  TelemetryController() : super(const TelemetryState()) {
    _restorePending();
  }

  Timer? _timer;
  static const _queueKey = "telemetry_queue";
  static const _interval = Duration(seconds: 5);
  static const _maxQueue = 500;

  void _restorePending() {
    state = state.copyWith(pending: _loadQueue().length);
  }

  void toggle() => state.streaming ? stop() : start();

  void start() {
    if (state.streaming) return;
    state = state.copyWith(streaming: true);
    _tick(); // immediate first point
    _timer = Timer.periodic(_interval, (_) => _tick());
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
    state = state.copyWith(streaming: false);
  }

  Future<void> _tick() async {
    final pos = await LocationService.instance.rawPosition();
    final lat = pos?.latitude ?? ApiConfig.demoLat;
    final lng = pos?.longitude ?? ApiConfig.demoLng;
    final speed = (pos != null && pos.speed >= 0) ? pos.speed * 3.6 : null;
    final heading = (pos != null && pos.heading >= 0) ? pos.heading : null;

    final point = <String, dynamic>{
      "vehicle_id": ApiConfig.deviceId,
      "timestamp": DateTime.now().toUtc().toIso8601String(),
      "latitude": lat,
      "longitude": lng,
      if (speed != null) "speed_kmph": speed,
      if (heading != null) "heading_deg": heading,
      "source": "internet",
    };

    // Batch = anything cached offline + this new point (dedup-safe on server).
    final batch = _loadQueue()..add(point);
    try {
      await ApiClient.instance.postJson("/telemetry/batch", {"points": batch});
      await LocalStore.remove(_queueKey);
      state = state.copyWith(pending: 0, lastSentAt: DateTime.now(), lastOk: true);
    } catch (_) {
      // Offline / send failed: cache (capped) for the next flush.
      final capped =
          batch.length > _maxQueue ? batch.sublist(batch.length - _maxQueue) : batch;
      await LocalStore.setString(_queueKey, jsonEncode(capped));
      state = state.copyWith(pending: capped.length, lastOk: false);
    }
  }

  List<Map<String, dynamic>> _loadQueue() {
    final raw = LocalStore.getString(_queueKey);
    if (raw == null) return [];
    try {
      return (jsonDecode(raw) as List)
          .whereType<Map>()
          .map((e) => e.cast<String, dynamic>())
          .toList();
    } catch (_) {
      return [];
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

final telemetryProvider =
    StateNotifierProvider<TelemetryController, TelemetryState>(
        (ref) => TelemetryController());
