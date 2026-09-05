import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:saptahara/app/auth.dart';
import 'package:saptahara/core/notifications/notification_service.dart';
import 'package:saptahara/core/storage/local_store.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/services/push/push_notification_service.dart';
import 'package:saptahara/presentation/auth/login_screen.dart';
import 'package:saptahara/presentation/navigation/app_shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await LocalStore.init();
  await NotificationService.init();

  // Firebase + FCM push notifications
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    await PushNotificationService.instance.initialize();
  } catch (_) {
    // Firebase not configured yet — runs fine without it
  }

  runApp(const ProviderScope(child: SaptaharaApp()));
}

class SaptaharaApp extends StatelessWidget {
  const SaptaharaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SAPTHARA',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      // Localization foundation for the North Eastern Region.
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('en'), // English
        Locale('hi'), // Hindi
        Locale('as'), // Assamese
        Locale('bn'), // Bengali
      ],
      home: const _Root(),
    );
  }
}

/// Shows the login screen until the user signs in or continues as guest.
class _Root extends ConsumerWidget {
  const _Root();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    return auth.isAuthenticated ? const AppShell() : const LoginScreen();
  }
}
