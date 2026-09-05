import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:saptahara/app/providers.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/core/i18n/i18n.dart';
import 'package:saptahara/domain/entities/entities.dart';
import 'package:saptahara/data/repositories/api_repositories.dart';

class VerificationScreen extends ConsumerWidget {
  const VerificationScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reports = ref.watch(reportsControllerProvider);
    final lang = ref.watch(languageProvider);
    final synced = reports.where((r) => r.syncStatus == SyncStatus.synced).toList();

    return Scaffold(
      appBar: AppBar(title: Text(AppStrings.t('verificationTrust', lang))),
      body: synced.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.verified_user_outlined, size: 64, color: AppColors.mapNeutral),
                  const SizedBox(height: 12),
                  Text(AppStrings.t('noVerifiedReports', lang),
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.mapNeutral, fontSize: 15)),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: synced.length,
              itemBuilder: (context, i) => _ReceiptCard(report: synced[i]),
            ),
    );
  }
}

class _ReceiptCard extends StatelessWidget {
  final FieldReport report;
  const _ReceiptCard({required this.report});

  @override
  Widget build(BuildContext context) {
    final receipt = ReceiptStore.instance.get(report.id);
    final hash = receipt?.transactionHash ?? 'pending';
    final verified = receipt?.status == VerificationStatus.verified;

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.card),
        side: BorderSide(
          color: verified ? AppColors.safeGreen : AppColors.moderateOrange,
          width: 1.5,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  verified ? Icons.verified : Icons.hourglass_top,
                  color: verified ? AppColors.safeGreen : AppColors.moderateOrange,
                  size: 22,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '${report.type.label} Report',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                  ),
                ),
                Text(
                  verified ? 'VERIFIED' : 'PENDING',
                  style: TextStyle(
                    color: verified ? AppColors.safeGreen : AppColors.moderateOrange,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            _hashRow('Ledger Hash', hash),
            const SizedBox(height: 4),
            _hashRow('Report ID', report.id),
            if (receipt != null) ...[
              const SizedBox(height: 4),
              Text(
                'Anchored: ${_fmt(receipt.timestamp)}',
                style: const TextStyle(fontSize: 12, color: AppColors.mapNeutral),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _hashRow(String label, String value) {
    final display = value.length > 20 ? '${value.substring(0, 10)}...${value.substring(value.length - 8)}' : value;
    return Row(
      children: [
        Text('$label: ', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
        Expanded(
          child: Text(display,
              style: const TextStyle(fontSize: 12, fontFamily: 'monospace', color: AppColors.mapNeutral)),
        ),
      ],
    );
  }

  String _fmt(DateTime dt) {
    return '${dt.day}/${dt.month}/${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}
