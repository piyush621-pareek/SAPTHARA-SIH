import 'package:flutter/material.dart';

/// Design tokens — matched to the SIH2026 reference UI.
/// pale blue panels / bold black outlines / rounded cards /
/// green-orange-red risk colors / lime nav / red SOS.
class AppColors {
  AppColors._();

  static const Color panelBlue = Color(0xFFB8C9DD);
  static const Color safeGreen = Color(0xFF347B2F);
  static const Color moderateOrange = Color(0xFFE5AE5E);
  static const Color riskyRed = Color(0xFFFF342E);
  static const Color limeNav = Color(0xFFBDE13F);
  static const Color purpleTrust = Color(0xFF6B43C9);
  static const Color mapNeutral = Color(0xFFDCDCD8);
  static const Color black = Color(0xFF111111);
  static const Color white = Color(0xFFFFFFFF);
}

class AppRadii {
  AppRadii._();
  static const double card = 16;
  static const double cardSm = 12;
  static const double cardLg = 18;
  static const double pill = 100;
}

class AppSpacing {
  AppSpacing._();
  static const double unit = 8;
  static double x(int n) => unit * n;
}

/// 2-3px black outline used on every card per spec.
class AppBorders {
  AppBorders._();
  static Border outline({double width = 2.5, Color color = AppColors.black}) =>
      Border.all(color: color, width: width);
}

class AppTheme {
  AppTheme._();

  static ThemeData get light {
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.safeGreen,
        primary: AppColors.safeGreen,
        error: AppColors.riskyRed,
      ),
      scaffoldBackgroundColor: AppColors.white,
      fontFamily: 'Roboto',
    );

    return base.copyWith(
      textTheme: base.textTheme.copyWith(
        headlineLarge: const TextStyle(
          fontWeight: FontWeight.w900,
          color: AppColors.black,
          fontSize: 28,
          letterSpacing: -0.5,
        ),
        headlineMedium: const TextStyle(
          fontWeight: FontWeight.w900,
          color: AppColors.black,
          fontSize: 22,
        ),
        titleLarge: const TextStyle(
          fontWeight: FontWeight.w800,
          color: AppColors.black,
          fontSize: 18,
        ),
        titleMedium: const TextStyle(
          fontWeight: FontWeight.w800,
          color: AppColors.black,
          fontSize: 16,
        ),
        bodyLarge: const TextStyle(
          fontWeight: FontWeight.w600,
          color: AppColors.black,
          fontSize: 15,
        ),
        bodyMedium: const TextStyle(
          fontWeight: FontWeight.w500,
          color: AppColors.black,
          fontSize: 13,
        ),
        labelLarge: const TextStyle(
          fontWeight: FontWeight.w900,
          color: AppColors.white,
          fontSize: 15,
          letterSpacing: 0.5,
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.white,
        foregroundColor: AppColors.black,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontWeight: FontWeight.w900,
          color: AppColors.black,
          fontSize: 20,
        ),
      ),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: AppColors.black,
        contentTextStyle: TextStyle(color: AppColors.white, fontWeight: FontWeight.w700),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

/// Risk level -> color mapping used across Home / Route screens.
enum RiskLevel { safe, moderate, risky }

extension RiskLevelX on RiskLevel {
  Color get color {
    switch (this) {
      case RiskLevel.safe:
        return AppColors.safeGreen;
      case RiskLevel.moderate:
        return AppColors.moderateOrange;
      case RiskLevel.risky:
        return AppColors.riskyRed;
    }
  }

  String get label {
    switch (this) {
      case RiskLevel.safe:
        return 'Safe';
      case RiskLevel.moderate:
        return 'Moderate Risk';
      case RiskLevel.risky:
        return 'Risky';
    }
  }
}
