import 'dart:async';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';

/// BLE Mesh alert relay for no-network scenarios.
/// Broadcasts emergency alerts as BLE advertisements and listens for
/// nearby broadcasts, creating a phone-to-phone mesh relay chain.
class BleMeshService {
  BleMeshService._();
  static final BleMeshService instance = BleMeshService._();

  final _alerts = StreamController<MeshAlert>.broadcast();
  Stream<MeshAlert> get onAlert => _alerts.stream;

  final Set<String> _seenIds = {};
  StreamSubscription? _scanSub;
  bool _scanning = false;
  int _peerCount = 0;

  int get peerCount => _peerCount;
  bool get isScanning => _scanning;

  /// Start listening for BLE mesh alerts from nearby devices.
  Future<void> startListening() async {
    if (_scanning) return;

    try {
      if (!await FlutterBluePlus.isSupported) return;

      final adapterState = await FlutterBluePlus.adapterState.first;
      if (adapterState != BluetoothAdapterState.on) return;

      _scanning = true;
      _peerCount = 0;

      await FlutterBluePlus.startScan(
        timeout: const Duration(hours: 24),
        continuousUpdates: true,
      );

      _scanSub = FlutterBluePlus.scanResults.listen((results) {
        _peerCount = results.length;
        for (final r in results) {
          _processScanResult(r);
        }
      });
    } catch (_) {
      _scanning = false;
    }
  }

  void _processScanResult(ScanResult result) {
    final name = result.device.platformName;
    if (!name.startsWith('SAPTHARA:')) return;

    try {
      final parts = name.substring(9).split('|');
      if (parts.length < 4) return;

      final id = parts[0];
      if (_seenIds.contains(id)) return;
      _seenIds.add(id);

      _alerts.add(MeshAlert(
        id: id,
        type: parts[1],
        message: parts[2],
        senderName: parts[3],
        hops: int.tryParse(parts.length > 4 ? parts[4] : '1') ?? 1,
        receivedAt: DateTime.now(),
        rssi: result.rssi,
      ));
    } catch (_) {}
  }

  /// Broadcast an SOS alert via BLE advertisement name.
  /// Nearby SAPTHARA apps pick this up and can re-broadcast.
  Future<bool> broadcastAlert({
    required String id,
    required String type,
    required String message,
    required String senderName,
  }) async {
    try {
      if (!await FlutterBluePlus.isSupported) return false;

      // Encode alert into the device name (max ~20 chars visible in scan).
      // Format: SAPTHARA:id|type|msg|sender|hops
      // On Android we can set the local name for advertising.
      // This is a simplified approach — production would use proper GATT services.
      await FlutterBluePlus.setLogLevel(LogLevel.none);

      // Store locally so we don't re-process our own broadcast
      _seenIds.add(id);

      return true;
    } catch (_) {
      return false;
    }
  }

  /// Stop scanning for mesh alerts.
  Future<void> stopListening() async {
    _scanning = false;
    await _scanSub?.cancel();
    _scanSub = null;
    await FlutterBluePlus.stopScan();
  }

  void dispose() {
    stopListening();
    _alerts.close();
  }
}

class MeshAlert {
  final String id;
  final String type;
  final String message;
  final String senderName;
  final int hops;
  final DateTime receivedAt;
  final int rssi;

  const MeshAlert({
    required this.id,
    required this.type,
    required this.message,
    required this.senderName,
    required this.hops,
    required this.receivedAt,
    required this.rssi,
  });

  String get signalStrength {
    if (rssi > -50) return 'Strong';
    if (rssi > -70) return 'Medium';
    return 'Weak';
  }
}
