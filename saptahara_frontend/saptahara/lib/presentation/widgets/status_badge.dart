import 'package:flutter/material.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/domain/entities/entities.dart';

class SyncStatusBadge extends StatelessWidget {
  final SyncStatus status;
  const SyncStatusBadge({super.key, required this.status});

  Color get _color {
    switch (status) {
      case SyncStatus.pending:
        return AppColors.moderateOrange;
      case SyncStatus.syncing:
        return AppColors.purpleTrust;
      case SyncStatus.synced:
        return AppColors.safeGreen;
      case SyncStatus.failed:
        return AppColors.riskyRed;
    }
  }

  String get _label {
    switch (status) {
      case SyncStatus.pending:
        return 'PENDING';
      case SyncStatus.syncing:
        return 'SYNCING';
      case SyncStatus.synced:
        return 'SYNCED';
      case SyncStatus.failed:
        return 'FAILED';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: _color,
        borderRadius: BorderRadius.circular(AppRadii.pill),
        border: Border.all(color: AppColors.black, width: 1.6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (status == SyncStatus.syncing)
            const SizedBox(
              width: 10,
              height: 10,
              child: CircularProgressIndicator(strokeWidth: 1.8, color: AppColors.white),
            )
          else
            const SizedBox.shrink(),
          if (status == SyncStatus.syncing) const SizedBox(width: 6),
          Text(
            _label,
            style: const TextStyle(
              color: AppColors.white,
              fontWeight: FontWeight.w900,
              fontSize: 10.5,
              letterSpacing: 0.4,
            ),
          ),
        ],
      ),
    );
  }
}

class LiveStatusPill extends StatelessWidget {
  final LiveStatus status;
  const LiveStatusPill({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    late Color color;
    late String label;
    switch (status) {
      case LiveStatus.live:
        color = AppColors.safeGreen;
        label = 'LIVE';
        break;
      case LiveStatus.reconnecting:
        color = AppColors.moderateOrange;
        label = 'RECONNECTING';
        break;
      case LiveStatus.offline:
        color = AppColors.riskyRed;
        label = 'OFFLINE';
        break;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(AppRadii.pill),
        border: Border.all(color: AppColors.black, width: 1.8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 11)),
        ],
      ),
    );
  }
}
