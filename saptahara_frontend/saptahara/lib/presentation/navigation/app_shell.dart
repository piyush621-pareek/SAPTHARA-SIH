import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:saptahara/app/providers.dart';
import 'package:saptahara/core/notifications/notification_service.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/core/i18n/i18n.dart';
import 'package:saptahara/domain/entities/entities.dart';
import 'package:saptahara/presentation/home/home_screen.dart';
import 'package:saptahara/presentation/route/route_screen.dart';
import 'package:saptahara/presentation/report/report_screen.dart';
import 'package:saptahara/presentation/more/more_screen.dart';
import 'package:saptahara/presentation/widgets/alert_toast.dart';
import 'package:saptahara/presentation/widgets/update_banner.dart';

/// Persistent tab index — shared so screens (e.g. Home's recommendation
/// card) can programmatically jump to another tab.
final appShellTabIndexProvider = StateProvider<int>((ref) => 0);

class AppShell extends ConsumerWidget {
  const AppShell({super.key});

  static const _screens = [
    HomeScreen(),
    RouteScreen(),
    ReportScreen(),
    MoreScreen(),
  ];

  static const _items = [
    _NavItem(icon: Icons.home_rounded, trKey: 'navHome'),
    _NavItem(icon: Icons.alt_route_rounded, trKey: 'navRoute'),
    _NavItem(icon: Icons.report_rounded, trKey: 'navReport'),
    _NavItem(icon: Icons.menu_rounded, trKey: 'more'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final index = ref.watch(appShellTabIndexProvider);

    // Surface a toast whenever a live socket alert (SOS / geofence breach)
    // arrives, from anywhere in the app.
    ref.listen<AsyncValue<HazardAlert>>(liveAlertStreamProvider, (prev, next) {
      next.whenData((alert) {
        // OS-level notification (fires even if the app is backgrounded).
        NotificationService.show(
          alert.title,
          alert.detail,
          critical: alert.severity == AlertSeverity.critical,
        );
        showAlertToast(
          context,
          alert,
          // Deep-link: jump to Home's map and centre/highlight the alert.
          onTap: (alert.latitude == 0 && alert.longitude == 0)
              ? null
              : () {
                  ref.read(appShellTabIndexProvider.notifier).state = 0;
                  ref.read(focusedAlertProvider.notifier).state = (
                    lat: alert.latitude,
                    lng: alert.longitude,
                    nonce: DateTime.now().millisecondsSinceEpoch,
                  );
                },
        );
      });
    });

    return Scaffold(
      body: Column(
        children: [
          const UpdateBanner(),
          Expanded(child: IndexedStack(index: index, children: _screens)),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AppColors.limeNav,
          border: Border(top: BorderSide(color: AppColors.black, width: 2.5)),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 64,
            child: Row(
              children: List.generate(_items.length, (i) {
                final selected = i == index;
                final item = _items[i];
                return Expanded(
                  child: InkWell(
                    onTap: () => ref.read(appShellTabIndexProvider.notifier).state = i,
                    child: Container(
                      constraints: const BoxConstraints(minHeight: 44, minWidth: 44),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            item.icon,
                            color: AppColors.black,
                            size: selected ? 26 : 22,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            AppStrings.t(item.trKey, ref.watch(languageProvider))
                                .toUpperCase(),
                            style: TextStyle(
                              color: AppColors.black,
                              fontWeight: selected ? FontWeight.w900 : FontWeight.w600,
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem {
  final IconData icon;
  final String trKey;
  const _NavItem({required this.icon, required this.trKey});
}
