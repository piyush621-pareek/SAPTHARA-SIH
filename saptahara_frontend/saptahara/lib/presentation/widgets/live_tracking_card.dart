import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:saptahara/app/telemetry.dart';
import 'package:saptahara/core/i18n/i18n.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/presentation/widgets/app_card.dart';

/// "Go online" control — starts/stops live GPS streaming to dispatch and shows
/// sync status (streaming, or N points cached offline awaiting sync).
class LiveTrackingCard extends ConsumerWidget {
  const LiveTrackingCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(telemetryProvider);
    final lang = ref.watch(languageProvider);
    final subtitle = t.streaming
        ? (t.pending > 0
            ? 'Streaming · ${t.pending} cached (syncing)'
            : t.lastOk
                ? AppStrings.t('streamingLive', lang)
                : 'Streaming · retrying…')
        : (t.pending > 0
            ? '${t.pending} points cached offline'
            : AppStrings.t('tapToGoOnline', lang));

    return AppCard(
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: (t.streaming ? AppColors.safeGreen : AppColors.black)
                  .withOpacity(0.12),
            ),
            child: Icon(
              t.streaming ? Icons.gps_fixed_rounded : Icons.gps_off_rounded,
              color: t.streaming ? AppColors.safeGreen : AppColors.black,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(AppStrings.t('liveTracking', lang),
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
                Text(subtitle,
                    style: const TextStyle(fontSize: 12, color: AppColors.black)),
              ],
            ),
          ),
          Switch(
            value: t.streaming,
            activeThumbColor: AppColors.safeGreen,
            onChanged: (_) => ref.read(telemetryProvider.notifier).toggle(),
          ),
        ],
      ),
    );
  }
}
