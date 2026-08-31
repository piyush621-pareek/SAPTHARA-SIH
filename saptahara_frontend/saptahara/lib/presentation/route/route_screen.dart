import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:saptahara/app/providers.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/domain/entities/entities.dart';
import 'package:saptahara/presentation/widgets/app_card.dart';
import 'package:saptahara/presentation/widgets/live_map.dart';
import 'package:saptahara/presentation/widgets/offline_banner.dart';

class RouteScreen extends ConsumerWidget {
  const RouteScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final routesAsync = ref.watch(routesControllerProvider);
    final selectedId = ref.watch(selectedRouteIdProvider);
    final mapStyle = ref.watch(mapStyleProvider);
    final geofenceRepo = ref.watch(geofenceRepositoryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Route')),
      body: SafeArea(
        child: Column(
          children: [
            const OfflineBanner(),
            Expanded(
              child: routesAsync.when(
                data: (routes) {
                  final selected = routes.firstWhere(
                    (r) => r.id == (selectedId ?? routes.first.id),
                    orElse: () => routes.first,
                  );
                  final fence = geofenceRepo.intersecting(selected);

                  return ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                    children: [
                      AppCard(
                        padding: const EdgeInsets.all(10),
                        child: LiveMap(
                          routes: routes,
                          highlightedRouteId: selected.id,
                          geofence: fence,
                          style: mapStyle,
                        ),
                      ),
                      const SizedBox(height: 14),
                      if (fence != null)
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          margin: const EdgeInsets.only(bottom: 14),
                          decoration: BoxDecoration(
                            color: AppColors.riskyRed,
                            borderRadius: BorderRadius.circular(AppRadii.cardSm),
                            border: Border.all(color: AppColors.black, width: 2),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.warning_amber_rounded, color: AppColors.white),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  '${selected.name} intersects "${fence.name}" — proceed with caution.',
                                  style: const TextStyle(color: AppColors.white, fontWeight: FontWeight.w800, fontSize: 12.5),
                                ),
                              ),
                            ],
                          ),
                        ),
                      _SummaryCard(route: selected),
                      const SizedBox(height: 16),
                      const _Legend(),
                      const SizedBox(height: 12),
                      Text('Available Routes', style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 10),
                      ...routes.map((r) => _RouteRow(
                            route: r,
                            selected: r.id == selected.id,
                            onTap: () => ref.read(selectedRouteIdProvider.notifier).state = r.id,
                          )),
                    ],
                  );
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, st) => const Center(child: Text('Failed to load routes')),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final RouteOption route;
  const _SummaryCard({required this.route});

  @override
  Widget build(BuildContext context) {
    return PanelBlueCard(
      child: Row(
        children: [
          Container(
            width: 14,
            height: 14,
            decoration: BoxDecoration(
              color: route.riskLevel.color,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.black, width: 1.5),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${route.name} — ${route.riskLevel.label}',
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
                const SizedBox(height: 3),
                Text(
                  'ETA ${route.etaLabel} · ${route.distanceKm.toStringAsFixed(0)} km · Safety ${route.safetyScore}/100',
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend();
  @override
  Widget build(BuildContext context) {
    Widget dot(Color c, String label) => Row(
          children: [
            Container(width: 12, height: 12, decoration: BoxDecoration(color: c, shape: BoxShape.circle, border: Border.all(color: AppColors.black, width: 1.4))),
            const SizedBox(width: 6),
            Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
          ],
        );
    return Wrap(
      spacing: 18,
      children: [
        dot(AppColors.safeGreen, 'Safe'),
        dot(AppColors.moderateOrange, 'Moderate'),
        dot(AppColors.riskyRed, 'Risky'),
      ],
    );
  }
}

class _RouteRow extends StatelessWidget {
  final RouteOption route;
  final bool selected;
  final VoidCallback onTap;
  const _RouteRow({required this.route, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: AppCard(
        onTap: onTap,
        borderWidth: selected ? 3 : 2,
        color: selected ? AppColors.panelBlue : AppColors.white,
        child: Row(
          children: [
            Container(
              width: 16,
              height: 16,
              decoration: BoxDecoration(
                color: route.riskLevel.color,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.black, width: 1.6),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(route.name, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
                  Text('${route.distanceKm.toStringAsFixed(0)} km · ETA ${route.etaLabel} · Score ${route.safetyScore}',
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
                ],
              ),
            ),
            if (selected) const Icon(Icons.check_circle, color: AppColors.safeGreen),
          ],
        ),
      ),
    );
  }
}
