import 'package:flutter/material.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/domain/entities/entities.dart';

/// Full-screen critical alert overlay for severe hazard/SOS events.
Future<void> showCriticalAlertOverlay(BuildContext context, HazardAlert alert) {
  return showGeneralDialog(
    context: context,
    barrierDismissible: false,
    barrierColor: AppColors.black.withOpacity(0.75),
    pageBuilder: (context, _, __) {
      return SafeArea(
        child: Center(
          child: Container(
            margin: const EdgeInsets.all(24),
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.riskyRed,
              borderRadius: BorderRadius.circular(AppRadii.cardLg),
              border: Border.all(color: AppColors.black, width: 3),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.warning_amber_rounded, color: AppColors.white, size: 52),
                const SizedBox(height: 12),
                Text(
                  alert.title.toUpperCase(),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.white, fontWeight: FontWeight.w900, fontSize: 20),
                ),
                const SizedBox(height: 10),
                Text(
                  alert.detail,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.white, fontWeight: FontWeight.w600, fontSize: 14),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  height: 50,
                  child: ElevatedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadii.card),
                        side: const BorderSide(color: AppColors.black, width: 2),
                      ),
                    ),
                    child: const Text('ACKNOWLEDGE',
                        style: TextStyle(color: AppColors.black, fontWeight: FontWeight.w900)),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}
