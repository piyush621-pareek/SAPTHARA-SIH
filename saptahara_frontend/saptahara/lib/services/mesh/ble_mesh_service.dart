import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:nearby_connections/nearby_connections.dart';

/// BLE/WiFi Mesh alert relay for no-network scenarios.
/// Uses Google Nearby Connections API for phone-to-phone communication.
/// Each device advertises + discovers simultaneously, creating a mesh.
class BleMeshService {
  BleMeshService._();
  static final BleMeshService instance = BleMeshService._();

  final _alerts = StreamController<MeshAlert>.broadcast();
  Stream<MeshAlert> get onAlert => _alerts.stream;

  final _peers = StreamController<int>.broadcast();
  Stream<int> get onPeerCount => _peers.stream;

  final Set<String> _seenIds = {};
  final Set<String> _connectedEndpoints = {};
  final List<MeshAlert> _outbox = [];
  bool _active = false;
  int _peerCount = 0;
  String _deviceName = 'SAPTHARA-${Random().nextInt(9999).toString().padLeft(4, '0')}';

  static const Strategy _strategy = Strategy.P2P_CLUSTER;
  static const String _serviceId = 'com.ner.saptahara.mesh';

  int get peerCount => _peerCount;
  bool get isActive => _active;
  String get deviceName => _deviceName;

  /// Start both advertising and discovering nearby devices.
  Future<bool> start() async {
    if (_active) return true;

    try {
      // Start advertising (so others can find us)
      await Nearby().startAdvertising(
        _deviceName,
        _strategy,
        onConnectionInitiated: _onConnectionInitiated,
        onConnectionResult: _onConnectionResult,
        onDisconnected: _onDisconnected,
        serviceId: _serviceId,
      );

      // Start discovering (so we can find others)
      await Nearby().startDiscovery(
        _deviceName,
        _strategy,
        onEndpointFound: _onEndpointFound,
        onEndpointLost: _onEndpointLost,
        serviceId: _serviceId,
      );

      _active = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  void _onEndpointFound(String id, String userName, String serviceId) {
    _peerCount++;
    _peers.add(_peerCount);
    // Auto-connect to nearby SAPTHARA devices
    Nearby().requestConnection(
      _deviceName,
      id,
      onConnectionInitiated: _onConnectionInitiated,
      onConnectionResult: _onConnectionResult,
      onDisconnected: _onDisconnected,
    );
  }

  void _onEndpointLost(String? id) {
    _peerCount = (_peerCount - 1).clamp(0, 999);
    _peers.add(_peerCount);
  }

  void _onConnectionInitiated(String id, ConnectionInfo info) {
    // Auto-accept all SAPTHARA connections
    Nearby().acceptConnection(
      id,
      onPayLoadRecieved: (endpointId, payload) {
        _handlePayload(endpointId, payload);
      },
    );
  }

  void _onConnectionResult(String id, Status status) {
    if (status == Status.CONNECTED) {
      _connectedEndpoints.add(id);
      // Send any queued outbox alerts to the new peer
      for (final alert in _outbox) {
        _sendToEndpoint(id, alert);
      }
    }
  }

  void _onDisconnected(String id) {
    _connectedEndpoints.remove(id);
  }

  void _handlePayload(String endpointId, Payload payload) {
    if (payload.type != PayloadType.BYTES || payload.bytes == null) return;

    try {
      final json = jsonDecode(utf8.decode(payload.bytes!));
      final id = json['id'] as String? ?? '';
      if (id.isEmpty || _seenIds.contains(id)) return;
      _seenIds.add(id);

      final alert = MeshAlert(
        id: id,
        type: json['type'] as String? ?? 'SOS',
        message: json['message'] as String? ?? '',
        senderName: json['sender'] as String? ?? 'Unknown',
        hops: (json['hops'] as num?)?.toInt() ?? 1,
        receivedAt: DateTime.now(),
        fromEndpoint: endpointId,
      );

      _alerts.add(alert);

      // Re-broadcast to all other connected endpoints (mesh relay)
      final relayAlert = MeshAlert(
        id: alert.id,
        type: alert.type,
        message: alert.message,
        senderName: alert.senderName,
        hops: alert.hops + 1,
        receivedAt: alert.receivedAt,
        fromEndpoint: endpointId,
      );
      for (final ep in _connectedEndpoints) {
        if (ep != endpointId) {
          _sendToEndpoint(ep, relayAlert);
        }
      }
    } catch (_) {}
  }

  void _sendToEndpoint(String endpointId, MeshAlert alert) {
    final data = jsonEncode({
      'id': alert.id,
      'type': alert.type,
      'message': alert.message,
      'sender': alert.senderName,
      'hops': alert.hops,
    });
    Nearby().sendBytesPayload(endpointId, utf8.encode(data));
  }

  /// Broadcast an alert to all connected peers.
  Future<bool> broadcastAlert({
    required String id,
    required String type,
    required String message,
    required String senderName,
  }) async {
    if (!_active) return false;

    _seenIds.add(id);
    final alert = MeshAlert(
      id: id,
      type: type,
      message: message,
      senderName: senderName,
      hops: 0,
      receivedAt: DateTime.now(),
      fromEndpoint: 'self',
    );

    _outbox.add(alert);

    if (_connectedEndpoints.isEmpty) {
      // No peers yet — alert is queued in outbox, will send when someone connects
      return true;
    }

    for (final ep in _connectedEndpoints) {
      _sendToEndpoint(ep, alert);
    }
    return true;
  }

  /// Stop advertising and discovering.
  Future<void> stop() async {
    _active = false;
    _peerCount = 0;
    _connectedEndpoints.clear();
    try {
      await Nearby().stopAdvertising();
      await Nearby().stopDiscovery();
      await Nearby().stopAllEndpoints();
    } catch (_) {}
    _peers.add(0);
  }

  void dispose() {
    stop();
    _alerts.close();
    _peers.close();
  }
}

class MeshAlert {
  final String id;
  final String type;
  final String message;
  final String senderName;
  final int hops;
  final DateTime receivedAt;
  final String fromEndpoint;

  const MeshAlert({
    required this.id,
    required this.type,
    required this.message,
    required this.senderName,
    required this.hops,
    required this.receivedAt,
    required this.fromEndpoint,
  });
}
