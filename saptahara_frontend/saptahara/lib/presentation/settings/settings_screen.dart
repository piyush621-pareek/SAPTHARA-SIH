import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:saptahara/app/providers.dart';
import 'package:saptahara/core/network/api_config.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/core/i18n/i18n.dart';
import 'package:saptahara/core/connectivity/connectivity_provider.dart';
import 'package:saptahara/domain/entities/entities.dart';
import 'package:saptahara/presentation/widgets/app_card.dart';
import 'package:saptahara/presentation/widgets/mock_map.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});
  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _privacyExpanded = false;
  late final TextEditingController _backendCtrl =
      TextEditingController(text: ApiConfig.savedBackendUrl ?? '');

  @override
  void dispose() {
    _backendCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final connectivity = ref.watch(connectivityProvider);
    final notifications = ref.watch(notificationsEnabledProvider);
    final locationPermission = ref.watch(locationPermissionProvider);
    final mapStyle = ref.watch(mapStyleProvider);
    final apiEnv = ref.watch(apiEnvironmentProvider);
    final syncJobs = ref.watch(syncControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: [
            _sectionTitle(context, AppStrings.t('language', ref.watch(languageProvider))),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('App language / नोटिफिकेशन भाषा',
                      style: TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: AppStrings.supported.entries.map((e) {
                      final selected = ref.watch(languageProvider) == e.key;
                      return ChoiceChip(
                        label: Text(e.value),
                        selected: selected,
                        onSelected: (_) =>
                            ref.read(languageProvider.notifier).set(e.key),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            _sectionTitle(
                context, AppStrings.t('backendServer', ref.watch(languageProvider))),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Backend URL',
                      style: TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  const Text(
                    'On a real phone, enter your server PC\'s LAN IP (same Wi-Fi), '
                    'e.g. http://192.168.1.10:8080 . Restart the app after saving.',
                    style: TextStyle(fontSize: 11.5, color: AppColors.black),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _backendCtrl,
                    keyboardType: TextInputType.url,
                    decoration: const InputDecoration(
                      hintText: 'http://10.0.2.2:8080',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () async {
                            await ApiConfig.setBackendUrl(_backendCtrl.text);
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Backend URL saved. Restart the app.')),
                              );
                            }
                          },
                          child: const Text('Save'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton(
                        onPressed: () async {
                          await ApiConfig.setBackendUrl('');
                          _backendCtrl.clear();
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Reset to default. Restart the app.')),
                            );
                          }
                        },
                        child: const Text('Reset'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            _sectionTitle(context, 'Connectivity'),
            AppCard(
              child: SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Offline Mode', style: TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text(connectivity == ConnectivityState.offline
                    ? 'Simulating no network — cached data shown app-wide'
                    : 'App is online — live data + sync active'),
                value: connectivity == ConnectivityState.offline,
                activeColor: AppColors.riskyRed,
                onChanged: (v) => ref.read(connectivityProvider.notifier).setOfflineMode(v),
              ),
            ),
            const SizedBox(height: 10),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Data Sync', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 6),
                  Text('Outbox: ${syncJobs.where((j) => j.status != SyncStatus.synced).length} pending job(s)',
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5)),
                  const SizedBox(height: 10),
                  SizedBox(
                    height: 44,
                    child: ElevatedButton.icon(
                      onPressed: () => ref.read(syncControllerProvider.notifier).flushAll(),
                      icon: const Icon(Icons.sync, color: AppColors.white, size: 18),
                      label: const Text('SYNC NOW', style: TextStyle(color: AppColors.white, fontWeight: FontWeight.w900)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.purpleTrust,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppRadii.cardSm),
                          side: const BorderSide(color: AppColors.black, width: 2),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            _sectionTitle(context, 'Notifications'),
            AppCard(
              child: SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Enable Notifications', style: TextStyle(fontWeight: FontWeight.w800)),
                subtitle: const Text('Hazard, sync and SOS alerts'),
                value: notifications,
                activeColor: AppColors.safeGreen,
                onChanged: (v) => ref.read(notificationsEnabledProvider.notifier).state = v,
              ),
            ),
            const SizedBox(height: 20),
            _sectionTitle(context, 'Location Permission'),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    switch (locationPermission) {
                      LocationPermission.granted => 'Granted — live position enabled',
                      LocationPermission.denied => 'Denied — using manual location entry',
                      LocationPermission.unknown => 'Not yet requested',
                    },
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => ref.read(locationPermissionProvider.notifier).state = LocationPermission.granted,
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: AppColors.black, width: 1.8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.cardSm)),
                          ),
                          child: const Text('Grant', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.black)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => ref.read(locationPermissionProvider.notifier).state = LocationPermission.denied,
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: AppColors.black, width: 1.8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.cardSm)),
                          ),
                          child: const Text('Deny', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.black)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            _sectionTitle(context, 'Map Style'),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SegmentedButton<MapStyle>(
                    segments: const [
                      ButtonSegment(value: MapStyle.standard, label: Text('Standard')),
                      ButtonSegment(value: MapStyle.terrain, label: Text('Terrain')),
                    ],
                    selected: {mapStyle},
                    onSelectionChanged: (s) => ref.read(mapStyleProvider.notifier).state = s.first,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            _sectionTitle(context, 'Privacy & Security'),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  InkWell(
                    onTap: () => setState(() => _privacyExpanded = !_privacyExpanded),
                    child: Row(
                      children: [
                        const Expanded(
                          child: Text('How your field data is handled', style: TextStyle(fontWeight: FontWeight.w800)),
                        ),
                        Icon(_privacyExpanded ? Icons.expand_less : Icons.expand_more),
                      ],
                    ),
                  ),
                  if (_privacyExpanded) ...[
                    const SizedBox(height: 8),
                    const Text(
                      'Reports and SOS events are stored locally on this device until synced. '
                      'Location is only shared with your response team when a report is submitted '
                      'or SOS is triggered. Verification receipts are recorded on a tamper-evident '
                      'ledger once synced.',
                      style: TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),
            _sectionTitle(context, 'API Environment (dev builds only)'),
            AppCard(
              child: DropdownButtonFormField<ApiEnvironment>(
                value: apiEnv,
                decoration: const InputDecoration(border: InputBorder.none),
                items: const [
                  DropdownMenuItem(value: ApiEnvironment.dev, child: Text('Development')),
                  DropdownMenuItem(value: ApiEnvironment.staging, child: Text('Staging')),
                  DropdownMenuItem(value: ApiEnvironment.prod, child: Text('Production')),
                ],
                onChanged: (v) {
                  if (v != null) ref.read(apiEnvironmentProvider.notifier).state = v;
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(BuildContext context, String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8, top: 4),
        child: Text(text, style: Theme.of(context).textTheme.titleLarge),
      );
}
