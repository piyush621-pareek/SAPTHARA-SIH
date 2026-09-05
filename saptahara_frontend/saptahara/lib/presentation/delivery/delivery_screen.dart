import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:saptahara/app/providers.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/core/i18n/i18n.dart';
import 'package:saptahara/domain/entities/entities.dart';

class DeliveryScreen extends ConsumerWidget {
  const DeliveryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final deliveries = ref.watch(deliveryProvider);
    final lang = ref.watch(languageProvider);

    return Scaffold(
      appBar: AppBar(title: Text(AppStrings.t('deliveries', lang))),
      body: deliveries.isEmpty
          ? Center(child: Text(AppStrings.t('noDeliveries', lang)))
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: deliveries.length,
              itemBuilder: (context, i) => _DeliveryCard(delivery: deliveries[i]),
            ),
    );
  }
}

class _DeliveryCard extends StatelessWidget {
  final DeliveryInfo delivery;
  const _DeliveryCard({required this.delivery});

  @override
  Widget build(BuildContext context) {
    final (color, icon) = switch (delivery.stage) {
      DeliveryStage.delivered => (AppColors.safeGreen, Icons.check_circle),
      DeliveryStage.inTransit => (Colors.blue, Icons.local_shipping),
      DeliveryStage.delayed => (AppColors.moderateOrange, Icons.warning_amber_rounded),
      DeliveryStage.cancelled => (AppColors.riskyRed, Icons.cancel),
      DeliveryStage.scheduled => (AppColors.mapNeutral, Icons.schedule),
    };

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.card),
        side: BorderSide(color: color.withOpacity(0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: color, size: 22),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(delivery.description,
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(delivery.stage.name.toUpperCase(),
                      style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 11)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.circle, size: 8, color: AppColors.safeGreen),
                const SizedBox(width: 6),
                Text(delivery.origin, style: const TextStyle(fontSize: 13)),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 6),
                  child: Icon(Icons.arrow_forward, size: 14, color: AppColors.mapNeutral),
                ),
                const Icon(Icons.flag, size: 12, color: AppColors.riskyRed),
                const SizedBox(width: 4),
                Expanded(child: Text(delivery.destination, style: const TextStyle(fontSize: 13))),
              ],
            ),
            const SizedBox(height: 6),
            Text('ETA: ${_fmt(delivery.eta)}',
                style: const TextStyle(fontSize: 12, color: AppColors.mapNeutral)),
            if (delivery.delayReason != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text('Delay: ${delivery.delayReason}',
                    style: const TextStyle(fontSize: 12, color: AppColors.moderateOrange, fontWeight: FontWeight.w600)),
              ),
          ],
        ),
      ),
    );
  }

  String _fmt(DateTime dt) {
    return '${dt.day}/${dt.month} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}
