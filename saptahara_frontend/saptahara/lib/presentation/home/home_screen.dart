import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:saptahara/app/providers.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/core/i18n/i18n.dart';
import 'package:saptahara/domain/entities/entities.dart';
import 'package:saptahara/presentation/widgets/app_card.dart';
import 'package:saptahara/presentation/widgets/alert_row.dart';
import 'package:saptahara/presentation/widgets/sos_button.dart';
import 'package:saptahara/presentation/widgets/sos_flow.dart';
import 'package:saptahara/presentation/widgets/status_badge.dart';
import 'package:saptahara/presentation/widgets/live_map.dart';
import 'package:saptahara/presentation/widgets/live_tracking_card.dart';
import 'package:saptahara/presentation/widgets/satellite_risk_card.dart';
import 'package:saptahara/presentation/widgets/offline_banner.dart';
import 'package:saptahara/presentation/widgets/critical_alert_overlay.dart';
import 'package:saptahara/presentation/navigation/app_shell.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final routesAsync = ref.watch(routesControllerProvider);
    final alertsAsync = ref.watch(alertsControllerProvider);
    final recommended = ref.watch(recommendedRouteProvider);
    final liveStatus = ref.watch(liveStatusProvider);
    final mapStyle = ref.watch(mapStyleProvider);
    final showRainfall = ref.watch(rainfallOverlayProvider);
    final focus = ref.watch(focusedAlertProvider);
    final lang = ref.watch(languageProvider);

    return Scaffold(
      appBar: AppBar(
        title: Image.asset('assets/images/logo.png',
            height: 34, fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => const Text('SAPTHARA')),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(child: LiveStatusPill(status: liveStatus)),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            const OfflineBanner(),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async {
                  await ref.read(routesControllerProvider.notifier).refresh();
                  await ref.read(alertsControllerProvider.notifier).refresh();
                },
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                  children: [
                    const LiveTrackingCard(),
                    const SizedBox(height: 16),
                    routesAsync.when(
                      data: (routes) => Column(
                        children: [
                          AppCard(
                            padding: const EdgeInsets.all(10),
                            child: LiveMap(
                              routes: routes,
                              highlightedRouteId: recommended?.id,
                              hazards: alertsAsync.maybeWhen(data: (a) => a, orElse: () => []),
                              style: mapStyle,
                              showRainfall: showRainfall,
                              focusLat: focus?.lat,
                              focusLng: focus?.lng,
                              focusNonce: focus?.nonce ?? 0,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(
                                child: InkWell(
                                  onTap: () => ref.read(rainfallOverlayProvider.notifier).state = !showRainfall,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                    decoration: BoxDecoration(
                                      color: showRainfall ? AppColors.panelBlue : AppColors.white,
                                      borderRadius: BorderRadius.circular(AppRadii.cardSm),
                                      border: Border.all(color: AppColors.black, width: 1.6),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.water_drop,
                                            size: 16,
                                            color: showRainfall ? AppColors.purpleTrust : AppColors.black),
                                        const SizedBox(width: 6),
                                        Text(AppStrings.t('rainfallOverlay', lang),
                                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      loading: () => const AppCard(
                        child: SizedBox(height: 220, child: Center(child: CircularProgressIndicator())),
                      ),
                      error: (e, st) => AppCard(
                        color: AppColors.riskyRed.withOpacity(0.1),
                        child: SizedBox(
                          height: 120,
                          child: Center(child: Text(AppStrings.t('failedRoutes', lang))),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const SatelliteRiskCard(),
                    const SizedBox(height: 16),
                    if (recommended != null)
                      AppCard(
                        color: AppColors.safeGreen,
                        onTap: () {
                          ref.read(selectedRouteIdProvider.notifier).state = recommended.id;
                          ref.read(appShellTabIndexProvider.notifier).state = 1;
                        },
                        child: Row(
                          children: [
                            const Icon(Icons.verified, color: AppColors.white, size: 28),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${AppStrings.t('takeRecommended', lang)} · ${recommended.name}',
                                    style: const TextStyle(
                                      color: AppColors.white,
                                      fontWeight: FontWeight.w900,
                                      fontSize: 16,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'ETA: ${recommended.etaLabel}  |  Distance: ${recommended.distanceKm.toStringAsFixed(0)} km',
                                    style: const TextStyle(color: AppColors.white, fontWeight: FontWeight.w600, fontSize: 13),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right, color: AppColors.white),
                          ],
                        ),
                      ),
                    const SizedBox(height: 20),
                    Text(AppStrings.t('currentAlerts', ref.watch(languageProvider)),
                        style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 10),
                    alertsAsync.when(
                      data: (alerts) {
                        if (alerts.isEmpty) {
                          return AppCard(
                              child: Text(AppStrings.t(
                                  'noAlerts', ref.watch(languageProvider))));
                        }
                        return Column(
                          children: alerts
                              .map((a) => AlertRow(
                                    alert: a,
                                    onTap: () {
                                      if (a.severity == AlertSeverity.critical) {
                                        showCriticalAlertOverlay(context, a);
                                      } else {
                                        _showAlertDetail(context, a);
                                      }
                                    },
                                  ))
                              .toList(),
                        );
                      },
                      loading: () => const Center(child: CircularProgressIndicator()),
                      error: (e, st) => Text(AppStrings.t('failedAlerts', lang)),
                    ),
                    const SizedBox(height: 8),
                    SosButton(onPressed: () => showSosFlow(context, ref)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showAlertDetail(BuildContext context, HazardAlert alert) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.cardLg)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(alert.title, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
            const SizedBox(height: 8),
            Text(alert.detail),
            const SizedBox(height: 12),
            Text('${alert.distanceAheadKm.toStringAsFixed(0)} km ahead',
                style: const TextStyle(fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}
