import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// OS-level notifications for live socket alerts (works when the app is
/// backgrounded). A local-notification substitute for FCM push — swap the
/// trigger for an FCM handler when a Firebase project is available.
class NotificationService {
  NotificationService._();
  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  static bool _ready = false;

  static Future<void> init() async {
    const android = AndroidInitializationSettings("@mipmap/ic_launcher");
    const settings = InitializationSettings(android: android);
    try {
      await _plugin.initialize(settings);
      await _plugin
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.requestNotificationsPermission();
      _ready = true;
    } catch (_) {
      _ready = false;
    }
  }

  static Future<void> show(String title, String body, {bool critical = false}) async {
    if (!_ready) return;
    final details = NotificationDetails(
      android: AndroidNotificationDetails(
        "ner_alerts",
        "Emergency & Hazard Alerts",
        channelDescription: "Live SOS and geofence-breach alerts",
        importance: critical ? Importance.max : Importance.high,
        priority: critical ? Priority.max : Priority.high,
        color: const Color.fromARGB(255, 255, 52, 46),
      ),
    );
    try {
      await _plugin.show(
        DateTime.now().millisecondsSinceEpoch.remainder(100000),
        title,
        body,
        details,
      );
    } catch (_) {/* non-fatal */}
  }
}
