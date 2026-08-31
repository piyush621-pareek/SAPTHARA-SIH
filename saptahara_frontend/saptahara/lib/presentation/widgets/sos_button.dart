import 'package:flutter/material.dart';
import 'package:saptahara/core/theme/app_theme.dart';

/// Full-width red rounded SOS button, uppercase white text.
/// Deliberate confirmation happens in the caller (bottom sheet) —
/// this widget just fires [onPressed] when tapped.
class SosButton extends StatelessWidget {
  final VoidCallback onPressed;
  const SosButton({super.key, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 58,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.riskyRed,
          foregroundColor: AppColors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.cardLg),
            side: const BorderSide(color: AppColors.black, width: 2.5),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(Icons.emergency_share, color: AppColors.white),
            SizedBox(width: 10),
            Text(
              'SEND SOS',
              style: TextStyle(
                color: AppColors.white,
                fontWeight: FontWeight.w900,
                fontSize: 18,
                letterSpacing: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
