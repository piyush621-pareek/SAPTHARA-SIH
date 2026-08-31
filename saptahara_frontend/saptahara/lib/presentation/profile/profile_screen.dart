import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:saptahara/app/providers.dart';
import 'package:saptahara/core/i18n/i18n.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/domain/entities/entities.dart';
import 'package:saptahara/presentation/widgets/app_card.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userAsync = ref.watch(currentUserProvider);
    final reports = ref.watch(reportsControllerProvider);
    final syncedReports = reports.where((r) => r.syncStatus == SyncStatus.synced).toList();
    final lang = ref.watch(languageProvider);

    return Scaffold(
      appBar: AppBar(title: Text(AppStrings.t('profileTitle', lang))),
      body: SafeArea(
        child: userAsync.when(
          data: (user) => ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            children: [
              AppCard(
                color: AppColors.panelBlue,
                child: Row(
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: AppColors.white,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.black, width: 2),
                      ),
                      child: const Icon(Icons.person, size: 30, color: AppColors.black),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(user.name, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17)),
                          const SizedBox(height: 2),
                          Text(user.role, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              _infoTile(context, 'Agency', user.agency),
              _infoTile(context, 'Field Team', user.team),
              const SizedBox(height: 20),
              Text(AppStrings.t('deviceStatus', lang), style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 10),
              AppCard(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: const [
                    _DeviceStatusChip(icon: Icons.gps_fixed, label: 'GPS', ok: true),
                    _DeviceStatusChip(icon: Icons.camera_alt, label: 'Camera', ok: true),
                    _DeviceStatusChip(icon: Icons.battery_5_bar, label: 'Battery 74%', ok: true),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Text(AppStrings.t('syncTitle', lang), style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 10),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${syncedReports.length} of ${reports.length} reports synced',
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    Text(
                      syncedReports.isEmpty
                          ? 'No successful sync yet'
                          : 'Last sync: ${DateFormat('MMM d, HH:mm').format(syncedReports.first.createdAt)}',
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Text(AppStrings.t('verificationTrust', lang), style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 10),
              _VerificationCard(reportId: reports.isNotEmpty ? reports.first.id : null),
            ],
          ),
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, st) => const Center(child: Text('Failed to load profile')),
        ),
      ),
    );
  }

  Widget _infoTile(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: AppCard(
        child: Row(
          children: [
            Text('$label: ', style: const TextStyle(fontWeight: FontWeight.w800)),
            Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w600))),
          ],
        ),
      ),
    );
  }
}

class _DeviceStatusChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool ok;
  const _DeviceStatusChip({required this.icon, required this.label, required this.ok});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: ok ? AppColors.safeGreen : AppColors.riskyRed,
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.black, width: 1.8),
          ),
          child: Icon(icon, color: AppColors.white, size: 20),
        ),
        const SizedBox(height: 6),
        Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11)),
      ],
    );
  }
}

class _VerificationCard extends ConsumerStatefulWidget {
  final String? reportId;
  const _VerificationCard({required this.reportId});

  @override
  ConsumerState<_VerificationCard> createState() => _VerificationCardState();
}

class _VerificationCardState extends ConsumerState<_VerificationCard> {
  VerificationReceipt? _receipt;
  bool _loading = false;

  Future<void> _load() async {
    if (widget.reportId == null) return;
    setState(() => _loading = true);
    final receipt = await ref.read(verificationRepositoryProvider).getReceipt(widget.reportId!);
    setState(() {
      _receipt = receipt;
      _loading = false;
    });
  }

  void _viewReceipt() {
    if (_receipt == null) return;
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.cardLg)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Verification Receipt', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
            const SizedBox(height: 10),
            Text('Status: ${_receipt!.status.name}', style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text('Tx Hash: ${_receipt!.transactionHash}', style: const TextStyle(fontSize: 12)),
            const SizedBox(height: 6),
            Text('Timestamp: ${DateFormat('MMM d, HH:mm:ss').format(_receipt!.timestamp)}',
                style: const TextStyle(fontSize: 12)),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.reportId == null) {
      return const AppCard(child: Text('No reports yet to verify.'));
    }
    return AppCard(
      color: AppColors.purpleTrust,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.verified_user, color: AppColors.white),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  _receipt == null
                      ? 'Blockchain verification not yet checked'
                      : 'Status: ${_receipt!.status.name.toUpperCase()}',
                  style: const TextStyle(color: AppColors.white, fontWeight: FontWeight.w900),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 44,
            child: ElevatedButton(
              onPressed: _loading ? null : (_receipt == null ? _load : _viewReceipt),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadii.cardSm),
                  side: const BorderSide(color: AppColors.black, width: 1.8),
                ),
              ),
              child: Text(
                _loading ? 'Checking…' : (_receipt == null ? 'Check Verification' : 'View Receipt'),
                style: const TextStyle(color: AppColors.black, fontWeight: FontWeight.w900),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
