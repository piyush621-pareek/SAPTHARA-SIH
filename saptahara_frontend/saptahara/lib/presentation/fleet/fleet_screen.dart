import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:saptahara/app/providers.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/core/i18n/i18n.dart';
import 'package:saptahara/domain/entities/entities.dart';

class FleetScreen extends ConsumerWidget {
  const FleetScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vehicles = ref.watch(fleetProvider);
    final lang = ref.watch(languageProvider);

    return Scaffold(
      appBar: AppBar(title: Text(AppStrings.t('fleet', lang))),
      body: vehicles.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.local_shipping_outlined, size: 64, color: AppColors.mapNeutral),
                  const SizedBox(height: 12),
                  Text(AppStrings.t('noFleetData', lang),
                      style: const TextStyle(color: AppColors.mapNeutral, fontSize: 16)),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: vehicles.length,
              itemBuilder: (context, i) => _VehicleCard(vehicle: vehicles[i]),
            ),
    );
  }
}

class _VehicleCard extends StatelessWidget {
  final FleetVehicle vehicle;
  const _VehicleCard({required this.vehicle});

  @override
  Widget build(BuildContext context) {
    final color = switch (vehicle.status) {
      'moving' => AppColors.safeGreen,
      'idle' => AppColors.moderateOrange,
      _ => AppColors.mapNeutral,
    };
    final icon = switch (vehicle.type) {
      'ambulance' => Icons.local_hospital,
      'supply' => Icons.inventory_2,
      _ => Icons.local_shipping,
    };

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.card),
        side: BorderSide(color: color, width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: color.withOpacity(0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 26),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(vehicle.name,
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  const SizedBox(height: 3),
                  Text(
                    '${vehicle.status.toUpperCase()} · ${vehicle.speed.toStringAsFixed(0)} km/h',
                    style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  if (vehicle.currentRoute != null)
                    Text('Route: ${vehicle.currentRoute}',
                        style: const TextStyle(fontSize: 12, color: AppColors.mapNeutral)),
                ],
              ),
            ),
            Column(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: color),
                ),
                const SizedBox(height: 4),
                Text(_timeSince(vehicle.lastSeen),
                    style: const TextStyle(fontSize: 11, color: AppColors.mapNeutral)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _timeSince(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }
}
