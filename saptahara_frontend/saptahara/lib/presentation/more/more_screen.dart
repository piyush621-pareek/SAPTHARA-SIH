import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/core/i18n/i18n.dart';
import 'package:saptahara/presentation/fleet/fleet_screen.dart';
import 'package:saptahara/presentation/connectivity/connectivity_screen.dart';
import 'package:saptahara/presentation/delivery/delivery_screen.dart';
import 'package:saptahara/presentation/verification/verification_screen.dart';
import 'package:saptahara/presentation/mesh/mesh_screen.dart';
import 'package:saptahara/presentation/sync/sync_queue_screen.dart';
import 'package:saptahara/presentation/settings/settings_screen.dart';
import 'package:saptahara/presentation/profile/profile_screen.dart';

class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(languageProvider);

    return Scaffold(
      appBar: AppBar(title: Text(AppStrings.t('more', lang))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _Tile(
            icon: Icons.local_shipping,
            color: Colors.blue,
            title: AppStrings.t('fleet', lang),
            subtitle: 'Live vehicle positions',
            onTap: () => _push(context, const FleetScreen()),
          ),
          _Tile(
            icon: Icons.cell_tower,
            color: AppColors.moderateOrange,
            title: AppStrings.t('districtConnectivity', lang),
            subtitle: 'Road & network status by district',
            onTap: () => _push(context, const ConnectivityScreen()),
          ),
          _Tile(
            icon: Icons.inventory_2,
            color: AppColors.safeGreen,
            title: AppStrings.t('deliveries', lang),
            subtitle: 'Track supply deliveries',
            onTap: () => _push(context, const DeliveryScreen()),
          ),
          _Tile(
            icon: Icons.verified_user,
            color: Colors.deepPurple,
            title: AppStrings.t('verificationTrust', lang),
            subtitle: 'Ledger receipts for synced reports',
            onTap: () => _push(context, const VerificationScreen()),
          ),
          _Tile(
            icon: Icons.bluetooth,
            color: Colors.indigo,
            title: AppStrings.t('meshNetwork', lang),
            subtitle: 'Offline BLE mesh relay for no-network areas',
            onTap: () => _push(context, const MeshScreen()),
          ),
          _Tile(
            icon: Icons.sync,
            color: Colors.teal,
            title: AppStrings.t('syncQueue', lang),
            subtitle: 'Offline report queue & retry status',
            onTap: () => _push(context, const SyncQueueScreen()),
          ),
          const Divider(height: 32),
          _Tile(
            icon: Icons.settings,
            color: AppColors.mapNeutral,
            title: AppStrings.t('navSettings', lang),
            subtitle: 'Language, backend, notifications',
            onTap: () => _push(context, const SettingsScreen()),
          ),
          _Tile(
            icon: Icons.person,
            color: AppColors.mapNeutral,
            title: AppStrings.t('navProfile', lang),
            subtitle: 'Your account & sync status',
            onTap: () => _push(context, const ProfileScreen()),
          ),
        ],
      ),
    );
  }

  void _push(BuildContext context, Widget screen) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }
}

class _Tile extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _Tile({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.card)),
      child: ListTile(
        leading: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: color.withOpacity(0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: color, size: 24),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(subtitle, style: const TextStyle(fontSize: 12)),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
