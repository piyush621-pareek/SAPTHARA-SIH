import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:saptahara/core/network/api_config.dart';

/// Socket.IO client bridging the backend's real-time events into Dart streams.
/// Mirrors the backend emitters: `emergency:alert`, `hazard:breach`,
/// `fleet:update`.
class SocketService {
  SocketService._();
  static final SocketService instance = SocketService._();

  io.Socket? _socket;

  final _emergency = StreamController<Map<String, dynamic>>.broadcast();
  final _breach = StreamController<Map<String, dynamic>>.broadcast();
  final _fleet = StreamController<Map<String, dynamic>>.broadcast();
  final _delivery = StreamController<Map<String, dynamic>>.broadcast();
  final _connectivity = StreamController<Map<String, dynamic>>.broadcast();
  final _connected = StreamController<bool>.broadcast();

  Stream<Map<String, dynamic>> get onEmergency => _emergency.stream;
  Stream<Map<String, dynamic>> get onBreach => _breach.stream;
  Stream<Map<String, dynamic>> get onFleet => _fleet.stream;
  Stream<Map<String, dynamic>> get onDelivery => _delivery.stream;
  Stream<Map<String, dynamic>> get onConnectivity => _connectivity.stream;
  Stream<bool> get onConnected => _connected.stream;

  bool get isConnected => _socket?.connected ?? false;

  void connect() {
    if (_socket != null) return;
    final socket = io.io(
      ApiConfig.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .enableReconnection()
          .setReconnectionDelay(1000)
          .build(),
    );

    socket.onConnect((_) => _connected.add(true));
    socket.onDisconnect((_) => _connected.add(false));
    socket.on('emergency:alert', (data) {
      if (data is Map) _emergency.add(Map<String, dynamic>.from(data));
    });
    socket.on('hazard:breach', (data) {
      if (data is Map) _breach.add(Map<String, dynamic>.from(data));
    });
    socket.on('fleet:update', (data) {
      if (data is Map) _fleet.add(Map<String, dynamic>.from(data));
    });
    socket.on('delivery:update', (data) {
      if (data is Map) _delivery.add(Map<String, dynamic>.from(data));
    });
    socket.on('connectivity:update', (data) {
      if (data is Map) _connectivity.add(Map<String, dynamic>.from(data));
    });

    _socket = socket;
  }

  void dispose() {
    _socket?.dispose();
    _socket = null;
    _emergency.close();
    _breach.close();
    _fleet.close();
    _delivery.close();
    _connectivity.close();
    _connected.close();
  }
}
