import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/core/update/update_service.dart';

/// A slim banner shown at the top of the app when the backend reports a newer
/// build. Tapping "Update" opens the APK download so the user can install it —
/// no Play Store, no re-sending the file.
class UpdateBanner extends ConsumerWidget {
  const UpdateBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final info = ref.watch(updateCheckProvider).valueOrNull;
    if (info == null) return const SizedBox.shrink();
    return Material(
      color: AppColors.purpleTrust,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
          child: Row(
            children: [
              const Icon(Icons.system_update, color: AppColors.white, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Update available (v${info.version}) — ${info.notes}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.white, fontWeight: FontWeight.w700, fontSize: 12.5),
                ),
              ),
              const SizedBox(width: 6),
              ElevatedButton(
                onPressed: () async {
                  final uri = Uri.tryParse(info.apkUrl);
                  if (uri != null) {
                    await launchUrl(uri, mode: LaunchMode.externalApplication);
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: const Text('UPDATE',
                    style: TextStyle(color: AppColors.purpleTrust, fontWeight: FontWeight.w900, fontSize: 12)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
