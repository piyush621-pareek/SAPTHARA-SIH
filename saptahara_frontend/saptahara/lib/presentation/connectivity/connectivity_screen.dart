import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:saptahara/app/providers.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/core/i18n/i18n.dart';
import 'package:saptahara/domain/entities/entities.dart';

class ConnectivityScreen extends ConsumerWidget {
  const ConnectivityScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final districts = ref.watch(districtStatusProvider);
    final lang = ref.watch(languageProvider);

    return Scaffold(
      appBar: AppBar(title: Text(AppStrings.t('districtConnectivity', lang))),
      body: districts.isEmpty
          ? Center(child: Text(AppStrings.t('noDistrictData', lang)))
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: districts.length,
              itemBuilder: (context, i) => _DistrictTile(district: districts[i]),
            ),
    );
  }
}

class _DistrictTile extends StatelessWidget {
  final DistrictStatus district;
  const _DistrictTile({required this.district});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.card)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(district.name,
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                ),
                Text(district.state,
                    style: const TextStyle(fontSize: 12, color: AppColors.mapNeutral)),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                _StatusChip(label: 'Road', status: district.road),
                const SizedBox(width: 8),
                _StatusChip(label: 'Network', status: district.network),
                const Spacer(),
                Text('${district.openRoutes}/${district.totalRoutes} routes open',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              ],
            ),
            if (district.note != null) ...[
              const SizedBox(height: 6),
              Text(district.note!,
                  style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic)),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String label;
  final ConnStatus status;
  const _StatusChip({required this.label, required this.status});

  @override
  Widget build(BuildContext context) {
    final (color, text) = switch (status) {
      ConnStatus.good => (AppColors.safeGreen, 'OK'),
      ConnStatus.degraded => (AppColors.moderateOrange, 'Slow'),
      ConnStatus.down => (AppColors.riskyRed, 'Down'),
      ConnStatus.unknown => (AppColors.mapNeutral, '?'),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color, width: 1),
      ),
      child: Text('$label: $text',
          style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12)),
    );
  }
}
