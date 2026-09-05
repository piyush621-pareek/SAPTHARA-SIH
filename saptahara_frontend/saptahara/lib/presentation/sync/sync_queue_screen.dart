import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:saptahara/app/providers.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/core/i18n/i18n.dart';
import 'package:saptahara/core/connectivity/connectivity_provider.dart';
import 'package:saptahara/domain/entities/entities.dart';
import 'package:saptahara/presentation/widgets/app_card.dart';

class SyncQueueScreen extends ConsumerWidget {
  const SyncQueueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(languageProvider);
    final outbox = ref.watch(syncControllerProvider);
    final reports = ref.watch(reportsControllerProvider);
    final connectivity = ref.watch(connectivityProvider);
    final isOnline = connectivity == ConnectivityState.online ||
        connectivity == ConnectivityState.syncing;

    final pending = outbox.where((j) => j.status != SyncStatus.synced).toList();
    final synced = outbox.where((j) => j.status == SyncStatus.synced).toList();

    return Scaffold(
      appBar: AppBar(
        title: Text(AppStrings.t('syncQueue', lang)),
        actions: [
          IconButton(
            icon: const Icon(Icons.sync),
            tooltip: 'Sync All Now',
            onPressed: isOnline
                ? () => ref.read(syncControllerProvider.notifier).flushAll()
                : null,
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Connection status banner
          AppCard(
            color: isOnline ? AppColors.safeGreen.withValues(alpha: 0.15) : AppColors.riskyRed.withValues(alpha: 0.15),
            child: Row(
              children: [
                Icon(
                  isOnline ? Icons.cloud_done : Icons.cloud_off,
                  color: isOnline ? AppColors.safeGreen : AppColors.riskyRed,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isOnline ? 'Online — Ready to Sync' : 'Offline — Reports Queued',
                        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
                      ),
                      Text(
                        '${pending.length} pending · ${synced.length} synced',
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                if (isOnline && pending.isNotEmpty)
                  ElevatedButton(
                    onPressed: () => ref.read(syncControllerProvider.notifier).flushAll(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.safeGreen,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadii.cardSm),
                        side: const BorderSide(color: AppColors.black, width: 1.6),
                      ),
                    ),
                    child: const Text('Sync Now',
                        style: TextStyle(color: AppColors.white, fontWeight: FontWeight.w900, fontSize: 12)),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Pending items
          if (pending.isNotEmpty) ...[
            Text('Pending (${pending.length})', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            ...pending.map((job) {
              final report = reports.where((r) => r.id == job.entityId).firstOrNull;
              return _SyncJobTile(job: job, report: report);
            }),
            const SizedBox(height: 16),
          ],
          // Synced items
          if (synced.isNotEmpty) ...[
            Text('Synced (${synced.length})', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            ...synced.map((job) {
              final report = reports.where((r) => r.id == job.entityId).firstOrNull;
              return _SyncJobTile(job: job, report: report);
            }),
          ],
          if (outbox.isEmpty)
            const AppCard(child: Text('No reports in the sync queue. Create a field report to see it here.')),
        ],
      ),
    );
  }
}

class _SyncJobTile extends StatelessWidget {
  final SyncJob job;
  final FieldReport? report;
  const _SyncJobTile({required this.job, this.report});

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (job.status) {
      SyncStatus.pending => AppColors.moderateOrange,
      SyncStatus.syncing => AppColors.panelBlue,
      SyncStatus.synced => AppColors.safeGreen,
      SyncStatus.failed => AppColors.riskyRed,
    };
    final statusIcon = switch (job.status) {
      SyncStatus.pending => Icons.schedule,
      SyncStatus.syncing => Icons.sync,
      SyncStatus.synced => Icons.check_circle,
      SyncStatus.failed => Icons.error,
    };
    final statusLabel = switch (job.status) {
      SyncStatus.pending => 'Queued',
      SyncStatus.syncing => 'Syncing…',
      SyncStatus.synced => 'Synced',
      SyncStatus.failed => 'Failed — will retry',
    };

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: AppCard(
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.2),
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.black, width: 1.4),
              ),
              child: Icon(statusIcon, color: statusColor, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    report != null
                        ? '${report!.type.label} Report'
                        : '${job.entityType} #${job.entityId.substring(0, 8)}',
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13),
                  ),
                  Text(
                    statusLabel,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                      color: statusColor,
                    ),
                  ),
                  if (report != null)
                    Text(
                      DateFormat('MMM d, HH:mm').format(report!.createdAt),
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 11),
                    ),
                ],
              ),
            ),
            if (job.retryCount > 0)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.riskyRed.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                  border: Border.all(color: AppColors.riskyRed, width: 1),
                ),
                child: Text('Retry ${job.retryCount}',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 10, color: AppColors.riskyRed)),
              ),
          ],
        ),
      ),
    );
  }
}
