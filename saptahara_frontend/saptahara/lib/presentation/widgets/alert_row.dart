import 'package:flutter/material.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/domain/entities/entities.dart';

class AlertRow extends StatelessWidget {
  final HazardAlert alert;
  final VoidCallback onTap;

  const AlertRow({super.key, required this.alert, required this.onTap});

  IconData get _icon {
    switch (alert.type) {
      case 'landslide':
        return Icons.terrain;
      case 'flood':
        return Icons.water;
      case 'roadblock':
        return Icons.block;
      case 'network':
        return Icons.signal_cellular_connected_no_internet_0_bar;
      default:
        return Icons.info_outline;
    }
  }

  Color get _severityColor {
    switch (alert.severity) {
      case AlertSeverity.critical:
        return AppColors.riskyRed;
      case AlertSeverity.warning:
        return AppColors.moderateOrange;
      case AlertSeverity.info:
        return AppColors.panelBlue;
    }
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadii.cardSm),
      child: Container(
        constraints: const BoxConstraints(minHeight: 44),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(AppRadii.cardSm),
          border: Border.all(color: AppColors.black, width: 2),
        ),
        margin: const EdgeInsets.only(bottom: 10),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: _severityColor,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.black, width: 1.6),
              ),
              child: Icon(_icon, size: 19, color: AppColors.black),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(alert.title, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 2),
                  Text(
                    alert.detail,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.black),
          ],
        ),
      ),
    );
  }
}
