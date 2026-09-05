import 'dart:async';
import 'dart:ui' show Color;
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Handles FCM push notifications + local notification display.
/// Registers the device token with the backend for targeted alerts.
class PushNotificationService {
  PushNotificationService._();
  static final PushNotificationService instance = PushNotificationService._();

  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _local = FlutterLocalNotificationsPlugin();
  final _messages = StreamController<RemoteMessage>.broadcast();

  Stream<RemoteMessage> get onMessage => _messages.stream;
  String? _token;
  String? get fcmToken => _token;

  Future<void> initialize() async {
    // Request permissions
    await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      criticalAlert: true,
    );

    // Initialize local notifications for foreground display
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    await _local.initialize(
      const InitializationSettings(android: androidSettings),
    );

    // Create high-priority channel for disaster alerts
    const alertChannel = AndroidNotificationChannel(
      'disaster_alerts',
      'Disaster Alerts',
      description: 'Critical disaster and emergency notifications',
      importance: Importance.max,
      playSound: true,
      enableVibration: true,
    );

    const deliveryChannel = AndroidNotificationChannel(
      'delivery_updates',
      'Delivery Updates',
      description: 'Supply chain delivery status updates',
      importance: Importance.high,
    );

    final androidPlugin = _local.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.createNotificationChannel(alertChannel);
    await androidPlugin?.createNotificationChannel(deliveryChannel);

    // Get FCM token
    _token = await _fcm.getToken();

    // Listen for token refresh
    _fcm.onTokenRefresh.listen((token) {
      _token = token;
      // TODO: re-register with backend
    });

    // Foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Background/terminated tap
    FirebaseMessaging.onMessageOpenedApp.listen((msg) {
      _messages.add(msg);
    });

    // Check if app was opened from a notification
    final initial = await _fcm.getInitialMessage();
    if (initial != null) _messages.add(initial);
  }

  void _handleForegroundMessage(RemoteMessage message) {
    _messages.add(message);

    final notification = message.notification;
    if (notification == null) return;

    final type = message.data['type'] ?? 'alert';
    final channelId = type == 'delivery' ? 'delivery_updates' : 'disaster_alerts';
    final priority = type == 'delivery' ? Priority.high : Priority.max;

    _local.show(
      message.hashCode,
      notification.title ?? 'SAPTHARA Alert',
      notification.body ?? '',
      NotificationDetails(
        android: AndroidNotificationDetails(
          channelId,
          channelId == 'disaster_alerts' ? 'Disaster Alerts' : 'Delivery Updates',
          importance: Importance.max,
          priority: priority,
          icon: '@mipmap/ic_launcher',
          color: const Color(0xFFD32F2F),
        ),
      ),
    );
  }

  /// Subscribe to topic-based notifications (e.g. district, region).
  Future<void> subscribeTopic(String topic) async {
    await _fcm.subscribeToTopic(topic);
  }

  Future<void> unsubscribeTopic(String topic) async {
    await _fcm.unsubscribeFromTopic(topic);
  }

  void dispose() {
    _messages.close();
  }
}

// Top-level handler for background messages (required by Firebase)
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Background messages are handled automatically by the system tray
}

