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
  final _connected = StreamController<bool>.broadcast();

  Stream<Map<String, dynamic>> get onEmergency => _emergency.stream;
  Stream<Map<String, dynamic>> get onBreach => _breach.stream;
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

    _socket = socket;
  }

  void dispose() {
    _socket?.dispose();
    _socket = null;
    _emergency.close();
    _breach.close();
    _connected.close();
  }
}
