import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:saptahara/app/providers.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/domain/entities/entities.dart';
import 'package:saptahara/presentation/widgets/live_map.dart';

/// Full-screen, Google-Maps-style view of the planned route: the map fills the
/// screen with the safe (green) + direct (red) routes, and a floating card
/// shows the recommended distance / ETA / safety.
class FullscreenMapScreen extends ConsumerWidget {
  const FullscreenMapScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final routesAsync = ref.watch(routesControllerProvider);
    final mapStyle = ref.watch(mapStyleProvider);

    return Scaffold(
      body: routesAsync.when(
        data: (routes) {
          final recommended = routes.isEmpty
              ? null
              : ([...routes]..sort((a, b) => b.safetyScore.compareTo(a.safetyScore))).first;
          return Stack(
            children: [
              Positioned.fill(
                child: LiveMap(
                  routes: routes,
                  highlightedRouteId: recommended?.id,
                  hazards: const [],
                  style: mapStyle,
                ),
              ),
              // Back button
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Align(
                    alignment: Alignment.topLeft,
                    child: Material(
                      color: AppColors.white,
                      shape: const CircleBorder(side: BorderSide(color: AppColors.black, width: 2)),
                      child: IconButton(
                        icon: const Icon(Icons.arrow_back, color: AppColors.black),
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                    ),
                  ),
                ),
              ),
              // Floating route summary (like a navigation card)
              if (recommended != null)
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 16,
                  child: SafeArea(
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.safeGreen,
                        borderRadius: BorderRadius.circular(AppRadii.cardLg),
                        border: Border.all(color: AppColors.black, width: 2),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.navigation_rounded, color: AppColors.white, size: 30),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(recommended.name,
                                    style: const TextStyle(color: AppColors.white, fontWeight: FontWeight.w900, fontSize: 16)),
                                const SizedBox(height: 3),
                                Text(
                                  '${recommended.distanceKm.toStringAsFixed(0)} km · ETA ${recommended.etaLabel} · Safety ${recommended.safetyScore}/100',
                                  style: const TextStyle(color: AppColors.white, fontWeight: FontWeight.w600, fontSize: 13),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, st) => const Center(child: Text('Failed to load route')),
      ),
    );
  }
}
