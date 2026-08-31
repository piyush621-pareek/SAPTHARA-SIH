import 'package:flutter/material.dart';
import 'package:saptahara/core/theme/app_theme.dart';

/// Base card used everywhere: solid fill, 12-18px radius, 2-3px black
/// outline, no gradients, no glassmorphism — per the reference UI spec.
class AppCard extends StatelessWidget {
  final Widget child;
  final Color color;
  final EdgeInsetsGeometry padding;
  final double radius;
  final VoidCallback? onTap;
  final Color borderColor;
  final double borderWidth;

  const AppCard({
    super.key,
    required this.child,
    this.color = AppColors.white,
    this.padding = const EdgeInsets.all(16),
    this.radius = AppRadii.card,
    this.onTap,
    this.borderColor = AppColors.black,
    this.borderWidth = 2.5,
  });

  @override
  Widget build(BuildContext context) {
    final card = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: borderColor, width: borderWidth),
      ),
      child: child,
    );
    if (onTap == null) return card;
    return InkWell(
      borderRadius: BorderRadius.circular(radius),
      onTap: onTap,
      child: card,
    );
  }
}

/// Pale-blue information panel — the large info card style from the spec.
class PanelBlueCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  const PanelBlueCard({super.key, required this.child, this.padding = const EdgeInsets.all(16)});

  @override
  Widget build(BuildContext context) {
    return AppCard(color: AppColors.panelBlue, padding: padding, child: child);
  }
}
