import 'package:flutter/material.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/domain/entities/entities.dart';

/// Custom-painted mock map: draws risk-colored route polylines, current
/// position marker, and optional hazard/geofence overlays. No API key,
/// no network — purely local rendering so the app is demoable standalone.
class MockMap extends StatelessWidget {
  final List<RouteOption> routes;
  final String? highlightedRouteId;
  final List<HazardAlert> hazards;
  final Geofence? geofence;
  final MapStyle style;

  const MockMap({
    super.key,
    required this.routes,
    this.highlightedRouteId,
    this.hazards = const [],
    this.geofence,
    this.style = MapStyle.standard,
  });

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 16 / 11,
      child: CustomPaint(
        painter: _MockMapPainter(
          routes: routes,
          highlightedRouteId: highlightedRouteId,
          hazardCount: hazards.length,
          geofence: geofence,
          style: style,
        ),
        child: Stack(
          children: [
            for (final r in routes) _RouteLabel(route: r, highlighted: r.id == highlightedRouteId),
          ],
        ),
      ),
    );
  }
}

enum MapStyle { standard, terrain }

class _RouteLabel extends StatelessWidget {
  final RouteOption route;
  final bool highlighted;
  const _RouteLabel({required this.route, required this.highlighted});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final mid = route.geometry[route.geometry.length ~/ 2];
      return Positioned(
        left: mid.x * constraints.maxWidth - 4,
        top: mid.y * constraints.maxHeight - 26,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
          decoration: BoxDecoration(
            color: AppColors.white,
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: AppColors.black, width: highlighted ? 2 : 1.2),
          ),
          child: Text(
            '${route.name} – ${route.riskLevel.label}',
            style: TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w900,
              color: route.riskLevel.color,
            ),
          ),
        ),
      );
    });
  }
}

class _MockMapPainter extends CustomPainter {
  final List<RouteOption> routes;
  final String? highlightedRouteId;
  final int hazardCount;
  final Geofence? geofence;
  final MapStyle style;

  _MockMapPainter({
    required this.routes,
    required this.highlightedRouteId,
    required this.hazardCount,
    required this.geofence,
    required this.style,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // Base surface.
    final base = Paint()
      ..color = style == MapStyle.terrain ? const Color(0xFFCFE0C8) : AppColors.mapNeutral;
    canvas.drawRect(Offset.zero & size, base);

    // Faint grid to suggest terrain/streets without being decorative.
    final gridPaint = Paint()
      ..color = AppColors.black.withOpacity(0.05)
      ..strokeWidth = 1;
    for (double x = 0; x < size.width; x += size.width / 8) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
    }
    for (double y = 0; y < size.height; y += size.height / 6) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    // Geofence overlay (translucent fill + black outline).
    if (geofence != null) {
      final path = Path();
      final pts = geofence!.polygon;
      path.moveTo(pts.first.x * size.width, pts.first.y * size.height);
      for (final p in pts.skip(1)) {
        path.lineTo(p.x * size.width, p.y * size.height);
      }
      path.close();
      canvas.drawPath(path, Paint()..color = AppColors.riskyRed.withOpacity(0.18));
      canvas.drawPath(
        path,
        Paint()
          ..color = AppColors.black
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2,
      );
    }

    // Routes — draw non-highlighted first so the highlighted one sits on top.
    final ordered = [...routes]..sort((a, b) {
        if (a.id == highlightedRouteId) return 1;
        if (b.id == highlightedRouteId) return -1;
        return 0;
      });

    for (final route in ordered) {
      final isHighlighted = route.id == highlightedRouteId || highlightedRouteId == null;
      final path = Path();
      final pts = route.geometry;
      path.moveTo(pts.first.x * size.width, pts.first.y * size.height);
      for (final p in pts.skip(1)) {
        path.lineTo(p.x * size.width, p.y * size.height);
      }
      final paint = Paint()
        ..color = isHighlighted ? route.riskLevel.color : route.riskLevel.color.withOpacity(0.35)
        ..style = PaintingStyle.stroke
        ..strokeWidth = isHighlighted ? 6 : 4
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round;
      canvas.drawPath(path, paint);
      // Black casing for contrast, matching "thick outlined" reference style.
      canvas.drawPath(
        path,
        Paint()
          ..color = AppColors.black
          ..style = PaintingStyle.stroke
          ..strokeWidth = isHighlighted ? 8 : 6
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..blendMode = BlendMode.dstOver,
      );
    }

    // Current position marker.
    if (routes.isNotEmpty) {
      final start = routes.first.geometry.first;
      final center = Offset(start.x * size.width, start.y * size.height);
      canvas.drawCircle(center, 9, Paint()..color = AppColors.purpleTrust);
      canvas.drawCircle(
        center,
        9,
        Paint()
          ..color = AppColors.black
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2,
      );
      canvas.drawCircle(center, 3.5, Paint()..color = AppColors.white);
    }

    // Hazard markers (simple compact high-contrast dots along risky routes).
    for (final route in routes) {
      if (route.hazards.isEmpty) continue;
      final p = route.geometry[route.geometry.length - 2];
      final center = Offset(p.x * size.width, p.y * size.height);
      canvas.drawCircle(center, 7, Paint()..color = AppColors.riskyRed);
      canvas.drawCircle(
        center,
        7,
        Paint()
          ..color = AppColors.black
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _MockMapPainter oldDelegate) {
    return oldDelegate.highlightedRouteId != highlightedRouteId ||
        oldDelegate.routes != routes ||
        oldDelegate.geofence != geofence ||
        oldDelegate.style != style;
  }
}
