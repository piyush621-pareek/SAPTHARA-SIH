import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/core/connectivity/connectivity_provider.dart';
import 'package:saptahara/domain/entities/entities.dart';

class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final connectivity = ref.watch(connectivityProvider);
    if (connectivity != ConnectivityState.offline) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      color: AppColors.moderateOrange,
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: const [
          Icon(Icons.cloud_off, size: 16, color: AppColors.black),
          SizedBox(width: 8),
          Text(
            'Working in Offline Mode — showing last known data',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, color: AppColors.black),
          ),
        ],
      ),
    );
  }
}
